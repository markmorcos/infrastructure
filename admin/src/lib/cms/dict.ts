// Content dictionary assembly, ported byte-for-byte from cms/dict.go's
// assembleDict. External sites consume the output, so flatten-vs-nest and the
// non-localized "*" merge are load-bearing and must match the Go service.

// localeAll is the pseudo-locale for non-localized sections (e.g. images),
// merged into every locale's assembled dictionary.
export const localeAll = "*";

// Section is the subset of a section definition needed to assemble a dict.
export interface DictSection {
  id: string;
  key: string;
  localized: boolean;
  flatten: boolean;
}

// ContentBySectionLocale maps sectionID -> locale -> the stored content value.
// A value is the already-parsed JSON object, or a raw JSON string/Buffer, or
// null/undefined when no row exists.
export type ContentValue = Record<string, unknown> | string | null | undefined;
export type ContentBySectionLocale = Record<
  string,
  Record<string, ContentValue>
>;

// parseObject normalizes a stored content value into an object, mirroring Go's
// json.Unmarshal into map[string]any: anything that isn't a JSON object (or that
// fails to parse) is skipped by returning null.
function parseObject(raw: ContentValue): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (raw === "") return null;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }
  return value as Record<string, unknown>;
}

// assembleDict builds the content dictionary for one locale from the site's
// sections: regular sections nest under their key, flatten sections spread into
// the root, and non-localized sections (stored under locale "*") are merged into
// every locale. Sections without content are skipped.
export function assembleDict(
  sections: DictSection[],
  content: ContentBySectionLocale,
  locale: string
): Record<string, unknown> {
  const dict: Record<string, unknown> = {};
  for (const sec of sections) {
    const loc = sec.localized ? locale : localeAll;
    const raw = content[sec.id]?.[loc];
    const obj = parseObject(raw);
    if (obj === null) continue;
    if (sec.flatten) {
      for (const k of Object.keys(obj)) {
        dict[k] = obj[k];
      }
    } else {
      dict[sec.key] = obj;
    }
  }
  return dict;
}
