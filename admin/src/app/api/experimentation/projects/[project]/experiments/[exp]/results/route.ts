import { NextRequest } from "next/server";
import {
  getProject,
  getExperiment,
  getEnvironment,
  stats,
  buildResults,
} from "@/lib/experimentation/admin";
import { json, text } from "../../../../../_http";

type Ctx = { params: Promise<{ project: string; exp: string }> };

// GET results (optional ?environment=)

export async function GET(req: NextRequest, { params }: Ctx) {
  const { project, exp } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const e = await getExperiment(p.id, exp);
    if (!e) return text("experiment not found", 404);

    let envId = "";
    const envKey = req.nextUrl.searchParams.get("environment");
    if (envKey) {
      const env = await getEnvironment(p.id, envKey);
      if (!env) return text("environment not found", 404);
      envId = env.id;
    }

    const st = await stats(p.id, e.key, envId, e.metric);
    return json(buildResults(e, e.metric, st));
  } catch (err) {
    console.error(err);
    return text("could not compute results", 500);
  }
}
