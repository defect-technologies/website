/**
 * Applies the migrations in drizzle/ to the database in DATABASE_URL (Neon, or any other Postgres).
 *
 *   DATABASE_URL=postgres://... npm run db:migrate
 */
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL to the database first.");

if (new URL(url).hostname.endsWith(".neon.tech")) {
  await migrateNeon(drizzleNeon(neon(url)), { migrationsFolder: "drizzle" });
} else {
  const client = postgres(url, { prepare: false, max: 1 });
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.end();
}
console.log("Migrations applied.");
