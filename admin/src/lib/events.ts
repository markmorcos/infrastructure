import { EventEmitter } from "events";

// In-process event bus connecting the GitHub webhook handler to open SSE
// streams. Admin runs as a single replica, so a module-level emitter is all we
// need — the webhook POST and the SSE GET share the same Node process.
//
// (Redis pub/sub was the alternative, but the admin Redis ACL grants no channel
// access — `channels` is empty — so PUBLISH/SUBSCRIBE are denied. If admin is
// ever scaled out, grant the admin user channel access and switch back.)

const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open builds page

const EVENT = "builds";

export async function publishBuildsChanged(): Promise<void> {
  bus.emit(EVENT);
}

// subscribeBuildsChanged registers a listener; returns a cleanup function.
export function subscribeBuildsChanged(onChange: () => void): () => void {
  bus.on(EVENT, onChange);
  return () => {
    bus.off(EVENT, onChange);
  };
}
