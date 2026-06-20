// Admin data-layer helpers for the CMS console, ported from cms/store.go and
// cms/adminapi.go. These extend the public lib/cms/db.ts read helpers with the
// write/CRUD operations the admin console needs. All use cmsPool (search_path
// = cms,public).

import { cmsPool as pool } from "@/lib/db";
import { randomBytes } from "crypto";
import { assembleDict, type ContentBySectionLocale } from "./dict";
import { listSections, type Section, type Site } from "./db";
import type { Field } from "./seed";

export { listSections, getProjectByKey } from "./db";
export type { Section, Site, Project } from "./db";

// localeAll is the pseudo-locale for non-localized sections (cms/model.go).
export const localeAll = "*";

// keyRe validates a site key (cms/adminapi.go keyRe).
const keyRe = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export function validKey(s: string): boolean {
  return keyRe.test(s);
}

function newId(): string {
  return randomBytes(16).toString("hex");
}

function mapSite(r: Record<string, unknown>): Site {
  return {
    id: r.id as string,
    key: r.key as string,
    name: r.name as string,
    locales: r.locales as string[],
    defaultLocale: r.default_locale as string,
    githubRepo: r.github_repo as string,
    dispatchEvent: r.dispatch_event as string,
    createdAt: r.created_at as Date,
    ownerUserId: (r.owner_user_id as number | null) ?? null,
    projectId: (r.project_id as string | null) ?? null,
    // Present only on rows from list queries that JOIN projects.
    projectKey: (r.project_key as string | null) ?? null,
  };
}

const SITE_COLS = `id, key, name, locales, default_locale, github_repo, dispatch_event, created_at, owner_user_id, project_id`;

// SITE_COLS_J selects the same columns plus the joined project key, for list
// queries that group sites by project (aliased table `s`, projects as `p`).
const SITE_COLS_J = `s.id, s.key, s.name, s.locales, s.default_locale, s.github_repo, s.dispatch_event, s.created_at, s.owner_user_id, s.project_id, p.key AS project_key`;

// ---- Sites ----

// listSites returns all sites ordered by creation (cms/store.go ListSites).
// An optional projectId filters to one project (null = the global namespace).
export async function listSites(opts?: {
  projectId?: string | null;
}): Promise<Site[]> {
  const projectId = opts?.projectId;
  if (projectId !== undefined) {
    const clause =
      projectId === null ? `s.project_id IS NULL` : `s.project_id = $1`;
    const args = projectId === null ? [] : [projectId];
    const { rows } = await pool.query(
      `SELECT ${SITE_COLS_J} FROM sites s LEFT JOIN projects p ON p.id = s.project_id
       WHERE ${clause} ORDER BY s.created_at`,
      args
    );
    return rows.map(mapSite);
  }
  const { rows } = await pool.query(
    `SELECT ${SITE_COLS_J} FROM sites s LEFT JOIN projects p ON p.id = s.project_id
     ORDER BY s.created_at`
  );
  return rows.map(mapSite);
}

// listSitesForUser returns every site for admins, or only the sites a non-admin
// (editor) owns. An optional projectId filters to one project (null = global).
export async function listSitesForUser(
  role: string,
  userId: number,
  opts?: { projectId?: string | null }
): Promise<Site[]> {
  if (role === "admin") return listSites(opts);
  const projectId = opts?.projectId;
  const filters = [`s.owner_user_id = $1`];
  const args: unknown[] = [userId];
  if (projectId !== undefined) {
    if (projectId === null) {
      filters.push(`s.project_id IS NULL`);
    } else {
      args.push(projectId);
      filters.push(`s.project_id = $${args.length}`);
    }
  }
  const { rows } = await pool.query(
    `SELECT ${SITE_COLS_J} FROM sites s LEFT JOIN projects p ON p.id = s.project_id
     WHERE ${filters.join(" AND ")} ORDER BY s.created_at`,
    args
  );
  return rows.map(mapSite);
}

// assignSiteOwner sets (or clears, with null) a site's owner by site id.
export async function assignSiteOwner(
  siteId: string,
  ownerUserId: number | null
): Promise<void> {
  await pool.query(`UPDATE sites SET owner_user_id = $2 WHERE id = $1`, [
    siteId,
    ownerUserId,
  ]);
}

// getSiteByKey returns the site with the given key or null (cms/store.go
// GetSite).
//
// Project-aware with a TRANSITIONAL GLOBAL FALLBACK: when a projectId is given,
// it first looks for the site in that project; if none is found it falls back to
// a global key lookup so reads keep working before practa sends a project.
//
// TODO: remove the transitional fallback after practa sends project.
export async function getSiteByKey(
  key: string,
  opts?: { projectId?: string | null }
): Promise<Site | null> {
  const projectId = opts?.projectId;
  if (projectId !== undefined && projectId !== null) {
    const scoped = await pool.query(
      `SELECT ${SITE_COLS} FROM sites WHERE key = $1 AND project_id = $2`,
      [key, projectId]
    );
    if (scoped.rows.length) return mapSite(scoped.rows[0]);
    // TODO: remove transitional fallback after practa sends project.
  }
  const { rows } = await pool.query(
    `SELECT ${SITE_COLS} FROM sites WHERE key = $1`,
    [key]
  );
  return rows.length ? mapSite(rows[0]) : null;
}

export interface CreateSiteInput {
  key: string;
  name?: string;
  locales?: string[];
  defaultLocale?: string;
  githubRepo?: string;
  dispatchEvent?: string;
  // Optional project scope; default null = the global (console) namespace.
  projectId?: string | null;
}

// createSite inserts a new site, defaulting locales/defaultLocale the same way
// cms/store.go CreateSite does. Throws on a duplicate key (handled as 409 by
// the route). A site with no github_repo/dispatch_event is studio-rendered
// (served live by the practa renderer — no CI rebuild on publish).
export async function createSite(input: CreateSiteInput): Promise<Site> {
  const id = newId();
  // New sites default to English only; other locales (de/ar/…) are opt-in.
  const locales = input.locales && input.locales.length ? input.locales : ["en"];
  const defaultLocale = input.defaultLocale || locales[0];
  const name = input.name || input.key;
  const { rows } = await pool.query(
    `INSERT INTO sites (id, key, name, locales, default_locale, github_repo, dispatch_event, project_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING ${SITE_COLS}`,
    [
      id,
      input.key,
      name,
      locales,
      defaultLocale,
      input.githubRepo ?? "",
      input.dispatchEvent ?? "",
      input.projectId ?? null,
    ]
  );
  return mapSite(rows[0]);
}

// updateSite patches name/github_repo/dispatch_event ONLY (cms/store.go
// UpdateSite). Returns the refreshed site.
export async function updateSite(
  id: string,
  name: string,
  githubRepo: string,
  dispatchEvent: string
): Promise<Site> {
  const { rows } = await pool.query(
    `UPDATE sites SET name=$2, github_repo=$3, dispatch_event=$4 WHERE id=$1
     RETURNING ${SITE_COLS}`,
    [id, name, githubRepo, dispatchEvent]
  );
  return mapSite(rows[0]);
}

// deleteSite removes a site (cascades to sections/contents/assets/publishes).
export async function deleteSite(id: string): Promise<void> {
  await pool.query(`DELETE FROM sites WHERE id=$1`, [id]);
}

// ---- Sections ----

// getSection returns one section by (site, key) or null (cms/store.go
// GetSection).
export async function getSection(
  siteId: string,
  key: string
): Promise<Section | null> {
  const { rows } = await pool.query(
    `SELECT id, site_id, key, title, page_group, position, localized, flatten, schema
     FROM sections WHERE site_id = $1 AND key = $2`,
    [siteId, key]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    siteId: r.site_id,
    key: r.key,
    title: r.title,
    pageGroup: r.page_group,
    position: r.position,
    localized: r.localized,
    flatten: r.flatten,
    schema: r.schema,
  };
}

// schemaFields narrows a section's stored JSONB schema to a Field[].
export function schemaFields(section: Section): Field[] {
  return (section.schema as Field[]) ?? [];
}

function mapSection(r: Record<string, unknown>): Section {
  return {
    id: r.id as string,
    siteId: r.site_id as string,
    key: r.key as string,
    title: r.title as string,
    pageGroup: r.page_group as string,
    position: r.position as number,
    localized: r.localized as boolean,
    flatten: r.flatten as boolean,
    schema: r.schema as unknown,
  } as Section;
}

const FIELD_TYPES = new Set([
  "text", "textarea", "stringlist", "paragraphs", "object", "list", "pairs", "image", "select",
]);
const keyOk = (s: unknown): s is string =>
  typeof s === "string" && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s);

export class SectionError extends Error {}

// sanitizeFields validates a section's field schema (recursively for object/list
// subfields) and returns a clean Field[]. Throws SectionError on bad input.
export function sanitizeFields(input: unknown, depth = 0): Field[] {
  if (!Array.isArray(input)) throw new SectionError("fields must be an array");
  if (depth > 2) throw new SectionError("fields nested too deep");
  return input.map((raw) => {
    const f = raw as Record<string, unknown>;
    if (!keyOk(f.key)) throw new SectionError(`invalid field key: ${String(f.key)}`);
    if (typeof f.type !== "string" || !FIELD_TYPES.has(f.type))
      throw new SectionError(`invalid field type for "${f.key}"`);
    const out: Field = {
      key: f.key,
      type: f.type as Field["type"],
      label: typeof f.label === "string" && f.label ? f.label : f.key,
    };
    if (f.type === "object" || f.type === "list") {
      out.fields = sanitizeFields(f.fields ?? [], depth + 1);
      if (out.fields.length === 0)
        throw new SectionError(`"${f.key}" (${f.type}) needs at least one subfield`);
    }
    if (f.type === "select") {
      const opts = Array.isArray(f.options)
        ? f.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim())
        : [];
      if (opts.length === 0)
        throw new SectionError(`"${f.key}" (select) needs at least one option`);
      out.options = opts;
    }
    return out;
  });
}

export interface SectionInput {
  key: string;
  title: string;
  pageGroup?: string;
  localized?: boolean;
  flatten?: boolean;
  fields: Field[];
}

// createSection appends a new section to a site (position after the last one).
export async function createSection(
  siteId: string,
  input: SectionInput
): Promise<Section> {
  if (!keyOk(input.key)) throw new SectionError("invalid section key");
  const fields = sanitizeFields(input.fields);
  const { rows: pos } = await pool.query(
    `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM sections WHERE site_id = $1`,
    [siteId]
  );
  const { rows } = await pool.query(
    `INSERT INTO sections (id, site_id, key, title, page_group, position, localized, flatten, schema)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, site_id, key, title, page_group, position, localized, flatten, schema`,
    [
      newId(),
      siteId,
      input.key,
      input.title || input.key,
      input.pageGroup || "content",
      pos[0].p as number,
      input.localized ?? true,
      input.flatten ?? false,
      JSON.stringify(fields),
    ]
  );
  return mapSection(rows[0]);
}

// updateSection edits a section's title/group/flags and field schema (key is
// immutable, matching the content-storage keying).
export async function updateSection(
  sectionId: string,
  input: Omit<SectionInput, "key">
): Promise<Section> {
  const fields = sanitizeFields(input.fields);
  const { rows } = await pool.query(
    `UPDATE sections SET title=$2, page_group=$3, localized=$4, flatten=$5, schema=$6
     WHERE id=$1
     RETURNING id, site_id, key, title, page_group, position, localized, flatten, schema`,
    [
      sectionId,
      input.title,
      input.pageGroup || "content",
      input.localized ?? true,
      input.flatten ?? false,
      JSON.stringify(fields),
    ]
  );
  return mapSection(rows[0]);
}

export async function deleteSection(sectionId: string): Promise<void> {
  await pool.query(`DELETE FROM sections WHERE id = $1`, [sectionId]);
}

// ---- Contents (drafts) ----

// getDraft returns the draft object for one section+locale, or {} when nothing
// has been saved (cms/store.go GetDraft). pg returns JSONB already parsed.
export async function getDraft(
  sectionId: string,
  locale: string
): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(
    `SELECT draft FROM contents WHERE section_id=$1 AND locale=$2`,
    [sectionId, locale]
  );
  if (!rows.length) return {};
  const draft = rows[0].draft;
  if (draft && typeof draft === "object" && !Array.isArray(draft)) {
    return draft as Record<string, unknown>;
  }
  return {};
}

// upsertDraft saves a draft object for one section+locale (cms/store.go
// UpsertDraft).
export async function upsertDraft(
  sectionId: string,
  locale: string,
  draft: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `INSERT INTO contents (id, section_id, locale, draft)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (section_id, locale) DO UPDATE SET draft=EXCLUDED.draft, updated_at=now()`,
    [newId(), sectionId, locale, JSON.stringify(draft)]
  );
}

// siteContent loads either draft or published content rows keyed sectionID ->
// locale (cms/store.go SiteContent).
export async function siteContentMap(
  siteId: string,
  draft: boolean
): Promise<ContentBySectionLocale> {
  const col = draft ? "c.draft" : "c.published";
  const { rows } = await pool.query(
    `SELECT c.section_id, c.locale, ${col} AS value
     FROM contents c JOIN sections sec ON sec.id = c.section_id
     WHERE sec.site_id = $1`,
    [siteId]
  );
  const out: ContentBySectionLocale = {};
  for (const r of rows) {
    const sid = r.section_id as string;
    const loc = r.locale as string;
    if (!out[sid]) out[sid] = {};
    out[sid][loc] = r.value;
  }
  return out;
}

// dirtySections reports which section+locale pairs have unpublished changes,
// keyed sectionID -> locale -> dirty (cms/store.go DirtySections).
export async function dirtySections(
  siteId: string
): Promise<Record<string, Record<string, boolean>>> {
  const { rows } = await pool.query(
    `SELECT c.section_id, c.locale, (c.draft IS DISTINCT FROM c.published) AS dirty
     FROM contents c JOIN sections sec ON sec.id = c.section_id
     WHERE sec.site_id = $1`,
    [siteId]
  );
  const out: Record<string, Record<string, boolean>> = {};
  for (const r of rows) {
    const sid = r.section_id as string;
    const loc = r.locale as string;
    if (!out[sid]) out[sid] = {};
    out[sid][loc] = r.dirty as boolean;
  }
  return out;
}

// lastPublishedAt returns the most recent publish time as ISO string, or null
// (cms/store.go LastPublishedAt).
export async function lastPublishedAt(siteId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT max(c.published_at) AS max
     FROM contents c JOIN sections sec ON sec.id = c.section_id
     WHERE sec.site_id = $1`,
    [siteId]
  );
  const max = rows[0]?.max as Date | null;
  return max ? max.toISOString() : null;
}

// ---- Import ----

// explodeDict splits a full locale dictionary into per-section objects — the
// inverse of assembleDict. Unknown root keys are an error so an import can't
// silently drop content (cms/dict.go explodeDict).
export function explodeDict(
  sections: Section[],
  dict: Record<string, unknown>
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  const claimed: Record<string, boolean> = {};
  for (const sec of sections) {
    const fields = schemaFields(sec);
    if (sec.flatten) {
      const obj: Record<string, unknown> = {};
      for (const fld of fields) {
        if (fld.key in dict) {
          obj[fld.key] = dict[fld.key];
          claimed[fld.key] = true;
        }
      }
      if (Object.keys(obj).length > 0) out[sec.key] = obj;
      continue;
    }
    if (!(sec.key in dict)) continue;
    const v = dict[sec.key];
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      throw new Error(`section "${sec.key}": expected an object`);
    }
    out[sec.key] = v as Record<string, unknown>;
    claimed[sec.key] = true;
  }
  for (const k of Object.keys(dict)) {
    if (!claimed[k]) {
      throw new Error(`unknown top-level key "${k}" — no matching section`);
    }
  }
  return out;
}

// importContent replaces draft and published for the given section+locale
// objects in one transaction (cms/store.go ImportContent).
export async function importContent(
  values: Record<string, Record<string, Record<string, unknown>>>
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const sectionId of Object.keys(values)) {
      for (const locale of Object.keys(values[sectionId])) {
        const obj = JSON.stringify(values[sectionId][locale]);
        await client.query(
          `INSERT INTO contents (id, section_id, locale, draft, published, published_at)
           VALUES ($1,$2,$3,$4,$4,now())
           ON CONFLICT (section_id, locale) DO UPDATE SET
             draft=EXCLUDED.draft, published=EXCLUDED.published,
             updated_at=now(), published_at=now()`,
          [newId(), sectionId, locale, obj]
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// importDict ports cms/adminapi.go apiImport: takes a full {locale: dict}
// payload, explodes each locale into per-section objects (erroring on unknown
// locales or top-level keys), and writes both draft+published. Non-localized
// sections take their value from the default locale only.
export async function importDict(
  site: Site,
  payload: Record<string, Record<string, unknown>>
): Promise<void> {
  const sections = await listSections(site.id);
  const sectionByKey = new Map(sections.map((s) => [s.key, s]));

  const values: Record<string, Record<string, Record<string, unknown>>> = {};
  const put = (
    sec: Section,
    locale: string,
    obj: Record<string, unknown>
  ) => {
    if (!values[sec.id]) values[sec.id] = {};
    values[sec.id][locale] = obj;
  };

  for (const locale of Object.keys(payload)) {
    if (!site.locales.includes(locale)) {
      throw new ImportError(`unknown locale ${locale.trim()}`);
    }
    let exploded: Record<string, Record<string, unknown>>;
    try {
      exploded = explodeDict(sections, payload[locale]);
    } catch (e) {
      throw new ImportError(
        `locale ${locale}: ${(e as Error).message}`
      );
    }
    for (const key of Object.keys(exploded)) {
      const sec = sectionByKey.get(key)!;
      if (!sec.localized) {
        if (locale === site.defaultLocale) {
          put(sec, localeAll, exploded[key]);
        }
        continue;
      }
      put(sec, locale, exploded[key]);
    }
  }
  await importContent(values);
}

// importDictSeparate imports DIFFERENT published vs draft content in one pass:
// `published` and `draft` are each a {locale: dict} payload. Used for the
// onboarding flow where the public site shows generic placeholders (published)
// while the owner reviews an AI draft (draft). When a section/locale appears in
// only one payload, that value is used for both columns so neither side is
// blank. Mirrors importDict's explode/validate per locale.
export async function importDictSeparate(
  site: Site,
  published: Record<string, Record<string, unknown>>,
  draft: Record<string, Record<string, unknown>>
): Promise<void> {
  const sections = await listSections(site.id);
  const sectionByKey = new Map(sections.map((s) => [s.key, s]));

  // sectionId -> locale -> { pub?, drf? }
  const merged: Record<string, Record<string, { pub?: Record<string, unknown>; drf?: Record<string, unknown> }>> = {};
  const slot = (secId: string, locale: string) => {
    if (!merged[secId]) merged[secId] = {};
    if (!merged[secId][locale]) merged[secId][locale] = {};
    return merged[secId][locale];
  };

  const ingest = (
    payload: Record<string, Record<string, unknown>>,
    which: "pub" | "drf"
  ) => {
    for (const locale of Object.keys(payload)) {
      if (!site.locales.includes(locale)) {
        throw new ImportError(`unknown locale ${locale.trim()}`);
      }
      let exploded: Record<string, Record<string, unknown>>;
      try {
        exploded = explodeDict(sections, payload[locale]);
      } catch (e) {
        throw new ImportError(`locale ${locale}: ${(e as Error).message}`);
      }
      for (const key of Object.keys(exploded)) {
        const sec = sectionByKey.get(key)!;
        const loc = sec.localized ? locale : localeAll;
        if (!sec.localized && locale !== site.defaultLocale) continue;
        slot(sec.id, loc)[which] = exploded[key];
      }
    }
  };

  ingest(published, "pub");
  ingest(draft, "drf");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const sectionId of Object.keys(merged)) {
      for (const locale of Object.keys(merged[sectionId])) {
        const { pub, drf } = merged[sectionId][locale];
        const finalPub = JSON.stringify(pub ?? drf ?? {});
        const finalDraft = JSON.stringify(drf ?? pub ?? {});
        await client.query(
          `INSERT INTO contents (id, section_id, locale, draft, published, published_at)
           VALUES ($1,$2,$3,$4,$5,now())
           ON CONFLICT (section_id, locale) DO UPDATE SET
             draft=EXCLUDED.draft, published=EXCLUDED.published,
             updated_at=now(), published_at=now()`,
          [newId(), sectionId, locale, finalDraft, finalPub]
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// mergeContent shallow-merges a patch into a section's draft + published content
// (Postgres jsonb `||`) for one locale, creating the row if absent. Used for
// targeted field updates (e.g. media.logo / media.portraitUrl) that must not
// clobber sibling fields the way a full import would.
export async function mergeContent(
  siteId: string,
  sectionKey: string,
  locale: string,
  patch: Record<string, unknown>
): Promise<void> {
  const sec = await getSection(siteId, sectionKey);
  if (!sec) throw new ImportError(`no section "${sectionKey}"`);
  await pool.query(
    `INSERT INTO contents (id, section_id, locale, draft, published, published_at)
     VALUES ($1,$2,$3,$4,$4,now())
     ON CONFLICT (section_id, locale) DO UPDATE SET
       draft = contents.draft || EXCLUDED.draft,
       published = contents.published || EXCLUDED.published,
       updated_at = now(), published_at = now()`,
    [newId(), sec.id, locale, JSON.stringify(patch)]
  );
}

// ImportError marks a client (400) error from importDict, vs a 500.
export class ImportError extends Error {}

// ---- Publish ----

// publishSite copies every draft to published in one transaction, records a
// snapshot for rollback insurance, then fires the GitHub rebuild dispatch
// (best-effort). Content publishes even when dispatch fails. Mirrors
// cms/store.go PublishSite + cms/publish.go publishSite. Returns whether the
// dispatch succeeded.
export async function publishSite(site: Site): Promise<boolean> {
  const sections = await listSections(site.id);
  const drafts = await siteContentMap(site.id, true);
  const snapshot: Record<string, unknown> = {};
  for (const locale of site.locales) {
    snapshot[locale] = assembleDict(sections, drafts, locale);
  }

  let publishId: number;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE contents SET published = draft, published_at = now()
       WHERE section_id IN (SELECT id FROM sections WHERE site_id = $1)
         AND draft IS DISTINCT FROM published`,
      [site.id]
    );
    const { rows } = await client.query(
      `INSERT INTO publishes (site_id, snapshot) VALUES ($1,$2) RETURNING id`,
      [site.id, JSON.stringify(snapshot)]
    );
    publishId = rows[0].id as number;
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  // Studio-rendered sites (no github_repo/dispatch_event) read published content
  // live via SSR — there's nothing to rebuild, so skip the GitHub dispatch.
  if (!site.githubRepo || !site.dispatchEvent) return false;

  const { dispatch } = await import("./dispatch");
  const dispatched = await dispatch(site);
  if (dispatched) {
    await pool
      .query(`UPDATE publishes SET dispatched=true WHERE id=$1`, [publishId])
      .catch((e) =>
        console.error(`publish ${site.key}: mark dispatched: ${e}`)
      );
  }
  return dispatched;
}

// ---- Assets ----

export interface Asset {
  id: string;
  siteId: string;
  objectKey: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
}

function mapAsset(r: Record<string, unknown>): Asset {
  return {
    id: r.id as string,
    siteId: r.site_id as string,
    objectKey: r.object_key as string,
    url: r.url as string,
    filename: r.filename as string,
    contentType: r.content_type as string,
    sizeBytes: Number(r.size_bytes),
    createdAt: r.created_at as Date,
  };
}

// listAssets returns a site's assets newest-first (cms/store.go ListAssets).
export async function listAssets(siteId: string): Promise<Asset[]> {
  const { rows } = await pool.query(
    `SELECT id, site_id, object_key, url, filename, content_type, size_bytes, created_at
     FROM assets WHERE site_id = $1 ORDER BY created_at DESC`,
    [siteId]
  );
  return rows.map(mapAsset);
}

// getAsset returns one asset by (site, id) or null (cms/store.go GetAsset).
export async function getAsset(
  siteId: string,
  id: string
): Promise<Asset | null> {
  const { rows } = await pool.query(
    `SELECT id, site_id, object_key, url, filename, content_type, size_bytes, created_at
     FROM assets WHERE site_id = $1 AND id = $2`,
    [siteId, id]
  );
  return rows.length ? mapAsset(rows[0]) : null;
}

export interface CreateAssetInput {
  siteId: string;
  objectKey: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

// createAsset inserts an asset row (cms/store.go CreateAsset).
export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const id = newId();
  const { rows } = await pool.query(
    `INSERT INTO assets (id, site_id, object_key, url, filename, content_type, size_bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, site_id, object_key, url, filename, content_type, size_bytes, created_at`,
    [
      id,
      input.siteId,
      input.objectKey,
      input.url,
      input.filename,
      input.contentType,
      input.sizeBytes,
    ]
  );
  return mapAsset(rows[0]);
}

// deleteAssetRow removes the assets row (cms/store.go DeleteAsset). The object
// removal in MinIO is handled by the storage layer.
export async function deleteAssetRow(id: string): Promise<void> {
  await pool.query(`DELETE FROM assets WHERE id=$1`, [id]);
}
