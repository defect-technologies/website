/**
 * One client cannot see or open the site of another client.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test, mock } from "node:test";
import { startEmptyTestDatabase } from "../emptyTestDatabase";

process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";
const cookieJar = new Map<string, string>();
mock.module("server-only", { namedExports: {} });
mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
      set: (name: string, value: string) => void cookieJar.set(name, value),
      delete: (name: string) => void cookieJar.delete(name),
    }),
  },
});
mock.module("next/cache", { namedExports: { revalidatePath: () => {} } });
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => {
      throw Object.assign(new Error(`Redirected to ${url}`), { digest: `NEXT_REDIRECT;replace;${url};307;` });
    },
  },
});

const closeDatabase = await startEmptyTestDatabase();
const { db } = await import("../db/client");
const schema = await import("../db/schema");
const { addClientSite } = await import("../sites/clientSites");
const { portalSite } = await import("./context");
const { signInWithGoogle } = await import("./accounts");
const { GET: openEditor } = await import("@/app/portal/edit/[slug]/route");
const { GET: openBilling } = await import("@/app/portal/(account)/billing/[slug]/route");

const BAKERY_OWNER = "owner@bakery.example";
const GARAGE_OWNER = "owner@garage.example";

after(async () => {
  await closeDatabase();
});

before(() => {
  process.env.SITE_URL ??= "https://defect.tech";
});

beforeEach(async () => {
  cookieJar.clear();
  await (await db()).delete(schema.clientSites);
  await addClientSite({ slug: "bakery", ownerEmail: BAKERY_OWNER, url: "https://bakery.example", businessId: null, createdBy: "test" });
  await addClientSite({ slug: "garage", ownerEmail: GARAGE_OWNER, url: "https://garage.example", businessId: null, createdBy: "test" });
});

const routeContext = (slug: string) => ({ params: Promise.resolve({ slug }) });
const locationOf = (response: Response) => new URL(response.headers.get("location") ?? "").pathname;

test("a client's site is found for them and not for another client", async () => {
  assert.equal((await portalSite({ email: BAKERY_OWNER }, "bakery"))?.slug, "bakery");
  assert.equal(await portalSite({ email: BAKERY_OWNER }, "garage"), null);
  assert.equal(await portalSite({ email: GARAGE_OWNER }, "bakery"), null);
});

test("the editor link of another client's site goes back to the portal", async () => {
  assert.equal(await signInWithGoogle(BAKERY_OWNER), true);
  const response = await openEditor(new Request("https://defect.tech/portal/edit/garage"), routeContext("garage"));
  assert.equal(locationOf(response), "/portal");
});

test("the billing link of another client's site never opens Stripe for it", async () => {
  assert.equal(await signInWithGoogle(BAKERY_OWNER), true);
  const response = await openBilling(new Request("https://defect.tech/portal/billing/garage"), routeContext("garage"));
  const location = new URL(response.headers.get("location") ?? "");
  assert.equal(location.pathname, "/portal/billing");
  assert.equal(location.searchParams.get("problem"), "missing");
});
