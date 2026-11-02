import type { Airport } from '$lib/db/types';
import type { FlightData } from '$lib/utils';
import { Duration } from '$lib/utils/datetime';
import { formatTime, getPreferences } from '$lib/utils/preferences';

type Preferences = ReturnType<typeof getPreferences>;

export const airportCode = (airport: Airport | null | undefined) =>
  airport ? (airport.iata ?? airport.icao) : '—';

export const airportCity = (airport: Airport | null | undefined) =>
  airport ? (airport.municipality ?? airport.name) : 'Unknown';

export const flagUrl = (country: string) =>
  `https://flagcdn.com/${country.toLowerCase()}.svg`;

/** "QF 12", or the airline's name when there is no number. */
export const flightLabel = (flight: FlightData) => {
  const number = flight.flightNumber?.trim();
  if (number) return number.replace(/^([A-Z0-9]{2})(\d+)/i, '$1 $2');
  return flight.airline?.name ?? null;
};

export const durationLabel = (seconds: number | null | undefined) =>
  seconds ? Duration.fromSeconds(seconds).toString(true) : null;

/** Local time at the airport, in the user's clock format. */
export const localTime = (
  date: Date | null,
  airport: Airport | null | undefined,
  prefs: Preferences,
) => (date ? formatTime(date, prefs, airport?.tz) : null);

/** "Fri, 5 Dec" at the airport. */
export const localDay = (
  date: Date | null,
  airport: Airport | null | undefined,
  includeYear = false,
) =>
  date
    ? new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: includeYear ? 'numeric' : undefined,
        timeZone: airport?.tz,
      }).format(date)
    : null;

/** Month and day for the date column of a row, at the departure airport. */
export const dateBlock = (flight: FlightData) => {
  const date = flight.date ?? flight.dateStart;
  if (!date) return { top: '', main: '?' };
  const timeZone = flight.from?.tz;
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date);
  if (flight.datePrecision === 'year') {
    return { top: '', main: part({ year: 'numeric' }) };
  }
  if (flight.datePrecision === 'month') {
    return { top: part({ year: 'numeric' }), main: part({ month: 'short' }) };
  }
  return { top: part({ month: 'short' }), main: part({ day: 'numeric' }) };
};
