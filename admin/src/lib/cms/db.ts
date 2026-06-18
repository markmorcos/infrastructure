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
  ownerUserId: number | null;
  themeOverrides: Record<string, unknown>;
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
    `SELECT id, key, name, locales, default_locale, github_repo, dispatch_event,
            created_at, owner_user_id, theme_overrides
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
    ownerUserId: r.owner_user_id ?? null,
    themeOverrides: r.theme_overrides ?? {},
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

// ---- Studio renderer bundle ----

export interface BundleSection {
  key: string;
  title: string;
  // content for the requested locale, or null when none exists (the renderer
  // falls back to the preset's placeholder copy).
  content: ContentValue | null;
}
export interface BundlePage {
  group: string;
  sections: BundleSection[];
}
export interface BundleAsset {
  url: string;
  filename: string;
  contentType: string;
}
export interface SiteBundle {
  key: string;
  name: string;
  locale: string;
  locales: string[];
  defaultLocale: string;
  themeOverrides: Record<string, unknown>;
  publishedAt: string | null;
  pages: BundlePage[];
  assets: BundleAsset[];
}

export async function listAssets(siteId: string): Promise<BundleAsset[]> {
  const { rows } = await pool.query(
    `SELECT url, filename, content_type FROM assets WHERE site_id = $1 ORDER BY created_at`,
    [siteId]
  );
  return rows.map((r) => ({
    url: r.url,
    filename: r.filename,
    contentType: r.content_type,
  }));
}

// siteBundle assembles everything the studio renderer needs for one locale in a
// single object: site meta + theme/preset/settings, sections grouped into pages
// (preserving position order, groups in first-seen order) with their content
// for the locale, and the asset list. draft=true serves drafts (admin preview).
export async function siteBundle(
  site: Site,
  locale: string,
  draft: boolean
): Promise<SiteBundle> {
  const { sections, content } = await siteContent(site.id, draft);
  const pages: BundlePage[] = [];
  const indexByGroup = new Map<string, number>();
  for (const s of sections) {
    let idx = indexByGroup.get(s.pageGroup);
    if (idx === undefined) {
      idx = pages.length;
      pages.push({ group: s.pageGroup, sections: [] });
      indexByGroup.set(s.pageGroup, idx);
    }
    pages[idx].sections.push({
      key: s.key,
      title: s.title,
      content: content[s.id]?.[locale] ?? null,
    });
  }
  return {
    key: site.key,
    name: site.name,
    locale,
    locales: site.locales,
    defaultLocale: site.defaultLocale,
    themeOverrides: site.themeOverrides,
    publishedAt: await maxPublishedAt(site.id),
    pages,
    assets: await listAssets(site.id),
  };
}
