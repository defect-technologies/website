import assert from "node:assert/strict";
import { test } from "node:test";
import { turnsInOrder } from "./turn";

test("repairs come first, then designs, then the sites nobody has looked at, and no site is listed twice", () => {
  const repaired = [{ id: "lead-2", businessName: "Repaired Roofing" }];
  const boards = [{ id: "board-1", businessName: "Waiting Bakery" }];
  const previews = [
    { id: "lead-1", businessName: "New Dental" },
    { id: "lead-2", businessName: "Repaired Roofing" },
  ];
  assert.deepEqual(turnsInOrder(repaired, boards, previews), [
    { kind: "repair", href: "/admin/review?id=lead-2", businessName: "Repaired Roofing" },
    { kind: "design", href: "/admin/designs/board-1", businessName: "Waiting Bakery" },
    { kind: "review", href: "/admin/review?id=lead-1", businessName: "New Dental" },
  ]);
  assert.deepEqual(turnsInOrder([], [], []), []);
});
