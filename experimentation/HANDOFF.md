# CLAUDE_HANDOFF — Wire datewithmark.com into the experimentation platform

**Goal:** Make the live app **datewithmark.com** fetch its A/B/C variant (and any
flags) from the self-hosted experimentation platform instead of a hard-coded
switch, and report conversion — so we can measure which date-invite UX
(Sunset / Midnight / Linen) converts. This doc is self-contained.

## What already exists (don't rebuild)

A self-hosted **feature-flag + experimentation platform** lives in
`github.com/markmorcos/infrastructure` under `experimentation/` (Go, single
binary, Postgres).

- **Merged:** PR #12 ("Add experimentation platform … (#12)") is on `main`.
- **Pending:** PR #13 renames the seeded project `datebloom → datewithmark`.
  Assume the project key is **`datewithmark`** (if #13 isn't merged yet it's
  `datebloom` — confirm).
- **Live host:** `https://experimentation.morcos.tech` (public, Let's Encrypt,
  ingress-nginx). CORS is open on the SDK endpoints.
- **Admin UI:** `https://experimentation.morcos.tech/` — log in with the
  `ADMIN_TOKEN`. Shows projects, flags, experiments, and live results
  (two-proportion z-test).

### The seeded experiment (already configured)

- Project `datewithmark` → environment `production` (auto-created with a client
  **SDK key**).
- Experiment **`date_flow_variant`**, status `running`, control `sunset`, metric
  **`date_confirmed`**, variants **`sunset` 33 / `midnight` 33 / `linen` 34**.
- Assignment is deterministic (FNV-1a hash of `device:experiment`) — same device
  always gets the same variant; no per-user state.

### SDK API the app uses (auth = the client SDK key, NOT the admin token)

- `GET /api/v1/config?key=<sdkKey>&device=<id>` →
  ```json
  { "project": "datewithmark", "environment": "production",
    "features": { }, "experiments": { "date_flow_variant": { "variant": "midnight" } } }
  ```
- `POST /api/v1/track` →
  `{ "key": <sdkKey>, "device": <id>, "experiment": "date_flow_variant", "variant": "midnight", "event": "exposure" }`
  → `204`. `event` is `"exposure"` (denominator) or the conversion metric
  `"date_confirmed"`.

### Where to get the SDK key

Admin UI → `datewithmark` project → SDK keys, **or** the pod logs line
`seeded datewithmark project; production SDK key: sdk_…`. Store it as an env var
in the app (`NEXT_PUBLIC_EXP_SDK_KEY` / `EXPO_PUBLIC_EXP_SDK_KEY`).

## The task (in the datewithmark repo)

1. Add a small client module + hook (below).
2. **Replace the existing hard-coded A/B/C flag** with the variant from
   `date_flow_variant`.
3. Fire **`exposure`** once on load; fire **`date_confirmed`** on the confirm /
   add-to-calendar tap. Use the *same* variant value for both.
4. Ensure the three screens (Sunset / Midnight / Linen) are real components
   rendered off the variant. Figma is the source of truth (below).
5. Use a **stable per-device id** persisted across launches.

### Drop-in code (framework-agnostic + React/Expo)

```ts
// experimentation.ts
const API = "https://experimentation.morcos.tech";
const SDK_KEY = process.env.NEXT_PUBLIC_EXP_SDK_KEY!;   // EXPO_PUBLIC_… in Expo
const EXPERIMENT = "date_flow_variant";

function deviceId(): string {
  let id = localStorage.getItem("device_id");           // RN: AsyncStorage/SecureStore
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("device_id", id); }
  return id;
}
export async function loadConfig(device = deviceId()) {
  const r = await fetch(`${API}/api/v1/config?key=${SDK_KEY}&device=${device}`);
  return r.json() as Promise<{ features: Record<string, unknown>;
                               experiments: Record<string, { variant: string }> }>;
}
export function track(event: string, variant: string, device = deviceId()) {
  return fetch(`${API}/api/v1/track`, {
    method: "POST", keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: SDK_KEY, device, experiment: EXPERIMENT, variant, event }),
  });
}
```

```tsx
function useDateVariant() {
  const [variant, setVariant] = useState<string | null>(null);
  useEffect(() => { loadConfig().then((c) => {
    const v = c.experiments.date_flow_variant?.variant ?? "sunset";
    setVariant(v); track("exposure", v);
  }); }, []);
  return variant;
}
// render (replaces the hard-coded flag):
const variant = useDateVariant();
if (!variant) return <Splash/>;
return { sunset: <Sunset/>, midnight: <Midnight/>, linen: <Linen/> }[variant];
// on confirm tap: track("date_confirmed", variant);
```

## Gotchas / conventions

- **Stack unknown — confirm first.** Handoff history says Expo/React Native, but
  it's live on the web at datewithmark.com. For Expo/RN: swap
  `localStorage`→`AsyncStorage`/`SecureStore`, `crypto.randomUUID()`→
  `expo-crypto`/`uuid`, env prefix `EXPO_PUBLIC_`.
- Keep the variant identical between `exposure` and `date_confirmed` (the hook
  holds it) so assignment ↔ conversion line up.
- Don't ship the **admin token** in the app — only the client **SDK key**.
- Verify in the admin UI results page that exposures and `date_confirmed`
  populate and the z-test moves.

## Verify the platform is actually up first

The pod needs two secrets in the `experimentation` namespace (out-of-band):
`database-secrets/DATABASE_URL` (→ native Postgres on `m720q:5432`, schema
auto-migrates) and `experimentation-secrets/ADMIN_TOKEN`. If
`https://experimentation.morcos.tech/healthz` isn't 200, fix that before
integrating.

## Reference

- Platform repo/dir: `github.com/markmorcos/infrastructure` → `experimentation/`
  (see its `README.md`).
- Figma (3 UX directions, working name "Datebloom"):
  https://www.figma.com/design/3mmpGyrA8TpWHxQ1opkJVD — flow: ask → pick vibe →
  pick day → pick time → confirm + add-to-calendar. Sunset (warm), Midnight
  (bold/dark), Linen (minimal).
- Experiment serving host: `https://experimentation.morcos.tech`.
