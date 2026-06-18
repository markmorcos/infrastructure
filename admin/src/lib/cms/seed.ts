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

// Field constructors mirroring cms/seed.go's f/ro/group helpers.
function f(key: string, type: FieldType, label: string): Field {
  return { key, type, label };
}
function ro(key: string, type: FieldType, label: string): Field {
  return { key, type, label, readOnly: true };
}
function group(
  key: string,
  type: FieldType,
  label: string,
  ...subs: Field[]
): Field {
  return { key, type, label, fields: subs };
}

// leaSections mirrors the Dict type in the Lea repo's src/content/content.ts.
// One section per top-level key; `general` (flatten) holds the root scalars and
// `media` (non-localized) holds images shared across locales. Ported 1:1 from
// cms/seed.go leaSections().
export function leaSections(): SeedSection[] {
  const step: Field[] = [
    f("n", fieldText, "Number"),
    f("title", fieldText, "Title"),
    f("body", fieldTextarea, "Text"),
  ];
  return [
    {
      key: "general",
      title: "General",
      pageGroup: "General",
      localized: true,
      flatten: true,
      fields: [
        group(
          "nav",
          fieldList,
          "Navigation",
          ro("id", fieldText, "ID (fixed)"),
          f("label", fieldText, "Label")
        ),
        f("cta", fieldText, "Main button (e.g. “Request an appointment”)"),
        f("moreAbout", fieldText, "“More about me” link"),
      ],
    },
    {
      key: "media",
      title: "Images",
      pageGroup: "General",
      localized: false,
      fields: [f("portraitUrl", fieldImage, "Portrait photo")],
    },
    {
      key: "footer",
      title: "Footer",
      pageGroup: "General",
      localized: true,
      fields: [
        f("tagline", fieldText, "Tagline"),
        f("legal", fieldStringlist, "Legal links (one per line)"),
        f("safety", fieldTextarea, "Safety notice"),
      ],
    },

    {
      key: "hero",
      title: "Hero",
      pageGroup: "Home",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        f("lead", fieldTextarea, "Lead text"),
        f("note", fieldText, "Name line"),
        f("meta", fieldStringlist, "Bullet points (one per line)"),
      ],
    },
    {
      key: "forWho",
      title: "Who it's for",
      pageGroup: "Home",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("body", fieldTextarea, "Text"),
      ],
    },
    {
      key: "aboutTeaser",
      title: "About teaser",
      pageGroup: "Home",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("body", fieldTextarea, "Text"),
        f("link", fieldText, "Link text"),
      ],
    },
    {
      key: "homeTopics",
      title: "Topics (home)",
      pageGroup: "Home",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        f("chips", fieldStringlist, "Topic chips (one per line)"),
        f("link", fieldText, "Link text"),
      ],
    },
    {
      key: "homeSteps",
      title: "Steps (home)",
      pageGroup: "Home",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        group("steps", fieldList, "Steps", ...step),
      ],
    },
    {
      key: "ctaBand",
      title: "Call-to-action banner",
      pageGroup: "Home",
      localized: true,
      fields: [
        f("text", fieldText, "Text"),
        f("cta", fieldText, "Button"),
      ],
    },

    {
      key: "about",
      title: "About",
      pageGroup: "About",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        f("bio", fieldParagraphs, "Bio (separate paragraphs with a blank line)"),
        f("qualTitle", fieldText, "Qualifications title"),
        f("quals", fieldStringlist, "Qualifications (one per line)"),
        group(
          "values",
          fieldList,
          "Values",
          ro("icon", fieldText, "Icon (fixed)"),
          f("label", fieldText, "Label")
        ),
      ],
    },

    {
      key: "services",
      title: "Services",
      pageGroup: "Services",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        group(
          "cards",
          fieldList,
          "Service cards",
          ro("icon", fieldText, "Icon (fixed)"),
          f("name", fieldText, "Name"),
          f("body", fieldTextarea, "Description"),
          f("badge", fieldText, "Badge")
        ),
        f("disclaimer", fieldTextarea, "Disclaimer"),
      ],
    },

    {
      key: "topics",
      title: "Topics",
      pageGroup: "Topics",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        f("lead", fieldTextarea, "Lead text"),
        group(
          "items",
          fieldList,
          "Topics",
          ro("icon", fieldText, "Icon (fixed)"),
          f("title", fieldText, "Title"),
          f("body", fieldTextarea, "Text")
        ),
        f("safety", fieldTextarea, "Safety notice"),
      ],
    },

    {
      key: "fees",
      title: "Process & fees",
      pageGroup: "Fees",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        f("ablaufTitle", fieldText, "Process title"),
        group("steps", fieldList, "Steps", ...step),
        f("costTitle", fieldText, "Fees title"),
        f("cost", fieldTextarea, "Fees text"),
        f("priceFigure", fieldText, "Price (e.g. 45 €)"),
        f("priceUnit", fieldText, "Unit (e.g. 50 minutes)"),
        f("insuranceTitle", fieldText, "Insurance title"),
        f("insurance", fieldTextarea, "Insurance text"),
      ],
    },

    {
      key: "booking",
      title: "Booking",
      pageGroup: "Booking",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        f("intro", fieldTextarea, "Intro"),
        f("schedulerLabel", fieldText, "Calendar label"),
        f("schedulerNote", fieldText, "Calendar note"),
        f("formTitle", fieldText, "Form title"),
        group(
          "fields",
          fieldObject,
          "Form fields",
          f("name", fieldText, "Name"),
          f("email", fieldText, "Email"),
          f("times", fieldText, "Preferred times"),
          f("message", fieldText, "Message")
        ),
        f("timesPlaceholder", fieldText, "Times placeholder"),
        f("consent", fieldTextarea, "Consent text"),
        f("submit", fieldText, "Submit button"),
      ],
    },

    {
      key: "contact",
      title: "Contact",
      pageGroup: "Contact",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        f("lead", fieldTextarea, "Lead text"),
        f("notice", fieldTextarea, "Notice"),
        group(
          "fields",
          fieldObject,
          "Form fields",
          f("name", fieldText, "Name"),
          f("email", fieldText, "Email"),
          f("phone", fieldText, "Phone"),
          f("message", fieldText, "Message")
        ),
        f("consent", fieldTextarea, "Consent text"),
        f("submit", fieldText, "Submit button"),
        f("errEmail", fieldText, "Email error message"),
        f("errConsent", fieldText, "Consent error message"),
        f("successTitle", fieldText, "Success title"),
        f("successBody", fieldText, "Success text"),
        f("sideTitle", fieldText, "Sidebar title"),
        group(
          "side",
          fieldList,
          "Sidebar",
          ro("icon", fieldText, "Icon (fixed)"),
          f("label", fieldText, "Text")
        ),
      ],
    },

    {
      key: "faq",
      title: "FAQ",
      pageGroup: "FAQ",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        group(
          "items",
          fieldList,
          "Questions",
          f("q", fieldText, "Question"),
          f("a", fieldTextarea, "Answer")
        ),
      ],
    },

    {
      key: "impressum",
      title: "Imprint (Impressum)",
      pageGroup: "Legal",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        group("rows", fieldPairs, "Entries"),
        f("note", fieldTextarea, "Note"),
      ],
    },
    {
      key: "datenschutz",
      title: "Privacy policy",
      pageGroup: "Legal",
      localized: true,
      fields: [
        f("eyebrow", fieldText, "Eyebrow"),
        f("title", fieldText, "Title"),
        f("intro", fieldTextarea, "Intro"),
        group(
          "sections",
          fieldList,
          "Sections",
          f("h", fieldText, "Heading"),
          f("b", fieldTextarea, "Text")
        ),
      ],
    },
  ];
}

function newId(): string {
  return randomBytes(16).toString("hex");
}

// upsertSeedSections creates or updates the seed section schemas for a site by
// (site, key), refreshing position from the array order. Idempotent — mirrors
// cms/seed.go's per-boot upsert and cms/store.go UpsertSection. The live DB
// already holds these rows, so this is optional but safe to call.
export async function upsertSeedSections(siteId: string): Promise<void> {
  await upsertSections(siteId, leaSections());
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
