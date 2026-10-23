/**
 * Who may use a client site: its owner, its editors, and nobody else.
 *
 *   npm test
 *
 * Runs against an in-memory Postgres (PGlite) migrated from drizzle/, with Next's cookies and cache stubbed.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { decodeJwt } from "jose";
import * as schema from "../db/schema";

process.env.AUTH_SECRET ??= "test-only-auth-secret-test-only-auth-secret";

const cookieJar = new Map<string, string>();
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
mock.module("server-only", {});
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => {
      throw Object.assign(new Error(`Redirected to ${url}`), { digest: `NEXT_REDIRECT;replace;${url};307;` });
    },
  },
});

const OWNER = "owner@nikkei.example";
const EDITOR = "board.member@nikkei.example";
const STRANGER = "stranger@elsewhere.example";
const PASSWORD = "correct horse battery";

const pglite = new PGlite();
const database = drizzle(pglite, { schema });
(globalThis as { defectDb?: Promise<unknown> }).defectDb = Promise.resolve(database);

const { addClientSite, changeSiteOwner, hasPortalAccess, portalSitesFor } = await import("./clientSites");
const { addEditorAndRecord, addSiteEditor, canEditSite, removeSiteEditor } = await import("./siteEditors");
const { emailPortalLink, setPassword, signInWithGoogle, signInWithLink, signInWithPassword } = await import("../portal/accounts");
const { currentPortalUser } = await import("../portal/session");
const { isOwnerOf, portalSite } = await import("../portal/context");
const { emailSignInLink, enterUrl, inspectSignInLink, spendSignInLink } = await import("../editor/signInLinks");
const { addEditorAction, removeEditorAction } = await import("@/app/portal/actions");

type Site = NonNullable<Awaited<ReturnType<typeof addClientSite>>>;
let site: Site;

const signInAs = async (email: string) => {
  cookieJar.clear();
  assert.equal(await signInWithGoogle(email), true);
};

/** Next's redirect() throws; the thrown digest says where it was sending the browser. */
async function redirectOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (error) {
    const digest = String((error as { digest?: string }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw error;
  }
  throw new Error("Expected a redirect.");
}

const formWith = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
};

const linkCodeFrom = (logged: string) => new URL(logged.match(/https?:\/\/\S+/)?.[0] ?? "").searchParams.get("code") ?? "";

before(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});

after(async () => {
  await pglite.close();
});

beforeEach(async () => {
  cookieJar.clear();
  await database.delete(schema.clientSites);
  await database.delete(schema.portalLinks);
  await database.delete(schema.portalFailedSignIns);
  await database.delete(schema.portalAccounts);
  const added = await addClientSite({ slug: "nikkei-nexus", ownerEmail: OWNER, url: "https://nikkei.example", businessId: null, createdBy: "test" });
  assert.ok(added);
  site = added;
  assert.equal(await addSiteEditor(site, EDITOR.toUpperCase(), OWNER), "added");
});

describe("portal access", () => {
  it("lists the site for its owner and its editor, each with their role, and nothing for a stranger", async () => {
    assert.deepEqual((await portalSitesFor(OWNER)).map((row) => [row.slug, row.role]), [["nikkei-nexus", "owner"]]);
    assert.deepEqual((await portalSitesFor(` ${EDITOR.toUpperCase()} `)).map((row) => [row.slug, row.role]), [["nikkei-nexus", "editor"]]);
    assert.deepEqual(await portalSitesFor(STRANGER), []);
  });

  it("lets owners and editors in, and keeps strangers out", async () => {
    assert.equal(await hasPortalAccess(OWNER), true);
    assert.equal(await hasPortalAccess(EDITOR), true);
    assert.equal(await hasPortalAccess(STRANGER), false);
    assert.equal(await signInWithGoogle(STRANGER), false);
  });

  it("signs a removed editor out on their next request", async () => {
    await signInAs(EDITOR);
    assert.deepEqual(await currentPortalUser(), { email: EDITOR });
    await removeSiteEditor(site.id, EDITOR);
    assert.equal(await hasPortalAccess(EDITOR), false);
  });

  it("stores editors lowercased, once each, and never the owner", async () => {
    assert.equal(await addSiteEditor(site, EDITOR, OWNER), "already-editor");
    assert.equal(await addSiteEditor(site, OWNER.toUpperCase(), OWNER), "is-owner");
    assert.equal(await addEditorAndRecord(site, "not an email", OWNER), "invalid");
  });

  it("drops the editor row when an editor becomes the owner", async () => {
    await changeSiteOwner(site.slug, EDITOR);
    assert.deepEqual((await portalSitesFor(EDITOR)).map((row) => row.role), ["owner"]);
    assert.deepEqual(await portalSitesFor(OWNER), []);
  });
});

describe("sign-in without account enumeration", () => {
  it("signs an editor in with their password and gives a stranger the same answer as a wrong password", async () => {
    assert.equal(await setPassword(EDITOR, "", PASSWORD), "saved");
    assert.equal(await setPassword(STRANGER, "", PASSWORD), "saved");
    assert.equal(await signInWithPassword(EDITOR, PASSWORD), "signed-in");
    assert.equal(await signInWithPassword(EDITOR, "wrong password here"), "wrong");
    assert.equal(await signInWithPassword(STRANGER, PASSWORD), "wrong");
    assert.equal(await signInWithPassword("nobody@nowhere.example", PASSWORD), "wrong");
  });

  it("answers an emailed-link request the same for owner, editor and stranger, and only mails people with a site", async () => {
    const logged: string[] = [];
    const info = mock.method(console, "info", (message: string) => void logged.push(message));
    try {
      for (const email of [OWNER, EDITOR, STRANGER]) assert.equal(await emailPortalLink(email, "/portal"), "sent");
    } finally {
      info.mock.restore();
    }
    const recipients = (await database.select().from(schema.portalLinks)).map((link) => link.email).sort();
    assert.deepEqual(recipients, [EDITOR, OWNER].sort());
    assert.ok(!logged.some((message) => message.includes(STRANGER)));
    const editorCode = linkCodeFrom(logged.find((message) => message.includes(EDITOR)) ?? "");
    assert.equal(await signInWithLink(editorCode), "/portal");
    assert.deepEqual(await currentPortalUser(), { email: EDITOR });
  });
});

describe("the editor token", () => {
  it("names the editor as sub and the site's slug, so their edits are logged under their own email", async () => {
    const token = new URL(await enterUrl(site, EDITOR)).searchParams.get("token") ?? "";
    const claims = decodeJwt(token);
    assert.equal(claims.sub, EDITOR);
    assert.equal(claims.site, "nikkei-nexus");
  });

  it("opens a founder's one-time link for an editor until they're removed", async () => {
    const logged: string[] = [];
    const info = mock.method(console, "info", (message: string) => void logged.push(message));
    try {
      await emailSignInLink(site, EDITOR);
      await emailSignInLink(site, EDITOR);
    } finally {
      info.mock.restore();
    }
    const [first, second] = logged.map(linkCodeFrom);
    assert.equal((await inspectSignInLink(first)).state, "ready");
    const destination = await spendSignInLink(first);
    assert.equal(decodeJwt(new URL(destination ?? "").searchParams.get("token") ?? "").sub, EDITOR);
    await removeSiteEditor(site.id, EDITOR);
    assert.deepEqual(await inspectSignInLink(second), { state: "expired", slug: "nikkei-nexus", forOwner: false });
    assert.equal(await spendSignInLink(second), null);
    assert.equal(await canEditSite(site, EDITOR), false);
  });
});

describe("editor management in the portal", () => {
  it("lets the owner add and remove editors", async () => {
    await signInAs(OWNER);
    const added = await redirectOf(() => addEditorAction(formWith({ site: site.slug, email: STRANGER })));
    assert.match(added, /editors=added/);
    assert.equal(await canEditSite(site, STRANGER), true);
    await redirectOf(() => removeEditorAction(formWith({ site: site.slug, email: STRANGER })));
    assert.equal(await canEditSite(site, STRANGER), false);
  });

  it("refuses an editor who tries to add or remove editors", async () => {
    await signInAs(EDITOR);
    const viewed = await portalSite({ email: EDITOR }, site.slug);
    assert.ok(viewed && !isOwnerOf(viewed));
    assert.equal(await redirectOf(() => addEditorAction(formWith({ site: site.slug, email: STRANGER }))), "/portal/account");
    assert.equal(await canEditSite(site, STRANGER), false);
    assert.equal(await redirectOf(() => removeEditorAction(formWith({ site: site.slug, email: EDITOR }))), "/portal/account");
    assert.equal(await canEditSite(site, EDITOR), true);
  });
});
