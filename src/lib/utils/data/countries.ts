import { COUNTRIES } from '$lib/data/countries';
import { TERRITORIES, type Territory } from '$lib/data/territories';

export type Country = (typeof COUNTRIES)[number];
export type { Territory };

/** Something that can be marked on the visited-countries map. */
export type VisitedPlace = {
  code: string;
  name: string;
  continent: string | null;
  kind: 'country' | 'territory';
  claimants: string[];
};

type FlightCountryEndpoints = {
  from: { country: string } | null;
  to: { country: string } | null;
};

export const countryFromAlpha2 = (alpha: string): Country | undefined => {
  return COUNTRIES.find((country) => country.alpha2 === alpha);
};

export const isKnownCountryCode = (code: string) =>
  countryFromAlpha2(code) !== undefined;

export const territoryFromCode = (code: string): Territory | undefined =>
  TERRITORIES.find((territory) => territory.code === code);

export const isTerritoryCode = (code: string) =>
  territoryFromCode(code) !== undefined;

export const visitedPlaceFromCode = (
  code: string,
): VisitedPlace | undefined => {
  const country = countryFromAlpha2(code);
  if (country) {
    return {
      code: country.alpha2,
      name: country.name,
      continent: country.continent,
      kind: 'country',
      claimants: [],
    };
  }

  const territory = territoryFromCode(code);
  if (territory) {
    return {
      code: territory.code,
      name: territory.name,
      continent: territory.continent,
      kind: 'territory',
      claimants: territory.claimants,
    };
  }

  return undefined;
};

/** Countries and disputed territories can both be marked as visited. */
export const isKnownVisitedPlaceCode = (code: string) =>
  visitedPlaceFromCode(code) !== undefined;

export const countryCodesFromFlights = (
  flights: readonly FlightCountryEndpoints[],
): Set<string> => {
  const countryCodes = new Set<string>();

  for (const flight of flights) {
    for (const airport of [flight.from, flight.to]) {
      if (airport && countryFromAlpha2(airport.country)) {
        countryCodes.add(airport.country);
      }
    }
  }

  return countryCodes;
};
