import type { Airline, Airport } from '$lib/db/types';
import type { FlightData } from '$lib/utils';
import { isCompletedFlight } from '$lib/utils/data/flight-timeline';

export const EARTH_CIRCUMFERENCE_KM = 40_075;
export const MOON_DISTANCE_KM = 384_400;

type Counted<T> = { item: T; count: number };

export type RecapFlight = {
  id: number;
  from: Airport;
  to: Airport;
  distanceKm: number;
  durationSeconds: number | null;
  date: Date | null;
  airline: Airline | null;
};

export type RecapCountryVisit = {
  country: string;
  /** Airport where the country was first reached this year. */
  airport: Airport;
  date: Date | null;
  /** True when the country appears in no flight before this year. */
  isNew: boolean;
};

export type YearRecap = {
  year: number;
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
  topRoute: Counted<{ from: Airport; to: Airport }> | null;
  topAirport: Counted<Airport> | null;
  topAirline: Counted<Airline> | null;
  topAircraft: Counted<string> | null;
  busiestMonth: Counted<number> | null;
  flightsPerMonth: number[];
  seats: Record<string, number>;
  classes: Record<string, number>;
  countryVisits: RecapCountryVisit[];
  previousYearFlights: number | null;
  previousYearDistanceKm: number | null;
};

const yearOf = (flight: FlightData) => {
  const date = flight.date ?? flight.dateStart;
  return date ? date.getFullYear() : null;
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

const toRecapFlight = (flight: FlightData): RecapFlight | null =>
  flight.from && flight.to
    ? {
        id: flight.id,
        from: flight.from,
        to: flight.to,
        distanceKm: flight.distance ?? 0,
        durationSeconds: flight.duration,
        date: flight.date ?? flight.dateStart,
        airline: flight.airline,
      }
    : null;

const sortByDate = (flights: FlightData[]) =>
  [...flights].sort(
    (a, b) =>
      (a.date ?? a.dateStart)!.getTime() - (b.date ?? b.dateStart)!.getTime(),
  );

/** Years that have at least one completed flight, newest first. */
export const recapYears = (
  flights: FlightData[],
  now: Date = new Date(),
): number[] => {
  const years = new Set<number>();
  for (const flight of flights) {
    const year = yearOf(flight);
    if (year !== null && isCompletedFlight(flight.raw, now)) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
};

const totals = (flights: FlightData[]) => ({
  flights: flights.length,
  distanceKm: flights.reduce((sum, flight) => sum + (flight.distance ?? 0), 0),
});

export const computeYearRecap = (
  allFlights: FlightData[],
  year: number,
  userId: string | undefined,
  now: Date = new Date(),
): YearRecap => {
  const completed = sortByDate(
    allFlights.filter(
      (flight) => yearOf(flight) !== null && isCompletedFlight(flight.raw, now),
    ),
  );
  const flights = completed.filter((flight) => yearOf(flight) === year);
  const earlier = completed.filter((flight) => yearOf(flight)! < year);
  const previous = completed.filter((flight) => yearOf(flight) === year - 1);
  const upcomingFlights = allFlights.filter(
    (flight) => yearOf(flight) === year && !isCompletedFlight(flight.raw, now),
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
  const airlines = new Map<number, Airline>();
  const aircraftTypes = new Set<string>();
  const routes = new Set<string>();
  const days = new Set<string>();
  const routeCounts = new Map<
    string,
    Counted<{ from: Airport; to: Airport }>
  >();
  const airportCounts = new Map<string, Counted<Airport>>();
  const airlineCounts = new Map<string, Counted<Airline>>();
  const aircraftCounts = new Map<string, Counted<string>>();
  const flightsPerMonth = Array.from({ length: 12 }, () => 0);
  const seats: Record<string, number> = {};
  const classes: Record<string, number> = {};
  const countryVisits: RecapCountryVisit[] = [];
  const reached = new Set<string>();
  let durationSeconds = 0;
  let longestFlight: RecapFlight | null = null;
  let shortestFlight: RecapFlight | null = null;

  for (const flight of flights) {
    const date = flight.date ?? flight.dateStart;
    if (date) {
      flightsPerMonth[date.getMonth()]!++;
      if (flight.datePrecision === 'day') {
        days.add(`${date.getMonth()}-${date.getDate()}`);
      }
    }
    durationSeconds += flight.duration ?? 0;

    for (const airport of [flight.from, flight.to]) {
      if (!airport) continue;
      airports.set(airport.id, airport);
      countries.add(airport.country);
      bump(airportCounts, String(airport.id), airport);
    }
    // A country counts as reached where the year first touched it: the destination, or
    // the origin of the year's first flight from it.
    for (const airport of [flight.from, flight.to]) {
      if (!airport || reached.has(airport.country)) continue;
      reached.add(airport.country);
      countryVisits.push({
        country: airport.country,
        airport,
        date,
        isNew: !seenCountries.has(airport.country),
      });
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
    if (passenger?.seat)
      seats[passenger.seat] = (seats[passenger.seat] ?? 0) + 1;
    if (passenger?.seatClass) {
      classes[passenger.seatClass] = (classes[passenger.seatClass] ?? 0) + 1;
    }
  }

  const busiest = flightsPerMonth.reduce<Counted<number> | null>(
    (best, count, month) =>
      count > 0 && (!best || count > best.count)
        ? { item: month, count }
        : best,
    null,
  );

  return {
    year,
    flights: flights.length,
    upcomingFlights,
    distanceKm: Math.round(totals(flights).distanceKm),
    durationSeconds,
    airports: airports.size,
    countries: countries.size,
    airlines: airlines.size,
    aircraftTypes: aircraftTypes.size,
    routes: routes.size,
    daysFlying: days.size,
    newAirports: [...airports.values()].filter(
      (airport) => !seenAirports.has(airport.id),
    ),
    newCountries: [...countries].filter(
      (country) => !seenCountries.has(country),
    ),
    newAirlines: [...airlines.values()].filter(
      (airline) => !seenAirlines.has(airline.id),
    ),
    newAircraft: [...aircraftTypes].filter((name) => !seenAircraft.has(name)),
    longestFlight,
    shortestFlight:
      shortestFlight && shortestFlight.id !== longestFlight?.id
        ? shortestFlight
        : null,
    topRoute: top(routeCounts),
    topAirport: top(airportCounts),
    topAirline: top(airlineCounts),
    topAircraft: top(aircraftCounts),
    busiestMonth: busiest,
    flightsPerMonth,
    seats,
    classes,
    countryVisits,
    previousYearFlights: previous.length ? previous.length : null,
    previousYearDistanceKm: previous.length
      ? Math.round(totals(previous).distanceKm)
      : null,
  };
};
