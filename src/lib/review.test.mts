import assert from "node:assert/strict";
import { test } from "node:test";
import { compileReviewNote, tasteMarkdown, type ReviewNote } from "./review";
import { samePage } from "./reviewAsks";

const pointed: ReviewNote = {
  id: "a",
  text: " The heading is too small. ",
  scope: "site",
  device: "phone",
  path: "/about",
  anchor: { path: "/about", selector: "section:nth-of-type(2) > h2", tag: "h2", text: "Meet   the team" },
};

const general: ReviewNote = { id: "b", text: "Never put the phone number in a pill.", scope: "every", device: "desktop", path: "/", anchor: null };

test("each note becomes a numbered change with its page, width and element", () => {
  const note = compileReviewNote([pointed, general], "https://x.vercel.app");
  assert.match(note, /reviewed the preview at https:\/\/x\.vercel\.app/);
  assert.match(note, /1\. On \/about at phone width, 390 px, the <h2> at `section:nth-of-type\(2\) > h2` \("Meet the team"\): The heading is too small\.$/m);
  assert.match(note, /2\. On \/ at desktop width, 1440 px, the page as a whole: Never put the phone number in a pill\. This is also a standing taste lesson/m);
});

test("taste lessons are a markdown list, and nothing at all when there are none", () => {
  assert.equal(tasteMarkdown([]), "");
  const markdown = tasteMarkdown([{ text: "No pills.\nEver." }]);
  assert.match(markdown, /^# Founder taste lessons/);
  assert.match(markdown, /^- No pills\. Ever\.$/m);
});

test("samePage matches a page whatever its query, hash or trailing slash", () => {
  assert.equal(samePage("/menu", "/menu/?from=nav#top"), true);
  assert.equal(samePage("/", "/?preview=1"), true);
  assert.equal(samePage("/menu", "/contact"), false);
});
