import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./db/schema";

/**
 * Gives the calling test file its own in-memory Postgres (PGlite), migrated from drizzle/, in place of the shared
 * .data/pglite folder. Call it before the first import of db/client; the returned function closes the database.
 */
export async function startEmptyTestDatabase(): Promise<() => Promise<void>> {
  const pglite = new PGlite();
  const database = drizzle(pglite, { schema });
  await migrate(database, { migrationsFolder: "drizzle" });
  (globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);
  return () => pglite.close();
}
