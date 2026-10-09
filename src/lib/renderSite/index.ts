/**
 * A TypeScript port of core/engine/preview/render.py and template/index.html.j2,
 * so the editor's preview is the same page the live site serves. The markup and
 * CSS are copied, not reinterpreted: when the template changes, change this too.
 */
import { DAY_LABEL, DAYS, sectionOrderOf, type Image, type OpenDay, type Section, type SiteContent } from "../siteContent";
import { statusScript } from "./statusScript";
import { siteStyles } from "./styles";
import { themeFor } from "./theme";

export type RenderOptions = {
  /** Where relative image paths in content.json resolve. Without one, photos render as plain placeholders. */
  assetBaseUrl?: string;
  studio?: string;
  /**
   * For the editor's preview frame: links stay put, and scroll position survives a re-render.
   * A srcdoc frame resolves "#visit" against the editor's URL, so even in-page links are scrolled by hand.
   */
  editorPreview?: boolean;
};

const PREVIEW_BRIDGE = `(function () {
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    e.preventDefault();
    var href = a.getAttribute("href");
    if (href.charAt(0) !== "#") return;
    var target = href.length > 1 && document.getElementById(href.slice(1));
    if (target) target.scrollIntoView({ behavior: "smooth" });
  });
  var queued = false;
  addEventListener("scroll", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; parent.postMessage({ previewScrollY: scrollY }, "*"); });
  }, { passive: true });
  addEventListener("message", function (e) {
    if (e.source === parent && e.data && typeof e.data.restoreScrollY === "number") scrollTo(0, e.data.restoreScrollY);
  });
})();`;

type Context = {
  c: SiteContent;
  img: (image: Image) => Image;
  phoneHref: string;
  directionsUrl: string;
  primary: { label: string; url: string } | null;
  gallery: Image[];
  aboutPhoto: Image | null;
};

const SOCIAL_LABELS = { instagram: "Instagram", facebook: "Facebook", yelp: "Yelp", tiktok: "TikTok" } as const;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value: string | undefined | null) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><rect width='600' height='600' fill='#E6E2DC'/><path d='M0 600 600 0' stroke='#D8D3CB' stroke-width='3'/></svg>",
  );

function imageResolver(assetBaseUrl?: string) {
  return (image: Image): Image => {
    if (/^(https?:|data:)/.test(image.src)) return image;
    if (!assetBaseUrl) return { src: PLACEHOLDER, alt: image.alt };
    return { src: new URL(image.src, assetBaseUrl).toString(), alt: image.alt };
  };
}

function fmtTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function weekRows(hours: OpenDay[]) {
  const byDay = new Map(hours.map((h) => [h.day, h]));
  return DAYS.map((day) => {
    const open = byDay.get(day);
    return { key: day, label: DAY_LABEL[day], text: open ? `${fmtTime(open.open)} to ${fmtTime(open.close)}` : "Closed" };
  });
}

function primaryAction(c: SiteContent, phoneHref: string) {
  const action = c.hero.primary_action;
  if (action?.url) return action;
  if (c.contact.booking_url) return { label: c.contact.booking_label || "Book online", url: c.contact.booking_url };
  if (phoneHref) return { label: "Call us", url: `tel:${phoneHref}` };
  if (c.contact.email) return { label: "Email us", url: `mailto:${c.contact.email}` };
  return null;
}

/** Mirrors render.py: one gallery photo moves to About once there are four, and the grid keeps whole rows of three. */
function splitGallery(images: Image[]) {
  const gallery = [...images];
  const aboutPhoto = gallery.length >= 4 ? (gallery.shift() ?? null) : null;
  const kept = gallery.length >= 3 ? gallery.slice(0, gallery.length - (gallery.length % 3)) : gallery;
  return { gallery: kept, aboutPhoto };
}

function visibleSections(ctx: Context): Section[] {
  const has: Record<Section, boolean> = {
    services: Boolean(ctx.c.services?.items?.length),
    about: Boolean(ctx.c.about?.paragraphs?.length),
    gallery: ctx.gallery.length > 0,
    visit: true,
  };
  return sectionOrderOf(ctx.c).filter((section) => has[section]);
}

function header(ctx: Context): string {
  const { c } = ctx;
  const brand = c.logo ? `<img src="${esc(ctx.img(c.logo).src)}" alt="${esc(c.logo.alt)}">` : esc(c.business.name);
  const links = [
    c.services?.items?.length ? `<a class="nav-link" href="#services">${esc(c.services.heading || "Services")}</a>` : "",
    c.about?.paragraphs?.length ? `<a class="nav-link" href="#about">About</a>` : "",
    `<a class="nav-link" href="#visit">${c.hours?.length ? "Hours and location" : "Contact"}</a>`,
    c.contact.phone ? `<a class="btn btn-solid btn-small" href="tel:${esc(ctx.phoneHref)}">Call</a>` : "",
  ];
  return `<header class="site-head"><div class="wrap"><a class="brand" href="#main">${brand}</a><nav class="site-nav" aria-label="Main">${links.join("")}</nav></div></header>`;
}

function heroActions(ctx: Context): string {
  const { c, primary } = ctx;
  const showCall = c.contact.phone && (!primary || !primary.url.startsWith("tel:"));
  return [
    primary ? `<a class="btn btn-solid" href="${esc(primary.url)}" data-track="Book">${esc(primary.label)}</a>` : "",
    showCall ? `<a class="btn btn-line" href="tel:${esc(ctx.phoneHref)}">Call ${esc(c.contact.phone)}</a>` : "",
    ctx.directionsUrl ? `<a class="btn btn-line" href="${esc(ctx.directionsUrl)}">Get directions</a>` : "",
  ].join("");
}

function hero(ctx: Context): string {
  const { c } = ctx;
  const image = c.hero.image ? ctx.img(c.hero.image) : null;
  const status = c.hours?.length ? `<p class="status" id="status" hidden><strong id="status-main"></strong><span id="status-sub"></span></p>` : "";
  const photo = image ? `<div class="hero-photo"><img src="${esc(image.src)}" alt="${esc(image.alt)}" width="800" height="800" fetchpriority="high"></div>` : "";
  return `<section class="hero${image ? " has-image" : ""}" aria-labelledby="hero-title"><div class="wrap"><div>
<h1 id="hero-title">${esc(c.hero.headline)}</h1>
<p class="what">${esc(c.hero.subheadline || c.business.what_we_do)}</p>
${status}<div class="actions">${heroActions(ctx)}</div></div>${photo}</div></section>`;
}

const block = (id: string, tint: boolean, inner: string) =>
  `<section class="block${tint ? " tinted" : ""}" id="${id}" aria-labelledby="${id}-title">${inner}</section>`;

function services(ctx: Context, tint: boolean): string {
  const s = ctx.c.services ?? {};
  const items = (s.items ?? [])
    .map((item) => {
      const price = item.price ? `<span class="leader" aria-hidden="true"></span><span class="price">${esc(item.price)}</span>` : "";
      const desc = item.description ? `<p class="desc">${esc(item.description)}</p>` : "";
      return `<li><div class="row"><span class="name">${esc(item.name)}</span>${price}</div>${desc}</li>`;
    })
    .join("");
  const intro = s.intro ? `<p class="intro">${esc(s.intro)}</p>` : "";
  return block("services", tint, `<div class="wrap"><h2 id="services-title">${esc(s.heading || "Services")}</h2>${intro}<ul class="menu">${items}</ul></div>`);
}

function about(ctx: Context, tint: boolean): string {
  const a = ctx.c.about ?? {};
  const photo = ctx.aboutPhoto ? ctx.img(ctx.aboutPhoto) : null;
  const paragraphs = (a.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join("");
  const img = photo ? `<img src="${esc(photo.src)}" alt="${esc(photo.alt)}" loading="lazy" width="600" height="600">` : "";
  return block("about", tint, `<div class="wrap about${photo ? " has-photo" : ""}"><div><h2 id="about-title">${esc(a.heading || "About us")}</h2>${paragraphs}</div>${img}</div>`);
}

function gallery(ctx: Context, tint: boolean): string {
  const count = ctx.gallery.length;
  const classes = `gallery${count >= 3 ? " feature" : ""}${count % 2 === 0 ? " even" : ""}`;
  const items = ctx.gallery.map((image) => ctx.img(image)).map((image) => `<li><img src="${esc(image.src)}" alt="${esc(image.alt)}" loading="lazy" width="600" height="600"></li>`);
  return block("gallery", tint, `<div class="wrap"><h2 id="gallery-title">Our work</h2><ul class="${classes}">${items.join("")}</ul></div>`);
}

function hoursTable(c: SiteContent): string {
  if (!c.hours?.length) return "";
  const rows = weekRows(c.hours).map((d) => `<tr data-day="${d.key}"><th scope="row">${d.label}</th><td>${d.text}</td></tr>`);
  const note = c.hours_note ? `<p class="note">${esc(c.hours_note)}</p>` : "";
  return `<div><table class="hours"><caption class="sr-only">Opening hours</caption><tbody>${rows.join("")}</tbody></table>${note}</div>`;
}

function contactList(ctx: Context): string {
  const { contact } = ctx.c;
  const address = contact.address_lines?.length ? `<li><span class="label">Address</span><address>${contact.address_lines.map(esc).join("<br>")}</address></li>` : "";
  const phone = contact.phone ? `<li><span class="label">Phone</span><a href="tel:${esc(ctx.phoneHref)}">${esc(contact.phone)}</a></li>` : "";
  const email = contact.email ? `<li><span class="label">Email</span><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></li>` : "";
  return `<ul class="contact-list">${address}${phone}${email}</ul>`;
}

function visit(ctx: Context, tint: boolean): string {
  const { primary, directionsUrl } = ctx;
  const actions = [
    primary ? `<a class="btn btn-solid" href="${esc(primary.url)}" data-track="Book">${esc(primary.label)}</a>` : "",
    directionsUrl ? `<a class="btn btn-line" href="${esc(directionsUrl)}">Get directions</a>` : "",
  ].join("");
  const heading = ctx.c.hours?.length ? "Hours and location" : "Get in touch";
  return block("visit", tint, `<div class="wrap"><h2 id="visit-title">${heading}</h2><div class="visit">${hoursTable(ctx.c)}<div>${contactList(ctx)}<div class="actions">${actions}</div></div></div></div>`);
}

const SECTION_RENDERERS: Record<Section, (ctx: Context, tint: boolean) => string> = { services, about, gallery, visit };

function footer(c: SiteContent, studio: string): string {
  const social = Object.entries(c.social ?? {})
    .filter(([key, url]) => url && key in SOCIAL_LABELS)
    .map(([key, url]) => `<li><a href="${esc(url)}">${SOCIAL_LABELS[key as keyof typeof SOCIAL_LABELS]}</a></li>`);
  const list = social.length ? `<ul class="social" aria-label="Social media">${social.join("")}</ul>` : "";
  return `<footer class="site-foot"><div class="wrap"><p>© <span id="year">${new Date().getFullYear()}</span> ${esc(c.business.name)}</p>${list}<p>Website kept current by ${esc(studio)}</p></div></footer>`;
}

function contextFor(c: SiteContent, options: RenderOptions): Context {
  const phoneHref = (c.contact.phone ?? "").replace(/[^\d+]/g, "");
  const address = c.contact.address_lines ?? [];
  const { gallery, aboutPhoto } = splitGallery(c.gallery ?? []);
  return {
    c,
    img: imageResolver(options.assetBaseUrl),
    phoneHref,
    directionsUrl: address.length ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.join(", ")).replace(/%20/g, "+")}` : "",
    primary: primaryAction(c, phoneHref),
    gallery,
    aboutPhoto,
  };
}

function hoursJson(hours: OpenDay[] | null | undefined): string {
  if (!hours?.length) return "null";
  return JSON.stringify(Object.fromEntries(hours.map((h) => [h.day, [h.open, h.close]]))).replace(/</g, "\\u003c");
}

/** The whole page as an HTML document, ready for an iframe's srcdoc. */
export function renderSite(c: SiteContent, options: RenderOptions = {}): string {
  const ctx = contextFor(c, options);
  const sections = visibleSections(ctx)
    .map((name, index) => SECTION_RENDERERS[name](ctx, index % 2 === 0))
    .join("\n");
  const title = c.business.category ? `${c.business.name}: ${c.business.category}` : c.business.name;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(c.business.what_we_do)}">
<style>${siteStyles(themeFor(c.style))}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${header(ctx)}
<main id="main">
${hero(ctx)}
${sections}
</main>
${footer(c, options.studio ?? "Defect Technologies")}
<script>${statusScript(hoursJson(c.hours))}</script>
${options.editorPreview ? `<script>${PREVIEW_BRIDGE}</script>` : ""}
</body>
</html>`;
}
