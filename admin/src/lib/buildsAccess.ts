import { NextRequest, NextResponse } from "next/server";
import { cmsPool } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/cms/authz";
import { cached } from "@/lib/cache";
import { getRunProject, listDeployRuns } from "@/lib/github";

// Builds access control. Admins see every deploy-app run; an editor is scoped
// to the apps whose CMS site they own — keyed by the site `key`, which matches
// the deploy project (site "lea" → deploy-lea runs → project "lea"). We use the
// key, not dispatch_event, because that field is the CMS content-publish event
// and varies per site (e.g. "cms-publish"). Read fresh from the DB each request
// so granting/revoking a site takes effect without re-login. Compared
// case-insensitively since deploy project names are lowercase.

// null = unrestricted (admin). A Set of lowercased project keys = the exact
// apps an editor may see (possibly empty → they see nothing).
export async function allowedProjects(user: SessionUser): Promise<Set<string> | null> {
  if (user.role === "admin") return null;
  const { rows } = await cmsPool.query<{ key: string }>(
    `SELECT key FROM sites WHERE owner_user_id = $1`,
    [user.userId],
  );
  return new Set(rows.map((r) => r.key.toLowerCase()));
}

type Guard = { user: SessionUser } | { error: NextResponse };

// requireRunAccess authorizes a handler operating on a single run id. Admins
// always pass; an editor passes only if the run's project is in their allowed
// set. The run's project is taken from the cached list when present (no extra
// API call for the runs they're actually viewing), else fetched directly.
export async function requireRunAccess(req: NextRequest, runId: number): Promise<Guard> {
  const user = getSessionUser(req);
  if (!user)
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const allowed = await allowedProjects(user);
  if (allowed === null) return { user };

  const runs = await cached("builds", 20_000, () => listDeployRuns(50));
  const known = runs.find((r) => r.id === runId);
  const project = known ? known.project : await getRunProject(runId);

  if (allowed.has(project.toLowerCase())) return { user };
  return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
}
