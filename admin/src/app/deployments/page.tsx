"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import DeploymentForm from "./DeploymentForm";

interface Deployment {
  projectName: string;
  token: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeployments = async () => {
    const res = await fetch("/api/deployments");
    const data = await res.json();
    setDeployments(data);
  };

  const toggleEnabled = async (projectName: string) => {
    const deployment = deployments.find((d) => d.projectName === projectName);
    if (!deployment) {
      setError("Deployment not found");
      return;
    }

    const res = await fetch("/api/deployments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName,
        token: deployment.token,
        enabled: !deployment.enabled,
      }),
    });

    if (!res.ok) {
      setError("Failed to update deployment");
      return;
    }

    fetchDeployments();
  };

  const deleteDeployment = async (projectName: string) => {
    const res = await fetch("/api/deployments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName }),
    });

    if (!res.ok) {
      setError("Failed to delete deployment");
      return;
    }

    fetchDeployments();
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const handleCreate = async ({
    projectName,
    token,
  }: {
    projectName: string;
    token: string;
  }) => {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, token }),
    });
    if (!res.ok) {
      setError("Failed to create deployment");
      setLoading(false);
      return;
    }
    setLoading(false);
    fetchDeployments();
  };

  if (loading) {
    return <div className="loading-state">Loading...</div>;
  }

  return (
    <div className="deployments-page">
      <div className="page-header">
        <h1>Deployments</h1>
        <p className="page-description">
          Manage your deployments and their configurations.
        </p>
      </div>

      <div className="section-title">
        <h2>Create New Deployment</h2>
      </div>

      <DeploymentForm onSubmit={handleCreate} loading={loading} error={error} />

      <div className="section-title">
        <h2>Existing Deployments</h2>
        <span className="deployment-count">{deployments.length}</span>
      </div>

      {deployments.length === 0 ? (
        <div className="empty-state">No deployments found</div>
      ) : (
        <table className="deployments-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((dep) => (
              <tr key={dep.projectName}>
                <td className="project-name" data-label="Project">
                  {dep.projectName}
                </td>
                <td data-label="Created">
                  {new Date(dep.createdAt).toLocaleString()}
                </td>
                <td data-label="Updated">
                  {new Date(dep.updatedAt).toLocaleString()}
                </td>
                <td data-label="Actions">
                  <div className="flex items-center gap-2">
                    <input
                      className="toggle-enabled"
                      type="checkbox"
                      checked={dep.enabled}
                      onChange={() => toggleEnabled(dep.projectName)}
                    />
                    <Link
                      href={`/deployments/edit/${encodeURIComponent(
                        dep.projectName
                      )}`}
                      className="edit-link"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() =>
                        confirm(
                          "Are you sure you want to delete this deployment?"
                        ) && deleteDeployment(dep.projectName)
                      }
                      className="edit-link"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
