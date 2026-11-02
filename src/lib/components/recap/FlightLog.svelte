<script lang="ts">
  import { ChevronDown } from '@o7/icon/lucide';

  import type { RecapFormat } from './format';

  import { MONTHS } from '$lib/data/datetime';
  import type { Airport } from '$lib/db/types';
  import { pluralize, type FlightData } from '$lib/utils';

  let {
    flights,
    f,
    allTime = false,
  }: {
    flights: FlightData[];
    f: RecapFormat;
    /** Group by year instead of month. */
    allTime?: boolean;
  } = $props();

  const COLLAPSED_ROWS = 12;
  let expanded = $state(false);

  const groups = $derived.by(() => {
    const list: { label: string; flights: FlightData[] }[] = [];
    // Newest first, like the flight list.
    for (const flight of [...flights].reverse()) {
      const date = flight.date ?? flight.dateStart;
      const label = !date
        ? 'Undated'
        : allTime
          ? String(date.getFullYear())
          : (MONTHS[date.getMonth()] ?? '');
      const group = list.at(-1);
      if (group?.label === label) group.flights.push(flight);
      else list.push({ label, flights: [flight] });
    }
    return list;
  });

  const visibleGroups = $derived.by(() => {
    if (expanded) return groups;
    let left = COLLAPSED_ROWS;
    const shown: typeof groups = [];
    for (const group of groups) {
      if (left <= 0) break;
      shown.push({ ...group, flights: group.flights.slice(0, left) });
      left -= group.flights.length;
    }
    return shown;
  });

  const flag = (airport: Airport | null) =>
    airport ? `https://flagcdn.com/${airport.country.toLowerCase()}.svg` : '';
  const day = (flight: FlightData) => {
    const date = flight.date ?? flight.dateStart;
    if (!date || flight.datePrecision !== 'day') return '';
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: allTime ? 'short' : undefined,
      weekday: allTime ? undefined : 'short',
    });
  };
</script>

<div class="space-y-5">
  {#each visibleGroups as group (group.label)}
    {@const count =
      groups.find((item) => item.label === group.label)?.flights.length ?? 0}
    <div>
      <div
        class="sticky top-0 z-[1] flex items-baseline justify-between bg-background/90 py-1 backdrop-blur"
      >
        <h4 class="text-[13px] font-semibold">{group.label}</h4>
        <span class="text-[12px] text-muted-foreground"
          >{count} {pluralize(count, 'flight')}</span
        >
      </div>
      <ul class="divide-y">
        {#each group.flights as flight (flight.id)}
          <li
            class="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 py-2 text-sm sm:grid-cols-[5rem_minmax(0,14rem)_minmax(0,1fr)_auto]"
          >
            <span class="text-[13px] tabular-nums text-muted-foreground"
              >{day(flight)}</span
            >
            <span class="flex min-w-0 items-center gap-1.5 font-semibold">
              {#if flight.from}
                <img
                  src={flag(flight.from)}
                  alt=""
                  class="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                />
                {f.airportCode(flight.from)}
              {/if}
              <span class="text-muted-foreground">→</span>
              {#if flight.to}
                <img
                  src={flag(flight.to)}
                  alt=""
                  class="h-3 w-4 shrink-0 rounded-[2px] object-cover"
                />
                {f.airportCode(flight.to)}
              {/if}
            </span>
            <span
              class="hidden min-w-0 truncate text-[13px] text-muted-foreground sm:block"
            >
              {[
                flight.airline?.name,
                flight.flightNumber,
                flight.aircraft?.name,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span
              class="text-right text-[13px] tabular-nums text-muted-foreground"
            >
              {flight.distance
                ? f.distanceWithUnit(flight.distance)
                : ''}{#if flight.duration}
                <span class="hidden sm:inline">
                  · {f.duration(flight.duration)}</span
                >{/if}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</div>
{#if flights.length > COLLAPSED_ROWS}
  <button
    type="button"
    class="mt-2 flex items-center gap-1 rounded px-2 py-1 text-[12.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
    onclick={() => (expanded = !expanded)}
  >
    {expanded ? 'Show fewer' : `All ${flights.length} flights`}
    <ChevronDown size={13} class={expanded ? 'rotate-180' : ''} />
  </button>
{/if}
