import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env, isDevelopment } from "../env";
import * as schema from "./schema";
import { SUPABASE_CA } from "./supabaseCa";

export type Db = NeonHttpDatabase<typeof schema>;

/** Neon's own driver for a Neon address; any other Postgres (Supabase) over postgres.js. */
export function isNeon(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function isSupabase(url: string): boolean {
  return /\.supabase\.(com|co)$/.test(new URL(url).hostname);
}

/**
 * The database in DATABASE_URL: Neon over its HTTP driver, or any other Postgres over node-postgres (postgres.js stalls
 * on Supabase's poolers when queries overlap). Moving the admin off Neon is then only a change of
 * DATABASE_URL: Neon bills each minute the database is awake, and the admin, asked all day by the runner and the bots,
 * used up the free month on 28 October. On a laptop with no DATABASE_URL, an in-process Postgres (PGlite) under
 * .data/, migrated on first use. All speak the same Drizzle query API; nothing here relies on transactions, which
 * neon-http lacks.
 */
async function connect(): Promise<Db> {
  const url = env.databaseUrl();
  if (url && isNeon(url)) return drizzleNeon(neon(url), { schema });
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    // A serverless function holds one connection; the pooler shares them out.
    const pool = new Pool({ connectionString: url, max: 1, ssl: isSupabase(url) ? { ca: SUPABASE_CA } : undefined });
    // The pooler can drop an idle connection; without a listener that error would crash the function.
    pool.on("error", (error) => console.error("[db] Idle connection failed", error.message));
    return drizzle(pool, { schema }) as unknown as Db;
  }
  if (!isDevelopment) throw new Error("DATABASE_URL is not set.");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(".data", { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const local = drizzle(new PGlite(".data/pglite"), { schema });
  await migrate(local, { migrationsFolder: "drizzle" });
  return local as unknown as Db;
}

const globalForDb = globalThis as unknown as { defectDb?: Promise<Db> };

export function db(): Promise<Db> {
  globalForDb.defectDb ??= connect().catch((error) => {
    globalForDb.defectDb = undefined;
    throw error;
  });
  return globalForDb.defectDb;
}
