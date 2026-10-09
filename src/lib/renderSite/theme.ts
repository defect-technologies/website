/** Port of the theme helpers in core/engine/preview/render.py. Keep the two in step. */

export type Preset = "classic" | "modern" | "warm";

type PresetTokens = {
  base: string;
  ink: string;
  muted: string;
  line: string;
  surface: string;
  displayFont: string;
  bodyFont: string;
  displayWeight: string;
  displayTracking: string;
  bodyLeading: string;
};

export type Theme = PresetTokens & { accent: string; accentInk: string; accentTint: string; onAccent: string };

const SYSTEM_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const CHARTER = "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif";

const PRESETS: Record<Preset, PresetTokens> = {
  classic: {
    base: "#FFFFFF", ink: "#1E2430", muted: "#58606E", line: "#DCDFE4", surface: "#F4F5F7",
    displayFont: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
    bodyFont: SYSTEM_SANS, displayWeight: "600", displayTracking: "-0.01em", bodyLeading: "1.6",
  },
  modern: {
    base: "#FFFFFF", ink: "#1D1F23", muted: "#5A5E65", line: "#E2E3E5", surface: "#F1F2F3",
    displayFont: "'Avenir Next', 'Segoe UI Variable Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    bodyFont: SYSTEM_SANS, displayWeight: "700", displayTracking: "-0.025em", bodyLeading: "1.55",
  },
  warm: {
    base: "#FCFAF7", ink: "#2A2421", muted: "#675D57", line: "#E7E1DA", surface: "#F4EFE9",
    displayFont: CHARTER, bodyFont: CHARTER, displayWeight: "700", displayTracking: "-0.01em", bodyLeading: "1.65",
  },
};

const FALLBACK_ACCENT = "#2F5D62";
const HEX = /^#[0-9a-fA-F]{6}$/;

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

function toHex(rgb: Rgb): string {
  return "#" + rgb.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0").toUpperCase()).join("");
}

function luminance(hex: string): number {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = toRgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function mix(a: string, b: string, amount: number): string {
  const ra = toRgb(a);
  const rb = toRgb(b);
  return toHex(ra.map((x, i) => x * amount + rb[i] * (1 - amount)) as Rgb);
}

/** Darkens the brand color until text in it is readable on the page (WCAG AA). */
function readableAccent(accent: string, base: string, minimum = 4.5): string {
  let color = accent;
  for (let step = 0; step < 40 && contrast(color, base) < minimum; step++) color = mix(color, "#000000", 0.93);
  return color;
}

export function themeFor(style: { preset?: string; accent?: string }): Theme {
  const preset = PRESETS[style.preset as Preset] ?? PRESETS.classic;
  const accent = style.accent && HEX.test(style.accent) ? style.accent : FALLBACK_ACCENT;
  const accentInk = readableAccent(accent, preset.base);
  return {
    ...preset,
    accent,
    accentInk,
    accentTint: mix(accent, preset.base, 0.1),
    onAccent: contrast("#FFFFFF", accentInk) >= 4.5 ? "#FFFFFF" : preset.ink,
  };
}
