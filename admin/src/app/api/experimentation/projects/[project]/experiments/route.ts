import { NextRequest } from "next/server";
import {
  getProject,
  createExperiment,
  validKey,
  validateExperiment,
  type Variant,
} from "@/lib/experimentation/admin";
import { isDuplicateKey, json, text } from "../../../_http";

type Ctx = { params: Promise<{ project: string }> };

// POST create experiment

export async function POST(req: NextRequest, { params }: Ctx) {
  const { project } = await params;
  let body: {
    key?: string;
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
  const key = (body.key ?? "").trim();
  if (!validKey(key)) {
    return text("key must match [a-z0-9_-]", 400);
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
    const created = await createExperiment(p.id, {
      key,
      name: body.name ?? "",
      status: status || "draft",
      metric,
      control,
      variants,
    });
    return json(created, 201);
  } catch (e) {
    if (isDuplicateKey(e)) {
      return text("could not create experiment (key may already exist)", 409);
    }
    console.error(e);
    return text("internal error", 500);
  }
}
