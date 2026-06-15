import { NextRequest } from "next/server";
import {
  getProject,
  getExperiment,
  updateExperiment,
  deleteExperiment,
  validateExperiment,
  type Variant,
} from "@/lib/experimentation/admin";
import { json, noContent, text } from "../../../../_http";

type Ctx = { params: Promise<{ project: string; exp: string }> };

// PUT    update experiment (replace variants)
// DELETE delete experiment (clears events by experiment_key)

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { project, exp } = await params;
  let body: {
    name?: string;
    status?: string;
    metric?: string;
    control?: string;
    variants?: Variant[];
  };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  const variants = body.variants ?? [];
  const status = body.status ?? "";
  const metric = body.metric ?? "";
  const control = body.control ?? "";
  const err = validateExperiment({ metric, control, variants, status });
  if (err) return text(err, 400);
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const e = await getExperiment(p.id, exp);
    if (!e) return text("experiment not found", 404);
    const input = {
      key: e.key,
      name: body.name ?? "",
      status: status || "draft",
      metric,
      control,
      variants,
    };
    await updateExperiment(e.id, input);
    return json({ ...e, ...input });
  } catch (e) {
    console.error(e);
    return text("could not update experiment", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { project, exp } = await params;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const e = await getExperiment(p.id, exp);
    if (!e) return text("experiment not found", 404);
    await deleteExperiment(e.id, p.id, e.key);
    return noContent();
  } catch (e) {
    console.error(e);
    return text("could not delete experiment", 500);
  }
}
