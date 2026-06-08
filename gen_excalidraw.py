#!/usr/bin/env python3
"""Generate an Excalidraw diagram for the PQC Migration Platform system design."""
import json, itertools, random

random.seed(42)
_seed = itertools.count(1)
def seed():
    return random.randint(1, 2_000_000_000)

TS = 1700000000000
elements = []

# ---- color palette per layer ----
COL = {
    "user":   ("#1971c2", "#a5d8ff"),   # stroke, fill
    "edge":   ("#0c8599", "#99e9f2"),
    "svc":    ("#6741d9", "#d0bfff"),
    "bus":    ("#e8590c", "#ffd8a8"),
    "data":   ("#2f9e44", "#b2f2bb"),
    "disc":   ("#c2255c", "#fcc2d7"),
    "scan":   ("#e03131", "#ffc9c9"),
    "title":  ("#343a40", "transparent"),
}

def add_box(x, y, w, h, label, kind, fontSize=15):
    rid = f"r{next(_seed)}"
    tid = f"t{next(_seed)}"
    stroke, fill = COL[kind]
    elements.append({
        "id": rid, "type": "rectangle", "x": x, "y": y, "width": w, "height": h,
        "angle": 0, "strokeColor": stroke, "backgroundColor": fill, "fillStyle": "solid",
        "strokeWidth": 2, "strokeStyle": "solid", "roughness": 1, "opacity": 100,
        "groupIds": [], "frameId": None, "roundness": {"type": 3}, "seed": seed(),
        "version": 1, "versionNonce": seed(), "isDeleted": False,
        "boundElements": [{"type": "text", "id": tid}], "updated": TS, "link": None, "locked": False,
    })
    elements.append({
        "id": tid, "type": "text", "x": x + 6, "y": y + h/2 - 10, "width": w - 12, "height": 20,
        "angle": 0, "strokeColor": "#1e1e1e", "backgroundColor": "transparent", "fillStyle": "solid",
        "strokeWidth": 2, "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [],
        "frameId": None, "roundness": None, "seed": seed(), "version": 1, "versionNonce": seed(),
        "isDeleted": False, "boundElements": [], "updated": TS, "link": None, "locked": False,
        "fontSize": fontSize, "fontFamily": 2, "text": label, "textAlign": "center",
        "verticalAlign": "middle", "containerId": rid, "originalText": label,
        "lineHeight": 1.25, "baseline": 14,
    })
    return rid

def add_container(x, y, w, h, kind="title", dash=True):
    stroke, _ = COL[kind]
    elements.append({
        "id": f"c{next(_seed)}", "type": "rectangle", "x": x, "y": y, "width": w, "height": h,
        "angle": 0, "strokeColor": stroke, "backgroundColor": "transparent", "fillStyle": "solid",
        "strokeWidth": 2, "strokeStyle": "dashed" if dash else "solid", "roughness": 1, "opacity": 100,
        "groupIds": [], "frameId": None, "roundness": {"type": 3}, "seed": seed(),
        "version": 1, "versionNonce": seed(), "isDeleted": False,
        "boundElements": [], "updated": TS, "link": None, "locked": False,
    })

def _cx(box_id):
    for e in elements:
        if e["id"] == box_id:
            return e["x"] + e["width"] / 2
    raise KeyError(box_id)

def add_text(x, y, label, size=20, color="#343a40", bold=False):
    elements.append({
        "id": f"x{next(_seed)}", "type": "text", "x": x, "y": y,
        "width": len(label) * size * 0.6, "height": size + 6,
        "angle": 0, "strokeColor": color, "backgroundColor": "transparent", "fillStyle": "solid",
        "strokeWidth": 2, "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [],
        "frameId": None, "roundness": None, "seed": seed(), "version": 1, "versionNonce": seed(),
        "isDeleted": False, "boundElements": [], "updated": TS, "link": None, "locked": False,
        "fontSize": size, "fontFamily": 2, "text": label, "textAlign": "left",
        "verticalAlign": "top", "containerId": None, "originalText": label,
        "lineHeight": 1.25, "baseline": size - 4,
    })

def add_arrow(x1, y1, x2, y2, startId=None, endId=None, label=None, color="#495057", dashed=False):
    aid = f"a{next(_seed)}"
    dx, dy = x2 - x1, y2 - y1
    el = {
        "id": aid, "type": "arrow", "x": x1, "y": y1, "width": abs(dx), "height": abs(dy),
        "angle": 0, "strokeColor": color, "backgroundColor": "transparent", "fillStyle": "solid",
        "strokeWidth": 2, "strokeStyle": "dashed" if dashed else "solid", "roughness": 1, "opacity": 100,
        "groupIds": [], "frameId": None, "roundness": {"type": 2}, "seed": seed(),
        "version": 1, "versionNonce": seed(), "isDeleted": False, "boundElements": [],
        "updated": TS, "link": None, "locked": False,
        "points": [[0, 0], [dx, dy]], "lastCommittedPoint": None,
        "startBinding": {"elementId": startId, "focus": 0, "gap": 4} if startId else None,
        "endBinding": {"elementId": endId, "focus": 0, "gap": 4} if endId else None,
        "startArrowhead": None, "endArrowhead": "arrow",
    }
    elements.append(el)
    for box_id in (startId, endId):
        if box_id:
            for e in elements:
                if e["id"] == box_id:
                    e["boundElements"].append({"type": "arrow", "id": aid})
    return aid

# ============================ TITLE ============================
add_text(420, 24, "PQC Migration Platform — System Architecture", 28, "#1e1e1e")
add_text(420, 64, "Discover  →  Assess  →  Plan  →  Remediate & Attest   |   metadata-only across the trust boundary", 16, "#868e96")

# ============================ USERS / EDGE (left) ============================
u_web = add_box(60, 240, 250, 70, "Users (Web)\nAnalyst / Auditor / BU Owner", "user")
u_sso = add_box(60, 360, 250, 70, "SSO  (OIDC / SAML / SCIM)", "user")

# ============================ CONTROL PLANE container ============================
add_container(360, 150, 1640, 660, "svc")
add_text(380, 162, "CONTROL PLANE  (multi-tenant SaaS  /  customer-VPC  /  air-gapped)", 18, "#6741d9")

# top row
b_web = add_box(400, 210, 250, 70, "Web App\n(React / TS)", "edge")
b_api = add_box(700, 210, 360, 70, "API Gateway\nAuthN/Z · RBAC · tenant routing · rate-limit · audit", "edge")
b_intg = add_box(1110, 210, 360, 70, "Integration Service\nJira · ServiceNow · GitHub · SSO/SCIM", "edge")

# services row
b_cbom = add_box(400, 340, 300, 95, "CBOM Service\nnormalize→CycloneDX,\nasset graph, snapshots", "svc", 14)
b_risk = add_box(740, 340, 300, 95, "Risk & Scoring\nquantum status,\nHNDL, risk rollups", "svc", 14)
b_plan = add_box(1080, 340, 300, 95, "Migration Planner\nPQC algo rec,\nwave sequencing", "svc", 14)
b_rep  = add_box(1420, 340, 300, 95, "Reporting / Attestation\nCBOM export, PDF,\nsigned snapshots", "svc", 14)

# bus bar
b_bus = add_box(400, 500, 1320, 60, "Event Bus (Kafka / NATS)  +  Job Orchestrator   ·   async, idempotent, resumable", "bus")

# data row
b_pg   = add_box(400, 630, 300, 95, "Postgres\nmetadata, asset\ngraph, scores", "data", 14)
b_obj  = add_box(740, 630, 300, 95, "Object Store\nsigned snapshots,\nreports", "data", 14)
b_srch = add_box(1080, 630, 300, 95, "Search (OpenSearch)\nquery 10M+ assets", "data", 14)
b_aud  = add_box(1420, 630, 300, 95, "Audit Store\nhash-chained,\nappend-only", "data", 14)

# ============================ CUSTOMER BOUNDARY container ============================
add_container(360, 900, 1640, 320, "scan")
add_text(380, 912, "CUSTOMER BOUNDARY  (VPC / on-prem / cloud accounts)   —   private keys never leave", 18, "#c2255c")

b_disc = add_box(400, 955, 1320, 70,
    "Discovery Engine — Scan Orchestrator   ·   outbound-only mTLS   ·   pulls jobs, pushes METADATA (not key material)", "disc", 14)

# scanner modules
b_s1 = add_box(400, 1080, 250, 90, "Network / TLS\nProbe", "scan", 14)
b_s2 = add_box(675, 1080, 250, 90, "Cert / PKI\nScanner", "scan", 14)
b_s3 = add_box(950, 1080, 250, 90, "Code / IaC\nSAST", "scan", 14)
b_s4 = add_box(1225, 1080, 250, 90, "Cloud KMS /\nHSM Connector", "scan", 14)
b_s5 = add_box(1500, 1080, 220, 90, "SBOM /\nBinary Analyzer", "scan", 14)

# ============================ ARROWS ============================
# users -> edge
add_arrow(310, 270, 700, 245, u_web, b_api)
add_arrow(310, 390, 700, 255, u_sso, b_api)
add_arrow(525, 245, 700, 240, b_web, b_api)
add_arrow(185, 240, 525, 245, u_web, b_web)

# api gateway -> services
for tgt in (b_cbom, b_risk, b_plan, b_rep):
    add_arrow(880, 280, _cx(tgt), 340, b_api, tgt)

# integration -> reporting/planner (sync)
add_arrow(1290, 280, 1570, 340, b_intg, b_rep, dashed=True)

# services -> bus
for src in (b_cbom, b_risk, b_plan, b_rep):
    add_arrow(_cx(src), 435, _cx(src), 500, src, b_bus)

# bus -> data
for tgt in (b_pg, b_obj, b_srch, b_aud):
    add_arrow(_cx(tgt), 560, _cx(tgt), 630, b_bus, tgt)

# control plane <-> discovery engine (trust boundary, bidirectional metadata)
add_arrow(1060, 560, 1060, 955, b_bus, b_disc, color="#c2255c", dashed=True)

# discovery -> scanners
for tgt in (b_s1, b_s2, b_s3, b_s4, b_s5):
    add_arrow(_cx(tgt), 1025, _cx(tgt), 1080, b_disc, tgt, color="#c2255c")

out = {
    "type": "excalidraw", "version": 2, "source": "https://excalidraw.com",
    "elements": elements,
    "appState": {"gridSize": None, "viewBackgroundColor": "#ffffff"},
    "files": {},
}
with open("/home/user/infrastructure/pqc-system-design.excalidraw", "w") as f:
    json.dump(out, f, indent=2)
print("elements:", len(elements))
