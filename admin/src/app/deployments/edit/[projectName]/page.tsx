"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DeploymentForm from "../../DeploymentForm";

interface Deployment {
  projectName: string;
  repositoryName: string;
  config: unknown;
  token: string;
  createdAt: string;
  updatedAt: string;
}

export default function EditDeploymentPage() {
  const router = useRouter();
  const params = useParams();
  const projectName = params?.projectName as string;
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!projectName) return;
    fetch(
      `/infrastructure/admin/api/deployments/${encodeURIComponent(projectName)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setDeployment(data);
        else setError("Deployment not found");
      })
      .catch(() => setError("Failed to load deployment"));
  }, [projectName]);

  const handleUpdate = async ({ config }: { config: unknown }) => {
    setError(null);
    setLoading(true);
    const res = await fetch("/infrastructure/admin/api/deployments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectName, config }),
    });
    if (!res.ok) {
      setError("Failed to update deployment");
      setLoading(false);
      return;
    }
    setLoading(false);
    setSuccess(true);
    setTimeout(() => router.push("/deployments"), 1200);
  };

  if (error) return <div className="edit-deployment-error">{error}</div>;
  if (!deployment)
    return <div className="loading-state">Loading deployment...</div>;

  return (
    <div className="edit-deployment-page">
      <div className="page-header">
        <div className="header-content">
          <Link href="/deployments" className="back-link">
            &larr; Back to Deployments
          </Link>
          <h1>Edit Deployment</h1>
          <p className="project-identifier">{projectName}</p>
        </div>
      </div>

      <DeploymentForm
        initialProjectName={deployment.projectName}
        initialRepositoryName={deployment.repositoryName}
        initialConfig={
          typeof deployment.config === "object"
            ? JSON.stringify(deployment.config, null, 2)
            : String(deployment.config)
        }
        initialToken={deployment.token}
        onSubmit={({ config }) => handleUpdate({ config })}
        loading={loading}
        error={error}
        isEdit
        disableProjectName
      />
      {success && (
        <div className="form-success">
          Deployment configuration updated successfully!
        </div>
      )}
    </div>
  );
}
