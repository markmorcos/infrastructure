// MinIO asset storage, ported from cms/assets.go. The CMS talks to MinIO
// directly (S3_ENDPOINT, e.g. m720q:9000); the public URL it persists points at
// the CDN ingress in front of the same bucket. Uploads are gracefully disabled
// when the 3 required env vars are unset — the console then shows a notice
// instead of failing.

import { Client as MinioClient } from "minio";
import { randomBytes } from "crypto";
import { createAsset, deleteAssetRow, type Asset, type Site } from "./admin";

export const maxUploadBytes = 10 << 20; // 10 MB

// allowedImageTypes maps detected content type -> canonical extension
// (cms/assets.go allowedImageTypes).
const allowedImageTypes: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

interface AssetStore {
  client: MinioClient;
  bucket: string;
  publicBaseURL: string;
  endPoint: string;
  port?: number;
  useSSL: boolean;
}

// newAssetStore builds the MinIO client from S3_* env vars. Returns null when
// S3 is not configured (cms/assets.go newAssetStore) so the console runs with
// uploads disabled instead of failing.
function newAssetStore(): AssetStore | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKey || !secretKey) {
    return null;
  }
  const bucket = process.env.S3_BUCKET || "cms";
  const useSSL = process.env.S3_SECURE === "true";

  // The minio SDK wants host + optional port split out, unlike Go's "host:port"
  // endpoint string.
  let host = endpoint;
  let port: number | undefined;
  const colon = endpoint.lastIndexOf(":");
  if (colon !== -1) {
    const maybePort = Number(endpoint.slice(colon + 1));
    if (!Number.isNaN(maybePort)) {
      host = endpoint.slice(0, colon);
      port = maybePort;
    }
  }

  const client = new MinioClient({
    endPoint: host,
    ...(port !== undefined ? { port } : {}),
    useSSL,
    accessKey,
    secretKey,
  });

  const publicBaseURL = (
    process.env.S3_PUBLIC_BASE_URL || "https://cdn.morcos.tech"
  ).replace(/\/+$/, "");

  const store: AssetStore = {
    client,
    bucket,
    publicBaseURL,
    endPoint: host,
    port,
    useSSL,
  };
  // Best-effort bucket provisioning (cms/assets.go ensureBucket).
  void ensureBucket(store);
  return store;
}

// ensureBucket creates the bucket and opens anonymous downloads. Best-effort:
// failures are logged, not fatal (cms/assets.go ensureBucket).
async function ensureBucket(store: AssetStore): Promise<void> {
  try {
    const exists = await store.client.bucketExists(store.bucket);
    if (!exists) {
      await store.client.makeBucket(store.bucket);
    }
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${store.bucket}/*`],
        },
      ],
    });
    await store.client.setBucketPolicy(store.bucket, policy);
  } catch (e) {
    console.error(`assets: ensure bucket: ${(e as Error).message}`);
  }
}

// Module-level singleton, reused across requests (and HMR in dev).
const g = globalThis as unknown as { cmsAssetStore?: AssetStore | null };
function assetStore(): AssetStore | null {
  if (g.cmsAssetStore === undefined) {
    g.cmsAssetStore = newAssetStore();
  }
  return g.cmsAssetStore;
}

// uploadsEnabled reports whether S3 is configured (cms/main.go assets != nil).
export function uploadsEnabled(): boolean {
  return assetStore() !== null;
}

const unsafeFilenameRe = /[^a-z0-9._-]+/g;

// sanitizeFilename mirrors cms/assets.go sanitizeFilename: lowercase basename,
// non-[a-z0-9._-] runs collapsed to "-", trimmed of "-"/".", "datei" fallback.
export function sanitizeFilename(name: string): string {
  // path.Base equivalent — take the last path segment.
  const base = name.split(/[\\/]/).pop() ?? name;
  let out = base.toLowerCase();
  out = out.replace(unsafeFilenameRe, "-");
  out = out.replace(/^[-.]+/, "").replace(/[-.]+$/, "");
  if (out === "") out = "datei";
  return out;
}

// detectContentType replicates the subset of Go's http.DetectContentType the
// upload path cares about: JPEG/PNG/WebP/SVG magic-byte sniffing on the first
// 512 bytes, plus the text/xml and text/plain fallbacks the SVG special-case
// relies on. Anything unrecognized returns application/octet-stream so it is
// rejected by the allowlist (matching Go's behavior for non-images).
function detectContentType(head: Buffer): string {
  const b = head;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return "image/webp";
  }

  // Go's http.DetectContentType sniffs a leading "<?xml" as text/xml and
  // otherwise-textual content as text/plain; both feed the SVG special-case.
  // It skips leading whitespace before the XML check.
  let i = 0;
  while (i < b.length && (b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0c || b[i] === 0x0d || b[i] === 0x20)) {
    i++;
  }
  const rest = b.subarray(i);
  if (rest.length >= 5 && rest.toString("latin1", 0, 5) === "<?xml") {
    return "text/xml; charset=utf-8";
  }
  // Treat content with no disallowed control bytes as text (mirrors Go's
  // isText / text-plain branch closely enough for the SVG path).
  let textual = true;
  for (let j = 0; j < b.length; j++) {
    const c = b[j];
    if (c <= 0x08 || c === 0x0b || (c >= 0x0e && c <= 0x1a) || (c >= 0x1c && c <= 0x1f)) {
      textual = false;
      break;
    }
  }
  if (textual && b.length > 0) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

// uploadResult is one of: an asset, or a client error (400) message. Mirrors
// the error semantics of cms/assets.go put / uploadFromRequest.
export type UploadResult =
  | { ok: true; asset: Asset }
  | { ok: false; error: string };

// uploadFile validates `data` as an allowed image, stores it in MinIO under
// {site.key}/{6-random-hex}-{sanitizedFilename} with an immutable cache header,
// and records it (cms/assets.go uploadFromRequest + put). `filename` is the
// original client filename. Returns a client-error result for size/type
// problems; throws only on storage/DB failures (mapped to 500 by the route).
export async function uploadFile(
  site: Site,
  filename: string,
  data: Buffer
): Promise<UploadResult> {
  const store = assetStore();
  if (!store) {
    return {
      ok: false,
      error: "uploads are not configured (S3_* env missing)",
    };
  }
  if (data.length > maxUploadBytes) {
    return { ok: false, error: "file too large (max 10 MB)" };
  }

  const head = data.subarray(0, 512);
  let contentType = detectContentType(head);
  const lower = filename.toLowerCase();
  if (
    lower.endsWith(".svg") &&
    (contentType.startsWith("text/xml") || contentType.startsWith("text/plain"))
  ) {
    contentType = "image/svg+xml";
  }
  if (!(contentType in allowedImageTypes)) {
    return {
      ok: false,
      error: `unsupported file type ${contentType} — allowed: JPG, PNG, WebP, SVG`,
    };
  }

  const suffix = randomBytes(6).toString("hex");
  const objectKey = `${site.key}/${suffix}-${sanitizeFilename(filename)}`;

  await store.client.putObject(store.bucket, objectKey, data, data.length, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  const asset = await createAsset({
    siteId: site.id,
    objectKey,
    url: `${store.publicBaseURL}/${store.bucket}/${objectKey}`,
    filename,
    contentType,
    sizeBytes: data.length,
  });
  return { ok: true, asset };
}

// deleteSiteAssets removes every MinIO object under the site's prefix
// ({siteKey}/…). Best-effort: storage failures are logged, not fatal — the DB
// asset rows are removed by the sites cascade regardless. Used by sites.delete.
export async function deleteSiteAssets(siteKey: string): Promise<void> {
  const store = assetStore();
  if (!store) return;
  try {
    const keys: string[] = [];
    const stream = store.client.listObjectsV2(store.bucket, `${siteKey}/`, true);
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (o) => { if (o.name) keys.push(o.name); });
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    if (keys.length) await store.client.removeObjects(store.bucket, keys);
  } catch (e) {
    console.error(`assets: delete site ${siteKey}: ${(e as Error).message}`);
  }
}

// deleteAsset removes the object from MinIO (best-effort) then the DB row
// (cms/assets.go deleteAsset).
export async function deleteAsset(asset: Asset): Promise<void> {
  const store = assetStore();
  if (store) {
    try {
      await store.client.removeObject(store.bucket, asset.objectKey);
    } catch (e) {
      console.error(
        `assets: remove object ${asset.objectKey}: ${(e as Error).message}`
      );
    }
  }
  await deleteAssetRow(asset.id);
}
