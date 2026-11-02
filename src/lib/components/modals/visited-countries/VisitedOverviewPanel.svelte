<script lang="ts">
  import { ChevronRight, RefreshCw, Search, X } from '@o7/icon/lucide';

  import BreakdownRow from '$lib/components/modals/statistics/BreakdownRow.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import type { VisitedCountryStatus } from '$lib/db/types';
  import { COUNTRY_BAR_CHARTS } from '$lib/stats/aggregations';
  import {
    isTerritoryCode,
    visitedPlaceFromCode,
  } from '$lib/utils/data/countries';

  type Status = (typeof VisitedCountryStatus)[number];
  type Entry = { code: string; status: Status; note: string | null };

  // UN members and observer states, the usual "countries of the world".
  const WORLD_COUNTRIES = 195;

  let {
    countries,
    subdivisions,
    subdivisionCounts,
    statusColors,
    syncing = false,
    onClose,
    onSelect,
    onSync,
  }: {
    countries: Entry[];
    subdivisions: { code: string; country: string; status: Status }[];
    subdivisionCounts: Record<string, number>;
    statusColors: Record<Status, string>;
    syncing?: boolean;
    onClose: () => void;
    /** A country row was picked. */
    onSelect: (code: string) => void;
    onSync: () => void;
  } = $props();

  const STATUS_LABELS: Record<Status, string> = {
    lived: 'Lived',
    visited: 'Visited',
    layover: 'Layover',
    wishlist: 'Wishlist',
  };
  const STATUS_ORDER: Status[] = ['lived', 'visited', 'layover', 'wishlist'];

  const realCountries = $derived(
    countries.filter((entry) => !isTerritoryCode(entry.code)),
  );
  const been = $derived(
    realCountries.filter(
      (entry) => entry.status === 'visited' || entry.status === 'lived',
    ).length,
  );
  const byStatus = $derived(
    STATUS_ORDER.map((status) => ({
      status,
      count: countries.filter((entry) => entry.status === status).length,
    })),
  );
  const continents = $derived(
    Object.entries(
      COUNTRY_BAR_CHARTS['countries-by-continent'].aggregate(realCountries),
    ).sort(([, a], [, b]) => b.visited - a.visited || b.total - a.total),
  );

  const subdivisionProgress = $derived.by(() => {
    const progress: Record<string, number> = {};
    for (const entry of subdivisions) {
      if (entry.status === 'visited' || entry.status === 'lived') {
        progress[entry.country] = (progress[entry.country] ?? 0) + 1;
      }
    }
    return progress;
  });

  let query = $state('');
  const rows = $derived.by(() => {
    const needle = query.trim().toLocaleLowerCase();
    return countries
      .map((entry) => ({
        ...entry,
        name: visitedPlaceFromCode(entry.code)?.name ?? entry.code,
      }))
      .filter(
        (entry) => !needle || entry.name.toLocaleLowerCase().includes(needle),
      )
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          a.name.localeCompare(b.name),
      );
  });
</script>

<aside
  class="absolute z-10 flex flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur max-md:inset-x-3 max-md:bottom-24 max-md:h-[46vh] md:bottom-24 md:left-3 md:top-3 md:w-80"
  aria-label="Visited countries overview"
>
  <header class="border-b p-3">
    <div class="flex items-start justify-between gap-2">
      <div>
        <h2 class="font-semibold leading-tight">Your world</h2>
        <p class="text-xs text-muted-foreground">
          {been} of {WORLD_COUNTRIES} countries · {Math.round(
            (been / WORLD_COUNTRIES) * 100,
          )}%
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="-mr-1 -mt-1 size-8"
        aria-label="Hide overview"
        onclick={onClose}
      >
        <X size={16} />
      </Button>
    </div>
    <div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        class="h-full rounded-full bg-primary transition-[width]"
        style:width="{Math.min(100, (been / WORLD_COUNTRIES) * 100)}%"
      ></div>
    </div>
    <div class="mt-3 grid grid-cols-4 gap-1 text-center">
      {#each byStatus as { status, count } (status)}
        <div>
          <div class="text-lg font-bold tabular-nums leading-tight">
            {count}
          </div>
          <div
            class="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"
          >
            <span
              class="size-2 rounded-full"
              style:background-color={statusColors[status]}
            ></span>
            {STATUS_LABELS[status]}
          </div>
        </div>
      {/each}
    </div>
  </header>

  <div class="flex-1 overflow-y-auto">
    <section class="border-b p-3">
      <h3 class="mb-1 text-[13px] font-semibold">By continent</h3>
      <div class="space-y-0.5">
        {#each continents as [continent, { visited, total }] (continent)}
          <BreakdownRow
            share={total ? visited / total : 0}
            value="{visited}/{total}"
          >
            <span class="truncate">{continent}</span>
          </BreakdownRow>
        {/each}
      </div>
    </section>

    <section class="p-1.5">
      <div class="relative px-1.5 pb-1.5 pt-1.5">
        <Search
          size={14}
          class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          bind:value={query}
          placeholder="Search your countries"
          class="h-8 pl-8 text-sm"
          aria-label="Search your countries"
        />
      </div>
      {#if rows.length === 0}
        <p class="p-3 text-sm text-muted-foreground">
          {countries.length
            ? 'No matches'
            : 'Click a country on the map to mark it.'}
        </p>
      {/if}
      <ul>
        {#each rows as row (row.code)}
          {@const total = subdivisionCounts[row.code]}
          <li>
            <button
              type="button"
              class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
              onclick={() => onSelect(row.code)}
            >
              {#if isTerritoryCode(row.code)}
                <span class="h-3.5 w-5 shrink-0 rounded-[2px] bg-muted"></span>
              {:else}
                <img
                  src="https://flagcdn.com/{row.code.toLowerCase()}.svg"
                  alt=""
                  class="h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-border"
                />
              {/if}
              <span class="min-w-0 flex-1 truncate">{row.name}</span>
              {#if total}
                <span class="text-xs tabular-nums text-muted-foreground"
                  >{subdivisionProgress[row.code] ?? 0}/{total}</span
                >
              {/if}
              <span
                class="size-2 shrink-0 rounded-full"
                style:background-color={statusColors[row.status]}
                title={STATUS_LABELS[row.status]}
              ></span>
              <ChevronRight size={14} class="shrink-0 text-muted-foreground" />
            </button>
          </li>
        {/each}
      </ul>
    </section>
  </div>

  <footer class="border-t p-2">
    <Button
      variant="ghost"
      size="sm"
      class="w-full justify-start text-muted-foreground"
      disabled={syncing}
      onclick={onSync}
    >
      <RefreshCw size={14} class={syncing ? 'animate-spin' : ''} />
      Fill in from flights
    </Button>
  </footer>
</aside>
