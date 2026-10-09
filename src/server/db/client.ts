import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env, isDevelopment } from "../env";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

/**
 * Neon in production. On a laptop with no DATABASE_URL, an in-process Postgres
 * (PGlite) under .data/, migrated on first use. Both speak the same Drizzle
 * query API; nothing here relies on transactions, which neon-http lacks.
 */
async function connect(): Promise<Db> {
  const url = env.databaseUrl();
  if (url) return drizzleNeon(neon(url), { schema });
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
