import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env, isDevelopment } from "../env";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

/** Neon's own driver for a Neon address; any other Postgres (Supabase) over postgres.js. */
export function isNeon(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

/**
 * The database in DATABASE_URL: Neon over its HTTP driver, or any other Postgres over postgres.js (Supabase's
 * transaction pooler, which needs prepared statements off). Moving the admin off Neon is then only a change of
 * DATABASE_URL: Neon bills each minute the database is awake, and the admin, asked all day by the runner and the bots,
 * used up the free month on 28 October. On a laptop with no DATABASE_URL, an in-process Postgres (PGlite) under
 * .data/, migrated on first use. All speak the same Drizzle query API; nothing here relies on transactions, which
 * neon-http lacks.
 */
async function connect(): Promise<Db> {
  const url = env.databaseUrl();
  if (url && isNeon(url)) return drizzleNeon(neon(url), { schema });
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // A serverless function holds one connection; the pooler shares them out.
    return drizzle(postgres(url, { prepare: false, max: 1 }), { schema }) as unknown as Db;
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
