"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Step {
  step: string;
  status: string;
  detail?: string;
}
interface Result {
  projectName: string;
  repo: string;
  namespace: string;
  ok: boolean;
  steps: Step[];
}

const OK_STATUSES = ["created", "exists", "set", "registered", "updated"];

export default function ProvisionPage() {
  const [projectName, setProjectName] = useState("");
  const [repo, setRepo] = useState("");
  const [namespace, setNamespace] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const provision = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/projects/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          repo: repo || undefined,
          namespace: namespace || undefined,
          private: isPrivate,
        }),
      });
      const d = await res.json();
      if (res.status >= 400 && d.error) {
        setError(d.error);
      } else {
        setResult(d);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="edit-deployment-page">
      <div className="page-header">
        <div className="header-content">
          <Link href="/projects" className="back-link">
            &larr; Back to Projects
          </Link>
          <h1>Provision Project</h1>
          <p className="page-description">
            Creates the repo, sets INFRASTRUCTURE_PAT + a minted DEPLOYMENT_TOKEN,
            scaffolds the deploy workflow + deployment.yaml, registers the dispatch
            type, and records it. Idempotent — safe to re-run.
          </p>
        </div>
      </div>

      <form className="deployment-form" onSubmit={provision} autoComplete="off">
        <div className="form-group">
          <label>
            Project name
            <br />
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-new-app"
              required
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            Repo (default markmorcos/&lt;name&gt;)
            <br />
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder={
                projectName ? `markmorcos/${projectName}` : "markmorcos/my-new-app"
              }
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            Namespace (default &lt;name&gt;)
            <br />
            <input
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder={projectName || "my-new-app"}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-group">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ width: "auto" }}
            />
            Private repo
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Provisioning..." : "Provision"}
        </button>
      </form>

      {result && (
        <div className="provision-report">
          <div className="section-title">
            <h2>{result.ok ? "Provisioned" : "Completed with errors"}</h2>
            <span className={`badge ${result.ok ? "badge-ok" : "badge-err"}`}>
              {result.repo}
            </span>
          </div>
          {result.steps.map((s) => (
            <div className="secret-row" key={s.step}>
              <span className="secret-key">{s.step}</span>
              <span
                className={`badge ${
                  OK_STATUSES.includes(s.status) ? "badge-ok" : "badge-err"
                }`}
              >
                {s.status}
                {s.detail ? `: ${s.detail}` : ""}
              </span>
            </div>
          ))}
          <p className="page-description" style={{ marginTop: "1rem" }}>
            Next: fill in <strong>deployment.yaml</strong> in the repo, then push to
            deploy.
          </p>
        </div>
      )}
    </div>
  );
}
