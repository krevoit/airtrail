<script lang="ts">
  import { ChevronDown, ChevronRight } from '@o7/icon/lucide';
  import { onMount } from 'svelte';

  import FlightCardLarge from './FlightCardLarge.svelte';
  import FlightRow from './FlightRow.svelte';
  import { buildTimeline, matchesSearch } from './timeline';

  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { pluralize, type FlightData } from '$lib/utils';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  let {
    flights,
    search = '',
    seatUserId,
    selectedId = null,
    onSelect,
  }: {
    flights: FlightData[];
    search?: string;
    seatUserId?: string;
    selectedId?: number | null;
    onSelect: (flightId: number) => void;
  } = $props();

  const PAGE = 60;
  const UPCOMING_ROWS = 4;

  let now = $state(new Date());
  onMount(() => {
    const timer = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(timer);
  });

  const prefs = $derived(getPreferences(page.data.user));
  const matching = $derived(
    search.trim()
      ? flights.filter((flight) => matchesSearch(flight, search))
      : flights,
  );
  const timeline = $derived(buildTimeline(matching, now));
  const [next, ...laterUpcoming] = $derived(timeline.upcoming);

  let showAllUpcoming = $state(false);
  let limit = $state(PAGE);
  $effect(() => {
    // A new search starts from the top.
    void search;
    limit = PAGE;
  });

  // Past groups, cut to the number of rows rendered so far.
  const pastGroups = $derived.by(() => {
    let left = limit;
    const groups: ((typeof timeline.past)[number] & {
      total: number;
      distance: number;
    })[] = [];
    for (const group of timeline.past) {
      if (left <= 0) break;
      groups.push({
        ...group,
        entries: group.entries.slice(0, left),
        total: group.entries.length,
        distance: group.entries.reduce(
          (sum, entry) => sum + (entry.flight.distance ?? 0),
          0,
        ),
      });
      left -= group.entries.length;
    }
    return groups;
  });

  let sentinel = $state<HTMLElement>();
  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) limit += PAGE;
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  const distanceText = (km: number) =>
    `${Math.round(convertDistance(km, prefs)).toLocaleString()} ${distanceUnitLabel(prefs)}`;
</script>

{#if matching.length === 0}
  <div class="px-3 py-10 text-center">
    <p class="font-medium">
      {search.trim() ? 'No flights match' : 'No flights to show'}
    </p>
    <p class="mt-1 text-sm text-muted-foreground">
      {search.trim()
        ? 'Try an airport code, a city, an airline or a flight number.'
        : 'Flights you add, or that match the map filters, show up here.'}
    </p>
  </div>
{:else}
  <div class="space-y-2 px-3">
    {#each timeline.live as entry (entry.flight.id)}
      <FlightCardLarge
        {entry}
        live
        {now}
        {seatUserId}
        selected={selectedId === entry.flight.id}
        {onSelect}
      />
    {/each}
    {#if next}
      <FlightCardLarge
        entry={next}
        {now}
        {seatUserId}
        selected={selectedId === next.flight.id}
        {onSelect}
      />
    {/if}
  </div>

  {#if laterUpcoming.length}
    <section class="mt-4 px-1.5">
      <h3
        class="flex items-baseline justify-between px-2 pb-1 text-[13px] font-semibold"
      >
        Upcoming
        <span class="text-[12px] font-normal text-muted-foreground"
          >{laterUpcoming.length} more</span
        >
      </h3>
      {#each showAllUpcoming ? laterUpcoming : laterUpcoming.slice(0, UPCOMING_ROWS) as entry (entry.flight.id)}
        <FlightRow
          flight={entry.flight}
          selected={selectedId === entry.flight.id}
          {onSelect}
        />
      {/each}
      {#if laterUpcoming.length > UPCOMING_ROWS}
        <button
          type="button"
          class="ml-2 mt-0.5 flex items-center gap-1 rounded px-1 py-1 text-[12.5px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          onclick={() => (showAllUpcoming = !showAllUpcoming)}
        >
          {showAllUpcoming
            ? 'Show fewer'
            : `All ${laterUpcoming.length} upcoming`}
          <ChevronDown size={13} class={showAllUpcoming ? 'rotate-180' : ''} />
        </button>
      {/if}
    </section>
  {/if}

  {#each pastGroups as group (group.year)}
    <section class="mt-4 px-1.5">
      <div
        class="sticky top-0 z-[1] -mx-1.5 flex items-baseline justify-between bg-[rgba(250,250,250,0.9)] px-3.5 dark:bg-[rgba(19,19,22,0.9)] pb-1 pt-1.5 backdrop-blur-md"
      >
        <h3 class="text-[13px] font-semibold">
          {group.year ?? 'Undated'}
        </h3>
        {#if group.year}
          <a
            href="{resolve('/recap')}?year={group.year}"
            class="flex items-center gap-0.5 text-[12px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          >
            {group.total}
            {pluralize(group.total, 'flight')} · {distanceText(group.distance)}
            <ChevronRight size={12} />
          </a>
        {:else}
          <span class="text-[12px] text-muted-foreground"
            >{group.total} {pluralize(group.total, 'flight')}</span
          >
        {/if}
      </div>
      {#each group.entries as entry (entry.flight.id)}
        <FlightRow
          flight={entry.flight}
          selected={selectedId === entry.flight.id}
          {onSelect}
        />
      {/each}
    </section>
  {/each}

  {#if limit < timeline.pastCount}
    <div bind:this={sentinel} class="h-12" aria-hidden="true"></div>
  {:else}
    <p class="px-3 pb-2 pt-4 text-center text-[12px] text-muted-foreground">
      {timeline.pastCount
        ? `That's every flight — ${matching.length} in all.`
        : ''}
    </p>
  {/if}
{/if}
