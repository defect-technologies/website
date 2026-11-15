import assert from "node:assert/strict";
import { test } from "node:test";
import { turnsInOrder } from "./turn";

const site = (id: string, businessName: string) => ({ id, businessName, previewUrl: `https://${id}.vercel.app`, held: false, since: null });

test("repairs come first, then designs, then the sites nobody has looked at, and no site is listed twice", () => {
  const repaired = [site("lead-2", "Repaired Roofing")];
  const designs = [{ id: "board-1", businessName: "Waiting Bakery", firstScreens: ["a.jpg", "b.jpg", "c.jpg"], since: null }];
  const sites = [site("lead-1", "New Dental"), site("lead-2", "Repaired Roofing")];
  assert.deepEqual(
    turnsInOrder(repaired, designs, sites).map((turn) => [turn.kind, turn.href, turn.businessName]),
    [
      ["repair", "/admin/review?id=lead-2", "Repaired Roofing"],
      ["design", "/admin/designs/board-1", "Waiting Bakery"],
      ["review", "/admin/review?id=lead-1", "New Dental"],
    ],
  );
  assert.deepEqual(turnsInOrder([], [], []), []);
});
