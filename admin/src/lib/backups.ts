import { Client as MinioClient } from "minio";
import { KubeConfig, BatchV1Api, CoreV1Api } from "@kubernetes/client-node";

// Backups console data layer: list objects in the Cloudflare R2 backup bucket
// and spawn one-off restore Jobs in the `backups` namespace (which already holds
// the R2 / DB / Mongo / MinIO source secrets the backup CronJob uses).

const NS = "backups";
export type BackupKind = "postgres" | "mongo" | "redis" | "minio";

export interface BackupItem {
  kind: BackupKind;
  label: string; // db/bucket name
  key: string; // R2 object key (or minio/<bucket> for a whole bucket)
  ts: string; // ISO timestamp
  size: number;
  objects?: number; // for minio buckets
  restorable: boolean;
}

function r2(): { client: MinioClient; bucket: string } | null {
  const ep = process.env.R2_ENDPOINT;
  const ak = process.env.R2_ACCESS_KEY;
  const sk = process.env.R2_SECRET_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!ep || !ak || !sk || !bucket) return null;
  const u = new URL(ep);
  return {
    bucket,
    client: new MinioClient({
      endPoint: u.hostname,
      port: u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80,
      useSSL: u.protocol === "https:",
      accessKey: ak,
      secretKey: sk,
      region: "auto",
      pathStyle: true,
    }),
  };
}

export function backupsConfigured(): boolean {
  return r2() !== null;
}

export async function listBackups(): Promise<BackupItem[]> {
  const r = r2();
  if (!r) throw new Error("R2 not configured");
  const items: BackupItem[] = [];
  const buckets = new Map<string, { size: number; objects: number; ts: string }>();

  await new Promise<void>((resolve, reject) => {
    const stream = r.client.listObjectsV2(r.bucket, "", true);
    stream.on("data", (o) => {
      const name = (o.name as string) || "";
      const size = (o.size as number) || 0;
      const ts = (o.lastModified instanceof Date ? o.lastModified : new Date()).toISOString();
      let m: RegExpMatchArray | null;
      if (name.startsWith("postgres/")) {
        items.push({ kind: "postgres", label: "infrastructure", key: name, ts, size, restorable: true });
      } else if ((m = name.match(/^mongo\/(.+)-\d{8}-\d{6}\.archive\.gz$/))) {
        items.push({ kind: "mongo", label: m[1], key: name, ts, size, restorable: true });
      } else if ((m = name.match(/^redis\/(.+)-\d{8}-\d{6}\.rdb\.gz$/))) {
        items.push({ kind: "redis", label: m[1], key: name, ts, size, restorable: false });
      } else if (name.startsWith("minio/")) {
        const b = name.split("/")[1];
        if (b) {
          const e = buckets.get(b) ?? { size: 0, objects: 0, ts };
          e.size += size;
          e.objects += 1;
          if (ts > e.ts) e.ts = ts;
          buckets.set(b, e);
        }
      }
    });
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });

  for (const [b, e] of buckets) {
    items.push({ kind: "minio", label: b, key: `minio/${b}`, ts: e.ts, size: e.size, objects: e.objects, restorable: true });
  }
  items.sort((a, b) => b.ts.localeCompare(a.ts));
  return items;
}

let _kc: KubeConfig | null = null;
function kc(): KubeConfig {
  if (!_kc) {
    _kc = new KubeConfig();
    _kc.loadFromCluster();
  }
  return _kc;
}

const RESTORE_SCRIPT = `set -eu
apk add --no-cache --quiet ca-certificates wget mongodb-tools >/dev/null 2>&1 || true
wget -qO /tmp/mc https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x /tmp/mc
/tmp/mc alias set r2 "$R2_ENDPOINT" "$R2_ACCESS_KEY" "$R2_SECRET_KEY" >/dev/null
/tmp/mc alias set src "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null
echo "[restore] $RESTORE_KIND $RESTORE_KEY $RESTORE_NAME"
case "$RESTORE_KIND" in
  postgres)
    /tmp/mc cp "r2/$R2_BUCKET/$RESTORE_KEY" /tmp/d.gz
    gunzip -c /tmp/d.gz | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 ;;
  mongo)
    /tmp/mc cp "r2/$R2_BUCKET/$RESTORE_KEY" /tmp/a.gz
    uri=$(printenv "MONGO_URI_$(echo "$RESTORE_NAME" | tr '[:lower:]' '[:upper:]')")
    mongorestore --uri="$uri" --archive=/tmp/a.gz --gzip --drop ;;
  minio)
    /tmp/mc mirror --overwrite "r2/$R2_BUCKET/minio/$RESTORE_NAME" "src/$RESTORE_NAME" ;;
  *) echo "unknown restore kind"; exit 1 ;;
esac
echo "[restore] done"`;

const secretEnv = (name: string, secret: string, key: string) => ({
  name,
  valueFrom: { secretKeyRef: { name: secret, key } },
});

// createRestore spawns a Job that pulls the chosen backup from R2 and restores
// it (postgres replay, mongorestore --drop, or mc mirror back). Returns the job
// name. DESTRUCTIVE — the caller must gate this behind an explicit confirmation.
export async function createRestore(
  kind: BackupKind,
  key: string,
  name: string
): Promise<string> {
  const jobName = `restore-${kind}-${Date.now().toString(36)}`;
  const job = {
    metadata: { name: jobName, namespace: NS, labels: { app: "backup-restore" } },
    spec: {
      backoffLimit: 0,
      ttlSecondsAfterFinished: 1800,
      template: {
        spec: {
          restartPolicy: "Never",
          containers: [
            {
              name: "restore",
              image: "postgres:16-alpine",
              command: ["sh", "-c", RESTORE_SCRIPT],
              env: [
                { name: "RESTORE_KIND", value: kind },
                { name: "RESTORE_KEY", value: key },
                { name: "RESTORE_NAME", value: name },
                { name: "MINIO_ENDPOINT", value: "http://minio.data.svc.cluster.local:9000" },
                secretEnv("DATABASE_URL", "database-secrets", "DATABASE_URL"),
                secretEnv("MINIO_ACCESS_KEY", "cms-secrets", "S3_ACCESS_KEY"),
                secretEnv("MINIO_SECRET_KEY", "cms-secrets", "S3_SECRET_KEY"),
                secretEnv("R2_ENDPOINT", "backup-r2", "R2_ENDPOINT"),
                secretEnv("R2_BUCKET", "backup-r2", "R2_BUCKET"),
                secretEnv("R2_ACCESS_KEY", "backup-r2", "R2_ACCESS_KEY"),
                secretEnv("R2_SECRET_KEY", "backup-r2", "R2_SECRET_KEY"),
                secretEnv("MONGO_URI_EVENTLANE", "mongodb-credentials", "MONGODB_URI"),
                secretEnv("MONGO_URI_GAMES", "database-secret", "MONGO_URI"),
                secretEnv("MONGO_URI_GAMESMEMORY", "memory-database-secret", "MONGO_URI"),
              ],
            },
          ],
        },
      },
    },
  };
  await kc().makeApiClient(BatchV1Api).createNamespacedJob({ namespace: NS, body: job });
  return jobName;
}

export interface RestoreStatus {
  phase: "running" | "succeeded" | "failed";
  log: string;
}

export async function restoreStatus(jobName: string): Promise<RestoreStatus> {
  const batch = kc().makeApiClient(BatchV1Api);
  const core = kc().makeApiClient(CoreV1Api);
  const job = await batch.readNamespacedJob({ name: jobName, namespace: NS });
  const phase =
    (job.status?.succeeded ?? 0) > 0
      ? "succeeded"
      : (job.status?.failed ?? 0) > 0
        ? "failed"
        : "running";
  let log = "";
  try {
    const pods = await core.listNamespacedPod({
      namespace: NS,
      labelSelector: `job-name=${jobName}`,
    });
    const pod = pods.items?.[0]?.metadata?.name;
    if (pod) log = await core.readNamespacedPodLog({ name: pod, namespace: NS });
  } catch {
    // pod may not exist yet
  }
  return { phase, log };
}
