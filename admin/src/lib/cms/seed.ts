// Section schemas are developer-owned: they live here in code (ported from
// cms/seed.go's leaSections) and are upserted on every boot, so deploying a
// schema change updates the admin forms in place while content stays in the
// database. When a site's Dict type changes, change the matching section here
// in the same commit. The live DB already has these rows, so upsertSeed is
// optional/idempotent.

import { cmsPool as pool } from "@/lib/db";
import { randomBytes } from "crypto";

// Field describes one editable value inside a section. The schema drives both
// the admin form rendering and JSON decoding, so the stored JSON always matches
// the shape the site's build expects (cms/model.go Field).
export interface Field {
  key: string;
  type: FieldType;
  label: string;
  readOnly?: boolean;
  fields?: Field[]; // subfields for object/list
  options?: string[]; // allowed values for select
}

// The 9 field types (cms/model.go field constants).
export const fieldText = "text" as const;
export const fieldTextarea = "textarea" as const;
export const fieldStringlist = "stringlist" as const; // string[], one per line
export const fieldParagraphs = "paragraphs" as const; // string[], blank-line separated
export const fieldObject = "object" as const; // fixed named subfields
export const fieldList = "list" as const; // repeatable group of flat fields
export const fieldPairs = "pairs" as const; // [string, string][] label/value tuples
export const fieldImage = "image" as const; // asset URL string
export const fieldSelect = "select" as const; // one string from `options` (a dropdown)

export type FieldType =
  | typeof fieldText
  | typeof fieldTextarea
  | typeof fieldStringlist
  | typeof fieldParagraphs
  | typeof fieldObject
  | typeof fieldList
  | typeof fieldPairs
  | typeof fieldImage
  | typeof fieldSelect;

// SeedSection is a section schema definition (cms/model.go Section, minus the
// DB-assigned id/siteId/position which are set during upsert).
export interface SeedSection {
  key: string;
  title: string;
  pageGroup: string;
  localized: boolean;
  flatten?: boolean;
  fields: Field[];
}

function newId(): string {
  return randomBytes(16).toString("hex");
}

// upsertSections upserts an arbitrary list of section schemas by (site, key),
// assigning positions in array order. The generic primitive behind the CMS
// service API's sections.upsert (consumers like practa pass their preset's
// sections); upsertSeedSections is just this with leaSections().
export async function upsertSections(
  siteId: string,
  sections: SeedSection[]
): Promise<void> {
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    await pool.query(
      `INSERT INTO sections (id, site_id, key, title, page_group, position, localized, flatten, schema)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (site_id, key) DO UPDATE SET
         title=EXCLUDED.title, page_group=EXCLUDED.page_group, position=EXCLUDED.position,
         localized=EXCLUDED.localized, flatten=EXCLUDED.flatten, schema=EXCLUDED.schema`,
      [
        newId(),
        siteId,
        sec.key,
        sec.title,
        sec.pageGroup,
        i,
        sec.localized,
        sec.flatten ?? false,
        JSON.stringify(sec.fields),
      ]
    );
  }
}
