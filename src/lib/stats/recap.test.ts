import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';

import { computeYearRecap, recapYears } from './recap';

import type { Airport, Flight } from '$lib/db/types';
import type { FlightData } from '$lib/utils';

const airport = (id: number, iata: string, country: string): Airport =>
  ({
    id,
    iata,
    icao: `X${iata}`,
    name: `${iata} Airport`,
    municipality: iata,
    country,
    lat: 0,
    lon: 0,
    tz: 'UTC',
  }) as Airport;

const BLR = airport(1, 'BLR', 'IN');
const DXB = airport(2, 'DXB', 'AE');
const LHR = airport(3, 'LHR', 'GB');

let nextId = 1;
const flight = (
  date: string,
  from: Airport,
  to: Airport,
  distance: number,
): FlightData => {
  const raw = {
    id: nextId,
    date,
    datePrecision: 'day',
    departure: null,
    arrival: null,
    from,
    to,
    duration: 3600,
    airline: null,
    aircraft: null,
    passengers: [{ userId: 'me', seat: 'window', seatClass: 'economy' }],
  } as unknown as Flight;
  const day = new TZDate(`${date}T12:00:00Z`, 'UTC');
  return {
    ...raw,
    id: nextId++,
    date: day,
    dateStart: day,
    dateEnd: day,
    departure: null,
    arrival: null,
    distance,
    raw,
  } as unknown as FlightData;
};

const now = new Date('2026-06-01T00:00:00Z');
const flights = [
  flight('2025-02-01', BLR, DXB, 2700),
  flight('2026-01-10', BLR, DXB, 2700),
  flight('2026-03-05', DXB, LHR, 5500),
  flight('2026-03-20', LHR, BLR, 8000),
  flight('2026-09-01', BLR, DXB, 2700),
];

describe('computeYearRecap', () => {
  const recap = computeYearRecap(flights, 2026, 'me', now);

  it('counts only completed flights of the year', () => {
    expect(recap.flights).toBe(3);
    expect(recap.upcomingFlights).toBe(1);
    expect(recap.distanceKm).toBe(16200);
    expect(recap.durationSeconds).toBe(3 * 3600);
    expect(recap.flightsPerMonth[2]).toBe(2);
  });

  it('finds firsts against earlier years', () => {
    expect(recap.newAirports.map((item) => item.iata)).toEqual(['LHR']);
    expect(recap.newCountries).toEqual(['GB']);
  });

  it('lists each country where it was first reached', () => {
    expect(
      recap.countryVisits.map((visit) => [
        visit.country,
        visit.airport.iata,
        visit.isNew,
      ]),
    ).toEqual([
      ['IN', 'BLR', false],
      ['AE', 'DXB', false],
      ['GB', 'LHR', true],
    ]);
  });

  it('picks superlatives', () => {
    expect(recap.longestFlight?.distanceKm).toBe(8000);
    expect(recap.shortestFlight?.distanceKm).toBe(2700);
    expect(recap.seats).toEqual({ window: 3 });
    expect(recap.previousYearFlights).toBe(1);
  });

  it('lists years with completed flights, newest first', () => {
    expect(recapYears(flights, now)).toEqual([2026, 2025]);
  });
});
