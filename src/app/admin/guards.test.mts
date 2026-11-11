/**
 * A layout does not re-render on client navigation, so every admin page that reads data must check the founder
 * itself. Pages that only redirect read nothing and need no check.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const PANEL_FOLDER = join(import.meta.dirname, "(panel)");

function pagesUnder(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return pagesUnder(path);
    return name === "page.tsx" ? [path] : [];
  });
}

function isRedirectStub(source: string): boolean {
  const imports = source.match(/^import .*$/gm) ?? [];
  const onlyImportsRedirect = imports.length === 1 && imports[0].includes('{ redirect }');
  return onlyImportsRedirect && source.includes("redirect(");
}

test("every admin page checks the founder itself unless it only redirects", () => {
  const unguarded = pagesUnder(PANEL_FOLDER).filter((path) => {
    const source = readFileSync(path, "utf8");
    return !source.includes("await requireFounder()") && !isRedirectStub(source);
  });
  assert.deepEqual(unguarded.map((path) => path.slice(PANEL_FOLDER.length)), []);
});

test("the scan sees the admin pages", () => {
  assert.ok(pagesUnder(PANEL_FOLDER).length > 30);
});
