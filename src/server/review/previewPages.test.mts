/**
 * How the review page reads a preview for Claude's questions.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

mock.module("server-only", {});
const { condenseHtml, isPreviewAddress, linkedPages } = await import("./previewPages");

const ORIGIN = "https://crystal-dental-abc.vercel.app";

describe("isPreviewAddress", () => {
  it("reads only our Vercel previews over https", () => {
    assert.equal(isPreviewAddress(`${ORIGIN}/`), true);
    assert.equal(isPreviewAddress("http://crystal-dental-abc.vercel.app/"), false);
    assert.equal(isPreviewAddress("https://example.com/"), false);
    assert.equal(isPreviewAddress("not a url"), false);
  });
});

describe("linkedPages", () => {
  it("keeps up to three internal pages and skips files, anchors, assets and other sites", () => {
    const html = `<a href="/">Home</a><a href="/services">S</a><a href="/about#team">A</a><a href="/menu.pdf">M</a>
      <a href="https://elsewhere.com/x">X</a><a href="/_next/static/a">N</a><a href="/contact">C</a><a href="/hours">H</a><a href="/faq">F</a>`;
    assert.deepEqual(linkedPages(html, ORIGIN), ["/services", "/contact", "/hours"]);
  });
});

describe("condenseHtml", () => {
  it("drops scripts, comments, long SVG paths and inline data but keeps the markup", () => {
    const html = `<h1 class="hero">Smiles</h1><script>var a = 1;</script><!-- note --><path d="${"M0 0 ".repeat(30)}"/><img src="data:image/png;base64,AAAA" srcset="a 1x, b 2x">`;
    const condensed = condenseHtml(html, 10_000);
    assert.match(condensed, /<h1 class="hero">Smiles<\/h1>/);
    assert.doesNotMatch(condensed, /var a|note|srcset|AAAA|M0 0 M0/);
  });
});
