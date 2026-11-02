import {
  geoInterpolate,
  geoNaturalEarth1,
  type GeoPermissibleObjects,
  type GeoProjection,
} from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

import topology from '$lib/data/world-topology.json';
import type { Airport } from '$lib/db/types';

export type CountryFeature = Feature<Geometry, { id: string }>;

const world = topology as unknown as Topology<{
  countries: GeometryCollection<{ id: string }>;
}>;

/** GISCO countries, keyed by the same codes as visited countries. */
export const worldCountries = (
  feature(world, world.objects.countries) as FeatureCollection<
    Geometry,
    { id: string }
  >
).features as CountryFeature[];

export type LonLat = [number, number];

export type MapRoute = {
  from: LonLat;
  to: LonLat;
  /** Times flown in either direction. */
  count: number;
};

export const lonLat = (airport: Airport): LonLat => [airport.lon, airport.lat];

/** One entry per airport pair, with how often it was flown. */
export const mapRoutes = (
  flights: { from: Airport | null; to: Airport | null }[],
): MapRoute[] => {
  const routes = new Map<string, MapRoute>();
  for (const { from, to } of flights) {
    if (!from || !to || from.id === to.id) continue;
    const key = [from.id, to.id].sort((a, b) => a - b).join('-');
    const route = routes.get(key);
    if (route) route.count++;
    else routes.set(key, { from: lonLat(from), to: lonLat(to), count: 1 });
  }
  return [...routes.values()].sort((a, b) => a.count - b.count);
};

export const mapAirports = (
  flights: { from: Airport | null; to: Airport | null }[],
): LonLat[] => {
  const airports = new Map<number, LonLat>();
  for (const { from, to } of flights) {
    for (const airport of [from, to]) {
      if (airport) airports.set(airport.id, lonLat(airport));
    }
  }
  return [...airports.values()];
};

/** The great-circle path from `from`, drawn up to `progress` of the way. */
export const routeLine = (
  route: MapRoute,
  progress = 1,
): GeoPermissibleObjects => ({
  type: 'LineString',
  coordinates:
    progress >= 1
      ? [route.from, route.to]
      : [route.from, geoInterpolate(route.from, route.to)(progress)],
});

const normalize = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * The longitude to centre a flat map on so no point is cut off by its edge:
 * the opposite side of the widest empty band of longitude.
 */
export const centerLongitude = (points: LonLat[]) => {
  if (!points.length) return 0;
  const lons = points.map(([lon]) => lon).sort((a, b) => a - b);
  let gapStart = lons.at(-1)!;
  let gap = lons[0]! + 360 - gapStart;
  for (let index = 0; index < lons.length - 1; index++) {
    const width = lons[index + 1]! - lons[index]!;
    if (width > gap) {
      gap = width;
      gapStart = lons[index]!;
    }
  }
  return normalize(gapStart + gap / 2 + 180);
};

/** Average position on the sphere, for pointing a globe at the routes. */
export const centroid = (points: LonLat[]): LonLat => {
  if (!points.length) return [0, 20];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lon, lat] of points) {
    const phi = (lat * Math.PI) / 180;
    const lambda = (lon * Math.PI) / 180;
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  return [lon, lat];
};

/**
 * A flat map fitted around the routes, never zoomed in so far that the
 * coarse coastlines show.
 */
export const fitFlatProjection = (
  points: LonLat[],
  width: number,
  height: number,
  padding: number,
): GeoProjection => {
  const projection = geoNaturalEarth1().rotate([-centerLongitude(points), 0]);
  const extent: [[number, number], [number, number]] = [
    [padding, padding],
    [width - padding, height - padding],
  ];
  if (points.length < 2) {
    return projection.fitExtent(extent, { type: 'Sphere' });
  }
  projection.fitExtent(extent, { type: 'MultiPoint', coordinates: points });
  const maxScale = Math.min(width, height) * 1.6;
  if (projection.scale() > maxScale) {
    const [lon, lat] = centroid(points);
    projection
      .scale(maxScale)
      .translate([width / 2, height / 2])
      .rotate([-lon, 0])
      .center([0, lat]);
  }
  return projection;
};
