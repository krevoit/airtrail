<script lang="ts" module>
  export type ShareLayout = 'summary' | 'map' | 'story';

  export const SHARE_SIZES: Record<ShareLayout, [number, number]> = {
    summary: [1080, 1350],
    map: [1080, 1350],
    story: [1080, 1920],
  };
</script>

<script lang="ts">
  import { mapAirports, mapRoutes } from './geo';
  import { FONT, PALETTES, type RecapTheme } from './palette';
  import RouteMap from './RouteMap.svelte';

  import type { Recap } from '$lib/stats/recap';

  let {
    recap,
    name,
    title,
    subtitle,
    stats,
    layout = 'summary',
    theme = 'light',
    svg = $bindable(),
  }: {
    recap: Recap;
    name: string;
    /** "2026" or "All time". */
    title: string;
    subtitle: string;
    /** Six figures, already formatted. */
    stats: { label: string; value: string }[];
    layout?: ShareLayout;
    theme?: RecapTheme;
    svg?: SVGSVGElement;
  } = $props();

  const PAD = 88;
  const palette = $derived(PALETTES[theme]);
  const size = $derived(SHARE_SIZES[layout]);
  const width = $derived(size[0]);
  const height = $derived(size[1]);
  const inner = $derived(width - PAD * 2);

  const routes = $derived(mapRoutes(recap.flightList));
  const airports = $derived(mapAirports(recap.flightList));
  const countries = $derived(
    new Set(recap.countryVisits.map((v) => v.country)),
  );

  // Where each block sits for the chosen layout.
  const frame = $derived.by(() => {
    if (layout === 'map') {
      return {
        map: { x: 0, y: 0, width, height: 820, radius: 0, padding: 70 },
        titleY: 960,
        statsY: 1030,
        statsColumns: 3,
        statsRows: 1,
        chipsY: 1240,
      };
    }
    if (layout === 'story') {
      return {
        map: {
          x: PAD,
          y: 440,
          width: inner,
          height: 640,
          radius: 28,
          padding: 40,
        },
        titleY: 300,
        statsY: 1140,
        statsColumns: 2,
        statsRows: 3,
        chipsY: 1720,
      };
    }
    return {
      map: {
        x: PAD,
        y: 400,
        width: inner,
        height: 400,
        radius: 24,
        padding: 32,
      },
      titleY: 290,
      statsY: 840,
      statsColumns: 3,
      statsRows: 2,
      chipsY: 1236,
    };
  });

  const shownStats = $derived(
    stats.slice(0, frame.statsColumns * frame.statsRows),
  );
  const columnWidth = $derived(inner / frame.statsColumns);
  const rowHeight = $derived(layout === 'story' ? 180 : 170);
  // Bold digits are about 0.6em wide; shrink long values to fit the column.
  const valueSize = (value: string) =>
    Math.min(
      layout === 'story' ? 92 : 76,
      Math.floor((columnWidth - 36) / (value.length * 0.6)),
    );

  const CHIP_WIDTH = 84;
  const CHIP_GAP = 10;
  const chipSlots = $derived(
    Math.floor((inner + CHIP_GAP) / (CHIP_WIDTH + CHIP_GAP)),
  );
  const chips = $derived.by(() => {
    const codes = recap.countryVisits.map((visit) => visit.country);
    if (codes.length <= chipSlots) return codes;
    return [
      ...codes.slice(0, chipSlots - 1),
      `+${codes.length - (chipSlots - 1)}`,
    ];
  });
</script>

<svg
  bind:this={svg}
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 {width} {height}"
  {width}
  {height}
  class="h-auto w-full"
  role="img"
  aria-label="{title}: {subtitle} for {name}"
  font-family={FONT}
>
  <rect {width} {height} fill={palette.background} />

  {#if layout === 'map'}
    <RouteMap {routes} {airports} {countries} {palette} {...frame.map} />
    <text
      x={PAD}
      y={frame.titleY}
      fill={palette.foreground}
      font-size="96"
      font-weight="700"
      letter-spacing="-3">{title}</text
    >
    <text
      x={width - PAD}
      y={frame.titleY}
      fill={palette.mutedForeground}
      font-size="34"
      text-anchor="end">{name}</text
    >
  {:else}
    <text
      x={PAD}
      y={layout === 'story' ? 170 : 150}
      fill={palette.mutedForeground}
      font-size="34"
      font-weight="500">{name}</text
    >
    <text
      x={PAD}
      y={frame.titleY}
      fill={palette.foreground}
      font-size={layout === 'story' ? 170 : 150}
      font-weight="700"
      letter-spacing="-5">{title}</text
    >
    <text
      x={PAD}
      y={frame.titleY + 60}
      fill={palette.mutedForeground}
      font-size="38">{subtitle}</text
    >
    <RouteMap {routes} {airports} {countries} {palette} {...frame.map} />
  {/if}

  {#each shownStats as stat, index (stat.label)}
    {@const x = PAD + (index % frame.statsColumns) * columnWidth}
    {@const y =
      frame.statsY + Math.floor(index / frame.statsColumns) * rowHeight}
    <line
      x1={PAD}
      x2={PAD + inner}
      y1={y}
      y2={y}
      stroke={palette.border}
      stroke-width="2"
    />
    <text {x} y={y + 56} fill={palette.mutedForeground} font-size="30"
      >{stat.label}</text
    >
    <text
      {x}
      y={y + 136}
      fill={palette.foreground}
      font-size={valueSize(stat.value)}
      font-weight="700"
      letter-spacing="-2">{stat.value}</text
    >
  {/each}

  {#each chips as chip, index (chip)}
    {@const x = PAD + index * (CHIP_WIDTH + CHIP_GAP)}
    <rect
      {x}
      y={frame.chipsY}
      width={CHIP_WIDTH}
      height="48"
      rx="24"
      fill={palette.muted}
    />
    <text
      x={x + CHIP_WIDTH / 2}
      y={frame.chipsY + 33}
      fill={palette.foreground}
      font-size="24"
      font-weight="600"
      text-anchor="middle">{chip}</text
    >
  {/each}

  <text
    x={width - PAD}
    y={height - 44}
    fill={palette.mutedForeground}
    font-size="26"
    font-weight="600"
    text-anchor="end">AirTrail</text
  >
</svg>
