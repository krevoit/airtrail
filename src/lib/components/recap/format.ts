import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Clock,
  Earth,
  Gauge,
  Hourglass,
  Moon,
  Sunrise,
} from '@o7/icon/lucide';
import type { Component } from 'svelte';

import { ContinentMap, type Airport } from '$lib/db/types';
import {
  EARTH_CIRCUMFERENCE_KM,
  MOON_DISTANCE_KM,
  type Recap,
  type RecapPeriod,
} from '$lib/stats/recap';
import { pluralize, toTitleCase } from '$lib/utils';
import { countryFromAlpha2 } from '$lib/utils/data/countries';
import { Duration } from '$lib/utils/datetime';
import { round } from '$lib/utils/number';
import {
  convertDistance,
  distanceUnitLabel,
  type getPreferences,
} from '$lib/utils/preferences';

type Preferences = ReturnType<typeof getPreferences>;

export const createFormat = (prefs: Preferences) => {
  const unit = distanceUnitLabel(prefs);
  const number = (value: number) => Math.round(value).toLocaleString();
  return {
    unit,
    number,
    /** Converted to the user's unit, without the unit. */
    distance: (km: number) => number(convertDistance(km, prefs)),
    distanceWithUnit: (km: number) =>
      `${number(convertDistance(km, prefs))} ${unit}`,
    duration: (seconds: number) => Duration.fromSeconds(seconds).toString(true),
    airportCode: (airport: Airport) => airport.iata ?? airport.icao,
    airportPlace: (airport: Airport) => airport.municipality ?? airport.name,
    countryName: (code: string) => countryFromAlpha2(code)?.name ?? code,
    continentName: (code: string) =>
      ContinentMap[code as keyof typeof ContinentMap] ?? code,
    /** "5 Mar" from a Date or a `YYYY-MM-DD` key. */
    shortDate: (date: Date | string | null) => {
      if (!date) return '';
      const value =
        typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
      return value.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
      });
    },
    title: (value: string) => toTitleCase(value),
  };
};

export type RecapFormat = ReturnType<typeof createFormat>;

export const periodTitle = (period: RecapPeriod) =>
  period === 'all' ? 'All time' : String(period);

export const laps = (recap: Recap) => recap.distanceKm / EARTH_CIRCUMFERENCE_KM;
export const moonShare = (recap: Recap) => recap.distanceKm / MOON_DISTANCE_KM;

/** "1.9× around Earth", or the trip to the Moon once that is more telling. */
export const distanceComparison = (recap: Recap) => {
  const moon = moonShare(recap);
  if (moon >= 1) return `${round(moon, 1)}× to the Moon`;
  const around = laps(recap);
  return around >= 0.1 ? `${round(around, 1)}× around Earth` : null;
};

export type Fact = {
  icon: Component;
  label: string;
  value: string;
  detail: string;
};

/** The fun facts worth showing for this period, best first. */
export const recapFacts = (recap: Recap, f: RecapFormat): Fact[] => {
  const { records } = recap;
  const facts: Fact[] = [];
  const airportFact = (
    icon: Component,
    label: string,
    airport: Airport | null,
    coordinate: string,
  ) => {
    if (!airport) return;
    facts.push({
      icon,
      label,
      value: f.airportCode(airport),
      detail: `${f.airportPlace(airport)} · ${coordinate}`,
    });
  };
  const lat = (value: number) =>
    `${Math.abs(value).toFixed(1)}° ${value >= 0 ? 'N' : 'S'}`;
  const lon = (value: number) =>
    `${Math.abs(value).toFixed(1)}° ${value >= 0 ? 'E' : 'W'}`;

  if (records.timeZonesCrossed) {
    facts.push({
      icon: Clock,
      label: 'Time zones crossed',
      value: records.timeZonesCrossed.toLocaleString(),
      detail: 'Hours of clock change, added up',
    });
  }
  if (records.equatorCrossings) {
    facts.push({
      icon: Earth,
      label: 'Equator crossings',
      value: String(records.equatorCrossings),
      detail:
        records.datelineCrossings > 0
          ? `And ${records.datelineCrossings} over the date line`
          : 'Between the hemispheres',
    });
  } else if (records.datelineCrossings) {
    facts.push({
      icon: Earth,
      label: 'Date line crossings',
      value: String(records.datelineCrossings),
      detail: 'Over the Pacific',
    });
  }
  if (records.redEyes) {
    facts.push({
      icon: Moon,
      label: 'Red-eyes',
      value: String(records.redEyes),
      detail: `Departing 9 pm to 5 am`,
    });
  }
  if (records.earlyStarts) {
    facts.push({
      icon: Sunrise,
      label: 'Early starts',
      value: String(records.earlyStarts),
      detail: 'Wheels up before 7 am',
    });
  }
  if (records.busiestDay && records.busiestDay.count > 1) {
    facts.push({
      icon: CalendarDays,
      label: 'Busiest day',
      value: f.shortDate(records.busiestDay.date),
      detail: `${records.busiestDay.count} flights in one day`,
    });
  }
  if (records.longestGround && records.longestGround.days >= 14) {
    facts.push({
      icon: Hourglass,
      label: 'Longest on the ground',
      value: `${records.longestGround.days} days`,
      detail: `${f.shortDate(records.longestGround.from)} to ${f.shortDate(records.longestGround.to)}`,
    });
  }
  if (records.fastest) {
    const { flight, kmh } = records.fastest;
    facts.push({
      icon: Gauge,
      label: 'Fastest flight',
      value: `${f.distance(kmh)} ${f.unit}/h`,
      detail: `${f.airportCode(flight.from)} → ${f.airportCode(flight.to)}, gate to gate`,
    });
  }
  airportFact(
    ArrowUp,
    'Furthest north',
    records.northernmost,
    lat(records.northernmost?.lat ?? 0),
  );
  airportFact(
    ArrowDown,
    'Furthest south',
    records.southernmost,
    lat(records.southernmost?.lat ?? 0),
  );
  airportFact(
    ArrowRight,
    'Furthest east',
    records.easternmost,
    lon(records.easternmost?.lon ?? 0),
  );
  airportFact(
    ArrowLeft,
    'Furthest west',
    records.westernmost,
    lon(records.westernmost?.lon ?? 0),
  );
  return facts;
};

/** "Your busiest year yet", or how it ranks among the years flown. */
export const yearRank = (
  totals: { year: number; flights: number; distanceKm: number }[],
  year: number,
): string | null => {
  if (totals.length < 2) return null;
  const byFlights = [...totals].sort((a, b) => b.flights - a.flights);
  const rank = byFlights.findIndex((total) => total.year === year) + 1;
  const byDistance = [...totals].sort((a, b) => b.distanceKm - a.distanceKm);
  const distanceRank = byDistance.findIndex((total) => total.year === year) + 1;
  if (rank === 1 && distanceRank === 1) return 'Your biggest year yet';
  if (rank === 1) return 'Your busiest year yet';
  if (distanceRank === 1) return 'Your furthest year yet';
  if (rank === 2) return `Your 2nd busiest of ${totals.length} years`;
  if (rank === 3) return `Your 3rd busiest of ${totals.length} years`;
  return null;
};

export const flightsLabel = (count: number) =>
  `${count.toLocaleString()} ${pluralize(count, 'flight')}`;
