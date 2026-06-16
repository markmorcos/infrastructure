import { randomBytes } from "crypto";
import { cmsPool as pool } from "@/lib/db";
import { createSite, assignSiteOwner, importDict } from "./admin";
import { upsertSeedSections } from "./seed";
import { therapistContent } from "./presets/therapist";
import { createUser, findUserIdByEmail } from "@/lib/users";

// spawnSite composes the existing CMS primitives into a one-call site creation:
// a studio-rendered cms.sites row + seeded section schemas + seeded (live)
// placeholder content + per-site settings + an owner. The site is live at
// `<key>.practa.co` the moment this returns. The caller is responsible for
// invite email / response. Currently only the "therapist" preset exists.

export interface SpawnInput {
  key: string;
  name: string;
  ownerEmail: string;
  brandColor?: string;
  calcomUrl?: string;
  preset?: string;
  locales?: string[];
}

export interface SpawnResult {
  siteKey: string;
  ownerUserId: number;
  isNewOwner: boolean;
}

export async function spawnSite(input: SpawnInput): Promise<SpawnResult> {
  const locales = input.locales?.length ? input.locales : ["de", "en"];
  const preset = input.preset ?? "therapist";

  const site = await createSite({
    key: input.key,
    name: input.name,
    locales,
    defaultLocale: locales[0],
    presetId: preset,
  });

  await upsertSeedSections(site.id);
  await importDict(site, therapistContent);

  // Per-site settings, set on both live + draft so the new site renders themed
  // immediately and the draft (Preview) matches.
  const settings: Record<string, unknown> = { contactEmail: input.ownerEmail };
  if (input.brandColor) settings.brandColor = input.brandColor;
  if (input.calcomUrl) settings.calcomUrl = input.calcomUrl;
  await pool.query(
    `UPDATE sites SET settings = $2::jsonb, settings_draft = $2::jsonb WHERE id = $1`,
    [site.id, JSON.stringify(settings)]
  );

  // Owner: reuse an existing account (additive — doesn't disturb their other
  // sites) or create a locked editor (random password) to be set via invite.
  let ownerUserId = await findUserIdByEmail(input.ownerEmail);
  const isNewOwner = ownerUserId === null;
  if (ownerUserId === null) {
    ownerUserId = await createUser(input.ownerEmail, randomBytes(24).toString("hex"), "editor");
  }
  await assignSiteOwner(site.id, ownerUserId);

  return { siteKey: site.key, ownerUserId, isNewOwner };
}
