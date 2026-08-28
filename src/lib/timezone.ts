// UAE (Asia/Dubai) never observes daylight saving time, so a fixed UTC+4
// offset is safe to hardcode here for constructing Dates from wall-clock
// parts — unlike most timezones, this never changes with the calendar. If
// the business ever operates from a DST-observing timezone, this fixed-
// offset approach would need replacing with real IANA-timezone conversion
// (e.g. a library, since native Date has no "construct from wall-clock time
// in an arbitrary zone" API).
export const BUSINESS_TIMEZONE = "Asia/Dubai";
const UAE_UTC_OFFSET_MINUTES = 4 * 60;

export type UaeDateParts = {
  year: number;
  month: number; // 0-indexed, matches Date/Date.UTC conventions
  day: number;
  hours: number;
  minutes: number;
  weekday: number; // 0 (Sun) - 6 (Sat), matches Date#getDay()
};

// Reads a UTC Date's wall-clock year/month/day/hours/minutes/weekday as
// they'd appear in the UAE.
export function toUaeParts(date: Date): UaeDateParts {
  const shifted = new Date(date.getTime() + UAE_UTC_OFFSET_MINUTES * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

// Builds the UTC Date instant for a given UAE wall-clock date/time. `day`
// may be out of the normal 1-31 range (e.g. today's day-of-month + an
// offset) — Date.UTC normalizes that the same way plain Date math does.
export function fromUaeParts(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(Date.UTC(year, month, day, hours, minutes) - UAE_UTC_OFFSET_MINUTES * 60 * 1000);
}

// Parses a "YYYY-MM-DDTHH:mm" string (the format <input type="datetime-local">
// produces, and what the scheduling dropdown's slot values use) as UAE
// wall-clock time — not the server process's local timezone, which is what
// `new Date(string)` would otherwise ambiguously assume.
export function parseUaeDateTimeLocal(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return new Date(NaN);
  const [, year, month, day, hours, minutes] = match;
  return fromUaeParts(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
}
