import { NextRequest, NextResponse } from "next/server";
import {
  resolveSdkKey,
  featuresForEval,
  runningExperiments,
} from "@/lib/experimentation/db";
import { evalFeature, assignVariant } from "@/lib/experimentation/eval";

// Public SDK config endpoint, ported from the Go service's handleConfig.
// GET /api/v1/config?key=<sdkKey>&device=<id> returns every evaluated flag plus
// a variant assignment for each running experiment, for one device. CORS is
// open so browser apps can call it cross-origin.

const CORS = { "Access-Control-Allow-Origin": "*" } as const;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const device = req.nextUrl.searchParams.get("device");
  if (!key || !device) {
    return NextResponse.json(
      { error: "key and device are required" },
      { status: 400, headers: CORS }
    );
  }

  try {
    const rk = await resolveSdkKey(key);
    if (!rk) {
      return NextResponse.json(
        { error: "invalid sdk key" },
        { status: 401, headers: CORS }
      );
    }

    const [feats, exps] = await Promise.all([
      featuresForEval(rk.projectId, rk.environmentId),
      runningExperiments(rk.projectId),
    ]);

    const features: Record<string, unknown> = {};
    for (const fe of feats) {
      features[fe.key] = evalFeature(
        { key: fe.key, default_value: fe.default_value },
        { enabled: fe.enabled, value: fe.value, rollout: fe.rollout },
        device
      );
    }

    const experiments: Record<string, { variant: string }> = {};
    for (const e of exps) {
      experiments[e.key] = {
        variant: assignVariant(e.key, e.variants, e.control, device),
      };
    }

    return NextResponse.json(
      {
        project: rk.projectKey,
        environment: rk.environmentKey,
        features,
        experiments,
      },
      { headers: CORS }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "internal error" },
      { status: 500, headers: CORS }
    );
  }
}
