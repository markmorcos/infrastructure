import {
  createSite,
  getSiteByKey,
  getProjectByKey,
  getSection,
  createSection,
  updateSection,
  deleteSection,
  upsertDraft,
  importDict,
  importDictSeparate,
  mergeContent,
  publishSite,
  validKey,
  ImportError,
  type Site,
} from "./admin";
import { upsertSections, type SeedSection } from "./seed";
import { uploadFile } from "./storage";

// Internal CMS service API: the single shared-secret write path that the admin
// console and the practa product both call, so there's no second copy of the
// write logic to drift. Generic CMS vocabulary only (sites/sections/content/
// users/ownership/publish) — it knows nothing about practitioners or presets;
// consumers pass their own schemas and content.

export class ServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function serializeSite(s: Site) {
  return {
    id: s.id,
    key: s.key,
    name: s.name,
    locales: s.locales,
    defaultLocale: s.defaultLocale,
    ownerUserId: s.ownerUserId,
    projectId: s.projectId,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

// ServiceContext carries the authenticated caller's tenant (from the per-tenant
// token) so the service can scope every site lookup/create to that tenant's
// project. Resolved once per request into `projectId`.
export interface ServiceContext {
  // The tenant string from verifyToken (e.g. "practa"), or null when unknown.
  tenant?: string | null;
}

async function requireSite(
  key: unknown,
  projectId: string | null
): Promise<Site> {
  if (typeof key !== "string" || !key) throw new ServiceError("missing site key");
  const site = await getSiteByKey(key, { projectId });
  if (!site) throw new ServiceError(`site "${key}" not found`, 404);
  return site;
}

type Params = Record<string, unknown>;

// handleServiceAction dispatches one RPC call. Throws ServiceError (mapped to a
// status by the route) on bad input. The optional ctx carries the caller's
// tenant; when it resolves to a project, all site lookups are scoped to it and
// new sites are stamped with its project_id (so practa's token only ever
// resolves/creates proj_practa sites).
export async function handleServiceAction(
  action: string,
  params: Params,
  ctx: ServiceContext = {}
): Promise<unknown> {
  // Resolve the caller's project from its tenant once. A null projectId means
  // the global namespace (and getSiteByKey's transitional fallback still applies
  // when a project is set but the site isn't yet assigned to it).
  const project = ctx.tenant ? await getProjectByKey(ctx.tenant) : null;
  const projectId = project?.id ?? null;
  switch (action) {
    case "sites.create": {
      const key = params.key;
      if (typeof key !== "string" || !validKey(key))
        throw new ServiceError("invalid site key");
      const locales = Array.isArray(params.locales)
        ? (params.locales.filter((l) => typeof l === "string") as string[])
        : undefined;
      const site = await createSite({
        key,
        name: typeof params.name === "string" ? params.name : undefined,
        locales,
        defaultLocale:
          typeof params.defaultLocale === "string" ? params.defaultLocale : undefined,
        projectId,
      });
      return { site: serializeSite(site) };
    }

    case "sites.get": {
      const site =
        typeof params.key === "string"
          ? await getSiteByKey(params.key, { projectId })
          : null;
      return { site: site ? serializeSite(site) : null };
    }

    case "sites.exists": {
      const site =
        typeof params.key === "string"
          ? await getSiteByKey(params.key, { projectId })
          : null;
      return { exists: site !== null };
    }

    case "sections.upsert": {
      const site = await requireSite(params.key, projectId);
      if (!Array.isArray(params.sections))
        throw new ServiceError("sections must be an array");
      await upsertSections(site.id, params.sections as SeedSection[]);
      return { ok: true };
    }

    case "content.import": {
      const site = await requireSite(params.key, projectId);
      try {
        if (params.published !== undefined || params.draft !== undefined) {
          await importDictSeparate(
            site,
            (params.published ?? {}) as Record<string, Record<string, unknown>>,
            (params.draft ?? {}) as Record<string, Record<string, unknown>>
          );
        } else {
          await importDict(
            site,
            (params.content ?? {}) as Record<string, Record<string, unknown>>
          );
        }
      } catch (e) {
        if (e instanceof ImportError) throw new ServiceError(e.message, 400);
        throw e;
      }
      return { ok: true };
    }

    case "publish": {
      const site = await requireSite(params.key, projectId);
      const dispatched = await publishSite(site);
      return { dispatched };
    }

    case "sections.create": {
      const site = await requireSite(params.key, projectId);
      const input = params.section as Record<string, unknown> | undefined;
      const sectionKey = typeof input?.key === "string" ? input.key : "";
      if (!sectionKey) throw new ServiceError("section key required");
      if (await getSection(site.id, sectionKey)) throw new ServiceError("section already exists", 409);
      const section = await createSection(site.id, {
        key: sectionKey,
        title: typeof input?.title === "string" ? input.title : sectionKey,
        pageGroup: typeof input?.pageGroup === "string" ? input.pageGroup : undefined,
        localized: typeof input?.localized === "boolean" ? input.localized : undefined,
        flatten: typeof input?.flatten === "boolean" ? input.flatten : undefined,
        fields: (input?.fields ?? []) as never,
      });
      return { section };
    }

    case "sections.update": {
      const site = await requireSite(params.key, projectId);
      const sectionKey = typeof params.sectionKey === "string" ? params.sectionKey : "";
      const sec = await getSection(site.id, sectionKey);
      if (!sec) throw new ServiceError("section not found", 404);
      const input = params.section as Record<string, unknown> | undefined;
      const section = await updateSection(sec.id, {
        title: typeof input?.title === "string" ? input.title : sec.title,
        pageGroup: typeof input?.pageGroup === "string" ? input.pageGroup : sec.pageGroup,
        localized: typeof input?.localized === "boolean" ? input.localized : sec.localized,
        flatten: typeof input?.flatten === "boolean" ? input.flatten : sec.flatten,
        fields: (input?.fields ?? sec.schema) as never,
      });
      return { section };
    }

    case "sections.delete": {
      const site = await requireSite(params.key, projectId);
      const sec = await getSection(site.id, typeof params.sectionKey === "string" ? params.sectionKey : "");
      if (!sec) throw new ServiceError("section not found", 404);
      await deleteSection(sec.id);
      return { ok: true };
    }

    case "content.putDraft": {
      const site = await requireSite(params.key, projectId);
      const sec = await getSection(site.id, typeof params.sectionKey === "string" ? params.sectionKey : "");
      if (!sec) throw new ServiceError("section not found", 404);
      const draft = params.draft && typeof params.draft === "object" && !Array.isArray(params.draft)
        ? (params.draft as Record<string, unknown>) : null;
      if (!draft) throw new ServiceError("draft must be an object");
      // Non-localized sections store under "*"; localized ones validate the locale.
      let locale = typeof params.locale === "string" ? params.locale : site.defaultLocale;
      if (!sec.localized) locale = "*";
      else if (!site.locales.includes(locale)) throw new ServiceError("unknown locale");
      await upsertDraft(sec.id, locale, draft);
      return { ok: true, locale };
    }

    case "content.merge": {
      const site = await requireSite(params.key, projectId);
      const section = typeof params.section === "string" ? params.section : "";
      if (!section) throw new ServiceError("missing section");
      const locale = typeof params.locale === "string" ? params.locale : "*";
      const patch = params.patch && typeof params.patch === "object" ? (params.patch as Record<string, unknown>) : null;
      if (!patch) throw new ServiceError("missing patch");
      try {
        await mergeContent(site.id, section, locale, patch);
      } catch (e) {
        if (e instanceof ImportError) throw new ServiceError(e.message, 400);
        throw e;
      }
      return { ok: true };
    }

    case "assets.add": {
      const site = await requireSite(params.key, projectId);
      const b64 = typeof params.dataBase64 === "string" ? params.dataBase64 : "";
      if (!b64) throw new ServiceError("missing dataBase64");
      const filename = typeof params.filename === "string" && params.filename ? params.filename : "upload";
      const data = Buffer.from(b64, "base64");
      const result = await uploadFile(site, filename, data);
      if (!result.ok) throw new ServiceError(result.error, 400);
      return { url: result.asset.url, id: result.asset.id, filename: result.asset.filename };
    }

    default:
      throw new ServiceError(`unknown action "${action}"`, 404);
  }
}
