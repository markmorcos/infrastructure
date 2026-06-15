import { Pool } from "pg";

type Pg = InstanceType<typeof Pool>;
const g = globalThis as unknown as {
  pgPool?: Pg;
  pgCmsPool?: Pg;
  pgExpPool?: Pg;
};

// One DATABASE_URL, three pools differing only by Postgres schema search_path:
// the control plane lives in `public`, the absorbed CMS in `cms`, and the
// experimentation platform in `experimentation` — one database, no table-name
// collisions (e.g. control-plane `projects` vs experimentation `projects`).
function makePool(searchPath?: string): Pg {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ...(searchPath ? { options: `-c search_path=${searchPath}` } : {}),
  });
}

export const pool = g.pgPool ?? makePool();
export const cmsPool = g.pgCmsPool ?? makePool("cms,public");
export const expPool = g.pgExpPool ?? makePool("experimentation,public");

if (process.env.NODE_ENV !== "production") {
  g.pgPool = pool;
  g.pgCmsPool = cmsPool;
  g.pgExpPool = expPool;
}
