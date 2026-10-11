/** The monthly email to a site's owner, as plain text. Kept free of server code so it can be checked on its own. */
import { totalActions, insights, type SiteAnalytics } from "./siteAnalytics";
import { TEAM_SIGN_OFF } from "./teamSignOff";

const count = (value: number) => value.toLocaleString("en-US");
export const plural = (value: number, one: string, many: string) => `${count(value)} ${value === 1 ? one : many}`;

function reachedLine(data: SiteAnalytics, earlier: string): string {
  const total = totalActions(data);
  const parts = [plural(data.actions.Call.now, "call", "calls"), `${count(data.actions.Directions.now)} asked for directions`, plural(data.actions.Email.now, "email", "emails"), plural(data.actions.Book.now, "booking", "bookings")];
  const difference = total.now - total.before;
  const change = difference === 0 ? `the same as in ${earlier}` : `${count(Math.abs(difference))} ${difference > 0 ? "more" : "fewer"} than in ${earlier}`;
  return `${plural(total.now, "person", "people")} reached you: ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}. That's ${change}.`;
}

export type ReportFor = { firstName: string | null; siteName: string; dashboardUrl: string; month: string; earlier: string };

/** What happened last month in plain words, anything worth a look, then where to see more. */
export function reportBody(data: SiteAnalytics, { firstName, siteName, dashboardUrl, month, earlier }: ReportFor): string {
  const top = data.actionSources[0];
  const notes = insights(data, 30).filter((item) => item.tone !== "good");
  return [
    `Hi ${firstName || "there"},`,
    "",
    `Here's how the ${siteName} website did in ${month}.`,
    "",
    reachedLine(data, earlier),
    `${plural(data.visitors.now, "person", "people")} visited and viewed ${plural(data.pageviews.now, "page", "pages")}.`,
    ...(top ? [`Most of the people who reached you came from ${top.label}.`] : []),
    ...notes.flatMap((note) => ["", `${note.title}. ${note.detail}`]),
    "",
    `Your dashboard has the details, and you can pick any time period there: ${dashboardUrl}`,
    "",
    "Warmly,",
    ...TEAM_SIGN_OFF,
  ].join("\n");
}
