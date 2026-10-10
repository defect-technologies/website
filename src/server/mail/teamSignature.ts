import "server-only";

/**
 * The studio inbox's signature, in both forms. The HTML version is the same block as
 * defect-tech/02-system/email-signature.html: inline styles and hosted PNGs, because
 * mail apps drop <style> blocks and Gmail won't show SVG.
 */
export const TEAM_SIGNATURE_TEXT = ["The Defect Technologies team", "hello@defect.tech"];

const INK = "#17161a";
const INK_SOFT = "#4b4852";
const VERMILION = "#e2421b";

export const TEAM_SIGNATURE_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;margin-top:8px;">
<tr>
<td style="padding:0 16px 0 0;vertical-align:middle;"><a href="https://defect.tech" style="text-decoration:none;"><img src="https://defect.tech/brand/defect-tech-paper-1200.png" width="128" height="70" alt="defect.tech" style="display:block;width:128px;height:70px;border:0;border-radius:6px;"></a></td>
<td style="padding:0;vertical-align:middle;">
<div style="font-size:14px;line-height:20px;font-weight:bold;color:${INK};">The Defect Technologies team</div>
<div style="font-size:13px;line-height:20px;color:${INK_SOFT};">Websites for small businesses</div>
<div style="font-size:13px;line-height:20px;padding-top:4px;"><a href="mailto:hello@defect.tech" style="color:${INK};text-decoration:none;">hello@defect.tech</a></div>
<div style="font-size:13px;line-height:20px;"><a href="https://defect.tech" style="color:${INK};text-decoration:none;">defect<span style="color:${VERMILION};font-weight:bold;">.</span>tech</a></div>
</td>
</tr>
</table>`;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character]);
}

/**
 * The HTML version of a plain-text email that ends with the team signature: each
 * paragraph as written, then the graphic signature in place of the two text lines.
 */
export function withTeamSignatureHtml(body: string): string {
  const withoutSignature = body.trimEnd().split("\n").slice(0, -TEAM_SIGNATURE_TEXT.length).join("\n").trim();
  const paragraphs = withoutSignature
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`);
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:21px;color:${INK};">${paragraphs.join("")}${TEAM_SIGNATURE_HTML}</div>`;
}
