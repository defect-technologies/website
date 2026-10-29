/**
 * Copies the admin's database from one Postgres to another: the move off Neon, whose free plan bills each minute the
 * database is awake (the admin, asked all day by the runner and the bots, used up the month on 28 October).
 *
 *   FROM_DATABASE_URL=postgres://...neon.tech/... TO_DATABASE_URL=postgres://...supabase.../... npx tsx scripts/copy-database.mts
 *
 * The new database gets every migration in drizzle/ first, so it has exactly this schema, then every table in the
 * public schema is copied, parents before the tables that point at them, and each table's rows and a checksum of its
 * whole contents are compared.
 * It refuses to copy into a database that already has rows, so running it twice can't double anything. Nothing is
 * written to the old database. Afterwards, point DATABASE_URL in Vercel at the new one (db/client.ts picks the driver
 * from the address).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const BATCH = 500;
const from = process.env.FROM_DATABASE_URL;
const to = process.env.TO_DATABASE_URL;
if (!from || !to) throw new Error("Set FROM_DATABASE_URL (the old database) and TO_DATABASE_URL (the new one).");

const source = postgres(from, { prepare: false, max: 1, onnotice: () => {} });
const target = postgres(to, { prepare: false, max: 1, onnotice: () => {} });

/** The public tables, each after every table its foreign keys point at. */
async function tablesInOrder(sql: postgres.Sql): Promise<string[]> {
  const tables = (await sql`select tablename from pg_tables where schemaname = 'public' order by tablename`).map((row) => row.tablename as string);
  const edges = await sql`
    select child.relname as child, parent.relname as parent
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_class parent on parent.oid = c.confrelid
    join pg_namespace n on n.oid = child.relnamespace
    where c.contype = 'f' and n.nspname = 'public' and child.relname <> parent.relname`;
  const parents = new Map(tables.map((table) => [table, new Set<string>()]));
  for (const { child, parent } of edges) parents.get(child)?.add(parent);
  const ordered: string[] = [];
  const placed = new Set<string>();
  while (ordered.length < tables.length) {
    const ready = tables.filter((table) => !placed.has(table) && [...parents.get(table)!].every((parent) => placed.has(parent)));
    if (ready.length === 0) throw new Error(`Foreign keys go round in a circle among: ${tables.filter((table) => !placed.has(table)).join(", ")}`);
    for (const table of ready) {
      ordered.push(table);
      placed.add(table);
    }
  }
  return ordered;
}

/** A table's whole contents, hashed: the copy matches row for row and value for value, not only in number. */
async function checksum(sql: postgres.Sql, table: string): Promise<string> {
  const [row] = await sql`select md5(coalesce(json_agg(t)::text, '')) as hash from (select * from ${sql(table)} order by 1) t`;
  return row.hash as string;
}

async function count(sql: postgres.Sql, table: string): Promise<number> {
  const [row] = await sql`select count(*)::int as n from ${sql(table)}`;
  return row.n as number;
}

/**
 * Copies a table a batch at a time. Each batch goes out of the old database as one JSON document and into the new one
 * through json_populate_recordset, so Postgres itself turns every value back into its column's type (dates, arrays,
 * enums, JSON) instead of a driver guessing them.
 */
async function copyTable(table: string): Promise<number> {
  let copied = 0;
  for (let offset = 0; ; offset += BATCH) {
    // Ordered by the first column (each table's id), so batches are stable.
    const [{ rows }] = await source`select coalesce(json_agg(t), '[]'::json)::text as rows from (select * from ${source(table)} order by 1 offset ${offset} limit ${BATCH}) t`;
    const batch = JSON.parse(rows as string) as unknown[];
    if (batch.length === 0) return copied;
    await target`insert into ${target(table)} select * from json_populate_recordset(null::${target(table)}, ${rows as string}::json)`;
    copied += batch.length;
  }
}

/** Serial and identity columns carry on after the copied rows instead of colliding with them. */
async function resetSequences(table: string): Promise<void> {
  const columns = await target`
    select column_name, pg_get_serial_sequence(${`public."${table}"`}, column_name) as sequence
    from information_schema.columns where table_schema = 'public' and table_name = ${table}`;
  for (const { column_name: column, sequence } of columns) {
    if (!sequence) continue;
    await target`select setval(${sequence}::regclass, coalesce((select max(${target(column as string)}) from ${target(table)}), 0) + 1, false)`;
  }
}

async function main(): Promise<void> {
  await migrate(drizzle(target), { migrationsFolder: "drizzle" });
  const tables = await tablesInOrder(target);
  const sourceTables = new Set(await tablesInOrder(source));
  const missing = [...sourceTables].filter((table) => !tables.includes(table));
  if (missing.length) throw new Error(`The new database has no table for: ${missing.join(", ")}. Is the old one on a newer schema?`);
  for (const table of tables) {
    if ((await count(target, table)) > 0) throw new Error(`${table} already has rows in the new database; copy only into an empty one.`);
  }
  const report: string[] = [];
  let mismatched = 0;
  for (const table of tables) {
    if (!sourceTables.has(table)) {
      report.push(`${table}: not in the old database, left empty`);
      continue;
    }
    const copied = await copyTable(table);
    await resetSequences(table);
    const [before, after] = [await count(source, table), await count(target, table)];
    const same = before === after && (await checksum(source, table)) === (await checksum(target, table));
    if (!same) mismatched += 1;
    report.push(`${table}: ${after} of ${before} rows${same ? ", identical" : "  MISMATCH"} (${copied} copied)`);
  }
  console.log(report.join("\n"));
  console.log(mismatched ? `${mismatched} tables don't match.` : `All ${tables.length} tables match.`);
  process.exitCode = mismatched ? 1 : 0;
}

try {
  await main();
} finally {
  await Promise.all([source.end(), target.end()]);
}
