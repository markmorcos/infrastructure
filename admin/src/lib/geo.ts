import { Reader, type CountryResponse } from "maxmind";
import { Client as MinioClient } from "minio";

// Centralised IP → country lookup (GeoLite2-Country) for the analytics backend.
// The DB is refreshed weekly into a private MinIO bucket by the geoip-update
// CronJob (k8s/08-geoip-update.yaml) — the app never calls MaxMind. Here we just
// pull the .mmdb from MinIO into memory and cache it; a pod restart costs one
// fast internal read, not a MaxMind download. The raw IP is used only for the
// lookup and never stored.

const BUCKET = process.env.GEOIP_BUCKET || "geoip";
const OBJECT = "GeoLite2-Country.mmdb";
const REFRESH_MS = 24 * 60 * 60 * 1000; // re-pull from MinIO daily (cheap, internal)

let reader: Reader<CountryResponse> | null = null;
let loadedAt = 0;
let loading: Promise<void> | null = null;

function minio(): { client: MinioClient } | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  const colon = endpoint.lastIndexOf(":");
  const port = colon !== -1 ? Number(endpoint.slice(colon + 1)) : NaN;
  const host = Number.isNaN(port) ? endpoint : endpoint.slice(0, colon);
  return {
    client: new MinioClient({
      endPoint: host,
      port: Number.isNaN(port) ? undefined : port,
      useSSL: process.env.S3_SECURE === "true",
      accessKey,
      secretKey,
    }),
  };
}

async function load(): Promise<void> {
  const m = minio();
  if (!m) return; // geo off until S3 is configured + the cron has populated it
  const stream = await m.client.getObject(BUCKET, OBJECT);
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  reader = new Reader<CountryResponse>(Buffer.concat(chunks));
  loadedAt = Date.now();
}

async function ensure(): Promise<void> {
  if (reader && Date.now() - loadedAt < REFRESH_MS) return;
  if (loading) return loading;
  loading = load()
    .catch((e) => console.error("geo db load failed", (e as Error).message))
    .finally(() => {
      loading = null;
    });
  return loading;
}

// countryOf returns the ISO-3166 alpha-2 country code for an IP, or null when geo
// is unavailable or the IP is private/invalid.
export async function countryOf(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  await ensure();
  if (!reader) return null;
  try {
    return reader.get(ip)?.country?.iso_code ?? null;
  } catch {
    return null;
  }
}
