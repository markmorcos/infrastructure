"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DeploymentForm from "../../DeploymentForm";

interface Deployment {
  projectName: string;
  token: string;
  createdAt: string;
  updatedAt: string;
}

export default function EditDeploymentPage() {
  const router = useRouter();
  const params = useParams();
  const projectName = params.projectName as string;
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchDeployment = async () => {
      try {
        const res = await fetch(
          `/api/deployments/${encodeURIComponent(projectName)}`
        );
        if (!res.ok) {
          throw new Error("Failed to fetch deployment");
        }
        const data = await res.json();
        setDeployment(data);
      } catch {
        setError("Failed to fetch deployment");
      }
    };
    fetchDeployment();
  }, [projectName]);

  const handleUpdate = async ({ token }: { token: string }) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/deployments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, token }),
      });
      if (!res.ok) {
        throw new Error("Failed to update deployment");
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/deployments");
      }, 2000);
    } catch {
      setError("Failed to update deployment");
    } finally {
      setLoading(false);
    }
  };

  if (!deployment) {
    return <div className="loading-state">Loading...</div>;
  }

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
        initialToken={deployment.token}
        onSubmit={({ token }) => handleUpdate({ token })}
        loading={loading}
        error={error}
        isEdit
        disableProjectName
      />
      {success && (
        <div className="form-success">Deployment updated successfully!</div>
      )}
    </div>
  );
}
