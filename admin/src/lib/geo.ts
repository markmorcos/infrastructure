import { open, type Reader, type CountryResponse } from "maxmind";
import { x as tarExtract } from "tar";
import { mkdtemp, readdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Centralised IP → country lookup (GeoLite2-Country) for the analytics backend.
// Lives in admin so EVERY product that posts events gets country enrichment with
// no per-product setup. The DB is lazy-downloaded with the MaxMind license key on
// first use and cached in /tmp, refreshed weekly. The raw IP is used only for the
// lookup and never stored.

const EDITION = "GeoLite2-Country";
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

let reader: Reader<CountryResponse> | null = null;
let loadedAt = 0;
let loading: Promise<void> | null = null;

async function load(): Promise<void> {
  const key = process.env.MAXMIND_LICENSE_KEY;
  if (!key) return; // geo disabled until the key is present
  const url = `https://download.maxmind.com/app/geoip_download?edition_id=${EDITION}&license_key=${encodeURIComponent(key)}&suffix=tar.gz`;
  const dir = await mkdtemp(join(tmpdir(), "geolite-"));
  const tgz = join(dir, "db.tar.gz");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`maxmind download ${res.status}`);
  await writeFile(tgz, Buffer.from(await res.arrayBuffer()));
  await tarExtract({ file: tgz, cwd: dir });

  // The archive extracts to GeoLite2-Country_<date>/GeoLite2-Country.mmdb.
  const sub = (await readdir(dir)).find((n) => n.startsWith(EDITION) && !n.endsWith(".tar.gz"));
  if (!sub) throw new Error("mmdb folder missing");
  reader = await open<CountryResponse>(join(dir, sub, `${EDITION}.mmdb`));
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
