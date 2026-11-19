/**
 * A layout does not re-render on client navigation, so every admin page that reads data must check the founder
 * itself, and every designer page the designer. Pages that only redirect read nothing and need no check. Every server
 * action checks too: a founder's requireFounder, a designer's requireDesigner.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const PANEL_FOLDER = join(import.meta.dirname, "(panel)");
const DESIGNER_FOLDER = join(import.meta.dirname, "..", "designer", "(area)");

function filesUnder(folder: string, wanted: (name: string) => boolean): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return filesUnder(path, wanted);
    return wanted(name) ? [path] : [];
  });
}

const pagesUnder = (folder: string) => filesUnder(folder, (name) => name === "page.tsx");

/** The exported async functions of a "use server" file, each with its own body. */
function serverActions(path: string): { name: string; body: string }[] {
  const source = readFileSync(path, "utf8");
  if (!/^"use server";/m.test(source)) return [];
  const starts = [...source.matchAll(/^export async function (\w+)/gm)];
  return starts.map((start, index) => ({ name: start[1], body: source.slice(start.index, starts[index + 1]?.index ?? source.length) }));
}

/** Helpers in the same file that an action may call to do its check, such as one that finds the designer's own lead. */
function checksThrough(path: string, gate: string): string[] {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/^async function (\w+)[^]*?^}/gm)].filter((helper) => helper[0].includes(gate)).map((helper) => helper[1]);
}

/** Signing out reads nothing and changes nothing but the caller's own cookie. */
const isSignOut = (name: string) => /SignOut/.test(name);

function unguardedActions(folder: string, gate: string): string[] {
  return filesUnder(folder, (name) => name.endsWith(".ts")).flatMap((path) => {
    const helpers = checksThrough(path, gate);
    return serverActions(path)
      .filter((action) => !isSignOut(action.name) && !action.body.includes(gate) && !helpers.some((helper) => action.body.includes(`${helper}(`)))
      .map((action) => `${path.slice(folder.length)}: ${action.name}`);
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

test("every designer page checks the designer itself", () => {
  const pages = pagesUnder(DESIGNER_FOLDER);
  assert.ok(pages.length >= 6, "the scan sees the designer pages");
  const unguarded = pages.filter((path) => !readFileSync(path, "utf8").includes("await requireDesigner()"));
  assert.deepEqual(unguarded.map((path) => path.slice(DESIGNER_FOLDER.length)), []);
});

test("every founder server action checks the founder, and every designer one the designer", () => {
  assert.deepEqual(unguardedActions(PANEL_FOLDER, "requireFounder()"), []);
  assert.deepEqual(unguardedActions(DESIGNER_FOLDER, "requireDesigner()"), []);
  assert.ok(filesUnder(PANEL_FOLDER, (name) => name.endsWith(".ts")).flatMap(serverActions).length > 50, "the scan sees the founders' actions");
});
