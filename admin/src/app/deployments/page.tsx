"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import DeploymentForm from "./DeploymentForm";

interface Deployment {
  projectName: string;
  repositoryName: string;
  config: unknown;
  token: string;
  createdAt: string;
  updatedAt: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeployments = async () => {
    const res = await fetch("/infrastructure/admin/api/deployments");
    const data = await res.json();
    setDeployments(data);
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const handleCreate = async ({
    projectName,
    repositoryName,
    config,
    token,
  }: {
    projectName: string;
    repositoryName: string;
    config: unknown;
    token: string;
  }) => {
    setError(null);
    setLoading(true);
    const res = await fetch("/infrastructure/admin/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, repositoryName, config, token }),
    });
    if (!res.ok) {
      setError("Failed to create deployment");
      setLoading(false);
      return;
    }
    setLoading(false);
    fetchDeployments();
  };

  return (
    <div className="deployments-page">
      <div className="page-header">
        <h1>Manage Deployments</h1>
        <p className="page-description">
          Create and manage your infrastructure deployments
        </p>
      </div>

      <div className="section-title">
        <h2>Create New Deployment</h2>
      </div>

      <DeploymentForm onSubmit={handleCreate} loading={loading} error={error} />

      <div className="section-title">
        <h2>All Deployments</h2>
        <span className="deployment-count">{deployments.length} Total</span>
      </div>

      {deployments.length === 0 ? (
        <div className="empty-state">
          <p>No deployments found. Create your first deployment above.</p>
        </div>
      ) : (
        <table className="deployments-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Repository</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((dep) => (
              <tr key={dep.projectName}>
                <td className="project-name">{dep.projectName}</td>
                <td className="repository-name">{dep.repositoryName}</td>
                <td>{new Date(dep.createdAt).toLocaleString()}</td>
                <td>{new Date(dep.updatedAt).toLocaleString()}</td>
                <td>
                  <Link
                    href={`/deployments/edit/${encodeURIComponent(
                      dep.projectName
                    )}`}
                    className="edit-link"
                  >
                    Edit Config
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
