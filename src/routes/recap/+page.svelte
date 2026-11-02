<script lang="ts">
  import {
    ChevronLeft,
    ChevronRight,
    Download,
    LoaderCircle,
  } from '@o7/icon/lucide';
  import type { Snippet } from 'svelte';
  import { toast } from 'svelte-sonner';

  import { replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import ColumnChart from '$lib/components/modals/statistics/charts/ColumnChart.svelte';
  import { downloadSvgAsPng } from '$lib/components/recap/export-image';
  import RecapShareCard from '$lib/components/recap/RecapShareCard.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { MONTHS, SHORT_MONTHS } from '$lib/data/datetime';
  import type { Airport } from '$lib/db/types';
  import {
    computeYearRecap,
    EARTH_CIRCUMFERENCE_KM,
    recapYears,
  } from '$lib/stats/recap';
  import { trpc } from '$lib/trpc';
  import { pluralize, prepareFlightData, toTitleCase } from '$lib/utils';
  import { countryFromAlpha2 } from '$lib/utils/data/countries';
  import { Duration } from '$lib/utils/datetime';
  import { round } from '$lib/utils/number';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  const user = $derived(page.data.user);
  const prefs = $derived(getPreferences(user));
  const rawFlights = trpc.flight.list.query({ scope: 'mine' });
  const flights = $derived(prepareFlightData($rawFlights.data ?? []));
  const years = $derived(recapYears(flights));

  const requestedYear = Number(page.url.searchParams.get('year')) || null;
  let chosenYear = $state<number | null>(requestedYear);
  const year = $derived(
    chosenYear && years.includes(chosenYear) ? chosenYear : (years[0] ?? null),
  );
  const yearIndex = $derived(year === null ? -1 : years.indexOf(year));

  const selectYear = (next: number) => {
    chosenYear = next;
    // Only the query changes; the path comes from resolve().
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    replaceState(`${resolve('/recap')}?year=${next}`, page.state);
  };

  const recap = $derived(
    year === null ? null : computeYearRecap(flights, year, user?.id),
  );
  const name = $derived(user?.displayName || user?.username || 'Traveller');
  const unit = $derived(distanceUnitLabel(prefs));
  const distance = (km: number) =>
    Math.round(convertDistance(km, prefs)).toLocaleString();
  const duration = (seconds: number) =>
    Duration.fromSeconds(seconds).toString(true);
  const airportCode = (airport: Airport) => airport.iata ?? airport.icao;
  const airportPlace = (airport: Airport) =>
    airport.municipality ?? airport.name;
  const countryName = (code: string) => countryFromAlpha2(code)?.name ?? code;
  const shortDate = (date: Date | null) =>
    date?.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const subtitle = $derived(
    recap?.upcomingFlights
      ? `Your year in flights so far, with ${recap.upcomingFlights} more ${pluralize(recap.upcomingFlights, 'flight')} booked.`
      : 'Your year in flights.',
  );
  const newCount = (count: number) => (count ? `${count} new` : null);

  const laps = $derived(recap ? recap.distanceKm / EARTH_CIRCUMFERENCE_KM : 0);
  const months = $derived(
    (recap?.flightsPerMonth ?? []).map((value, month) => ({
      key: month,
      label: SHORT_MONTHS[month] ?? '',
      name: MONTHS[month] ?? '',
      value,
    })),
  );

  const flightsChange = $derived.by(() => {
    if (!recap?.previousYearFlights) return null;
    const delta = Math.round(
      ((recap.flights - recap.previousYearFlights) /
        recap.previousYearFlights) *
        100,
    );
    if (delta === 0) return `same as ${recap.year - 1}`;
    return `${delta > 0 ? '+' : ''}${delta}% on ${recap.year - 1}`;
  });

  const favourite = (counts: Record<string, number>) => {
    const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const best = entries[0];
    return best && total
      ? {
          label: toTitleCase(best[0]),
          share: Math.round((best[1] / total) * 100),
        }
      : null;
  };

  type Highlight = { label: string; value: string; detail: string };
  const highlights = $derived.by(() => {
    if (!recap) return [];
    const list: Highlight[] = [];
    const route = (from: Airport, to: Airport, arrow = '→') =>
      `${airportCode(from)} ${arrow} ${airportCode(to)}`;
    if (recap.longestFlight) {
      const flight = recap.longestFlight;
      list.push({
        label: 'Longest flight',
        value: route(flight.from, flight.to),
        detail: [
          `${distance(flight.distanceKm)} ${unit}`,
          flight.durationSeconds ? duration(flight.durationSeconds) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
    if (recap.shortestFlight) {
      const flight = recap.shortestFlight;
      list.push({
        label: 'Shortest flight',
        value: route(flight.from, flight.to),
        detail: `${distance(flight.distanceKm)} ${unit}`,
      });
    }
    if (recap.topRoute && recap.topRoute.count > 1) {
      const { item, count } = recap.topRoute;
      list.push({
        label: 'Most flown route',
        value: route(item.from, item.to, '↔'),
        detail: `${count} times`,
      });
    }
    if (recap.topAirport) {
      const { item, count } = recap.topAirport;
      list.push({
        label: 'Most visited airport',
        value: airportCode(item),
        detail: `${airportPlace(item)} · ${count} ${pluralize(count, 'visit')}`,
      });
    }
    if (recap.topAirline) {
      const { item, count } = recap.topAirline;
      list.push({
        label: 'Top airline',
        value: item.name,
        detail: `${count} of ${recap.flights} flights`,
      });
    }
    if (recap.topAircraft) {
      const { item, count } = recap.topAircraft;
      list.push({
        label: 'Top aircraft',
        value: item,
        detail: `${count} ${pluralize(count, 'flight')}`,
      });
    }
    if (recap.busiestMonth && recap.flights > 2) {
      const { item, count } = recap.busiestMonth;
      list.push({
        label: 'Busiest month',
        value: MONTHS[item] ?? '',
        detail: `${count} ${pluralize(count, 'flight')}`,
      });
    }
    const seat = favourite(recap.seats);
    const cabin = favourite(recap.classes);
    if (seat || cabin) {
      list.push({
        label: 'Usual seat',
        value: [seat?.label, cabin?.label].filter(Boolean).join(', '),
        detail: [
          seat ? `${seat.share}% ${seat.label.toLowerCase()}` : null,
          cabin ? `${cabin.share}% ${cabin.label.toLowerCase()}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
    return list;
  });

  const firsts = $derived(
    recap
      ? [
          { label: 'Airports', items: recap.newAirports.map(airportCode) },
          { label: 'Airlines', items: recap.newAirlines.map((a) => a.name) },
          { label: 'Aircraft', items: recap.newAircraft },
        ].filter((group) => group.items.length)
      : [],
  );

  let shareCard = $state<SVGSVGElement>();
  let exporting = $state(false);
  const download = async () => {
    if (!shareCard || !recap) return;
    exporting = true;
    try {
      await downloadSvgAsPng(shareCard, `airtrail-${recap.year}.png`);
    } catch (error) {
      console.error(error);
      toast.error('Could not create the image');
    } finally {
      exporting = false;
    }
  };
</script>

{#snippet total(label: string, value: string, sub: string | null)}
  <div class="min-w-0 border-b py-3">
    <div class="text-[13px] text-muted-foreground">{label}</div>
    <div
      class="mt-0.5 whitespace-nowrap text-xl font-bold tracking-tight lg:text-[26px]"
    >
      {value}
    </div>
    <div class="truncate text-[13px] text-muted-foreground">
      {sub ?? ' '}
    </div>
  </div>
{/snippet}

{#snippet section(title: string, body: Snippet)}
  <section
    class="grid gap-3 border-b py-5 last:border-b-0 lg:grid-cols-[136px_minmax(0,1fr)] lg:gap-4"
  >
    <h3
      class="text-lg font-bold tracking-tight lg:text-[15px] lg:font-semibold"
    >
      {title}
    </h3>
    <div class="min-w-0">{@render body()}</div>
  </section>
{/snippet}

<svelte:head>
  <title>{year ? `${year} recap` : 'Recap'} - AirTrail</title>
</svelte:head>

<div class="h-full overflow-y-auto">
  <div class="mx-auto max-w-5xl px-6 pb-36 pt-6 md:pt-10">
    {#if $rawFlights.isLoading}
      <div class="flex justify-center py-24 text-muted-foreground">
        <LoaderCircle class="animate-spin" />
      </div>
    {:else if !recap || year === null}
      <div class="max-w-md py-10">
        <h1 class="text-3xl font-bold tracking-tight">Recap</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Your yearly recap appears once you have a completed flight.
        </p>
      </div>
    {:else}
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={yearIndex >= years.length - 1}
            onclick={() => selectYear(years[yearIndex + 1]!)}
            aria-label="Previous year"
          >
            <ChevronLeft />
          </Button>
          <h1 class="text-3xl font-bold tracking-tight tabular-nums">
            {recap.year}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            disabled={yearIndex <= 0}
            onclick={() => selectYear(years[yearIndex - 1]!)}
            aria-label="Next year"
          >
            <ChevronRight />
          </Button>
        </div>
        <Button variant="outline" onclick={download} disabled={exporting}>
          {#if exporting}
            <LoaderCircle size={16} class="animate-spin" />
          {:else}
            <Download size={16} />
          {/if}
          Download image
        </Button>
      </header>
      <p class="mt-1 text-sm text-muted-foreground">
        {subtitle}
      </p>

      <div class="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
        {@render total(
          'Flights',
          recap.flights.toLocaleString(),
          flightsChange,
        )}
        {@render total(
          'Distance',
          `${distance(recap.distanceKm)} ${unit}`,
          laps >= 0.1 ? `${round(laps, 1)}× around Earth` : null,
        )}
        {@render total(
          'Duration',
          duration(recap.durationSeconds),
          `${recap.daysFlying} ${pluralize(recap.daysFlying, 'day')} flying`,
        )}
        {@render total('Routes', recap.routes.toLocaleString(), null)}
        {@render total(
          'Airports',
          recap.airports.toLocaleString(),
          newCount(recap.newAirports.length),
        )}
        {@render total(
          'Countries',
          recap.countries.toLocaleString(),
          newCount(recap.newCountries.length),
        )}
        {@render total(
          'Airlines',
          recap.airlines.toLocaleString(),
          newCount(recap.newAirlines.length),
        )}
        {@render total(
          'Aircraft types',
          recap.aircraftTypes.toLocaleString(),
          newCount(recap.newAircraft.length),
        )}
      </div>

      {#snippet monthsBody()}
        <ColumnChart data={months} testId="recap-per-month" />
      {/snippet}
      {@render section('Per month', monthsBody)}

      {#snippet highlightsBody()}
        <dl class="grid grid-cols-2 gap-x-7 gap-y-4 lg:grid-cols-4">
          {#each highlights as highlight (highlight.label)}
            <div class="min-w-0">
              <dt class="text-[13px] text-muted-foreground">
                {highlight.label}
              </dt>
              <dd class="truncate font-semibold">{highlight.value}</dd>
              <dd class="truncate text-[13px] text-muted-foreground">
                {highlight.detail}
              </dd>
            </div>
          {/each}
        </dl>
      {/snippet}
      {#if highlights.length}
        {@render section('Highlights', highlightsBody)}
      {/if}

      {#snippet countriesBody()}
        <ul class="grid gap-x-7 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {#each recap.countryVisits as visit (visit.country)}
            <li class="flex min-w-0 items-center gap-3 py-1.5">
              <img
                src="https://flagcdn.com/{visit.country.toLowerCase()}.svg"
                alt=""
                class="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm"
              />
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium">
                    {countryName(visit.country)}
                  </span>
                  {#if visit.isNew}
                    <Badge variant="secondary">New</Badge>
                  {/if}
                </div>
                <div class="truncate text-[13px] text-muted-foreground">
                  {[airportCode(visit.airport), shortDate(visit.date)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/snippet}
      {#if recap.countryVisits.length}
        {@render section('Countries', countriesBody)}
      {/if}

      {#snippet firstsBody()}
        <dl class="space-y-3">
          {#each firsts as group (group.label)}
            <div class="flex flex-col gap-1.5 sm:flex-row sm:gap-4">
              <dt class="w-24 shrink-0 text-[13px] text-muted-foreground">
                {group.label}
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

      {#snippet shareBody()}
        <p class="text-sm text-muted-foreground">
          A 1080 × 1350 image of this page, for sharing.
        </p>
        <div class="mt-3 w-full max-w-xs overflow-hidden rounded-lg border">
          <RecapShareCard
            bind:svg={shareCard}
            {recap}
            {name}
            distance={distance(recap.distanceKm)}
            distanceUnit={unit}
            timeAloft={duration(recap.durationSeconds)}
          />
        </div>
      {/snippet}
      {@render section('Share', shareBody)}
    {/if}
  </div>
</div>
