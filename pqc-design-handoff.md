# Design Handoff — PQC Migration Platform System Architecture Diagram

**To:** Claude (design)
**From:** Systems/architecture
**Goal:** Produce a clean, presentation-grade architecture diagram of the platform described below. This brief is self-contained — you do not need any prior conversation. Render the visual; do not redesign the system.

---

## 1. What to produce

A single **system architecture diagram** (landscape, ~16:9) that a non-technical exec *and* a security architect can both read. Two clearly separated zones stacked vertically:

1. **Control Plane** (our managed SaaS / private deployment)
2. **Customer Boundary** (runs inside the customer's network)

…connected by ONE emphasized link that is the story of the product: **metadata crosses the boundary, private keys never do.**

Deliverable formats: editable source (FigJam or Figma) + PNG + SVG export.

---

## 2. Context (one paragraph, for your understanding only — do not put on canvas)

This is a platform that helps regulated enterprises migrate to post-quantum cryptography (PQC). It **discovers** every place cryptography lives across their estate, **assesses** quantum risk, **plans** a migration to PQC algorithms, and **tracks** remediation to completion. The defining trust decision: discovery runs *inside* the customer's network and sends back only *metadata* (algorithm types, cert inventory, risk signals) — never private keys or secret material.

---

## 3. Nodes (exact labels, grouped by zone)

### Zone A — Users / Edge (small, left side, feeding into Control Plane)
- **Web Users** — Analyst / Auditor / BU Owner
- **SSO** — OIDC / SAML / SCIM

### Zone B — CONTROL PLANE  *(container label: "Control Plane — SaaS / customer-VPC / air-gapped")*
Row 1 (edge tier):
- **Web App** (React)
- **API Gateway** — AuthN/Z · RBAC · tenant routing · audit
- **Integration Service** — Jira · ServiceNow · GitHub · SSO/SCIM

Row 2 — sub-group **"Services"** (4 boxes side by side):
- **CBOM Service** — normalize → CycloneDX, asset graph, snapshots
- **Risk & Scoring** — quantum status, HNDL flag, risk rollups
- **Migration Planner** — PQC algorithm rec, wave sequencing
- **Reporting / Attestation** — CBOM export, signed snapshots

Row 3 (full-width bar):
- **Event Bus (Kafka / NATS) + Job Orchestrator** — async, idempotent, resumable

Row 4 — sub-group **"Data Stores"** (4 boxes side by side):
- **Postgres** — metadata, asset graph, scores
- **Object Store** — signed snapshots, reports
- **Search (OpenSearch)** — query 10M+ assets
- **Audit Store** — hash-chained, append-only

### Zone C — CUSTOMER BOUNDARY  *(container label: "Customer Boundary — VPC / on-prem / cloud accounts · private keys never leave")*
Full-width bar:
- **Discovery Engine — Scan Orchestrator** — outbound-only mTLS · pulls jobs, pushes metadata (not key material)

Sub-group **"Scanner Modules"** (5 boxes side by side):
- **Network / TLS Probe**
- **Cert / PKI Scanner**
- **Code / IaC SAST**
- **Cloud KMS / HSM Connector**
- **SBOM / Binary Analyzer**

---

## 4. Connections (directed edges)

```
Web Users           → Web App
Web Users           → API Gateway
SSO                 → API Gateway
Web App             → API Gateway
API Gateway         → CBOM Service
API Gateway         → Risk & Scoring
API Gateway         → Migration Planner
API Gateway         → Reporting / Attestation
Integration Service → Reporting / Attestation   (label: "sync tickets", dashed)
CBOM Service        → Event Bus
Risk & Scoring      → Event Bus
Migration Planner   → Event Bus
Reporting/Attest    → Event Bus
Event Bus           → Postgres
Event Bus           → Object Store
Event Bus           → Search
Event Bus           → Audit Store
Event Bus  <——————> Discovery Engine   ★ EMPHASIZE: bidirectional, dashed, label "mTLS — jobs down, metadata up · NO key material"
Discovery Engine    → Network / TLS Probe
Discovery Engine    → Cert / PKI Scanner
Discovery Engine    → Code / IaC SAST
Discovery Engine    → Cloud KMS / HSM Connector
Discovery Engine    → SBOM / Binary Analyzer
```

---

## 5. Visual style

- **Layout:** top-to-bottom flow. Users (left) → Control Plane (upper container) → Customer Boundary (lower container). Keep the two containers as large rounded rectangles with dashed borders and translucent fills.
- **Color coding (use as fills, keep light/pastel so text stays black):**
  - Edge/Users tier — cyan `#99e9f2` / stroke `#0c8599`
  - Services — purple `#d0bfff` / stroke `#6741d9`
  - Event Bus — orange `#ffd8a8` / stroke `#e8590c`
  - Data Stores — green `#b2f2bb` / stroke `#2f9e44`
  - Discovery + Scanners — pink/red `#ffc9c9` / stroke `#e03131`
  - Container outlines — Control Plane purple, Customer Boundary pink
- **The trust-boundary edge** (Event Bus ↔ Discovery Engine) should be the visually heaviest line: thicker stroke, pink `#c2255c`, dashed, with the label in a callout. This is the hero of the diagram.
- **Typography:** clean sans-serif (Inter/Helvetica). Node titles bold ~15px, sub-text regular ~12px grey. Container titles ~18px in the container's accent color.
- **Diagram title (top):** "PQC Migration Platform — System Architecture"
- **Subtitle:** "Discover → Assess → Plan → Remediate & Attest   ·   metadata-only across the trust boundary"
- Generous whitespace, orthogonal (right-angle) connectors, no crossing lines where avoidable.

---

## 6. Optional companion views (only if asked / time permits)

1. **The 4-pillar value flow** (simple horizontal): `Discover → Assess → Plan → Remediate & Attest`, each with a one-line outcome.
2. **Free-assessment onboarding flow** (the GTM wedge): Sign up → deploy Discovery Engine (or grant read-only role) → scoped scan → "N quantum-vulnerable assets, X internet-facing, Y harvest-now-decrypt-later" report in < 30 min.

---

## 7. Source material

An editable Excalidraw version of this exact diagram already exists at `pqc-system-design.excalidraw` in this repo, and a Mermaid `flowchart TB` definition is in the architecture doc. Use either as a starting reference — but the layout/style guidance above takes precedence.

*Note: keep all text on canvas exactly as written in §3 and §4; these are reviewed labels.*
