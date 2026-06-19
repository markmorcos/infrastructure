import Link from "next/link";
import { Card, Chip, Callout, buttonClass } from "@/components/ui";

export const metadata = { title: "Analytics" };

const PLAUSIBLE_URL = "https://plausible.morcos.tech";

// Analytics surface — self-hosted Plausible runs in-cluster (k8s/07-analytics.yaml).
// The dashboard itself lives at plausible.morcos.tech (its own auth); this page
// is the launch point + setup status inside the control plane.
export default function AnalyticsPage() {
  return (
    <div className="px-[14px] py-5 md:px-7 md:py-7" style={{ maxWidth: 900 }}>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span
            className="msym"
            style={{ fontSize: 34, color: "var(--md-sys-color-primary)" }}
          >
            bar_chart_4_bars
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 500 }}>Plausible Analytics</div>
            <div
              style={{
                fontFamily: "var(--cp-mono)",
                fontSize: 11.5,
                color: "var(--md-sys-color-on-surface-variant)",
                letterSpacing: ".04em",
              }}
            >
              self-hosted · privacy-first · no cookie banner
            </div>
          </div>
          <div className="flex-1" />
          <Chip tone="primary">in-cluster</Chip>
        </div>

        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--md-sys-color-on-surface-variant)",
            margin: 0,
          }}
        >
          Per-tenant pageviews and the signup → publish → paid funnel for the
          practa sites. Runs on the m720q k3s cluster: ClickHouse in-cluster for
          events, the existing host Postgres for metadata. GDPR-friendly, no
          personal data, no consent prompt.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <Link href={PLAUSIBLE_URL} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
            <span className="msym text-[18px]">open_in_new</span>
            Open dashboard
          </Link>
          <Link href={`${PLAUSIBLE_URL}/register`} target="_blank" rel="noreferrer" className={buttonClass("soft", "md")}>
            <span className="msym text-[18px]">person_add</span>
            Register owner
          </Link>
        </div>
      </Card>

      <div
        className="mt-6 mb-2.5"
        style={{
          fontFamily: "var(--cp-mono)",
          fontSize: 11,
          letterSpacing: ".1em",
          color: "var(--md-sys-color-on-surface-variant)",
        }}
      >
        {`// SETUP`}
      </div>

      <Callout tone="info" icon="info">
        First-time bootstrap (one-off, secrets are never committed): create the{" "}
        <code>plausible_db</code> Postgres database + user, then the{" "}
        <code>plausible-secrets</code> secret in the <code>analytics</code>{" "}
        namespace, and point <code>plausible.morcos.tech</code> at the cluster
        ingress. The full commands are in the header of{" "}
        <code>k8s/07-analytics.yaml</code>. Registration is open until you add the
        owner account, then flip <code>DISABLE_REGISTRATION</code> to{" "}
        <code>true</code>.
      </Callout>

      <Card className="mt-4 flex flex-col gap-3">
        <div
          style={{
            fontFamily: "var(--cp-mono)",
            fontSize: 11,
            letterSpacing: ".1em",
            color: "var(--md-sys-color-on-surface-variant)",
          }}
        >
          {`// TRACKING`}
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--md-sys-color-on-surface-variant)", margin: 0 }}>
          The practa renderer injects the Plausible script per tenant (each
          site&apos;s own domain as the data-domain) and sends custom events for
          the product funnel. Add each tenant domain as a site inside Plausible
          to start collecting.
        </p>
      </Card>
    </div>
  );
}
