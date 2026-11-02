import { booleanPointInPolygon } from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

import { db } from '$lib/db';
import type { VisitedCountryStatus } from '$lib/db/types';
import subdivisionList from '$lib/server/data/subdivisions.json';
import { isTerritoryCode } from '$lib/utils/data/countries';

type Status = (typeof VisitedCountryStatus)[number];

export type Subdivision = {
  code: string;
  name: string;
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
};

const catalog = subdivisionList as unknown as Record<string, Subdivision[]>;

const countryBySubdivision = new Map<string, string>();
for (const [country, subdivisions] of Object.entries(catalog)) {
  for (const subdivision of subdivisions) {
    countryBySubdivision.set(subdivision.code, country);
  }
}

/** States, provinces or regions of a country, sorted by name. */
export const subdivisionsOfCountry = (country: string): Subdivision[] =>
  catalog[country] ?? [];

/** How many subdivisions each country has. */
export const subdivisionCounts = (): Record<string, number> =>
  Object.fromEntries(
    Object.entries(catalog).map(([country, list]) => [country, list.length]),
  );

export const countryOfSubdivision = (code: string) =>
  countryBySubdivision.get(code);

export const isKnownSubdivisionCode = (code: string) =>
  countryBySubdivision.has(code);

export const listVisitedSubdivisions = async (userId: string) => {
  const rows = await db
    .selectFrom('visitedSubdivision')
    .selectAll()
    .where('userId', '=', userId)
    .orderBy('code')
    .execute();
  return rows.filter((row) => isKnownSubdivisionCode(row.code));
};

/**
 * Marks a subdivision. Marking one as visited or lived also marks its country
 * as visited when the country has no status yet.
 */
export const setVisitedSubdivision = async (
  userId: string,
  input: { code: string; status: Status; note: string | null },
) => {
  const country = countryOfSubdivision(input.code);
  if (!country) throw new Error(`Unknown subdivision ${input.code}`);

  return db.transaction().execute(async (trx) => {
    const row = await trx
      .insertInto('visitedSubdivision')
      .values({ ...input, country, userId })
      .onConflict((oc) =>
        oc
          .columns(['userId', 'code'])
          .doUpdateSet({ status: input.status, note: input.note }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();

    if (input.status === 'visited' || input.status === 'lived') {
      await trx
        .insertInto('visitedCountry')
        .values({ userId, code: country, status: 'visited' })
        .onConflict((oc) => oc.columns(['userId', 'code']).doNothing())
        .execute();
    }

    return row;
  });
};

export const removeVisitedSubdivision = (userId: string, code: string) =>
  db
    .deleteFrom('visitedSubdivision')
    .where('userId', '=', userId)
    .where('code', '=', code)
    .execute();

type ShapeProperties = {
  SUBDIVISION_CODE?: string;
  COUNTRY_CODE?: string;
  TERRITORY_CODE?: string;
};

type IndexedShape = {
  feature: Feature<Polygon | MultiPolygon, ShapeProperties>;
  bounds: [number, number, number, number];
};

const walkBounds = (coordinates: unknown, bounds: number[]) => {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === 'number') {
    const [x, y] = coordinates as [number, number];
    bounds[0] = Math.min(bounds[0]!, x);
    bounds[1] = Math.min(bounds[1]!, y);
    bounds[2] = Math.max(bounds[2]!, x);
    bounds[3] = Math.max(bounds[3]!, y);
    return;
  }
  for (const child of coordinates) walkBounds(child, bounds);
};

let shapes: Promise<IndexedShape[]> | null = null;

// About 3 MB, so it is only loaded when someone fills from flights.
const loadShapes = () =>
  (shapes ??= import('$lib/server/data/visited-place-shapes.json').then(
    (module) => {
      const collection = (module.default ?? module) as unknown as {
        features: Feature<Polygon | MultiPolygon, ShapeProperties>[];
      };
      return collection.features
        .filter((feature) => feature.geometry)
        .map((feature) => {
          const bounds = [Infinity, Infinity, -Infinity, -Infinity];
          walkBounds(feature.geometry.coordinates, bounds);
          return {
            feature,
            bounds: bounds as IndexedShape['bounds'],
          };
        });
    },
  ));

export type PlaceMatch = {
  subdivisions: Set<string>;
  territories: Set<string>;
};

/** Subdivisions and disputed territories that contain any of the points. */
export const placesAtPoints = async (
  points: readonly { lon: number; lat: number }[],
): Promise<PlaceMatch> => {
  const indexed = await loadShapes();
  const subdivisions = new Set<string>();
  const territories = new Set<string>();

  for (const { lon, lat } of points) {
    for (const { feature, bounds } of indexed) {
      if (lon < bounds[0] || lat < bounds[1]) continue;
      if (lon > bounds[2] || lat > bounds[3]) continue;
      if (!booleanPointInPolygon([lon, lat], feature)) continue;

      const { SUBDIVISION_CODE, TERRITORY_CODE } = feature.properties;
      if (SUBDIVISION_CODE && isKnownSubdivisionCode(SUBDIVISION_CODE)) {
        subdivisions.add(SUBDIVISION_CODE);
      }
      if (TERRITORY_CODE && isTerritoryCode(TERRITORY_CODE)) {
        territories.add(TERRITORY_CODE);
      }
    }
  }

  return { subdivisions, territories };
};
