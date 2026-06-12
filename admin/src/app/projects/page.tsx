"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface RepoSecret {
  name: string;
  updatedAt: string;
}
interface K8sSecret {
  name: string;
  type: string;
  keys: string[];
}
type Source<T> = { ok: true; secrets: T[] } | { ok: false; error: string };

interface Project {
  projectName: string;
  repo: string | null;
  namespace: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  jwt: { sub: string | null; valid: boolean } | null;
  github: Source<RepoSecret>;
  k8s: Source<K8sSecret>;
}

const REQUIRED_SECRETS = ["INFRASTRUCTURE_PAT", "DEPLOYMENT_TOKEN"];
const MASK = "••••••••";

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load projects");
        setProjects(await res.json());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-state">Loading...</div>;

  return (
    <div className="deployments-page">
      <div className="page-header">
        <h1>Projects</h1>
        <p className="page-description">
          Every project, its GitHub Actions secrets and Kubernetes secrets, and
          its deployment token — at a glance.
        </p>
      </div>

      <div className="section-title">
        <h2>All Projects</h2>
        <span className="deployment-count">{projects.length}</span>
      </div>

      {error && <div className="edit-deployment-error">{error}</div>}

      {projects.length === 0 ? (
        <div className="empty-state">No projects found</div>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <div className="project-card" key={p.projectName}>
              <div className="project-card-head">
                <div>
                  <Link
                    href={`/deployments/edit/${encodeURIComponent(p.projectName)}`}
                    className="project-name"
                  >
                    {p.projectName}
                  </Link>
                  {p.repo && <div className="repository-name">{p.repo}</div>}
                </div>
                <span className={`badge ${p.enabled ? "badge-ok" : "badge-off"}`}>
                  {p.enabled ? "enabled" : "disabled"}
                </span>
              </div>

              <div className="project-meta">
                <span>ns: {p.namespace ?? "—"}</span>
                {p.jwt && (
                  <span className={`badge ${p.jwt.valid ? "badge-ok" : "badge-err"}`}>
                    sub={p.jwt.sub ?? "?"} {p.jwt.valid ? "✓" : "invalid"}
                  </span>
                )}
              </div>

              <div className="secret-block">
                <div className="secret-block-title">GitHub secrets</div>
                {p.github.ok ? (
                  <>
                    <div className="required-row">
                      {REQUIRED_SECRETS.map((name) => {
                        const present =
                          p.github.ok &&
                          p.github.secrets.some((s) => s.name === name);
                        return (
                          <span
                            key={name}
                            className={`badge ${present ? "badge-ok" : "badge-err"}`}
                          >
                            {present ? "✓" : "✗"} {name}
                          </span>
                        );
                      })}
                    </div>
                    {p.github.secrets.length === 0 ? (
                      <div className="secret-empty">none</div>
                    ) : (
                      p.github.secrets.map((s) => (
                        <div className="secret-row" key={s.name}>
                          <span className="secret-key">{s.name}</span>
                          <span className="secret-meta">{timeAgo(s.updatedAt)}</span>
                        </div>
                      ))
                    )}
                  </>
                ) : (
                  <div className="secret-error">{p.github.error}</div>
                )}
              </div>

              <div className="secret-block">
                <div className="secret-block-title">
                  Kubernetes secrets{p.namespace ? ` (${p.namespace})` : ""}
                </div>
                {p.k8s.ok ? (
                  p.k8s.secrets.length === 0 ? (
                    <div className="secret-empty">none</div>
                  ) : (
                    p.k8s.secrets.map((s) => (
                      <div className="secret-row k8s" key={s.name}>
                        <span className="secret-key">{s.name}</span>
                        <span className="secret-meta">
                          {s.keys.map((k) => (
                            <span className="k8s-key" key={k}>
                              {k}: {MASK}
                            </span>
                          ))}
                        </span>
                      </div>
                    ))
                  )
                ) : (
                  <div className="secret-error">{p.k8s.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
