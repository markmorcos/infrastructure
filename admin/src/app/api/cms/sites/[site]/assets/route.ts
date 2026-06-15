import { NextRequest, NextResponse } from "next/server";
import { getSiteByKey, listAssets } from "@/lib/cms/admin";
import { maxUploadBytes, uploadFile } from "@/lib/cms/storage";

// Admin assets list + upload, ported from cms/adminapi.go apiListAssets /
// apiUploadAsset. Multipart upload needs the Node runtime (Buffer + minio SDK).

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  try {
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }
    return NextResponse.json(await listAssets(site.id), { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ site: string }> }
) {
  const { site: siteKey } = await params;
  try {
    const site = await getSiteByKey(siteKey);
    if (!site) {
      return NextResponse.json({ error: "site not found" }, { status: 404 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "upload too large or invalid (max 10 MB)" },
        { status: 400 }
      );
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }
    if (file.size > maxUploadBytes) {
      return NextResponse.json(
        { error: "file too large (max 10 MB)" },
        { status: 400 }
      );
    }
    const data = Buffer.from(await file.arrayBuffer());
    const result = await uploadFile(site, file.name, data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.asset, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
