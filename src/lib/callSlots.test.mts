import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CALL_HOURS, callDays, clockLabel, isOpenSlot } from "./callSlots";

/** Thursday, November 26, 2026, 12:00 PM in Los Angeles (PST, UTC−8). */
const NOON_THURSDAY = Date.UTC(2026, 10, 26, 20);
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 10, day, hour + 8, minute);

describe("callDays", () => {
  it("starts a day's notice out and offers half hours from 10 AM to 5 PM", () => {
    const [first, second] = callDays(NOON_THURSDAY, []);
    assert.equal(first.fullDate, "Friday, November 27");
    assert.equal(first.slots[0], at(27, 12));
    assert.equal(first.slots.at(-1), at(27, 16, 30));
    assert.equal(second.slots.length, ((CALL_HOURS.lastHour - CALL_HOURS.firstHour) * 60) / CALL_HOURS.minutes);
  });

  it("leaves out slots that touch a busy time and days with nothing free", () => {
    const busy = [
      { start: at(28, 10, 15), end: at(28, 11) },
      { start: at(29, 9), end: at(29, 18) },
    ];
    const days = callDays(NOON_THURSDAY, busy);
    const saturday = days.find((day) => day.fullDate === "Saturday, November 28");
    assert.equal(saturday?.slots[0], at(28, 11));
    assert.equal(days.some((day) => day.fullDate === "Sunday, November 29"), false);
  });

  it("goes no further than the booking window", () => {
    const days = callDays(NOON_THURSDAY, []);
    assert.equal(days.at(-1)?.fullDate, "Thursday, December 10");
  });
});

describe("isOpenSlot", () => {
  it("accepts only an offered start time", () => {
    assert.equal(isOpenSlot(at(30, 10), NOON_THURSDAY, []), true);
    assert.equal(isOpenSlot(at(30, 10, 10), NOON_THURSDAY, []), false);
    assert.equal(isOpenSlot(at(26, 15), NOON_THURSDAY, []), false);
    assert.equal(isOpenSlot(at(30, 10), NOON_THURSDAY, [{ start: at(30, 10), end: at(30, 10, 30) }]), false);
  });
});

describe("clockLabel", () => {
  it("reads like a clock", () => {
    assert.equal(clockLabel(at(30, 10)), "10 AM");
    assert.equal(clockLabel(at(30, 14, 30)), "2:30 PM");
  });
});
