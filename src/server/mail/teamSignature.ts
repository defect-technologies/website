import "server-only";

/**
 * The email signature, in both forms. The HTML version matches
 * defect-tech/02-system/email-signature.html: inline styles and a hosted PNG, because
 * mail apps drop <style> blocks and Gmail won't show SVG.
 */
export const TEAM_SIGNATURE_TEXT = ["The Defect Technologies team", "hello@defect.tech"];

const INK = "#17161a";
const INK_SOFT = "#4b4852";
const INK_FAINT = "#6b6771";
const FONT = "font-family:Helvetica,Arial,sans-serif;";

export type Signer = { name: string; line: string; email: string };

const TEAM: Signer = { name: "The Defect Technologies team", line: "Websites for small businesses", email: "hello@defect.tech" };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character]);
}

export function signatureHtml({ name, line, email }: Signer): string {
  const address = escapeHtml(email);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;${FONT}margin-top:8px;">
<tr>
<td style="padding:0 16px 0 0;vertical-align:middle;"><a href="https://defect.tech" style="text-decoration:none;"><img src="https://defect.tech/brand/defect-tech-signature.png" width="136" height="48" alt="defect.tech" style="display:block;width:136px;height:48px;border:0;"></a></td>
<td style="padding:0;vertical-align:middle;">
<div style="font-size:14px;line-height:20px;font-weight:bold;color:${INK};">${escapeHtml(name)}</div>
<div style="font-size:13px;line-height:20px;color:${INK_SOFT};">${escapeHtml(line)}</div>
<div style="font-size:13px;line-height:20px;padding-top:4px;"><a href="mailto:${address}" style="color:${INK};text-decoration:none;">${address}</a></div>
</td>
</tr>
</table>`;
}

export const TEAM_SIGNATURE_HTML = signatureHtml(TEAM);

function paragraphsHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function finePrintHtml(lines: string[]): string {
  const text = lines.join("\n").trim();
  if (!text) return "";
  return `<p style="margin:16px 0 0;font-size:12px;line-height:18px;color:${INK_FAINT};">${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
}

function wrap(inner: string): string {
  return `<div style="${FONT}font-size:14px;line-height:21px;color:${INK};">${inner}</div>`;
}

/** The HTML version of a plain-text email that ends with the team signature lines. */
export function withTeamSignatureHtml(body: string): string {
  const lines = body.trimEnd().split("\n");
  return wrap(paragraphsHtml(lines.slice(0, -TEAM_SIGNATURE_TEXT.length).join("\n")) + TEAM_SIGNATURE_HTML);
}

/**
 * The HTML version of a cold email: everything above the signer's name as written, the
 * graphic signature in place of the name, and the lines under it (the mailing address and
 * opt-out line the law requires) as fine print. Null when the name isn't on its own line.
 */
export function withSignerHtml(body: string, signer: Signer): string | null {
  const lines = body.trimEnd().split("\n");
  const at = lines.map((line) => line.trim()).lastIndexOf(signer.name.trim());
  if (at === -1) return null;
  return wrap(paragraphsHtml(lines.slice(0, at).join("\n")) + signatureHtml(signer) + finePrintHtml(lines.slice(at + 1)));
}
