import type { Theme } from "./theme";

/** The stylesheet from core/engine/preview/template/index.html.j2, without the preview-only banner. */
export function siteStyles(t: Theme): string {
  return `:root {
  --base: ${t.base};
  --ink: ${t.ink};
  --muted: ${t.muted};
  --line: ${t.line};
  --surface: ${t.surface};
  --accent: ${t.accent};
  --accent-ink: ${t.accentInk};
  --accent-tint: ${t.accentTint};
  --on-accent: ${t.onAccent};
  --display: ${t.displayFont};
  --body: ${t.bodyFont};
  --display-weight: ${t.displayWeight};
  --display-tracking: ${t.displayTracking};
  --body-leading: ${t.bodyLeading};
  --radius: 6px;
  --wrap: 72rem;
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--base);
  color: var(--ink);
  font-family: var(--body);
  font-size: 1.0625rem;
  line-height: var(--body-leading);
}
img { max-width: 100%; display: block; }
a { color: var(--accent-ink); text-underline-offset: 0.18em; }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 3px; border-radius: 2px; }
.skip { position: absolute; left: -9999px; top: 0; background: var(--ink); color: var(--base); padding: 0.75rem 1rem; z-index: 10; }
.skip:focus { left: 1rem; top: 1rem; }
.wrap { max-width: var(--wrap); margin: 0 auto; padding: 0 1.25rem; }
h1, h2, h3 { font-family: var(--display); font-weight: var(--display-weight); letter-spacing: var(--display-tracking); line-height: 1.12; margin: 0; }
h2 { font-size: clamp(1.6rem, 1.2rem + 1.4vw, 2.25rem); margin-bottom: 1.25rem; }
h3 { font-size: 1.125rem; }
p { margin: 0 0 1em; max-width: 64ch; }


/* Header */
.site-head { border-bottom: 1px solid var(--line); }
.site-head .wrap { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 4.25rem; }
.brand { display: flex; align-items: center; gap: 0.75rem; color: var(--ink); text-decoration: none; font-family: var(--display); font-weight: var(--display-weight); font-size: 1.15rem; }
.brand img { height: 2.5rem; width: auto; }
.site-nav { display: flex; align-items: center; gap: 1.5rem; }
.site-nav a.nav-link { color: var(--ink); text-decoration: none; font-size: 0.98rem; }
.site-nav a.nav-link:hover { text-decoration: underline; }
@media (max-width: 760px) { .site-nav a.nav-link { display: none; } }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 2.9rem; padding: 0 1.25rem; border-radius: var(--radius); font-weight: 600; font-size: 1rem; text-decoration: none; border: 2px solid var(--accent-ink); }
.btn-solid { background: var(--accent-ink); color: var(--on-accent); }
.btn-solid:hover { filter: brightness(1.08); }
.btn-line { background: transparent; color: var(--accent-ink); }
.btn-line:hover { background: var(--accent-tint); }
.btn-small { min-height: 2.5rem; padding: 0 1rem; font-size: 0.95rem; }

/* Hero */
.hero .wrap { display: grid; gap: 2.5rem; padding-top: clamp(2.5rem, 6vw, 5rem); padding-bottom: clamp(2.5rem, 6vw, 5rem); align-items: center; }
.hero.has-image .wrap { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); }
@media (max-width: 860px) { .hero.has-image .wrap { grid-template-columns: 1fr; } }
.hero h1 { font-size: clamp(2.6rem, 1.6rem + 4.6vw, 5.25rem); line-height: 1.0; }
.hero .what { font-size: clamp(1.1rem, 1rem + 0.4vw, 1.3rem); color: var(--muted); margin: 1.25rem 0 0; max-width: 40ch; }
.status { margin: 1.75rem 0 0; padding: 0.9rem 1.1rem; border-left: 4px solid var(--accent); background: var(--accent-tint); border-radius: 0 var(--radius) var(--radius) 0; max-width: 34rem; }
.status strong { display: block; font-family: var(--display); font-size: clamp(1.25rem, 1.05rem + 0.8vw, 1.6rem); font-weight: var(--display-weight); letter-spacing: var(--display-tracking); color: var(--ink); }
.status span { color: var(--muted); font-size: 0.98rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.75rem; }
.hero-photo img { width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: cover; border-radius: var(--radius); }
@media (max-width: 860px) { .hero-photo img { aspect-ratio: 4 / 3; } }

/* Sections */
section.block { padding: clamp(3rem, 7vw, 5.5rem) 0; border-top: 1px solid var(--line); }
section.block.tinted { background: var(--surface); border-top: 0; }

/* Services as a menu: name and price on one line */
.menu { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); column-gap: 3rem; }
.menu li { padding: 1.1rem 0; border-bottom: 1px solid var(--line); }
.menu .row { display: flex; align-items: baseline; gap: 0.75rem; }
.menu .name { font-weight: 600; }
.menu .leader { flex: 1; border-bottom: 1px dotted var(--muted); transform: translateY(-0.3em); min-width: 1rem; }
.menu .price { font-variant-numeric: tabular-nums; white-space: nowrap; }
.menu .desc { color: var(--muted); margin: 0.35rem 0 0; font-size: 0.98rem; }
.intro { color: var(--muted); margin-bottom: 1.5rem; }

/* About */
.about { display: grid; gap: 2.5rem; grid-template-columns: minmax(0, 1fr); }
.about.has-photo { grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); align-items: start; }
@media (max-width: 860px) { .about.has-photo { grid-template-columns: 1fr; } }
.about img { height: auto; border-radius: var(--radius); aspect-ratio: 1 / 1; object-fit: cover; width: 100%; }

/* Gallery */
.gallery { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
.gallery:not(.feature) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.gallery.feature li:first-child { grid-column: span 2; grid-row: span 2; }
.gallery img { width: 100%; height: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: var(--radius); }
@media (max-width: 640px) {
  .gallery, .gallery:not(.feature) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gallery.feature li:first-child { grid-column: span 2; grid-row: span 1; }
  .gallery.feature.even li:first-child { grid-column: auto; }
}

/* Visit */
.visit { display: grid; gap: 3rem; grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); }
.hours { width: 100%; border-collapse: collapse; max-width: 26rem; }
.hours th, .hours td { text-align: left; padding: 0.55rem 0; border-bottom: 1px solid var(--line); font-weight: 400; }
.hours td { text-align: right; font-variant-numeric: tabular-nums; }
.hours tr.today th, .hours tr.today td { font-weight: 700; }
.hours tr.today th::after { content: " (today)"; font-weight: 400; color: var(--muted); }
.note { color: var(--muted); font-size: 0.98rem; margin-top: 0.9rem; }
.contact-list { list-style: none; margin: 0 0 1.5rem; padding: 0; }
.contact-list li { padding: 0.35rem 0; }
.contact-list .label { display: block; color: var(--muted); font-size: 0.9rem; }
address { font-style: normal; }

/* Footer */
.site-foot { border-top: 1px solid var(--line); padding: 2rem 0 2.5rem; color: var(--muted); font-size: 0.92rem; }
.site-foot .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; }
.site-foot a { color: var(--muted); }
.social { display: flex; gap: 1.25rem; flex-wrap: wrap; list-style: none; margin: 0 0 1em; padding: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
}
