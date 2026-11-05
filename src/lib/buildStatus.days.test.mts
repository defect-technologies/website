import assert from "node:assert/strict";
import { test } from "node:test";
import { jobsByDay } from "./buildStatus";
import { hiddenOutcomes } from "./previewJobs";

const job = (finishedAt: string | null) => ({ finishedAt: finishedAt ? new Date(finishedAt) : null, createdAt: new Date("2026-01-02T20:00:00Z") });
const NOON_NOV_4_LA = Date.parse("2026-11-04T20:00:00Z");

test("builds group by the day they finished in Los Angeles, not in UTC", () => {
  const days = jobsByDay([job("2026-11-04T17:00:00Z"), job("2026-11-04T07:30:00Z"), job("2026-11-03T09:00:00Z")], NOON_NOV_4_LA);
  assert.deepEqual(days.map((day) => [day.label, day.jobs.length]), [["Today", 1], ["Yesterday", 2]]);
});

test("older days are named, with the year once it isn't this year's", () => {
  const days = jobsByDay([job("2026-10-20T20:00:00Z"), job("2025-12-30T20:00:00Z")], NOON_NOV_4_LA);
  assert.deepEqual(days.map((day) => day.label), ["Tue, Oct 20", "Tue, Dec 30, 2025"]);
});

test("a finished build with no finish time falls on the day it was requested", () => {
  assert.equal(jobsByDay([job(null)], NOON_NOV_4_LA)[0].label, "Fri, Jan 2");
});

test("a hide value names only real outcomes, in a fixed order", () => {
  assert.deepEqual(hiddenOutcomes("skipped,nonsense,failed"), ["failed", "skipped"]);
  assert.deepEqual(hiddenOutcomes(undefined), []);
});
