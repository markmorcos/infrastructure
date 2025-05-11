"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

interface DeploymentFormProps {
  initialProjectName?: string;
  initialToken?: string;
  onSubmit: (values: { projectName: string; token: string }) => Promise<void>;
  loading: boolean;
  error: string | null;
  isEdit?: boolean;
  disableProjectName?: boolean;
}

interface FormValues {
  projectName: string;
  token: string;
}

export default function DeploymentForm({
  initialProjectName = "",
  initialToken = "",
  onSubmit,
  loading,
  error,
  isEdit = false,
  disableProjectName = false,
}: DeploymentFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      projectName: initialProjectName,
      token: initialToken,
    },
  });

  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setValue("projectName", initialProjectName);
    setValue("token", initialToken);
  }, [initialProjectName, initialToken, setValue]);

  const onFormSubmit = async (data: FormValues) => {
    setLocalError(null);
    await onSubmit({
      projectName: data.projectName,
      token: data.token,
    });
  };

  return (
    <form
      className="deployment-form"
      onSubmit={handleSubmit(onFormSubmit)}
      autoComplete="off"
    >
      <>
        <div className="form-group">
          <label>
            Project Name
            <br />
            <input
              {...register("projectName", { required: true })}
              disabled={disableProjectName}
              autoComplete="off"
            />
            {errors.projectName && (
              <span className="form-error">Project name is required</span>
            )}
          </label>
        </div>
        <div className="form-group">
          <label>
            Token
            <br />
            <input
              {...register("token", { required: true })}
              autoComplete="off"
            />
            {errors.token && (
              <span className="form-error">Token is required</span>
            )}
          </label>
        </div>
      </>
      {(localError || error) && (
        <div className="form-error">{localError || error}</div>
      )}
      <button type="submit" disabled={loading || isSubmitting}>
        {loading || isSubmitting
          ? isEdit
            ? "Saving..."
            : "Creating..."
          : isEdit
          ? "Save Changes"
          : "Create Deployment"}
      </button>
    </form>
  );
}
