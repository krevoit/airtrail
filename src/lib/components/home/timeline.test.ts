import { describe, expect, it } from 'vitest';

import {
  buildTimeline,
  countdownLabel,
  flightProgress,
  matchesSearch,
  toEntry,
} from './timeline';

import type { Airport, Flight } from '$lib/db/types';
import { prepareFlightData } from '$lib/utils';

const airport = (id: number, iata: string, city: string): Airport =>
  ({
    id,
    iata,
    icao: `X${iata}`,
    name: `${city} Airport`,
    municipality: city,
    country: 'AU',
    continent: 'OC',
    lat: 0,
    lon: 0,
    tz: 'UTC',
  }) as Airport;

const SYD = airport(1, 'SYD', 'Sydney');
const MEL = airport(2, 'MEL', 'Melbourne');

let nextId = 1;
const flight = (departure: string, arrival: string): Flight =>
  ({
    id: nextId++,
    date: departure.slice(0, 10),
    datePrecision: 'day',
    departure,
    arrival,
    departureScheduled: null,
    arrivalScheduled: null,
    takeoffScheduled: null,
    takeoffActual: null,
    landingScheduled: null,
    landingActual: null,
    duration: 5400,
    from: SYD,
    to: MEL,
    airline: { id: 1, name: 'Qantas', iata: 'QF', icao: 'QFA' },
    aircraft: null,
    aircraftReg: null,
    flightNumber: 'QF401',
    passengers: [],
  }) as unknown as Flight;

const now = new Date('2026-06-15T12:00:00Z');
const flights = prepareFlightData([
  flight('2025-01-10T08:00:00Z', '2025-01-10T09:30:00Z'),
  flight('2026-06-01T08:00:00Z', '2026-06-01T09:30:00Z'),
  flight('2026-06-15T11:30:00Z', '2026-06-15T13:00:00Z'),
  flight('2026-06-20T08:00:00Z', '2026-06-20T09:30:00Z'),
  flight('2026-06-16T08:00:00Z', '2026-06-16T09:30:00Z'),
]);

describe('buildTimeline', () => {
  const timeline = buildTimeline(flights, now);

  it('splits live, upcoming and past flights', () => {
    expect(timeline.live.map((entry) => entry.flight.id)).toEqual([3]);
    expect(timeline.upcoming.map((entry) => entry.flight.id)).toEqual([5, 4]);
    expect(timeline.pastCount).toBe(2);
  });

  it('groups past flights by year, newest first', () => {
    expect(
      timeline.past.map((group) => [
        group.year,
        group.entries.map((entry) => entry.flight.id),
      ]),
    ).toEqual([
      [2026, [2]],
      [2025, [1]],
    ]);
  });

  it('reports progress through a live flight', () => {
    expect(flightProgress(timeline.live[0]!, now)).toBeCloseTo(1 / 3, 2);
  });
});

describe('countdownLabel', () => {
  const at = (iso: string) => new Date(iso);
  it('counts down in minutes, hours, then days and weeks', () => {
    expect(countdownLabel(at('2026-06-15T12:40:00Z'), now)).toBe(
      'Departs in 40 min',
    );
    expect(countdownLabel(at('2026-06-15T15:30:00Z'), now)).toBe(
      'Departs in 3h 30m',
    );
    expect(countdownLabel(at('2026-06-25T12:00:00Z'), now)).toBe('In 10 days');
    expect(countdownLabel(at('2026-07-20T12:00:00Z'), now)).toBe('In 5 weeks');
    expect(countdownLabel(at('2026-12-20T12:00:00Z'), now)).toBe('In 6 months');
  });
});

describe('matchesSearch', () => {
  const entry = toEntry(flights[1]!);
  it('matches codes, cities, airline and flight number', () => {
    expect(matchesSearch(entry.flight, 'syd')).toBe(true);
    expect(matchesSearch(entry.flight, 'melbourne qantas')).toBe(true);
    expect(matchesSearch(entry.flight, 'QF401')).toBe(true);
    expect(matchesSearch(entry.flight, 'perth')).toBe(false);
  });
});
