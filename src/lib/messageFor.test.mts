import assert from "node:assert/strict";
import { test } from "node:test";
import { messageFor } from "./messageFor";

const MESSAGES = { limited: "Wait a few minutes and try again." };

test("a known key gives its message", () => {
  assert.equal(messageFor(MESSAGES, "limited"), "Wait a few minutes and try again.");
});

test("an unknown key, no key, and a name every object has give no message", () => {
  for (const key of ["other", "", undefined, "constructor", "toString", "__proto__"]) {
    assert.equal(messageFor(MESSAGES, key), undefined, String(key));
  }
});
