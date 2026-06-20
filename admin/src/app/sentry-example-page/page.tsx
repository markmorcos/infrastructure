import { notFound } from "next/navigation";
import { SentryTestButtons } from "./SentryTestButtons";

export const dynamic = "force-dynamic";

// Dev-only Sentry verification page. In production it 404s unless
// NEXT_PUBLIC_SENTRY_DEBUG=1, so it never adds public surface area.
export default function SentryExamplePage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DEBUG !== "1") {
    notFound();
  }
  return <SentryTestButtons />;
}
