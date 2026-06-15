#!/usr/bin/env bash
set -euo pipefail

# Apply forward DB migrations by running them from a one-shot Job in the app's
# namespace. Each *.sql MUST be idempotent (re-applied every deploy). Files run
# in filename order, each in a single transaction; the first failure aborts.
#
# Env:
#   NAMESPACE       (required) namespace holding the DB secret; Job runs here
#   SECRET          (required) secret name with the connection string
#   KEY             (required) key in $SECRET holding DATABASE_URL
#   MIGRATIONS_DIR  (required) dir of *.sql files
#   JOB_NAME        (default: db-migrate-<epoch>)
#   PG_IMAGE        (default: postgres:16-alpine) — needs psql
#   TIMEOUT         (default: 300) seconds to wait for the Job

: "${NAMESPACE:?NAMESPACE is required}"
: "${SECRET:?SECRET is required}"
: "${KEY:?KEY is required}"
: "${MIGRATIONS_DIR:?MIGRATIONS_DIR is required}"
JOB_NAME="${JOB_NAME:-db-migrate-$(date +%s)}"
PG_IMAGE="${PG_IMAGE:-postgres:16-alpine}"
TIMEOUT="${TIMEOUT:-300}"
CM_NAME="${JOB_NAME}-sql"

command -v kubectl >/dev/null || { echo "kubectl required"; exit 1; }

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migrations found in $MIGRATIONS_DIR"; exit 0
fi

cleanup() { kubectl -n "$NAMESPACE" delete job "$JOB_NAME" cm "$CM_NAME" --ignore-not-found >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Ship the .sql files as a ConfigMap (one key per file).
kubectl -n "$NAMESPACE" delete cm "$CM_NAME" --ignore-not-found >/dev/null 2>&1 || true
kubectl -n "$NAMESPACE" create configmap "$CM_NAME" "${files[@]/#/--from-file=}"

# Run them from a Job in the namespace. Runtime vars (\$f, \$DATABASE_URL, the
# command substitution) are escaped so they evaluate in the container, not here.
kubectl -n "$NAMESPACE" apply -f - <<YAML
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 300
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: ${PG_IMAGE}
          command:
            - sh
            - -c
            - 'set -e; for f in \$(ls /sql/*.sql | sort); do echo "applying \$(basename \$f)"; psql "\$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "\$f"; done; echo "migrations complete"'
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: ${SECRET}
                  key: ${KEY}
          volumeMounts:
            - name: sql
              mountPath: /sql
      volumes:
        - name: sql
          configMap:
            name: ${CM_NAME}
YAML

# Tie the ConfigMap to the Job so k8s garbage-collects it when the Job's TTL
# removes the Job — a backstop to the EXIT trap, which is skipped if the runner
# cancels/kills the step (that orphaned a CM once).
JOB_UID=$(kubectl -n "$NAMESPACE" get job "$JOB_NAME" -o jsonpath='{.metadata.uid}' 2>/dev/null || true)
if [ -n "$JOB_UID" ]; then
  kubectl -n "$NAMESPACE" patch configmap "$CM_NAME" --type merge \
    -p "{\"metadata\":{\"ownerReferences\":[{\"apiVersion\":\"batch/v1\",\"kind\":\"Job\",\"name\":\"$JOB_NAME\",\"uid\":\"$JOB_UID\",\"blockOwnerDeletion\":false}]}}" >/dev/null 2>&1 || true
fi

echo "waiting for job/${JOB_NAME} in ${NAMESPACE} (timeout ${TIMEOUT}s) ..."
status=""
end=$((SECONDS + TIMEOUT))
while [ $SECONDS -lt $end ]; do
  succeeded=$(kubectl -n "$NAMESPACE" get job "$JOB_NAME" -o jsonpath='{.status.succeeded}' 2>/dev/null || true)
  failed=$(kubectl -n "$NAMESPACE" get job "$JOB_NAME" -o jsonpath='{.status.failed}' 2>/dev/null || true)
  [ "$succeeded" = "1" ] && { status=ok; break; }
  if [ -n "$failed" ] && [ "$failed" -ge 1 ] 2>/dev/null; then status=fail; break; fi
  sleep 3
done

echo "--- job logs ---"
kubectl -n "$NAMESPACE" logs "job/$JOB_NAME" --all-containers 2>/dev/null || true
echo "----------------"

if [ "$status" = ok ]; then echo "✅ migrations complete"; exit 0; fi
echo "❌ migration job did not succeed (status=${status:-timeout})"; exit 1
