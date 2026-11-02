<script lang="ts">
  import { SHORT_MONTHS } from '$lib/data/datetime';
  import type { YearRecap } from '$lib/stats/recap';

  let {
    recap,
    name,
    distance,
    distanceUnit,
    timeAloft,
    svg = $bindable(),
  }: {
    recap: YearRecap;
    name: string;
    distance: string;
    distanceUnit: string;
    timeAloft: string;
    svg?: SVGSVGElement;
  } = $props();

  // The app's light theme, written out because the PNG export can't read CSS
  // variables.
  const FOREGROUND = '#09090b';
  const MUTED = '#71717a';
  const BORDER = '#e4e4e7';
  const SECONDARY = '#f4f4f5';
  const PRIMARY = '#3b82f6';
  const FONT = 'Public Sans, ui-sans-serif, system-ui, sans-serif';

  const PAD = 88;
  const WIDTH = 1080 - PAD * 2;
  const COLUMN = WIDTH / 2;

  const stats = $derived([
    { label: 'Flights', value: recap.flights.toLocaleString() },
    { label: `Distance (${distanceUnit})`, value: distance },
    { label: 'Duration', value: timeAloft },
    { label: 'Airports', value: recap.airports.toLocaleString() },
    { label: 'Countries', value: recap.countries.toLocaleString() },
    { label: 'Airlines', value: recap.airlines.toLocaleString() },
  ]);
  // Bold digits are about 0.6em wide; shrink long values to fit the column.
  const valueSize = (value: string) =>
    Math.min(76, Math.floor((COLUMN - 40) / (value.length * 0.6)));

  const BAR_GAP = 12;
  const BAR_WIDTH = (WIDTH - BAR_GAP * 11) / 12;
  const CHART_TOP = 1040;
  const CHART_HEIGHT = 120;
  const monthMax = $derived(Math.max(1, ...recap.flightsPerMonth));

  const CHIP_WIDTH = 84;
  const CHIP_GAP = 10;
  const chips = $derived(
    recap.countryVisits
      .slice(0, Math.floor((WIDTH + CHIP_GAP) / (CHIP_WIDTH + CHIP_GAP)))
      .map((visit) => visit.country),
  );
</script>

<svg
  bind:this={svg}
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 1080 1350"
  width="1080"
  height="1350"
  class="h-auto w-full"
  role="img"
  aria-label="{recap.year} in flights for {name}"
  font-family={FONT}
>
  <rect width="1080" height="1350" fill="#ffffff" />

  <text x={PAD} y="150" fill={MUTED} font-size="34" font-weight="500"
    >{name}</text
  >
  <text
    x={PAD}
    y="300"
    fill={FOREGROUND}
    font-size="150"
    font-weight="700"
    letter-spacing="-5">{recap.year}</text
  >
  <text x={PAD} y="360" fill={MUTED} font-size="38">Year in flights</text>

  {#each stats as stat, index (stat.label)}
    {@const x = PAD + (index % 2) * COLUMN}
    {@const y = 430 + Math.floor(index / 2) * 170}
    <line
      x1={PAD}
      x2={PAD + WIDTH}
      y1={y}
      y2={y}
      stroke={BORDER}
      stroke-width="2"
    />
    <text {x} y={y + 58} fill={MUTED} font-size="30">{stat.label}</text>
    <text
      {x}
      y={y + 136}
      fill={FOREGROUND}
      font-size={valueSize(stat.value)}
      font-weight="700"
      letter-spacing="-2">{stat.value}</text
    >
  {/each}
  <line
    x1={PAD}
    x2={PAD + WIDTH}
    y1="940"
    y2="940"
    stroke={BORDER}
    stroke-width="2"
  />

  <text x={PAD} y="1000" fill={MUTED} font-size="30">Flights per month</text>
  {#each recap.flightsPerMonth as count, month (month)}
    {@const x = PAD + month * (BAR_WIDTH + BAR_GAP)}
    {@const height = count ? Math.max(8, (count / monthMax) * CHART_HEIGHT) : 4}
    <rect
      {x}
      y={CHART_TOP + CHART_HEIGHT - height}
      width={BAR_WIDTH}
      {height}
      rx="6"
      fill={count ? PRIMARY : BORDER}
    />
    <text
      x={x + BAR_WIDTH / 2}
      y={CHART_TOP + CHART_HEIGHT + 40}
      fill={MUTED}
      font-size="24"
      text-anchor="middle">{SHORT_MONTHS[month]?.[0]}</text
    >
  {/each}

  {#each chips as country, index (country)}
    {@const x = PAD + index * (CHIP_WIDTH + CHIP_GAP)}
    <rect
      {x}
      y="1236"
      width={CHIP_WIDTH}
      height="48"
      rx="24"
      fill={SECONDARY}
    />
    <text
      x={x + CHIP_WIDTH / 2}
      y="1269"
      fill={FOREGROUND}
      font-size="24"
      font-weight="600"
      text-anchor="middle">{country}</text
    >
  {/each}
</svg>
