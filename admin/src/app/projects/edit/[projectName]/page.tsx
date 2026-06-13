"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Project {
  projectName: string;
  repo: string | null;
  namespace: string | null;
  token: string;
  enabled: boolean;
}

export default function EditProjectPage() {
  const params = useParams();
  const projectName = params.projectName as string;

  const [loaded, setLoaded] = useState(false);
  const [repo, setRepo] = useState("");
  const [namespace, setNamespace] = useState("");
  const [token, setToken] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [secretName, setSecretName] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [secretMsg, setSecretMsg] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [secretSaving, setSecretSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`);
    if (!res.ok) {
      setError("Failed to load project");
      return;
    }
    const d: Project = await res.json();
    setRepo(d.repo ?? "");
    setNamespace(d.namespace ?? "");
    setToken(d.token ?? "");
    setEnabled(d.enabled);
    setLoaded(true);
  }, [projectName]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, namespace, token, enabled }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Failed to save");
      return;
    }
    setMessage("Saved");
    load();
  };

  const rotate = async () => {
    if (
      !confirm(
        "Re-mint the deployment token with the current cluster secret? Updates the DB and, if a repo is set, the repo's DEPLOYMENT_TOKEN secret."
      )
    )
      return;
    setError(null);
    setMessage(null);
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/rotate`,
      { method: "POST" }
    );
    const d = await res.json();
    if (!res.ok) {
      setError(d.error || "Rotate failed");
      return;
    }
    setMessage(
      d.pushedToRepo
        ? "Rotated + pushed DEPLOYMENT_TOKEN to repo"
        : d.repo
        ? `Rotated in DB, but repo push failed: ${d.pushError}`
        : "Rotated (DB only — no repo set)"
    );
    load();
  };

  const setK8sSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecretSaving(true);
    setSecretError(null);
    setSecretMsg(null);
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/k8s-secrets`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secretName,
          data: { [secretKey]: secretValue },
        }),
      }
    );
    const d = await res.json();
    setSecretSaving(false);
    if (!res.ok) {
      setSecretError(d.error || "Failed to set secret");
      return;
    }
    setSecretMsg(`Set ${secretKey} in ${d.secretName} (${d.namespace})`);
    setSecretValue("");
  };

  if (!loaded) return <div className="loading-state">Loading...</div>;

  return (
    <div className="edit-deployment-page">
      <div className="page-header">
        <div className="header-content">
          <Link href="/projects" className="back-link">
            &larr; Back to Projects
          </Link>
          <h1>Edit Project</h1>
          <p className="project-identifier">{projectName}</p>
        </div>
      </div>

      <form className="deployment-form" onSubmit={save} autoComplete="off">
        <div className="form-group">
          <label>
            Repo (owner/name)
            <br />
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="markmorcos/lea"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            Namespace
            <br />
            <input
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="lea"
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            Deployment token
            <br />
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-group">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: "auto" }}
            />
            Enabled
          </label>
        </div>

        {error && <div className="form-error">{error}</div>}
        {message && <div className="form-success">{message}</div>}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={rotate}
            style={{ background: "var(--accent)" }}
          >
            Rotate token
          </button>
        </div>
      </form>

      <div className="section-title">
        <h2>Set Kubernetes secret</h2>
      </div>
      <form className="deployment-form" onSubmit={setK8sSecret} autoComplete="off">
        <p className="page-description">
          Writes into namespace <strong>{namespace || "—"}</strong>. Creates the
          secret if missing, otherwise updates the key (other keys preserved).
        </p>
        <div className="form-group">
          <label>
            Secret name
            <br />
            <input
              value={secretName}
              onChange={(e) => setSecretName(e.target.value)}
              placeholder="resend-credentials"
              required
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            Key
            <br />
            <input
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="RESEND_API_KEY"
              required
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            Value
            <br />
            <input
              type="password"
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
        {secretError && <div className="form-error">{secretError}</div>}
        {secretMsg && <div className="form-success">{secretMsg}</div>}
        <button type="submit" disabled={secretSaving || !namespace}>
          {secretSaving ? "Writing..." : "Set Secret"}
        </button>
      </form>
    </div>
  );
}
