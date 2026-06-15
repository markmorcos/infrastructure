import { NextRequest } from "next/server";
import {
  getProject,
  createFeature,
  validKey,
  validFeatureType,
  defaultForType,
} from "@/lib/experimentation/admin";
import { isDuplicateKey, json, text } from "../../../_http";

type Ctx = { params: Promise<{ project: string }> };

// POST create feature

export async function POST(req: NextRequest, { params }: Ctx) {
  const { project } = await params;
  let body: {
    key?: string;
    type?: string;
    description?: string;
    default?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return text("invalid json", 400);
  }
  const key = (body.key ?? "").trim();
  const type = body.type ?? "";
  if (!validKey(key) || !validFeatureType(type)) {
    return text("valid key and type (boolean|string|number|json) required", 400);
  }
  // `default` omitted -> type default. The Go service treats an absent default
  // as zero-length; here `undefined` is the equivalent.
  const def = body.default === undefined ? defaultForType(type) : body.default;
  try {
    const p = await getProject(project);
    if (!p) return text("project not found", 404);
    const f = await createFeature(
      p.id,
      key,
      type,
      (body.description ?? "").trim(),
      def
    );
    return json(f, 201);
  } catch (e) {
    if (isDuplicateKey(e)) {
      return text("could not create feature (key may already exist)", 409);
    }
    console.error(e);
    return text("internal error", 500);
  }
}
