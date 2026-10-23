/**
 * Reading Vercel's deployment webhook.
 *
 *   npm test
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { isSignedByVercel, leadPreviewFrom } from "./vercelDeployHook";

const PROJECT_ID = "prj_4ckcP8kNPgMgx6xha75Zo2rWnYRV";

function succeeded(overrides: { target?: string | null; meta?: Record<string, string>; projectId?: string; name?: string } = {}) {
  return {
    type: "deployment.succeeded",
    payload: {
      target: overrides.target ?? null,
      project: { id: overrides.projectId ?? PROJECT_ID },
      deployment: {
        name: overrides.name ?? "defect-previews",
        url: "defect-previews-cs69n0fw8-defect-technologies.vercel.app",
        meta: overrides.meta ?? { lead: "nikkei-nexus", githubCommitSha: "547ed0c" },
      },
    },
  };
}

describe("isSignedByVercel", () => {
  const body = JSON.stringify(succeeded());
  const signature = createHmac("sha1", "hook-secret").update(body).digest("hex");

  it("accepts the HMAC-SHA1 of the body", () => {
    assert.equal(isSignedByVercel(body, signature, "hook-secret"), true);
  });

  it("rejects a body changed after signing", () => {
    assert.equal(isSignedByVercel(body.replace("nikkei-nexus", "someone-else"), signature, "hook-secret"), false);
  });

  it("rejects everything while the secret is unset", () => {
    assert.equal(isSignedByVercel(body, createHmac("sha1", "").update(body).digest("hex"), ""), false);
  });

  it("rejects a missing signature", () => {
    assert.equal(isSignedByVercel(body, null, "hook-secret"), false);
  });
});

describe("leadPreviewFrom", () => {
  it("reads the lead and the https address of a tagged preview", () => {
    assert.deepEqual(leadPreviewFrom(succeeded(), "defect-previews"), {
      slug: "nikkei-nexus",
      previewUrl: "https://defect-previews-cs69n0fw8-defect-technologies.vercel.app",
    });
  });

  it("matches the previews project by its ID as well as its name", () => {
    assert.equal(leadPreviewFrom(succeeded({ name: "renamed" }), PROJECT_ID)?.slug, "nikkei-nexus");
  });

  it("ignores a deploy without a lead tag", () => {
    assert.equal(leadPreviewFrom(succeeded({ meta: { githubCommitSha: "547ed0c" } }), "defect-previews"), null);
  });

  it("ignores production deploys", () => {
    assert.equal(leadPreviewFrom(succeeded({ target: "production" }), "defect-previews"), null);
  });

  it("ignores other projects", () => {
    assert.equal(leadPreviewFrom(succeeded({ projectId: "prj_other", name: "website" }), "defect-previews"), null);
  });

  it("ignores other events", () => {
    assert.equal(leadPreviewFrom({ ...succeeded(), type: "deployment.created" }, "defect-previews"), null);
  });
});
