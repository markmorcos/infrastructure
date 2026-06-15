import { NextRequest } from "next/server";
import { subscribeBuildsChanged } from "@/lib/events";

// SSE stream of "builds changed" events (driven by GitHub webhooks). The builds
// page subscribes and refetches on each event. Admin-only via middleware.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(enc.encode(`data: ${data}\n\n`));
        } catch {
          // controller closed
        }
      };
      send("connected");
      // "changed" or "changed:<runId>" so the client can refetch the affected
      // run's jobs specifically.
      const unsub = subscribeBuildsChanged((runId) =>
        send(runId ? `changed:${runId}` : "changed"),
      );
      const ping = setInterval(() => send("ping"), 25_000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx response buffering for SSE
    },
  });
}
