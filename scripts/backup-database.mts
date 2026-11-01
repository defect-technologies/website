/**
 * Replaces the backup database (Neon) with the primary's contents (Supabase). GitHub Actions runs this weekly.
 *
 *   FROM_DATABASE_URL=postgres://...supabase.../... TO_DATABASE_URL=postgres://...neon.tech/... npx tsx scripts/backup-database.mts
 *
 * The primary is read from one snapshot, so rows written during the backup can't leave it inconsistent. The backup is
 * replaced in one transaction that commits only if every table's rows and checksum match, so a failed run leaves last
 * week's backup untouched. It prints no row counts because this repo's Actions logs are public.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const BATCH = 500;
const from = process.env.FROM_DATABASE_URL;
const to = process.env.TO_DATABASE_URL;
if (!from || !to) throw new Error("Set FROM_DATABASE_URL (the primary) and TO_DATABASE_URL (the backup).");

const primary = postgres(from, { prepare: false, max: 1, onnotice: () => {} });
const backup = postgres(to, { prepare: false, max: 1, onnotice: () => {} });

type Query = postgres.TransactionSql;

/** The public tables, each after every table its foreign keys point at. */
async function tablesInOrder(sql: Query): Promise<string[]> {
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

/** Supabase's pooler otherwise rounds decimals as it prints them, which would save rounded values in the backup. */
async function printDecimalsInFull(sql: Query): Promise<void> {
  await sql`set local extra_float_digits = 3`;
}

async function fingerprint(sql: Query, table: string): Promise<string> {
  const [row] = await sql`select count(*)::int as rows, md5(coalesce(json_agg(t)::text, '')) as hash from (select * from ${sql(table)} order by 1) t`;
  return `${row.rows}:${row.hash}`;
}

async function copyTable(source: Query, target: Query, table: string): Promise<void> {
  for (let offset = 0; ; offset += BATCH) {
    const [{ rows }] = await source`select coalesce(json_agg(t), '[]'::json)::text as rows from (select * from ${source(table)} order by 1 offset ${offset} limit ${BATCH}) t`;
    if ((JSON.parse(rows as string) as unknown[]).length === 0) return;
    await target`insert into ${target(table)} select * from json_populate_recordset(null::${target(table)}, ${rows as string}::json)`;
  }
}

async function resetSequences(target: Query, table: string): Promise<void> {
  const columns = await target`
    select column_name, pg_get_serial_sequence(${`public."${table}"`}, column_name) as sequence
    from information_schema.columns where table_schema = 'public' and table_name = ${table}`;
  for (const { column_name: column, sequence } of columns) {
    if (!sequence) continue;
    await target`select setval(${sequence}::regclass, coalesce((select max(${target(column as string)}) from ${target(table)}), 0) + 1, false)`;
  }
}

async function replaceBackup(source: Query, target: Query): Promise<number> {
  const tables = await tablesInOrder(source);
  const backupTables = new Set(await tablesInOrder(target));
  const missing = tables.filter((table) => !backupTables.has(table));
  if (missing.length) throw new Error(`The backup has no table for: ${missing.join(", ")}.`);
  await target`truncate ${target([...backupTables])}`;
  for (const table of tables) {
    await copyTable(source, target, table);
    await resetSequences(target, table);
    if ((await fingerprint(source, table)) !== (await fingerprint(target, table))) throw new Error(`${table} doesn't match after copying; the backup is unchanged.`);
  }
  return tables.length;
}

async function main(): Promise<void> {
  await migrate(drizzle(backup), { migrationsFolder: "drizzle" });
  const copied = await primary.begin("isolation level repeatable read read only", async (source) => {
    await printDecimalsInFull(source);
    return backup.begin(async (target) => {
      await printDecimalsInFull(target);
      return replaceBackup(source, target);
    });
  });
  console.log(`Backed up: all ${copied} tables match.`);
}

try {
  await main();
} finally {
  await Promise.all([primary.end(), backup.end()]);
}
