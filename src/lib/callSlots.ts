/** When owners can book a call on defect.tech/call. Times are in Los Angeles, the way Brendan keeps them. */
export const CALL_HOURS = {
  timeZone: "America/Los_Angeles",
  timeZoneName: "Pacific Time",
  firstHour: 10,
  lastHour: 17,
  minutes: 30,
  /** Brendan needs a day's notice before a call. */
  noticeHours: 24,
  daysAhead: 14,
};

export type Span = { start: number; end: number };
export type CalendarDate = { year: number; month: number; day: number };
export type CallDay = { key: string; weekday: string; date: string; fullDate: string; slots: number[] };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function wallClockParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute") };
}

function offsetMinutes(instant: number, timeZone: string) {
  const wall = wallClockParts(instant, timeZone);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return Math.round((wallAsUtc - instant) / MINUTE);
}

/** The instant a clock in `timeZone` reads `hour`:00 on `date`, correct across daylight saving changes. */
export function instantAt(date: CalendarDate, hour: number, timeZone: string) {
  const wallAsUtc = Date.UTC(date.year, date.month - 1, date.day, hour);
  const firstGuess = wallAsUtc - offsetMinutes(wallAsUtc, timeZone) * MINUTE;
  return wallAsUtc - offsetMinutes(firstGuess, timeZone) * MINUTE;
}

function calendarDateOf(instant: number, timeZone: string): CalendarDate {
  const { year, month, day } = wallClockParts(instant, timeZone);
  return { year, month, day };
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

/** "10 AM" or "2:30 PM", built from numeric parts so the server and the browser print the same string. */
export function clockLabel(instant: number, timeZone = CALL_HOURS.timeZone) {
  const { hour, minute } = wallClockParts(instant, timeZone);
  const minutes = minute ? `:${String(minute).padStart(2, "0")}` : "";
  return `${hour % 12 || 12}${minutes} ${hour < 12 ? "AM" : "PM"}`;
}

function dayLabels(date: CalendarDate) {
  const noon = instantAt(date, 12, CALL_HOURS.timeZone);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: CALL_HOURS.timeZone, ...options }).format(noon);
  return {
    weekday: format({ weekday: "short" }),
    date: format({ month: "short", day: "numeric" }),
    fullDate: format({ weekday: "long", month: "long", day: "numeric" }),
  };
}

const overlaps = (slot: Span, busy: Span[]) => busy.some((span) => span.start < slot.end && span.end > slot.start);

function slotsOn(date: CalendarDate, earliest: number, busy: Span[]) {
  const { firstHour, lastHour, minutes, timeZone } = CALL_HOURS;
  const opens = instantAt(date, firstHour, timeZone);
  const closes = instantAt(date, lastHour, timeZone);
  const slots: number[] = [];
  for (let start = opens; start + minutes * MINUTE <= closes; start += minutes * MINUTE) {
    if (start >= earliest && !overlaps({ start, end: start + minutes * MINUTE }, busy)) slots.push(start);
  }
  return slots;
}

/** The range freeBusy has to cover for `callDays`. */
export function bookingRange(now: number): Span {
  const today = calendarDateOf(now, CALL_HOURS.timeZone);
  return { start: instantAt(today, 0, CALL_HOURS.timeZone), end: instantAt(addDays(today, CALL_HOURS.daysAhead + 1), 0, CALL_HOURS.timeZone) };
}

/** Each day in the booking window that still has a free slot, with its free slots' start times. */
export function callDays(now: number, busy: Span[]): CallDay[] {
  const today = calendarDateOf(now, CALL_HOURS.timeZone);
  const earliest = now + CALL_HOURS.noticeHours * HOUR;
  const days: CallDay[] = [];
  for (let index = 0; index <= CALL_HOURS.daysAhead; index += 1) {
    const date = addDays(today, index);
    const slots = slotsOn(date, earliest, busy);
    if (slots.length) days.push({ key: `${date.year}-${date.month}-${date.day}`, ...dayLabels(date), slots });
  }
  return days;
}

/** True when `start` is one of the slots `callDays` would offer right now. */
export function isOpenSlot(start: number, now: number, busy: Span[]) {
  return callDays(now, busy).some((day) => day.slots.includes(start));
}

export function callEnd(start: number) {
  return start + CALL_HOURS.minutes * MINUTE;
}
