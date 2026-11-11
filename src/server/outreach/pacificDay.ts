import { sql } from "drizzle-orm";

/** The most recent midnight in Los Angeles, as a timestamp, so a daily count follows the founders' day wherever the server runs. */
export const PACIFIC_MIDNIGHT = sql`(date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')`;
