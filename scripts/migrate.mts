/**
 * Applies the migrations in drizzle/ to the database in DATABASE_URL.
 *
 *   DATABASE_URL=postgres://... npm run db:migrate
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL to the Neon database first.");

await migrate(drizzle(neon(url)), { migrationsFolder: "drizzle" });
console.log("Migrations applied.");
