<script lang="ts">
  import { geoPath } from 'd3-geo';

  import {
    fitFlatProjection,
    routeLine,
    worldCountries,
    type LonLat,
    type MapRoute,
  } from './geo';
  import type { Palette } from './palette';

  // Drawn as plain SVG elements (no CSS) so it can be exported as an image.
  let {
    routes,
    airports,
    countries,
    palette,
    x = 0,
    y = 0,
    width,
    height,
    padding = 24,
    radius = 0,
    animate = false,
  }: {
    routes: MapRoute[];
    airports: LonLat[];
    countries: Set<string>;
    palette: Palette;
    x?: number;
    y?: number;
    width: number;
    height: number;
    padding?: number;
    radius?: number;
    /** Draw the routes in one after another. */
    animate?: boolean;
  } = $props();

  const clipId = `route-map-${Math.random().toString(36).slice(2)}`;
  const projection = $derived(
    fitFlatProjection(airports, width, height, padding),
  );
  const path = $derived(geoPath(projection));
  const land = $derived(
    worldCountries.map((country) => ({
      id: country.properties.id,
      d: path(country) ?? '',
    })),
  );
  const widest = $derived(Math.max(1, ...routes.map((route) => route.count)));
  const scale = $derived(Math.max(1, Math.min(width, height) / 400));
</script>

<g transform="translate({x} {y})">
  <defs>
    <clipPath id={clipId}>
      <rect {width} {height} rx={radius} />
    </clipPath>
  </defs>
  <g clip-path="url(#{clipId})">
    <rect {width} {height} fill={palette.water} />
    {#each land as country (country.id)}
      <path
        d={country.d}
        fill={countries.has(country.id) ? palette.visited : palette.land}
        stroke={palette.landBorder}
        stroke-width={0.6 * scale}
        stroke-linejoin="round"
      />
    {/each}
    {#each routes as route, index (index)}
      {@const d = path(routeLine(route)) ?? ''}
      <path
        {d}
        fill="none"
        stroke={palette.primary}
        stroke-width={(1.4 + (route.count / widest) * 2) * scale}
        stroke-linecap="round"
        pathLength={animate ? 1 : undefined}
        stroke-dasharray={animate ? 1 : undefined}
        stroke-dashoffset={animate ? 1 : undefined}
        style:animation={animate
          ? `route-draw 900ms ease-out ${200 + (index / Math.max(1, routes.length)) * 1600}ms forwards`
          : undefined}
      />
    {/each}
    {#each airports as airport, index (index)}
      {@const point = projection(airport)}
      {#if point}
        <circle
          cx={point[0]}
          cy={point[1]}
          r={3 * scale}
          fill={palette.background}
          stroke={palette.primary}
          stroke-width={1.6 * scale}
        />
      {/if}
    {/each}
  </g>
</g>

<style>
  @keyframes -global-route-draw {
    to {
      stroke-dashoffset: 0;
    }
  }
</style>
