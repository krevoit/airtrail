<script lang="ts">
  import {
    ArrowDown,
    ArrowUp,
    ChevronRight,
    LoaderCircle,
    Plane,
    PlaneLanding,
    PlaneTakeoff,
    Play,
    Share,
    Timer,
  } from '@o7/icon/lucide';
  import type { Component, Snippet } from 'svelte';

  import { replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import ChartDrillDown from '$lib/components/modals/statistics/charts/ChartDrillDown.svelte';
  import ColumnChart from '$lib/components/modals/statistics/charts/ColumnChart.svelte';
  import FlightsPerYear from '$lib/components/modals/statistics/charts/FlightsPerYear.svelte';
  import PunctualitySection from '$lib/components/modals/statistics/PunctualitySection.svelte';
  import RankedList from '$lib/components/modals/statistics/RankedList.svelte';
  import CalendarHeatmap from '$lib/components/recap/CalendarHeatmap.svelte';
  import FlightLog from '$lib/components/recap/FlightLog.svelte';
  import {
    createFormat,
    distanceComparison,
    flightsLabel,
    periodTitle,
    recapFacts,
    yearRank,
  } from '$lib/components/recap/format';
  import { mapAirports, mapRoutes } from '$lib/components/recap/geo';
  import RecapStory from '$lib/components/recap/RecapStory.svelte';
  import RouteGlobe from '$lib/components/recap/RouteGlobe.svelte';
  import ShareDialog from '$lib/components/recap/ShareDialog.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Tabs from '$lib/components/ui/tabs';
  import { MONTHS, SHORT_MONTHS } from '$lib/data/datetime';
  import {
    punctualityReport,
    type FlightChartKey,
  } from '$lib/stats/aggregations';
  import {
    computeRecap,
    recapYears,
    yearTotals,
    type Recap,
    type RecapPeriod,
  } from '$lib/stats/recap';
  import { trpc } from '$lib/trpc';
  import { pluralize, prepareFlightData } from '$lib/utils';
  import { getPreferences } from '$lib/utils/preferences';

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WEEKDAY_NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  const user = $derived(page.data.user);
  const f = $derived(createFormat(getPreferences(user)));
  const rawFlights = trpc.flight.list.query({ scope: 'mine' });
  const flights = $derived(prepareFlightData($rawFlights.data ?? []));
  const years = $derived(recapYears(flights));
  const totals = $derived(yearTotals(flights));

  const parsePeriod = (value: string | null): RecapPeriod | null =>
    value === 'all' ? 'all' : Number(value) || null;
  let chosen = $state<RecapPeriod | null>(
    parsePeriod(page.url.searchParams.get('year')),
  );
  const period = $derived<RecapPeriod | null>(
    chosen === 'all' || (chosen && years.includes(chosen))
      ? chosen
      : (years[0] ?? null),
  );
  const selectPeriod = (value: string) => {
    chosen = parsePeriod(value);
    // Only the query changes; the path comes from resolve().
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    replaceState(`${resolve('/recap')}?year=${value}`, page.state);
    activeChart = null;
  };

  const recap = $derived(
    period === null ? null : computeRecap(flights, period, user?.id),
  );
  const previous = $derived<Recap | null>(
    typeof period === 'number' && years.includes(period - 1)
      ? computeRecap(flights, period - 1, user?.id)
      : null,
  );
  const name = $derived(user?.displayName || user?.username || 'Traveller');
  const title = $derived(period === null ? '' : periodTitle(period));
  const facts = $derived(recap ? recapFacts(recap, f) : []);
  const rank = $derived(
    typeof period === 'number' ? yearRank(totals, period) : null,
  );
  const punctuality = $derived(
    recap ? punctualityReport(recap.flightList) : null,
  );

  const routes = $derived(recap ? mapRoutes(recap.flightList) : []);
  const airports = $derived(recap ? mapAirports(recap.flightList) : []);
  const visitedCountries = $derived(
    new Set(recap?.countryVisits.map((visit) => visit.country) ?? []),
  );

  const months = $derived(
    (recap?.flightsPerMonth ?? []).map((value, month) => ({
      key: month,
      label: SHORT_MONTHS[month] ?? '',
      name: MONTHS[month] ?? '',
      value,
    })),
  );
  const weekdays = $derived(
    // Monday first.
    [1, 2, 3, 4, 5, 6, 0].map((day) => ({
      key: day,
      label: WEEKDAYS[day]!,
      name: WEEKDAY_NAMES[day]!,
      value: recap?.flightsPerWeekday[day] ?? 0,
    })),
  );

  type Change = { up: boolean; text: string } | null;
  const change = (current: number, before: number | undefined): Change => {
    if (!previous || before === undefined || before === 0) return null;
    const delta = Math.round(((current - before) / before) * 100);
    if (delta === 0) return { up: true, text: `same as ${previous.period}` };
    return { up: delta > 0, text: `${Math.abs(delta)}% on ${previous.period}` };
  };

  const stats = $derived(
    recap
      ? [
          {
            label: 'Flights',
            value: recap.flights.toLocaleString(),
            change: change(recap.flights, previous?.flights),
            sub:
              recap.period === 'all' && totals[0]
                ? `since ${totals[0].year}`
                : null,
          },
          {
            label: 'Distance',
            value: f.distanceWithUnit(recap.distanceKm),
            change: change(recap.distanceKm, previous?.distanceKm),
            sub: distanceComparison(recap),
          },
          {
            label: 'In the air',
            value: f.duration(recap.durationSeconds),
            change: change(recap.durationSeconds, previous?.durationSeconds),
            sub: recap.daysFlying
              ? `over ${recap.daysFlying} ${pluralize(recap.daysFlying, 'day')}`
              : null,
          },
          {
            label: 'Routes',
            value: recap.routes.toLocaleString(),
            change: change(recap.routes, previous?.routes),
            sub: `${recap.records.internationalFlights} international`,
          },
          {
            label: 'Airports',
            value: recap.airports.toLocaleString(),
            change: null,
            sub: recap.newAirports.length
              ? `${recap.newAirports.length} new`
              : null,
          },
          {
            label: 'Countries',
            value: recap.countries.toLocaleString(),
            change: null,
            sub: recap.newCountries.length
              ? `${recap.newCountries.length} new`
              : `${recap.records.continents.length} ${pluralize(recap.records.continents.length, 'continent')}`,
          },
          {
            label: 'Airlines',
            value: recap.airlines.toLocaleString(),
            change: null,
            sub: recap.newAirlines.length
              ? `${recap.newAirlines.length} new`
              : null,
          },
          {
            label: 'Aircraft types',
            value: recap.aircraftTypes.toLocaleString(),
            change: null,
            sub: recap.newAircraft.length
              ? `${recap.newAircraft.length} new`
              : null,
          },
        ]
      : [],
  );

  const shareStats = $derived(
    recap
      ? [
          { label: 'Flights', value: recap.flights.toLocaleString() },
          {
            label: `Distance (${f.unit})`,
            value: f.distance(recap.distanceKm),
          },
          { label: 'In the air', value: f.duration(recap.durationSeconds) },
          { label: 'Airports', value: recap.airports.toLocaleString() },
          { label: 'Countries', value: recap.countries.toLocaleString() },
          { label: 'Airlines', value: recap.airlines.toLocaleString() },
        ]
      : [],
  );
  const subtitle = $derived(
    period === 'all' ? 'Every flight so far' : 'Year in flights',
  );

  const firsts = $derived(
    recap
      ? [
          { label: 'Countries', items: recap.newCountries.map(f.countryName) },
          { label: 'Airports', items: recap.newAirports.map(f.airportCode) },
          { label: 'Airlines', items: recap.newAirlines.map((a) => a.name) },
          { label: 'Aircraft', items: recap.newAircraft },
        ].filter((group) => group.items.length)
      : [],
  );

  let activeChart = $state<FlightChartKey | null>(null);
  let activeEntry = $state<string | null>(null);
  const openChart = (key: FlightChartKey, entry?: string) => {
    activeChart = key;
    activeEntry = entry ?? null;
  };

  let storyOpen = $state(false);
  let shareOpen = $state(false);
</script>

{#snippet section(title: string, body: Snippet, aside?: Snippet)}
  <section
    class="grid gap-3 border-b py-6 last:border-b-0 lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-4"
  >
    <div>
      <h3
        class="text-lg font-bold tracking-tight lg:text-[15px] lg:font-semibold"
      >
        {title}
      </h3>
      {#if aside}{@render aside()}{/if}
    </div>
    <div class="min-w-0">{@render body()}</div>
  </section>
{/snippet}

{#snippet lists(keys: FlightChartKey[])}
  <div class="grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
    {#each keys as chartKey (chartKey)}
      <RankedList
        {chartKey}
        flights={recap?.flightList ?? []}
        seatUserId={user?.id}
        onOpen={openChart}
      />
    {/each}
  </div>
{/snippet}

<svelte:head>
  <title>{title ? `${title} recap` : 'Recap'} - AirTrail</title>
</svelte:head>

<div class="h-full overflow-y-auto" data-testid="recap-scroll">
  <div class="mx-auto max-w-6xl px-4 pb-36 pt-6 sm:px-6 md:pt-8">
    {#if $rawFlights.isLoading}
      <div class="flex justify-center py-24 text-muted-foreground">
        <LoaderCircle class="animate-spin" />
      </div>
    {:else if !recap || period === null}
      <div class="max-w-md py-10">
        <h1 class="text-3xl font-bold tracking-tight">Recap</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Your recap appears once you have a completed flight.
        </p>
      </div>
    {:else}
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-bold tracking-tight">Recap</h1>
        <div class="flex gap-2">
          <Button variant="outline" onclick={() => (shareOpen = true)}>
            <Share size={16} />
            Share
          </Button>
          <Button onclick={() => (storyOpen = true)}>
            <Play size={16} />
            Play {period === 'all' ? 'story' : period}
          </Button>
        </div>
      </header>

      <div class="-mx-4 mt-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <Tabs.Root value={String(period)} onValueChange={selectPeriod}>
          <Tabs.List>
            {#each years as year (year)}
              <Tabs.Trigger value={String(year)} class="tabular-nums"
                >{year}</Tabs.Trigger
              >
            {/each}
            <Tabs.Trigger value="all">All time</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>

      <!-- Hero -->
      <div
        class="mt-4 grid items-center gap-6 border-b pb-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10"
      >
        <div class="order-2 min-w-0 lg:order-1">
          <p class="text-sm text-muted-foreground">
            {[
              period === 'all'
                ? `${name}, every flight since ${totals[0]?.year ?? ''}`
                : `${name} in ${period}`,
              recap.upcomingFlights
                ? `${recap.upcomingFlights} more booked`
                : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <h2
            class="mt-1 text-balance text-3xl font-bold tracking-tight lg:text-[40px] lg:leading-[1.1]"
          >
            {flightsLabel(recap.flights)} to {recap.countries}
            {pluralize(recap.countries, 'country', 'countries')}, covering
            {f.distanceWithUnit(recap.distanceKm)}.
          </h2>
          {#if rank}
            <p class="mt-2 text-sm font-medium text-primary">{rank}.</p>
          {/if}

          <div class="mt-5 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
            {#each stats as stat (stat.label)}
              <div class="min-w-0 border-t py-3">
                <div class="text-[13px] text-muted-foreground">
                  {stat.label}
                </div>
                <div
                  class="mt-0.5 whitespace-nowrap text-xl font-bold tracking-tight"
                >
                  {stat.value}
                </div>
                <div
                  class="flex items-center gap-0.5 truncate text-[12.5px] text-muted-foreground"
                >
                  {#if stat.change}
                    {#if stat.change.up}
                      <ArrowUp size={12} class="shrink-0 text-foreground" />
                    {:else}
                      <ArrowDown size={12} class="shrink-0 text-foreground" />
                    {/if}
                    <span class="truncate">{stat.change.text}</span>
                  {:else}
                    <span class="truncate">{stat.sub ?? ' '}</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
        <div class="order-1 mx-auto w-full max-w-[460px] lg:order-2">
          <RouteGlobe {routes} {airports} countries={visitedCountries} />
        </div>
      </div>

      <!-- When -->
      {#snippet whenBody()}
        {#if typeof period === 'number'}
          <CalendarHeatmap year={period} days={recap.days} />
        {:else}
          <h4 class="mb-1 text-[13px] font-semibold">Per year</h4>
          <FlightsPerYear flights={recap.flightList} />
        {/if}
        <div class="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
          <div class="min-w-0">
            <h4 class="mb-1 text-[13px] font-semibold">Per month</h4>
            <ColumnChart data={months} compact testId="recap-per-month" />
          </div>
          <div class="min-w-0">
            <h4 class="mb-1 text-[13px] font-semibold">Per weekday</h4>
            <ColumnChart data={weekdays} compact testId="recap-per-weekday" />
          </div>
        </div>
      {/snippet}
      {#snippet whenAside()}
        {#if recap.daysFlying}
          <p class="mt-1 hidden text-[13px] text-muted-foreground lg:block">
            {recap.daysFlying} flying {pluralize(recap.daysFlying, 'day')}
          </p>
        {/if}
      {/snippet}
      {@render section('When', whenBody, whenAside)}

      <!-- Records -->
      {#snippet recordsBody()}
        <div class="grid gap-x-7 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {#if recap.longestFlight}
            {@const flight = recap.longestFlight}
            {@render record(
              Plane,
              'Longest flight',
              `${f.airportCode(flight.from)} → ${f.airportCode(flight.to)}`,
              [
                f.distanceWithUnit(flight.distanceKm),
                flight.durationSeconds
                  ? f.duration(flight.durationSeconds)
                  : null,
              ]
                .filter(Boolean)
                .join(' · '),
            )}
          {/if}
          {#if recap.shortestFlight}
            {@const flight = recap.shortestFlight}
            {@render record(
              Timer,
              'Shortest flight',
              `${f.airportCode(flight.from)} → ${f.airportCode(flight.to)}`,
              f.distanceWithUnit(flight.distanceKm),
            )}
          {/if}
          {#if recap.firstFlight && recap.period !== 'all'}
            {@const flight = recap.firstFlight}
            {@render record(
              PlaneTakeoff,
              'First flight',
              `${f.airportCode(flight.from)} → ${f.airportCode(flight.to)}`,
              f.shortDate(flight.date),
            )}
          {/if}
          {#if recap.lastFlight && recap.period !== 'all' && recap.lastFlight.id !== recap.firstFlight?.id}
            {@const flight = recap.lastFlight}
            {@render record(
              PlaneLanding,
              recap.upcomingFlights ? 'Latest flight' : 'Last flight',
              `${f.airportCode(flight.from)} → ${f.airportCode(flight.to)}`,
              f.shortDate(flight.date),
            )}
          {/if}
          {#each facts as fact (fact.label)}
            {@render record(fact.icon, fact.label, fact.value, fact.detail)}
          {/each}
        </div>
      {/snippet}
      {@render section('Records', recordsBody)}

      <!-- Where -->
      {#snippet whereBody()}
        {@render lists(['airports', 'routes', 'continents'])}
      {/snippet}
      {@render section('Where', whereBody)}

      <!-- Countries -->
      {#snippet countriesBody()}
        <ul class="grid gap-x-7 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {#each [...recap.countryVisits].sort((a, b) => b.flights - a.flights) as visit (visit.country)}
            <li class="flex min-w-0 items-center gap-3 py-1.5">
              <img
                src="https://flagcdn.com/{visit.country.toLowerCase()}.svg"
                alt=""
                class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm ring-1 ring-border"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium">
                    {f.countryName(visit.country)}
                  </span>
                  {#if visit.isNew}
                    <Badge variant="secondary">New</Badge>
                  {/if}
                </div>
                <div class="truncate text-[13px] text-muted-foreground">
                  {[
                    `${visit.flights} ${pluralize(visit.flights, 'flight')}`,
                    recap.period === 'all'
                      ? null
                      : `first ${f.airportCode(visit.airport)} ${f.shortDate(visit.date)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </li>
          {/each}
        </ul>
        <Button
          href="{resolve('/visited-countries')}?view=overview"
          variant="ghost"
          size="sm"
          class="mt-2 -ml-2 text-muted-foreground"
        >
          Visited countries and states
          <ChevronRight size={14} />
        </Button>
      {/snippet}
      {#snippet countriesAside()}
        <p class="mt-1 hidden text-[13px] text-muted-foreground lg:block">
          On {recap.records.continents.length}
          {pluralize(recap.records.continents.length, 'continent')}
        </p>
      {/snippet}
      {#if recap.countryVisits.length}
        {@render section('Countries', countriesBody, countriesAside)}
      {/if}

      <!-- Airlines and aircraft -->
      {#snippet fleetBody()}
        {@render lists(['airlines', 'aircraft-models', 'aircraft-regs'])}
      {/snippet}
      {@render section('Airlines and aircraft', fleetBody)}

      <!-- On board -->
      {#snippet onBoardBody()}
        {@render lists(['seat-class', 'seat', 'reason'])}
      {/snippet}
      {@render section('On board', onBoardBody)}

      {#snippet punctualityBody()}
        <PunctualitySection flights={recap.flightList} onOpen={openChart} />
      {/snippet}
      {#if punctuality && punctuality.assessedFlights > 0}
        {@render section('Punctuality', punctualityBody)}
      {/if}

      <!-- Firsts -->
      {#snippet firstsBody()}
        <dl class="space-y-3">
          {#each firsts as group (group.label)}
            <div class="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
              <dt class="w-24 shrink-0 text-[13px] text-muted-foreground">
                {group.label}
                <span class="tabular-nums">{group.items.length}</span>
              </dt>
              <dd class="flex flex-wrap gap-1.5">
                {#each group.items as item (item)}
                  <Badge variant="outline">{item}</Badge>
                {/each}
              </dd>
            </div>
          {/each}
        </dl>
      {/snippet}
      {#if firsts.length}
        {@render section('First time', firstsBody)}
      {/if}

      <!-- Log -->
      {#snippet logBody()}
        <FlightLog
          flights={recap.flightList}
          {f}
          allTime={recap.period === 'all'}
        />
      {/snippet}
      {@render section('Flight log', logBody)}
    {/if}
  </div>
</div>

{#snippet record(
  Icon: Component<{ size?: number }>,
  label: string,
  value: string,
  detail: string,
)}
  <div class="flex min-w-0 gap-3">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20"
    >
      <Icon size={16} />
    </div>
    <div class="min-w-0">
      <div class="text-[13px] text-muted-foreground">{label}</div>
      <div class="truncate font-semibold">{value}</div>
      <div class="truncate text-[13px] text-muted-foreground">{detail}</div>
    </div>
  </div>
{/snippet}

{#if activeChart && recap}
  <div class="fixed inset-0 z-40">
    <ChartDrillDown
      chartKey={activeChart}
      initialEntry={activeEntry}
      flights={recap.flightList}
      seatUserId={user?.id}
      backLabel="Recap"
      onBack={() => (activeChart = null)}
    />
  </div>
{/if}

{#if recap}
  <ShareDialog
    bind:open={shareOpen}
    {recap}
    {name}
    {title}
    {subtitle}
    stats={shareStats}
  />
  {#if storyOpen}
    <RecapStory
      {recap}
      {name}
      {title}
      {f}
      {facts}
      {rank}
      onClose={() => (storyOpen = false)}
      onShare={() => {
        storyOpen = false;
        shareOpen = true;
      }}
    />
  {/if}
{/if}
