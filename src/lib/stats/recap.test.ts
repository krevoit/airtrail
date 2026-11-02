import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';

import { computeRecap, recapYears, yearTotals } from './recap';

import type { Airport, Flight } from '$lib/db/types';
import type { FlightData } from '$lib/utils';

const airport = (
  id: number,
  iata: string,
  country: string,
  continent: string,
  lat: number,
  lon: number,
  tz: string,
): Airport =>
  ({
    id,
    iata,
    icao: `X${iata}`,
    name: `${iata} Airport`,
    municipality: iata,
    country,
    continent,
    lat,
    lon,
    tz,
  }) as Airport;

const BLR = airport(1, 'BLR', 'IN', 'AS', 13.2, 77.7, 'Asia/Kolkata');
const DXB = airport(2, 'DXB', 'AE', 'AS', 25.3, 55.4, 'Asia/Dubai');
const LHR = airport(3, 'LHR', 'GB', 'EU', 51.5, -0.5, 'Europe/London');
const SYD = airport(4, 'SYD', 'AU', 'OC', -33.9, 151.2, 'Australia/Sydney');
const LAX = airport(5, 'LAX', 'US', 'NA', 33.9, -118.4, 'America/Los_Angeles');

let nextId = 1;
const flight = (
  date: string,
  from: Airport,
  to: Airport,
  distance: number,
  departureHour: number | null = null,
): FlightData => {
  const raw = {
    id: nextId,
    date,
    datePrecision: 'day',
    departure: null,
    arrival: null,
    from,
    to,
    duration: 3600 * Math.max(1, Math.round(distance / 800)),
    airline: null,
    aircraft: null,
    flightNumber: null,
    passengers: [
      {
        userId: 'me',
        seat: 'window',
        seatClass: 'economy',
        flightReason: 'leisure',
      },
    ],
  } as unknown as Flight;
  const [year, month, dayOfMonth] = date.split('-').map(Number);
  const at = (hour: number, minute: number) =>
    new TZDate(year!, month! - 1, dayOfMonth!, hour, minute, from.tz);
  const day = at(12, 0);
  const departure = departureHour === null ? null : at(departureHour, 30);
  return {
    ...raw,
    id: nextId++,
    date: departure ?? day,
    dateStart: day,
    dateEnd: day,
    departure,
    arrival: null,
    distance,
    raw,
  } as unknown as FlightData;
};

const now = new Date('2026-06-01T00:00:00Z');
const flights = [
  flight('2025-02-01', BLR, DXB, 2700),
  flight('2026-01-10', BLR, DXB, 2700, 23),
  flight('2026-03-05', DXB, LHR, 5500, 6),
  flight('2026-03-05', LHR, BLR, 8000, 21),
  flight('2026-03-20', BLR, SYD, 9000, 14),
  flight('2026-03-22', SYD, LAX, 12000),
  flight('2026-09-01', BLR, DXB, 2700),
];

describe('computeRecap for a year', () => {
  const recap = computeRecap(flights, 2026, 'me', now);

  it('counts only completed flights of the year', () => {
    expect(recap.flights).toBe(5);
    expect(recap.upcomingFlights).toBe(1);
    expect(recap.distanceKm).toBe(37200);
    expect(recap.flightsPerMonth[2]).toBe(4);
    expect(recap.flightList.map((item) => item.from?.iata)).toEqual([
      'BLR',
      'DXB',
      'LHR',
      'BLR',
      'SYD',
    ]);
  });

  it('finds firsts against earlier years', () => {
    expect(recap.newAirports.map((item) => item.iata)).toEqual([
      'LHR',
      'SYD',
      'LAX',
    ]);
    expect(recap.newCountries).toEqual(['GB', 'AU', 'US']);
  });

  it('lists each country where it was first reached', () => {
    expect(
      recap.countryVisits.map((visit) => [
        visit.country,
        visit.airport.iata,
        visit.isNew,
        visit.flights,
      ]),
    ).toEqual([
      ['IN', 'BLR', false, 3],
      ['AE', 'DXB', false, 2],
      ['GB', 'LHR', true, 2],
      ['AU', 'SYD', true, 2],
      ['US', 'LAX', true, 1],
    ]);
  });

  it('picks superlatives', () => {
    expect(recap.longestFlight?.distanceKm).toBe(12000);
    expect(recap.shortestFlight?.distanceKm).toBe(2700);
    expect(recap.firstFlight?.to.iata).toBe('DXB');
    expect(recap.lastFlight?.to.iata).toBe('LAX');
    expect(recap.seats).toEqual({ window: 5 });
    expect(recap.reasons).toEqual({ leisure: 5 });
  });

  it('builds a calendar of flying days', () => {
    expect(recap.days).toEqual({
      '2026-01-10': 1,
      '2026-03-05': 2,
      '2026-03-20': 1,
      '2026-03-22': 1,
    });
    expect(recap.daysFlying).toBe(4);
  });

  it('finds records', () => {
    const { records } = recap;
    expect(records.northernmost?.iata).toBe('LHR');
    expect(records.southernmost?.iata).toBe('SYD');
    expect(records.easternmost?.iata).toBe('SYD');
    expect(records.westernmost?.iata).toBe('LAX');
    expect(records.equatorCrossings).toBe(2);
    expect(records.datelineCrossings).toBe(1);
    expect(records.timedFlights).toBe(4);
    expect(records.redEyes).toBe(2);
    expect(records.earlyStarts).toBe(1);
    expect(records.busiestDay).toEqual({ date: '2026-03-05', count: 2 });
    expect(records.longestGround).toEqual({
      days: 53,
      from: '2026-01-10',
      to: '2026-03-05',
    });
    expect(records.internationalFlights).toBe(5);
    expect(records.continents).toEqual(['AS', 'EU', 'NA', 'OC']);
    expect(records.timeZonesCrossed).toBeGreaterThan(20);
  });
});

describe('computeRecap for all time', () => {
  const recap = computeRecap(flights, 'all', 'me', now);

  it('covers every completed flight and has no firsts', () => {
    expect(recap.flights).toBe(6);
    expect(recap.newAirports).toEqual([]);
    expect(recap.countryVisits.every((visit) => !visit.isNew)).toBe(true);
  });
});

describe('years', () => {
  it('lists years with completed flights, newest first', () => {
    expect(recapYears(flights, now)).toEqual([2026, 2025]);
  });

  it('totals each year', () => {
    expect(
      yearTotals(flights, now).map(({ year, flights, distanceKm }) => [
        year,
        flights,
        distanceKm,
      ]),
    ).toEqual([
      [2025, 1, 2700],
      [2026, 5, 37200],
    ]);
  });
});
