import assert from "node:assert/strict";
import { mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });

test("a corrected name reaches the prospect and its lead while the lead is new, and never a contacted lead", async () => {
  const { db } = await import("./db/client.ts");
  const { businesses, prospects } = await import("./db/schema.ts");
  const { ProspectInput, upsertProspects, renameProspects } = await import("./prospects.ts");
  const { eq } = await import("drizzle-orm");
  const database = await db();
  const stamp = Date.now();
  const site = (n: number) => `https://rename-test-${stamp}-${n}.example`;
  await upsertProspects([1, 2].map((n) => ProspectInput.parse({ place_id: `rename-${stamp}-${n}`, business_name: "Los Angeles, CA", website: site(n) })));
  const rows = await database.select().from(prospects).where(eq(prospects.businessName, "Los Angeles, CA"));
  const [fresh, contacted] = [rows.find((r) => r.website === site(1))!, rows.find((r) => r.website === site(2))!];
  for (const [row, stage] of [[fresh, "new"], [contacted, "sent"]] as const) {
    const [lead] = await database.insert(businesses).values({ businessName: "Los Angeles, CA", slug: `rename-${stamp}-${stage}`, linkCode: `rename-${stamp}-${stage}`, website: row.website, stage } as never).returning({ id: businesses.id });
    await database.update(prospects).set({ businessId: lead.id }).where(eq(prospects.id, row.id));
  }
  const result = await renameProspects([{ id: fresh.id, businessName: "Styling Studio" }, { id: contacted.id, businessName: "Secret Tattoo Art" }]);
  assert.equal(result.prospects, 2);
  assert.equal(result.leads, 1);
  const leads = await database.select({ name: businesses.businessName, stage: businesses.stage }).from(businesses).where(eq(businesses.slug, `rename-${stamp}-new`));
  assert.equal(leads[0].name, "Styling Studio");
  const sent = await database.select({ name: businesses.businessName }).from(businesses).where(eq(businesses.slug, `rename-${stamp}-sent`));
  assert.equal(sent[0].name, "Los Angeles, CA");
  // The in-process Postgres stays open otherwise, and the test run never ends.
  await (database as unknown as { $client?: { close?: () => Promise<void> } }).$client?.close?.();
});
