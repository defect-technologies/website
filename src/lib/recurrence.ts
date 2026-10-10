export const FREQUENCIES = ["one_time", "monthly", "annual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABEL: Record<Frequency, string> = { one_time: "One time", monthly: "Monthly", annual: "Annual" };

const MONTHS_BETWEEN: Record<Exclude<Frequency, "one_time">, number> = { monthly: 1, annual: 12 };

const pad = (value: number) => String(value).padStart(2, "0");

/** The same day of the month, `months` later. Jan 31 plus one month is Feb 28. */
function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
}

type Schedule = { startsOn: string; frequency: Exclude<Frequency, "one_time">; addedThrough: string | null; stoppedOn: string | null };

/** Dates a repeating expense came due after `addedThrough`, up to and including `through`, and before it was stopped. */
export function datesDue({ startsOn, frequency, addedThrough, stoppedOn }: Schedule, through: string): string[] {
  const last = stoppedOn && stoppedOn < through ? stoppedOn : through;
  const dates: string[] = [];
  for (let step = 0; ; step++) {
    const date = addMonths(startsOn, step * MONTHS_BETWEEN[frequency]);
    if (date > last) return dates;
    if (!addedThrough || date > addedThrough) dates.push(date);
  }
}

/** The next date after `today` a repeating expense comes due, or null once it's stopped. */
export function nextDue(schedule: Omit<Schedule, "addedThrough">, today: string): string | null {
  if (schedule.stoppedOn) return null;
  for (let step = 0; ; step++) {
    const date = addMonths(schedule.startsOn, step * MONTHS_BETWEEN[schedule.frequency]);
    if (date > today) return date;
  }
}
