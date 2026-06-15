import { NextRequest, NextResponse } from "next/server";
import { resolveSdkKey, insertEvent } from "@/lib/experimentation/db";

// Public SDK track endpoint, ported from the Go service's handleTrack.
// POST /api/v1/track records an exposure or conversion event. CORS is open so
// browser apps can call it cross-origin.

const CORS = { "Access-Control-Allow-Origin": "*" } as const;
const MAX_BODY = 8 << 10; // ~8KB, matching the Go MaxBytesReader cap.

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

export async function POST(req: NextRequest) {
  let body: {
    key?: string;
    device?: string;
    experiment?: string;
    variant?: string;
    event?: string;
  };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) {
      return NextResponse.json(
        { error: "request body too large" },
        { status: 400, headers: CORS }
      );
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "invalid json" },
      { status: 400, headers: CORS }
    );
  }

  const { key, device, experiment, variant, event } = body;
  if (!key || !device || !experiment || !variant || !event) {
    return NextResponse.json(
      { error: "key, device, experiment, variant and event are required" },
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

    await insertEvent({
      projectId: rk.projectId,
      environmentId: rk.environmentId,
      experimentKey: experiment,
      variant,
      deviceId: device,
      event,
    });

    return new NextResponse(null, { status: 204, headers: CORS });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "could not record event" },
      { status: 500, headers: CORS }
    );
  }
}
