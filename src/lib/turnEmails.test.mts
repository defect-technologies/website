import assert from "node:assert/strict";
import { test } from "node:test";
import { designsWaitEmail, previewWaitsEmail } from "./turnEmails";

const OPTIONS = [
  { letter: "a", name: "Cream sunburst" },
  { letter: "b", name: "Night ribbon" },
  { letter: "c", name: "Open house" },
];

test("the email about three designs names them and links to where one is chosen", () => {
  const email = designsWaitEmail("JW Heating & Air", OPTIONS, "https://defect.tech/admin/designs/board-1");
  assert.equal(email.subject, "Choose a design for JW Heating & Air");
  assert.equal(
    email.body,
    ["Three designs for JW Heating & Air are ready.", "A. Cream sunburst\nB. Night ribbon\nC. Open house", "Choose one: https://defect.tech/admin/designs/board-1", "The build starts when one of you has chosen."].join("\n\n"),
  );
});

test("the email about a built site says what was built and why it waits", () => {
  const link = "https://defect.tech/admin/review?id=lead-1";
  const built = previewWaitsEmail({ business: "Acme Roofing", build: "built", wait: null, link });
  assert.equal(built.subject, "Review the site for Acme Roofing");
  assert.equal(built.body, `The site for Acme Roofing is built.\n\nReview it: ${link}`);

  const rebuilt = previewWaitsEmail({ business: "Acme Roofing", build: "rebuilt", wait: "held", link });
  assert.match(rebuilt.body, /^The site for Acme Roofing is rebuilt with the changes its note asked for\./);
  assert.match(rebuilt.body, /stays out of outreach until one of you approves it/);

  const forOwner = previewWaitsEmail({ business: "Acme Roofing", build: "rebuilt", wait: "owner", link: "https://defect.tech/admin" });
  assert.match(forOwner.body, /The owner still sees the earlier preview/);
  assert.match(forOwner.body, /Review it: https:\/\/defect\.tech\/admin$/);

  assert.match(previewWaitsEmail({ business: "Acme Roofing", build: "updated", wait: null, link }).body, /^The preview for Acme Roofing is updated\. You can now point at its parts\./);
});
