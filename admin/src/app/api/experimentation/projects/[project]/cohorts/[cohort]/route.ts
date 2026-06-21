import { NextRequest } from "next/server";
import {
  getProject,
  getCohort,
  deleteCohort,
} from "@/lib/experimentation/admin";
import { noContent, text } from "../../../../_http";

type Ctx = { params: Promise<{ project: string; cohort: string }> };

// DELETE cohort (cascades members + any feature_rules referencing it)

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { project, cohort } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const c = await getCohort(p.id, cohort);
    if (!c) return text("cohort not found", 404);
    await deleteCohort(c.id);
    return noContent();
  } catch (e) {
    console.error(e);
    return text("could not delete cohort", 500);
  }
}
