package main

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

// ---- assembly: per-section JSON → full locale dictionary ----

// assembleDict builds the content dictionary for one locale from the site's
// sections: regular sections nest under their key, flatten sections spread
// into the root, and non-localized sections (stored under locale '*') are
// merged into every locale. Sections without content are skipped.
func assembleDict(sections []Section, content map[string]map[string]json.RawMessage, locale string) map[string]any {
	dict := map[string]any{}
	for _, sec := range sections {
		loc := locale
		if !sec.Localized {
			loc = localeAll
		}
		raw := content[sec.ID][loc]
		if raw == nil {
			continue
		}
		var obj map[string]any
		if err := json.Unmarshal(raw, &obj); err != nil {
			continue
		}
		if sec.Flatten {
			for k, v := range obj {
				dict[k] = v
			}
		} else {
			dict[sec.Key] = obj
		}
	}
	return dict
}

// explodeDict splits a full locale dictionary into per-section objects — the
// inverse of assembleDict. Unknown root keys are an error so an import can't
// silently drop content.
func explodeDict(sections []Section, dict map[string]any) (map[string]map[string]any, error) {
	out := map[string]map[string]any{}
	claimed := map[string]bool{}
	for _, sec := range sections {
		if sec.Flatten {
			obj := map[string]any{}
			for _, f := range sec.Fields {
				if v, ok := dict[f.Key]; ok {
					obj[f.Key] = v
					claimed[f.Key] = true
				}
			}
			if len(obj) > 0 {
				out[sec.Key] = obj
			}
			continue
		}
		v, ok := dict[sec.Key]
		if !ok {
			continue
		}
		obj, ok := v.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("section %q: expected an object", sec.Key)
		}
		out[sec.Key] = obj
		claimed[sec.Key] = true
	}
	for k := range dict {
		if !claimed[k] {
			return nil, fmt.Errorf("unknown top-level key %q — no matching section", k)
		}
	}
	return out, nil
}

// ---- form decoding: admin form values → section JSON ----

// Form field names follow the schema: "f.<key>" for scalars, "f.<key>.<sub>"
// for object subfields, "f.<key>.<i>.<sub>" for list items, and a hidden
// "f.<key>.__count" carries each list's current length.
const formPrefix = "f."

func decodeSectionForm(fields []Field, form url.Values) map[string]any {
	return decodeFields(fields, form, formPrefix)
}

func decodeFields(fields []Field, form url.Values, prefix string) map[string]any {
	obj := make(map[string]any, len(fields))
	for _, f := range fields {
		name := prefix + f.Key
		switch f.Type {
		case fieldText, fieldImage:
			obj[f.Key] = strings.TrimSpace(form.Get(name))
		case fieldTextarea:
			obj[f.Key] = strings.TrimSpace(normalizeNewlines(form.Get(name)))
		case fieldStringlist:
			obj[f.Key] = splitLines(form.Get(name))
		case fieldParagraphs:
			obj[f.Key] = splitParagraphs(form.Get(name))
		case fieldObject:
			obj[f.Key] = decodeFields(f.Fields, form, name+".")
		case fieldList:
			n := formCount(form, name)
			items := make([]any, 0, n)
			for i := 0; i < n; i++ {
				items = append(items, decodeFields(f.Fields, form, fmt.Sprintf("%s.%d.", name, i)))
			}
			obj[f.Key] = items
		case fieldPairs:
			n := formCount(form, name)
			items := make([]any, 0, n)
			for i := 0; i < n; i++ {
				items = append(items, []any{
					strings.TrimSpace(form.Get(fmt.Sprintf("%s.%d.0", name, i))),
					strings.TrimSpace(form.Get(fmt.Sprintf("%s.%d.1", name, i))),
				})
			}
			obj[f.Key] = items
		}
	}
	return obj
}

func formCount(form url.Values, name string) int {
	n, err := strconv.Atoi(form.Get(name + ".__count"))
	if err != nil || n < 0 {
		return 0
	}
	if n > 500 {
		n = 500
	}
	return n
}

func normalizeNewlines(s string) string {
	return strings.ReplaceAll(s, "\r\n", "\n")
}

func splitLines(s string) []string {
	var out []string
	for _, line := range strings.Split(normalizeNewlines(s), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			out = append(out, line)
		}
	}
	if out == nil {
		out = []string{}
	}
	return out
}

var blankLineRe = regexp.MustCompile(`\n\s*\n`)

func splitParagraphs(s string) []string {
	var out []string
	for _, p := range blankLineRe.Split(normalizeNewlines(s), -1) {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, strings.ReplaceAll(p, "\n", " "))
		}
	}
	if out == nil {
		out = []string{}
	}
	return out
}

func joinLines(v any) string {
	items, _ := v.([]any)
	var b strings.Builder
	for _, it := range items {
		if s, ok := it.(string); ok {
			b.WriteString(s)
			b.WriteString("\n")
		}
	}
	return b.String()
}

func joinParagraphs(v any) string {
	items, _ := v.([]any)
	parts := make([]string, 0, len(items))
	for _, it := range items {
		if s, ok := it.(string); ok {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, "\n\n")
}

// ---- list actions from the section form ----

// applyListAction mutates a decoded section object according to an
// "add:<key>" / "del:<key>:<i>" / "up:<key>:<i>" / "down:<key>:<i>" action
// fired by one of the list buttons inside the section form. The form is
// always decoded (= saved) first, so edits made before clicking are kept.
func applyListAction(obj map[string]any, fields []Field, action string) {
	parts := strings.Split(action, ":")
	if len(parts) < 2 {
		return
	}
	op, key := parts[0], parts[1]
	var field *Field
	for i := range fields {
		if fields[i].Key == key && (fields[i].Type == fieldList || fields[i].Type == fieldPairs) {
			field = &fields[i]
			break
		}
	}
	if field == nil {
		return
	}
	items, _ := obj[key].([]any)
	idx := -1
	if len(parts) == 3 {
		idx, _ = strconv.Atoi(parts[2])
	}
	switch op {
	case "add":
		if field.Type == fieldPairs {
			items = append(items, []any{"", ""})
		} else {
			item := map[string]any{}
			for _, sub := range field.Fields {
				switch sub.Type {
				case fieldStringlist, fieldParagraphs:
					item[sub.Key] = []string{}
				default:
					item[sub.Key] = ""
				}
			}
			items = append(items, item)
		}
	case "del":
		if idx >= 0 && idx < len(items) {
			items = append(items[:idx], items[idx+1:]...)
		}
	case "up":
		if idx > 0 && idx < len(items) {
			items[idx-1], items[idx] = items[idx], items[idx-1]
		}
	case "down":
		if idx >= 0 && idx < len(items)-1 {
			items[idx+1], items[idx] = items[idx], items[idx+1]
		}
	}
	obj[key] = items
}
