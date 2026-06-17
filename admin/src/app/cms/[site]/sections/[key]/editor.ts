// Form-state <-> stored-JSON conversion for the schema-driven section editor.
// We drop the Go server's form-name protocol (cms/dict.go decodeSectionForm)
// and edit a plain JS object directly, but the STORED JSON shapes must match Go
// exactly: stringlist/paragraphs -> string[], pairs -> [string,string][], list
// -> object[], object -> nested object, empty lists -> [] (not null), readOnly
// fields round-trip unchanged.

import type { Field } from "../../../types";

// EditorValue is the in-memory editing shape per field, keyed by field.key.
// Scalars are strings; stringlist/paragraphs are edited as a single multiline
// string (joined by "\n" / "\n\n") then split on save, matching Go's
// joinLines/joinParagraphs + splitLines/splitParagraphs round-trip. object is a
// nested record; list is an array of records; pairs is an array of [a, b].
export type EditorObject = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// joinLines mirrors cms/dict.go joinLines: one entry per line.
function joinLines(v: unknown): string {
  return asArray(v)
    .filter((x): x is string => typeof x === "string")
    .join("\n");
}

// joinParagraphs mirrors cms/dict.go joinParagraphs: blank-line separated.
function joinParagraphs(v: unknown): string {
  return asArray(v)
    .filter((x): x is string => typeof x === "string")
    .join("\n\n");
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, "\n");
}

// splitLines mirrors cms/dict.go splitLines: trim each line, drop blanks, never
// null.
function splitLines(s: string): string[] {
  const out: string[] = [];
  for (const line of normalizeNewlines(s).split("\n")) {
    const t = line.trim();
    if (t !== "") out.push(t);
  }
  return out;
}

// splitParagraphs mirrors cms/dict.go splitParagraphs: split on blank lines,
// collapse interior newlines to spaces, never null.
function splitParagraphs(s: string): string[] {
  const out: string[] = [];
  for (const part of normalizeNewlines(s).split(/\n\s*\n/)) {
    const t = part.trim();
    if (t !== "") out.push(t.replace(/\n/g, " "));
  }
  return out;
}

// toEditor builds the editing object from a stored draft object + the schema.
// Lists/pairs keep their items so the UI can render and reorder them.
export function toEditor(fields: Field[], obj: EditorObject): EditorObject {
  const out: EditorObject = {};
  for (const f of fields) {
    const raw = obj[f.key];
    switch (f.type) {
      case "text":
      case "textarea":
      case "image":
      case "select":
        out[f.key] = asString(raw);
        break;
      case "stringlist":
        out[f.key] = joinLines(raw);
        break;
      case "paragraphs":
        out[f.key] = joinParagraphs(raw);
        break;
      case "object":
        out[f.key] = toEditor(
          f.fields ?? [],
          (typeof raw === "object" && raw !== null && !Array.isArray(raw)
            ? (raw as EditorObject)
            : {})
        );
        break;
      case "list":
        out[f.key] = asArray(raw).map((it) =>
          toEditor(
            f.fields ?? [],
            typeof it === "object" && it !== null && !Array.isArray(it)
              ? (it as EditorObject)
              : {}
          )
        );
        break;
      case "pairs":
        out[f.key] = asArray(raw).map((it) => {
          const pair = asArray(it);
          return [asString(pair[0]), asString(pair[1])] as [string, string];
        });
        break;
    }
  }
  return out;
}

// fromEditor converts the editing object back to the stored JSON shape. readOnly
// fields are copied through unchanged from the original draft so they
// round-trip.
export function fromEditor(
  fields: Field[],
  editor: EditorObject,
  original: EditorObject
): EditorObject {
  const out: EditorObject = {};
  for (const f of fields) {
    const v = editor[f.key];
    if (f.readOnly) {
      // Preserve the original stored value untouched.
      out[f.key] = original[f.key];
      continue;
    }
    switch (f.type) {
      case "text":
      case "image":
      case "select":
        out[f.key] = asString(v).trim();
        break;
      case "textarea":
        out[f.key] = normalizeNewlines(asString(v)).trim();
        break;
      case "stringlist":
        out[f.key] = splitLines(asString(v));
        break;
      case "paragraphs":
        out[f.key] = splitParagraphs(asString(v));
        break;
      case "object": {
        const sub = (typeof v === "object" && v !== null && !Array.isArray(v)
          ? (v as EditorObject)
          : {}) as EditorObject;
        const origSub = (typeof original[f.key] === "object" &&
        original[f.key] !== null &&
        !Array.isArray(original[f.key])
          ? (original[f.key] as EditorObject)
          : {}) as EditorObject;
        out[f.key] = fromEditor(f.fields ?? [], sub, origSub);
        break;
      }
      case "list": {
        const items = asArray(v);
        const origItems = asArray(original[f.key]);
        out[f.key] = items.map((it, i) => {
          const itObj = (typeof it === "object" && it !== null && !Array.isArray(it)
            ? (it as EditorObject)
            : {}) as EditorObject;
          const origItem = (typeof origItems[i] === "object" &&
          origItems[i] !== null &&
          !Array.isArray(origItems[i])
            ? (origItems[i] as EditorObject)
            : {}) as EditorObject;
          return fromEditor(f.fields ?? [], itObj, origItem);
        });
        break;
      }
      case "pairs":
        out[f.key] = asArray(v).map((it) => {
          const pair = asArray(it);
          return [asString(pair[0]).trim(), asString(pair[1]).trim()] as [
            string,
            string
          ];
        });
        break;
    }
  }
  return out;
}

// emptyListItem builds a blank list item for the "add" action, matching
// cms/dict.go applyListAction: stringlist/paragraphs subfields start as "" in
// the editor (joined form), other scalars "".
export function emptyListItem(fields: Field[]): EditorObject {
  const item: EditorObject = {};
  for (const f of fields) {
    switch (f.type) {
      case "object":
        item[f.key] = emptyListItem(f.fields ?? []);
        break;
      case "list":
      case "pairs":
        item[f.key] = [];
        break;
      default:
        item[f.key] = "";
    }
  }
  return item;
}
