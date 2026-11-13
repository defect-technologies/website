/**
 * Every cron, engine, runner and bot route answers 401 without a valid token, and the runner routes refuse a key
 * that belongs to another bot. The list of routes is read from the folders, so a new route is covered on arrival,
 * and a route in these folders that checks no token at all fails the test.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { after, describe, mock, test } from "node:test";
import { startEmptyTestDatabase } from "../../server/emptyTestDatabase";

mock.module("server-only", { namedExports: {} });

const closeDatabase = await startEmptyTestDatabase();
const realEnvironment = { cron: process.env.CRON_SECRET, engine: process.env.ENGINE_TOKEN };
process.env.CRON_SECRET = "test-cron-secret";
process.env.ENGINE_TOKEN = "test-engine-token";

after(async () => {
  for (const [name, value] of [["CRON_SECRET", realEnvironment.cron], ["ENGINE_TOKEN", realEnvironment.engine]] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await closeDatabase();
});

const apiFolder = dirname(fileURLToPath(import.meta.url));
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const GUARDED_FOLDERS = ["cron", "engine", "runner", "bot"];

type RouteFile = { file: string; name: string; source: string };

function routeFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

const routes: RouteFile[] = routeFiles(apiFolder).map((file) => ({
  file,
  name: relative(apiFolder, file).split(sep).join("/"),
  source: readFileSync(file, "utf8"),
}));

const PUBLIC_BOT_INDEX = "bot/route.ts";
const inGuardedFolder = (route: RouteFile) => GUARDED_FOLDERS.includes(route.name.split("/")[0]) && route.name !== PUBLIC_BOT_INDEX;
const checksBearer = (route: RouteFile) => route.source.includes("hasBearer(");
const usesBotKey = (route: RouteFile) => /\b(botRoute|runnerRoute)\(/.test(route.source);
const bearerRoutes = routes.filter(checksBearer);
const keyedRoutes = routes.filter(usesBotKey);
const runnerRoutes = routes.filter((route) => route.name.startsWith("runner/"));

const routeContext = { params: Promise.resolve({ id: "x", job: "x", picture: "x" }) };
type Handler = (request: Request, context: typeof routeContext) => Promise<Response>;

async function handlersOf(route: RouteFile): Promise<Array<[string, Handler]>> {
  const loaded = (await import(pathToFileURL(route.file).href)) as Record<string, unknown>;
  return METHODS.filter((method) => typeof loaded[method] === "function").map((method) => [method, loaded[method] as Handler]);
}

const callWith = (method: string, authorization?: string) =>
  new Request("https://defect.tech/api/x", { method, headers: authorization ? { authorization } : {}, body: method === "GET" ? undefined : "{}" });

test("every route in the guarded folders checks a token", () => {
  const unguarded = routes.filter((route) => inGuardedFolder(route) && !checksBearer(route) && !usesBotKey(route)).map((route) => route.name);
  assert.deepEqual(unguarded, []);
  assert.ok(bearerRoutes.length >= 10 && keyedRoutes.length >= 20 && runnerRoutes.length >= 8);
});

describe("routes with a shared secret answer 401 without it", () => {
  for (const route of bearerRoutes) {
    test(route.name, async () => {
      const handlers = await handlersOf(route);
      assert.ok(handlers.length > 0);
      for (const [method, handler] of handlers) {
        for (const authorization of [undefined, "Bearer wrong", "test-cron-secret", "Bearer "]) {
          const response = await handler(callWith(method, authorization), routeContext);
          assert.equal(response.status, 401, `${method} with ${authorization ?? "no header"}`);
        }
      }
    });
  }
});

describe("routes with a bot key answer 401 without a valid key", () => {
  for (const route of keyedRoutes) {
    test(route.name, async () => {
      const handlers = await handlersOf(route);
      assert.ok(handlers.length > 0);
      for (const [method, handler] of handlers) {
        for (const authorization of [undefined, "Bearer wrong", "Bearer dbk_notarealkey"]) {
          const response = await handler(callWith(method, authorization), routeContext);
          assert.equal(response.status, 401, `${method} with ${authorization ?? "no header"}`);
        }
      }
    });
  }
});

describe("runner routes refuse the key of another bot", () => {
  for (const route of runnerRoutes) {
    test(route.name, async () => {
      const { createBotKey } = await import("../../server/bots/keys");
      const { key } = await createBotKey("outreach", `outreach for ${route.name}`, "test");
      for (const [method, handler] of await handlersOf(route)) {
        const response = await handler(callWith(method, `Bearer ${key}`), routeContext);
        assert.equal(response.status, 403, method);
      }
    });
  }
});
