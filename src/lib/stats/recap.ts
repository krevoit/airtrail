import { tzOffset } from '@date-fns/tz';

import type { Airline, Airport } from '$lib/db/types';
import type { FlightData } from '$lib/utils';
import { isCompletedFlight } from '$lib/utils/data/flight-timeline';

export const EARTH_CIRCUMFERENCE_KM = 40_075;
export const MOON_DISTANCE_KM = 384_400;

/** A calendar year, or every year together. */
export type RecapPeriod = number | 'all';

export type Counted<T> = { item: T; count: number };

export type RecapFlight = {
  id: number;
  from: Airport;
  to: Airport;
  distanceKm: number;
  durationSeconds: number | null;
  date: Date | null;
  airline: Airline | null;
  flightNumber: string | null;
};

export type RecapCountryVisit = {
  country: string;
  /** Airport where the country was first reached in the period. */
  airport: Airport;
  date: Date | null;
  /** True when the country appears in no flight before the period. */
  isNew: boolean;
  /** Flights in the period that touched the country. */
  flights: number;
};

export type RecapRecords = {
  northernmost: Airport | null;
  southernmost: Airport | null;
  easternmost: Airport | null;
  westernmost: Airport | null;
  equatorCrossings: number;
  datelineCrossings: number;
  /** Flights with a known local departure time. */
  timedFlights: number;
  /** Departures between 21:00 and 04:59 local time. */
  redEyes: number;
  /** Departures between 05:00 and 06:59 local time. */
  earlyStarts: number;
  /** Hours of time zone change, summed over every flight. */
  timeZonesCrossed: number;
  busiestDay: { date: string; count: number } | null;
  /** Longest run of days between two flights. */
  longestGround: { days: number; from: string; to: string } | null;
  fastest: { flight: RecapFlight; kmh: number } | null;
  domesticFlights: number;
  internationalFlights: number;
  continents: string[];
};

export type Recap = {
  period: RecapPeriod;
  /** Completed flights in the period, oldest first. */
  flightList: FlightData[];
  flights: number;
  upcomingFlights: number;
  distanceKm: number;
  durationSeconds: number;
  airports: number;
  countries: number;
  airlines: number;
  aircraftTypes: number;
  routes: number;
  daysFlying: number;
  newAirports: Airport[];
  newCountries: string[];
  newAirlines: Airline[];
  newAircraft: string[];
  longestFlight: RecapFlight | null;
  shortestFlight: RecapFlight | null;
  firstFlight: RecapFlight | null;
  lastFlight: RecapFlight | null;
  topRoute: Counted<{ from: Airport; to: Airport }> | null;
  topAirport: Counted<Airport> | null;
  topAirline: Counted<Airline> | null;
  topAircraft: Counted<string> | null;
  busiestMonth: Counted<number> | null;
  flightsPerMonth: number[];
  /** Sunday first, like Date#getDay. */
  flightsPerWeekday: number[];
  /** Flights per local departure date, keyed `YYYY-MM-DD`. */
  days: Record<string, number>;
  seats: Record<string, number>;
  classes: Record<string, number>;
  reasons: Record<string, number>;
  countryVisits: RecapCountryVisit[];
  records: RecapRecords;
};

export type YearTotal = {
  year: number;
  flights: number;
  distanceKm: number;
  durationSeconds: number;
};

const dateOf = (flight: FlightData) => flight.date ?? flight.dateStart;

const yearOf = (flight: FlightData) => dateOf(flight)?.getFullYear() ?? null;

const pad = (value: number) => String(value).padStart(2, '0');

/** The flight's local departure date as `YYYY-MM-DD`. */
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const dayNumber = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year!, month! - 1, day!) / 86_400_000;
};

const top = <T>(counts: Map<string, Counted<T>>): Counted<T> | null => {
  let best: Counted<T> | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best;
};

const bump = <T>(counts: Map<string, Counted<T>>, key: string, item: T) => {
  const entry = counts.get(key);
  if (entry) entry.count++;
  else counts.set(key, { item, count: 1 });
};

const tally = (counts: Record<string, number>, key: string | null) => {
  if (key) counts[key] = (counts[key] ?? 0) + 1;
};

const toRecapFlight = (flight: FlightData): RecapFlight | null =>
  flight.from && flight.to
    ? {
        id: flight.id,
        from: flight.from,
        to: flight.to,
        distanceKm: flight.distance ?? 0,
        durationSeconds: flight.duration,
        date: dateOf(flight),
        airline: flight.airline,
        flightNumber: flight.flightNumber,
      }
    : null;

const sortByDate = (flights: FlightData[]) =>
  [...flights].sort((a, b) => dateOf(a)!.getTime() - dateOf(b)!.getTime());

const completedFlights = (flights: FlightData[], now: Date) =>
  sortByDate(
    flights.filter(
      (flight) => dateOf(flight) !== null && isCompletedFlight(flight.raw, now),
    ),
  );

/** Years that have at least one completed flight, newest first. */
export const recapYears = (
  flights: FlightData[],
  now: Date = new Date(),
): number[] => {
  const years = new Set<number>();
  for (const flight of completedFlights(flights, now)) {
    years.add(yearOf(flight)!);
  }
  return [...years].sort((a, b) => b - a);
};

/** Completed-flight totals for every year with flights, oldest first. */
export const yearTotals = (
  flights: FlightData[],
  now: Date = new Date(),
): YearTotal[] => {
  const byYear = new Map<number, YearTotal>();
  for (const flight of completedFlights(flights, now)) {
    const year = yearOf(flight)!;
    const total = byYear.get(year) ?? {
      year,
      flights: 0,
      distanceKm: 0,
      durationSeconds: 0,
    };
    total.flights++;
    total.distanceKm += flight.distance ?? 0;
    total.durationSeconds += flight.duration ?? 0;
    byYear.set(year, total);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
};

/** Hours between the two airports' UTC offsets on the day of the flight. */
const timeZoneChange = (flight: FlightData) => {
  const date = dateOf(flight);
  if (!date || !flight.from || !flight.to) return 0;
  try {
    return (
      Math.abs(tzOffset(flight.to.tz, date) - tzOffset(flight.from.tz, date)) /
      60
    );
  } catch {
    return 0;
  }
};

const extremes = (airports: Airport[]) => {
  const pick = (better: (a: Airport, b: Airport) => boolean) =>
    airports.reduce<Airport | null>(
      (best, airport) => (!best || better(airport, best) ? airport : best),
      null,
    );
  return {
    northernmost: pick((a, b) => a.lat > b.lat),
    southernmost: pick((a, b) => a.lat < b.lat),
    easternmost: pick((a, b) => a.lon > b.lon),
    westernmost: pick((a, b) => a.lon < b.lon),
  };
};

export const computeRecap = (
  allFlights: FlightData[],
  period: RecapPeriod,
  userId: string | undefined,
  now: Date = new Date(),
): Recap => {
  const inPeriod = (flight: FlightData) =>
    period === 'all' || yearOf(flight) === period;
  const completed = completedFlights(allFlights, now);
  const flights = completed.filter(inPeriod);
  const earlier =
    period === 'all'
      ? []
      : completed.filter((flight) => yearOf(flight)! < period);
  const upcomingFlights = allFlights.filter(
    (flight) =>
      dateOf(flight) !== null &&
      inPeriod(flight) &&
      !isCompletedFlight(flight.raw, now),
  ).length;

  const seenAirports = new Set<number>();
  const seenCountries = new Set<string>();
  const seenAirlines = new Set<number>();
  const seenAircraft = new Set<string>();
  for (const flight of earlier) {
    for (const airport of [flight.from, flight.to]) {
      if (!airport) continue;
      seenAirports.add(airport.id);
      seenCountries.add(airport.country);
    }
    if (flight.airline) seenAirlines.add(flight.airline.id);
    if (flight.aircraft) seenAircraft.add(flight.aircraft.name);
  }

  const airports = new Map<number, Airport>();
  const countries = new Set<string>();
  const continents = new Set<string>();
  const airlines = new Map<number, Airline>();
  const aircraftTypes = new Set<string>();
  const routes = new Set<string>();
  const days: Record<string, number> = {};
  const routeCounts = new Map<
    string,
    Counted<{ from: Airport; to: Airport }>
  >();
  const airportCounts = new Map<string, Counted<Airport>>();
  const airlineCounts = new Map<string, Counted<Airline>>();
  const aircraftCounts = new Map<string, Counted<string>>();
  const flightsPerMonth = Array.from({ length: 12 }, () => 0);
  const flightsPerWeekday = Array.from({ length: 7 }, () => 0);
  const seats: Record<string, number> = {};
  const classes: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  const countryVisits = new Map<string, RecapCountryVisit>();
  let durationSeconds = 0;
  let longestFlight: RecapFlight | null = null;
  let shortestFlight: RecapFlight | null = null;
  let fastest: RecapRecords['fastest'] = null;
  let equatorCrossings = 0;
  let datelineCrossings = 0;
  let timedFlights = 0;
  let redEyes = 0;
  let earlyStarts = 0;
  let timeZonesCrossed = 0;
  let domesticFlights = 0;
  let internationalFlights = 0;

  for (const flight of flights) {
    const date = dateOf(flight)!;
    const exactDay = flight.datePrecision === 'day';
    if (exactDay || flight.datePrecision === 'month') {
      flightsPerMonth[date.getMonth()]!++;
    }
    if (exactDay) {
      flightsPerWeekday[date.getDay()]!++;
      tally(days, dayKey(date));
    }
    durationSeconds += flight.duration ?? 0;

    if (flight.departure) {
      timedFlights++;
      const hour = flight.departure.getHours();
      if (hour >= 21 || hour < 5) redEyes++;
      else if (hour < 7) earlyStarts++;
    }

    for (const airport of [flight.from, flight.to]) {
      if (!airport) continue;
      airports.set(airport.id, airport);
      countries.add(airport.country);
      continents.add(airport.continent);
      bump(airportCounts, String(airport.id), airport);
    }
    // A country counts as reached where the period first touched it: the
    // origin of its first flight from there, or else the destination.
    const touched = new Map<string, Airport>();
    for (const airport of [flight.from, flight.to]) {
      if (airport && !touched.has(airport.country)) {
        touched.set(airport.country, airport);
      }
    }
    for (const [country, airport] of touched) {
      const visit = countryVisits.get(country);
      if (visit) visit.flights++;
      else {
        countryVisits.set(country, {
          country,
          airport,
          date,
          isNew: period !== 'all' && !seenCountries.has(country),
          flights: 1,
        });
      }
    }

    if (flight.from && flight.to) {
      const [a, b] = [flight.from, flight.to].sort((x, y) => x.id - y.id);
      const key = `${a!.id}-${b!.id}`;
      routes.add(key);
      bump(routeCounts, key, { from: flight.from, to: flight.to });

      const recapFlight = toRecapFlight(flight)!;
      if (!longestFlight || recapFlight.distanceKm > longestFlight.distanceKm) {
        longestFlight = recapFlight;
      }
      if (
        !shortestFlight ||
        recapFlight.distanceKm < shortestFlight.distanceKm
      ) {
        shortestFlight = recapFlight;
      }
      // Short or quick legs give silly speeds from rounded times.
      if (
        flight.duration &&
        flight.duration >= 45 * 60 &&
        recapFlight.distanceKm >= 400
      ) {
        const kmh = recapFlight.distanceKm / (flight.duration / 3600);
        if (!fastest || kmh > fastest.kmh) {
          fastest = { flight: recapFlight, kmh };
        }
      }

      if (flight.from.lat * flight.to.lat < 0) equatorCrossings++;
      if (Math.abs(flight.from.lon - flight.to.lon) > 180) datelineCrossings++;
      timeZonesCrossed += timeZoneChange(flight);
      if (flight.from.country === flight.to.country) domesticFlights++;
      else internationalFlights++;
    }

    if (flight.airline) {
      airlines.set(flight.airline.id, flight.airline);
      bump(airlineCounts, String(flight.airline.id), flight.airline);
    }
    if (flight.aircraft) {
      aircraftTypes.add(flight.aircraft.name);
      bump(aircraftCounts, flight.aircraft.name, flight.aircraft.name);
    }

    const passenger = userId
      ? flight.passengers.find((item) => item.userId === userId)
      : flight.passengers[0];
    tally(seats, passenger?.seat ?? null);
    tally(classes, passenger?.seatClass ?? null);
    tally(reasons, passenger?.flightReason ?? null);
  }

  const busiestMonth = flightsPerMonth.reduce<Counted<number> | null>(
    (best, count, month) =>
      count > 0 && (!best || count > best.count)
        ? { item: month, count }
        : best,
    null,
  );

  const dayKeys = Object.keys(days).sort();
  let busiestDay: RecapRecords['busiestDay'] = null;
  let longestGround: RecapRecords['longestGround'] = null;
  for (const [index, key] of dayKeys.entries()) {
    if (!busiestDay || days[key]! > busiestDay.count) {
      busiestDay = { date: key, count: days[key]! };
    }
    const previous = dayKeys[index - 1];
    if (previous) {
      const gap = dayNumber(key) - dayNumber(previous) - 1;
      if (gap > 0 && (!longestGround || gap > longestGround.days)) {
        longestGround = { days: gap, from: previous, to: key };
      }
    }
  }

  const located = flights
    .map(toRecapFlight)
    .filter((flight) => flight !== null);

  return {
    period,
    flightList: flights,
    flights: flights.length,
    upcomingFlights,
    distanceKm: Math.round(
      flights.reduce((sum, flight) => sum + (flight.distance ?? 0), 0),
    ),
    durationSeconds,
    airports: airports.size,
    countries: countries.size,
    airlines: airlines.size,
    aircraftTypes: aircraftTypes.size,
    routes: routes.size,
    daysFlying: dayKeys.length,
    newAirports:
      period === 'all'
        ? []
        : [...airports.values()].filter(
            (airport) => !seenAirports.has(airport.id),
          ),
    newCountries:
      period === 'all'
        ? []
        : [...countries].filter((country) => !seenCountries.has(country)),
    newAirlines:
      period === 'all'
        ? []
        : [...airlines.values()].filter(
            (airline) => !seenAirlines.has(airline.id),
          ),
    newAircraft:
      period === 'all'
        ? []
        : [...aircraftTypes].filter((name) => !seenAircraft.has(name)),
    longestFlight,
    shortestFlight:
      shortestFlight && shortestFlight.id !== longestFlight?.id
        ? shortestFlight
        : null,
    firstFlight: located[0] ?? null,
    lastFlight: located.at(-1) ?? null,
    topRoute: top(routeCounts),
    topAirport: top(airportCounts),
    topAirline: top(airlineCounts),
    topAircraft: top(aircraftCounts),
    busiestMonth,
    flightsPerMonth,
    flightsPerWeekday,
    days,
    seats,
    classes,
    reasons,
    countryVisits: [...countryVisits.values()],
    records: {
      ...extremes([...airports.values()]),
      equatorCrossings,
      datelineCrossings,
      timedFlights,
      redEyes,
      earlyStarts,
      timeZonesCrossed: Math.round(timeZonesCrossed),
      busiestDay,
      longestGround,
      fastest,
      domesticFlights,
      internationalFlights,
      continents: [...continents].sort(),
    },
  };
};
