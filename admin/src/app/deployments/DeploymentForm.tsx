"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";

interface DeploymentFormProps {
  initialProjectName?: string;
  initialRepositoryName?: string;
  initialConfig?: string;
  initialToken?: string;
  onSubmit: (values: {
    projectName: string;
    repositoryName: string;
    config: unknown;
    token: string;
  }) => Promise<void>;
  loading: boolean;
  error: string | null;
  isEdit?: boolean;
  disableProjectName?: boolean;
}

interface FormValues {
  projectName: string;
  repositoryName: string;
  config: string;
  token: string;
}

const INITIAL_CONFIG =
  '{\n\
  "chartVersion": "",\n\
  "projectName": "example",\n\
  "ingress": {\n\
    "host": "example.com",\n\
    "path": "/",\n\
    "pathType": "Prefix"\n\
  },\n\
  "deployment": {\n\
    "image": "markmorcos/example",\n\
    "tag": "latest"\n\
  },\n\
  "service": {\n\
    "port": 80\n\
  }\n\
}';

export default function DeploymentForm({
  initialProjectName = "",
  initialRepositoryName = "",
  initialConfig = INITIAL_CONFIG,
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      projectName: initialProjectName,
      repositoryName: initialRepositoryName,
      config: initialConfig,
      token: initialToken,
    },
  });

  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setValue("projectName", initialProjectName);
    setValue("repositoryName", initialRepositoryName);
    setValue("config", initialConfig);
    setValue("token", initialToken);
  }, [
    initialProjectName,
    initialRepositoryName,
    initialConfig,
    initialToken,
    setValue,
  ]);

  const onFormSubmit = async (data: FormValues) => {
    setLocalError(null);
    await onSubmit({
      projectName: data.projectName,
      repositoryName: data.repositoryName,
      config: data.config,
      token: data.token,
    });
  };

  const configValue = watch ? watch("config") : initialConfig;

  return (
    <form
      className="deployment-form"
      onSubmit={handleSubmit(onFormSubmit)}
      autoComplete="off"
    >
      {!isEdit && (
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
              Repository Name
              <br />
              <input
                {...register("repositoryName", { required: true })}
                autoComplete="off"
              />
              {errors.repositoryName && (
                <span className="form-error">Repository name is required</span>
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
      )}
      <div className="form-group">
        <label>
          Config (JSON)
          <br />
          <div className="codemirror-responsive">
            <CodeMirror
              value={configValue}
              height="400px"
              extensions={[json()]}
              theme="dark"
              basicSetup={{ lineNumbers: true }}
              onChange={(value) =>
                setValue("config", value, { shouldValidate: true })
              }
            />
          </div>
          {errors.config && (
            <span className="form-error">Config is required</span>
          )}
        </label>
      </div>
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
