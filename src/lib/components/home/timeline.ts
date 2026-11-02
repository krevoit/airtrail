import type { FlightData } from '$lib/utils';
import {
  isCompletedFlight,
  resolveFlightTimeline,
} from '$lib/utils/data/flight-timeline';

export type TimelineEntry = {
  flight: FlightData;
  /** Best known departure and arrival (recorded, actual or scheduled). */
  departure: Date | null;
  arrival: Date | null;
};

export type Timeline = {
  /** Departed and not yet landed. */
  live: TimelineEntry[];
  /** Soonest first. */
  upcoming: TimelineEntry[];
  /** Newest first, grouped by year of departure. */
  past: { year: number | null; entries: TimelineEntry[] }[];
  pastCount: number;
};

const sortKey = (entry: TimelineEntry) =>
  (entry.departure ?? entry.flight.date ?? entry.flight.dateStart)?.getTime() ??
  0;

export const toEntry = (flight: FlightData): TimelineEntry => {
  const timeline = resolveFlightTimeline(flight.raw);
  return {
    flight,
    departure: timeline.effectiveDeparture ?? flight.date ?? flight.dateStart,
    arrival: timeline.effectiveArrival,
  };
};

export const buildTimeline = (
  flights: FlightData[],
  now: Date = new Date(),
): Timeline => {
  const live: TimelineEntry[] = [];
  const upcoming: TimelineEntry[] = [];
  const past: TimelineEntry[] = [];

  for (const flight of flights) {
    const entry = toEntry(flight);
    const departed = entry.departure !== null && entry.departure <= now;
    const landed = entry.arrival !== null && entry.arrival <= now;
    if (departed && !landed && entry.arrival !== null) live.push(entry);
    else if (isCompletedFlight(flight.raw, now)) past.push(entry);
    else upcoming.push(entry);
  }

  upcoming.sort((a, b) => sortKey(a) - sortKey(b));
  past.sort((a, b) => sortKey(b) - sortKey(a));

  const groups: Timeline['past'] = [];
  for (const entry of past) {
    const year =
      (entry.flight.date ?? entry.flight.dateStart)?.getFullYear() ?? null;
    const group = groups.at(-1);
    if (group && group.year === year) group.entries.push(entry);
    else groups.push({ year, entries: [entry] });
  }

  return { live, upcoming, past: groups, pastCount: past.length };
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Calendar days between two dates in the viewer's time zone. */
const daysBetween = (from: Date, to: Date) => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end.getTime() - start.getTime()) / DAY);
};

/** "Departs in 40 min", "Tomorrow", "In 5 days", "In 3 weeks". */
export const countdownLabel = (
  departure: Date | null,
  now: Date = new Date(),
  exactTime = true,
): string | null => {
  if (!departure) return null;
  const ms = departure.getTime() - now.getTime();
  if (ms <= 0) return 'Departing';
  if (exactTime && ms < HOUR) {
    return `Departs in ${Math.max(1, Math.round(ms / MINUTE))} min`;
  }
  if (exactTime && ms < 12 * HOUR) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.round((ms % HOUR) / MINUTE);
    return minutes
      ? `Departs in ${hours}h ${minutes}m`
      : `Departs in ${hours}h`;
  }
  const days = daysBetween(now, departure);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `In ${months} months`;
  const years = Math.round(days / 365.25);
  return years === 1 ? 'In a year' : `In ${years} years`;
};

/** How far along a live flight is, from 0 to 1. */
export const flightProgress = (
  entry: TimelineEntry,
  now: Date = new Date(),
): number => {
  if (!entry.departure || !entry.arrival) return 0;
  const total = entry.arrival.getTime() - entry.departure.getTime();
  if (total <= 0) return 1;
  return Math.min(
    1,
    Math.max(0, (now.getTime() - entry.departure.getTime()) / total),
  );
};

/** Matches a free-text search against codes, places, airline and number. */
export const matchesSearch = (flight: FlightData, query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const haystack = [
    flight.from?.iata,
    flight.from?.icao,
    flight.from?.municipality,
    flight.from?.name,
    flight.to?.iata,
    flight.to?.icao,
    flight.to?.municipality,
    flight.to?.name,
    flight.airline?.name,
    flight.airline?.iata,
    flight.airline?.icao,
    flight.flightNumber,
    flight.aircraft?.name,
    flight.aircraftReg,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
  return needle.split(/\s+/).every((part) => haystack.includes(part));
};
