import { cmsPool as pool } from "@/lib/db";
import type {
  ContentBySectionLocale,
  ContentValue,
  DictSection,
} from "./dict";

// Data-layer helpers for the public CMS content API, ported from cms/store.go.

// Site mirrors the sites table (cms/model.go Site).
export interface Site {
  id: string;
  key: string;
  name: string;
  locales: string[];
  defaultLocale: string;
  githubRepo: string;
  dispatchEvent: string;
  createdAt: Date;
}

// Section mirrors the sections table with its parsed schema (cms/model.go
// Section). `schema` is the section's field definitions (JSONB).
export interface Section extends DictSection {
  siteId: string;
  title: string;
  pageGroup: string;
  position: number;
  schema: unknown;
}

// getSiteByKey returns the site with the given public key, or null when none
// matches (cms/store.go GetSite).
export async function getSiteByKey(key: string): Promise<Site | null> {
  const { rows } = await pool.query(
    `SELECT id, key, name, locales, default_locale, github_repo, dispatch_event, created_at
     FROM sites WHERE key = $1`,
    [key]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    locales: r.locales,
    defaultLocale: r.default_locale,
    githubRepo: r.github_repo,
    dispatchEvent: r.dispatch_event,
    createdAt: r.created_at,
  };
}

// listSections returns a site's sections ordered by position then key, with the
// schema JSONB parsed (cms/store.go ListSections).
export async function listSections(siteId: string): Promise<Section[]> {
  const { rows } = await pool.query(
    `SELECT id, site_id, key, title, page_group, position, localized, flatten, schema
     FROM sections WHERE site_id = $1 ORDER BY position, key`,
    [siteId]
  );
  return rows.map((r) => ({
    id: r.id,
    siteId: r.site_id,
    key: r.key,
    title: r.title,
    pageGroup: r.page_group,
    position: r.position,
    localized: r.localized,
    flatten: r.flatten,
    schema: r.schema,
  }));
}

// SiteContent bundles a site's sections with its content rows keyed
// sectionID -> locale -> value, ready to feed assembleDict.
export interface SiteContent {
  sections: Section[];
  content: ContentBySectionLocale;
}

// siteContent loads a site's sections and either the draft or published content
// rows, returning everything assembleDict needs (cms/store.go ListSections +
// SiteContent).
export async function siteContent(
  siteId: string,
  draft: boolean
): Promise<SiteContent> {
  const sections = await listSections(siteId);
  const col = draft ? "c.draft" : "c.published";
  const { rows } = await pool.query(
    `SELECT c.section_id, c.locale, ${col} AS value
     FROM contents c JOIN sections sec ON sec.id = c.section_id
     WHERE sec.site_id = $1`,
    [siteId]
  );
  const content: ContentBySectionLocale = {};
  for (const r of rows) {
    const sectionId = r.section_id as string;
    const locale = r.locale as string;
    if (!content[sectionId]) content[sectionId] = {};
    content[sectionId][locale] = r.value as ContentValue;
  }
  return { sections, content };
}

// maxPublishedAt returns the most recent publish time across a site's content
// as an ISO 8601 string, or null when never published (cms/store.go
// LastPublishedAt).
export async function maxPublishedAt(siteId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT max(c.published_at) AS max
     FROM contents c JOIN sections sec ON sec.id = c.section_id
     WHERE sec.site_id = $1`,
    [siteId]
  );
  const max = rows[0]?.max as Date | null;
  return max ? max.toISOString() : null;
}
