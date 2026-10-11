/** Open spot checks wait for a founder; skipped ones were passed over, say because the preview was already gone. */
export const SPOT_CHECK_STATUSES = ["open", "done", "skipped"] as const;
export type SpotCheckStatus = (typeof SPOT_CHECK_STATUSES)[number];

/** What a founder rates on each spot check, 1 to 5. */
export const SPOT_CHECK_ASPECTS = [
  { field: "copyRating", label: "Copy", short: "Copy", hint: "Does it sound like this business, say the right things, and read cleanly?" },
  { field: "typographyRating", label: "Typography", short: "Type", hint: "Fonts, sizes, spacing between lines and letters." },
  { field: "layoutRating", label: "Layout", short: "Layout", hint: "Order of sections, spacing, alignment, how it holds up on a phone." },
] as const;
export type SpotCheckAspect = (typeof SPOT_CHECK_ASPECTS)[number]["field"];

/** Settings the founders control from the Spot checks page. */
export type SpotCheckSettings = {
  /** The share of finished previews picked for a spot check, 0 to 1. */
  share: number;
};

export const DEFAULT_SPOT_CHECK_SETTINGS: SpotCheckSettings = { share: 0.1 };
