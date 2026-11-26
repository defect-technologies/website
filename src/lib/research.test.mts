import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_RESEARCH, listFromLines, nextSearches } from "./research";

describe("nextSearches", () => {
  it("takes the pairs never searched first, then the longest ago", () => {
    const settings = {
      ...DEFAULT_RESEARCH,
      niches: ["dentist", "florist"],
      areas: ["Pasadena, CA"],
      searchesPerNight: 1,
      searched: { "dentist|Pasadena, CA": "2026-11-20T00:00:00Z" },
    };
    assert.deepEqual(nextSearches(settings), [{ niche: "florist", area: "Pasadena, CA" }]);
    const both = { ...settings, searched: { ...settings.searched, "florist|Pasadena, CA": "2026-11-21T00:00:00Z" } };
    assert.deepEqual(nextSearches(both), [{ niche: "dentist", area: "Pasadena, CA" }]);
  });
});

describe("listFromLines", () => {
  it("drops blanks and repeats", () => assert.deepEqual(listFromLines(" a \n\nb\na\n"), ["a", "b"]));
});
