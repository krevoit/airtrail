<script lang="ts">
  import { STAMP_INKS, stampSeed } from './PassportStamp.svelte';

  import type { YearRecap } from '$lib/stats/recap';
  import { EARTH_CIRCUMFERENCE_KM } from '$lib/stats/recap';

  let {
    recap,
    name,
    distance,
    distanceUnit,
    timeAloft,
    mrz,
    svg = $bindable(),
  }: {
    recap: YearRecap;
    name: string;
    distance: string;
    distanceUnit: string;
    timeAloft: string;
    mrz: readonly [string, string];
    svg?: SVGSVGElement;
  } = $props();

  const GOLD = '#e3c27a';
  const PAPER = '#f5efe0';
  const INK = '#2b2a28';

  const stats = $derived([
    { label: 'Flights', value: recap.flights.toLocaleString() },
    { label: distanceUnit, value: distance },
    { label: 'Time aloft', value: timeAloft },
    { label: 'Airports', value: recap.airports.toLocaleString() },
    { label: 'Countries', value: recap.countries.toLocaleString() },
    { label: 'Airlines', value: recap.airlines.toLocaleString() },
  ]);
  // Each stat column is 300 units wide. Shrink long values such as "4d 6h 41m"
  // so they don't run into the next column (bold serif digits are ~0.55em).
  const valueFontSize = (value: string) =>
    Math.min(70, Math.floor(260 / (value.length * 0.55)));
  const laps = $derived(recap.distanceKm / EARTH_CIRCUMFERENCE_KM);
  const stamps = $derived(recap.stamps.slice(0, 7));
  const stampSpacing = $derived(
    stamps.length > 1 ? Math.min(124, 800 / (stamps.length - 1)) : 0,
  );
  const stampStart = $derived(540 - (stampSpacing * (stamps.length - 1)) / 2);
</script>

<svg
  bind:this={svg}
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1080 1350"
  width="1080"
  height="1350"
  class="h-auto w-full"
  role="img"
  aria-label="{recap.year} flight passport for {name}"
>
  <defs>
    <linearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d2d50" />
      <stop offset="0.55" stop-color="#14213d" />
      <stop offset="1" stop-color="#0a1222" />
    </linearGradient>
    <pattern
      id="guilloche"
      width="36"
      height="36"
      patternUnits="userSpaceOnUse"
    >
      <circle cx="18" cy="18" r="16" fill="none" stroke="#d9cdb1" />
      <circle cx="0" cy="0" r="16" fill="none" stroke="#d9cdb1" />
      <circle cx="36" cy="36" r="16" fill="none" stroke="#d9cdb1" />
    </pattern>
  </defs>

  <rect width="1080" height="1350" fill="url(#cover)" />
  <rect
    x="34"
    y="34"
    width="1012"
    height="1282"
    rx="34"
    fill="none"
    stroke={GOLD}
    stroke-opacity="0.55"
    stroke-width="3"
  />

  <!-- Emblem -->
  <g transform="translate(540 150)" fill="none" stroke={GOLD} stroke-width="3">
    <circle r="54" />
    <ellipse rx="24" ry="54" />
    <line x1="-54" x2="54" />
    <path d="M -47 -27 Q 0 -14 47 -27 M -47 27 Q 0 14 47 27" />
  </g>
  <text
    x="540"
    y="262"
    fill={GOLD}
    font-family="ui-sans-serif, system-ui, sans-serif"
    font-size="30"
    font-weight="600"
    letter-spacing="12"
    text-anchor="middle">FLIGHT PASSPORT</text
  >
  <text
    x="540"
    y="440"
    fill={GOLD}
    font-family="ui-serif, Georgia, serif"
    font-size="190"
    font-weight="700"
    text-anchor="middle">{recap.year}</text
  >
  <text
    x="540"
    y="505"
    fill="#f3ead6"
    fill-opacity="0.85"
    font-family="ui-sans-serif, system-ui, sans-serif"
    font-size="36"
    text-anchor="middle">{name}</text
  >

  <!-- Data page -->
  <rect x="74" y="556" width="932" height="560" rx="26" fill={PAPER} />
  <rect
    x="74"
    y="556"
    width="932"
    height="560"
    rx="26"
    fill="url(#guilloche)"
    opacity="0.35"
  />
  {#each stats as stat, index (stat.label)}
    {@const x = 140 + (index % 3) * 300}
    {@const y = 640 + Math.floor(index / 3) * 170}
    <text
      {x}
      {y}
      fill="#7a705c"
      font-family="ui-sans-serif, system-ui, sans-serif"
      font-size="24"
      font-weight="600"
      letter-spacing="3">{stat.label.toUpperCase()}</text
    >
    <text
      {x}
      y={y + 78}
      fill={INK}
      font-family="ui-serif, Georgia, serif"
      font-size={valueFontSize(stat.value)}
      font-weight="700">{stat.value}</text
    >
  {/each}
  <text
    x="540"
    y="1002"
    fill="#5d5546"
    font-family="ui-serif, Georgia, serif"
    font-size="30"
    font-style="italic"
    text-anchor="middle"
  >
    {laps >= 0.1
      ? `${laps.toFixed(laps >= 10 ? 0 : 1)}× around the Earth`
      : `${recap.routes} ${recap.routes === 1 ? 'route' : 'routes'} flown`}
  </text>

  {#each stamps as stamp, index (stamp.country)}
    {@const ink = STAMP_INKS[stampSeed(stamp.country) % STAMP_INKS.length]}
    {@const cx = stampStart + index * stampSpacing}
    <g
      transform="translate({cx} 1062) rotate({(stampSeed(stamp.country) % 21) -
        10})"
      fill="none"
      stroke={ink}
      opacity="0.85"
    >
      <circle r="40" stroke-width="4" />
      <circle r="33" stroke-width="1.5" />
      <text
        y="10"
        fill={ink}
        stroke="none"
        font-family="ui-serif, Georgia, serif"
        font-size="28"
        font-weight="700"
        text-anchor="middle">{stamp.country}</text
      >
    </g>
  {/each}

  <!-- Machine-readable zone -->
  {#each mrz as line, index (index)}
    <text
      x="540"
      y={1212 + index * 48}
      fill="#f3ead6"
      fill-opacity="0.8"
      font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
      font-size="31"
      letter-spacing="3.2"
      text-anchor="middle">{line}</text
    >
  {/each}
</svg>
