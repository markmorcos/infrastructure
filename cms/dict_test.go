package main

import (
	"encoding/json"
	"net/url"
	"reflect"
	"testing"
)

// Round-trip: a locale dictionary exploded into sections and reassembled must
// come back identical, including flatten and non-localized handling.
func TestExplodeAssembleRoundTrip(t *testing.T) {
	sections := leaSections()
	for i := range sections {
		sections[i].ID = sections[i].Key // stand-in ids
	}

	dict := map[string]any{
		"nav":       []any{map[string]any{"id": "ueber", "label": "Über mich"}},
		"cta":       "Termin anfragen",
		"moreAbout": "Mehr über mich",
		"hero": map[string]any{
			"eyebrow": "e", "title": "t", "lead": "l", "note": "n",
			"meta": []any{"a", "b"},
		},
		"faq": map[string]any{
			"eyebrow": "F", "title": "FAQ",
			"items": []any{map[string]any{"q": "Q1", "a": "A1"}},
		},
		"impressum": map[string]any{
			"eyebrow": "R", "title": "Impressum", "note": "n",
			"rows": []any{[]any{"Name", "Lea"}},
		},
		"media": map[string]any{"portraitUrl": "https://cdn.morcos.tech/cms/lea/x.jpg"},
	}

	exploded, err := explodeDict(sections, dict)
	if err != nil {
		t.Fatalf("explode: %v", err)
	}
	content := map[string]map[string]json.RawMessage{}
	for key, obj := range exploded {
		var sec Section
		for _, s := range sections {
			if s.Key == key {
				sec = s
			}
		}
		raw, _ := json.Marshal(obj)
		locale := "de"
		if !sec.Localized {
			locale = localeAll
		}
		content[sec.ID] = map[string]json.RawMessage{locale: raw}
	}

	got := assembleDict(sections, content, "de")
	// JSON round-trip both sides to normalize types before comparing.
	want := jsonNorm(t, dict)
	if !reflect.DeepEqual(jsonNorm(t, got), want) {
		t.Fatalf("round trip mismatch:\n got: %#v\nwant: %#v", got, want)
	}
}

func TestExplodeRejectsUnknownKey(t *testing.T) {
	if _, err := explodeDict(leaSections(), map[string]any{"bogus": map[string]any{}}); err == nil {
		t.Fatal("expected error for unknown top-level key")
	}
}

func TestDecodeSectionFormAndActions(t *testing.T) {
	fields := []Field{
		f("title", fieldText, ""),
		f("bio", fieldParagraphs, ""),
		f("meta", fieldStringlist, ""),
		group("items", fieldList, "", f("q", fieldText, ""), f("a", fieldTextarea, "")),
		group("rows", fieldPairs, ""),
	}
	form := url.Values{
		"f.title":         {" Hello "},
		"f.bio":           {"Para one\r\n\r\nPara two\nstill two"},
		"f.meta":          {"one\n\ntwo\n"},
		"f.items.__count": {"2"},
		"f.items.0.q":     {"Q1"},
		"f.items.0.a":     {"A1"},
		"f.items.1.q":     {"Q2"},
		"f.items.1.a":     {"A2"},
		"f.rows.__count":  {"1"},
		"f.rows.0.0":      {"Name"},
		"f.rows.0.1":      {"Lea"},
	}
	obj := decodeSectionForm(fields, form)
	want := map[string]any{
		"title": "Hello",
		"bio":   []string{"Para one", "Para two still two"},
		"meta":  []string{"one", "two"},
		"items": []any{
			map[string]any{"q": "Q1", "a": "A1"},
			map[string]any{"q": "Q2", "a": "A2"},
		},
		"rows": []any{[]any{"Name", "Lea"}},
	}
	if !reflect.DeepEqual(jsonNorm(t, obj), jsonNorm(t, want)) {
		t.Fatalf("decode mismatch:\n got: %#v\nwant: %#v", obj, want)
	}

	applyListAction(obj, fields, "up:items:1")
	items := obj["items"].([]any)
	if items[0].(map[string]any)["q"] != "Q2" {
		t.Fatalf("up action failed: %#v", items)
	}
	applyListAction(obj, fields, "del:items:0")
	if len(obj["items"].([]any)) != 1 {
		t.Fatalf("del action failed: %#v", obj["items"])
	}
	applyListAction(obj, fields, "add:items")
	items = obj["items"].([]any)
	if len(items) != 2 || items[1].(map[string]any)["q"] != "" {
		t.Fatalf("add action failed: %#v", items)
	}
	applyListAction(obj, fields, "add:rows")
	if len(obj["rows"].([]any)) != 2 {
		t.Fatalf("add pairs failed: %#v", obj["rows"])
	}
}

func jsonNorm(t *testing.T, v any) any {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return out
}
