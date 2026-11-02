<script lang="ts">
  import {
    ChevronLeft,
    ChevronRight,
    Download,
    LoaderCircle,
  } from '@o7/icon/lucide';
  import { toast } from 'svelte-sonner';

  import { replaceState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { downloadSvgAsPng } from '$lib/components/recap/export-image';
  import PassportStamp from '$lib/components/recap/PassportStamp.svelte';
  import RecapShareCard from '$lib/components/recap/RecapShareCard.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { Airport } from '$lib/db/types';
  import {
    computeYearRecap,
    EARTH_CIRCUMFERENCE_KM,
    machineReadableZone,
    MOON_DISTANCE_KM,
    recapYears,
  } from '$lib/stats/recap';
  import { trpc } from '$lib/trpc';
  import { prepareFlightData, toTitleCase } from '$lib/utils';
  import { countryFromAlpha2 } from '$lib/utils/data/countries';
  import { Duration } from '$lib/utils/datetime';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';

  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

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
  const entriesLabel = $derived(
    !recap
      ? ''
      : [
          `${recap.stamps.length} ${recap.stamps.length === 1 ? 'country' : 'countries'}`,
          recap.newCountries.length ? `${recap.newCountries.length} new` : '',
        ]
          .filter(Boolean)
          .join(' · '),
  );
  const unit = $derived(distanceUnitLabel(prefs));
  const distance = (km: number) =>
    Math.round(convertDistance(km, prefs)).toLocaleString();
  const duration = (seconds: number) =>
    Duration.fromSeconds(seconds).toString(true);
  const airportCode = (airport: Airport) => airport.iata ?? airport.icao;
  const airportPlace = (airport: Airport) =>
    airport.municipality ?? airport.name;
  const countryName = (code: string) => countryFromAlpha2(code)?.name ?? code;
  const stampDate = (date: Date | null) =>
    date
      ? date
          .toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit',
          })
          .toUpperCase()
      : String(year);

  const mrz = $derived(recap ? machineReadableZone(name, recap) : null);
  const laps = $derived(recap ? recap.distanceKm / EARTH_CIRCUMFERENCE_KM : 0);
  const moon = $derived(recap ? recap.distanceKm / MOON_DISTANCE_KM : 0);
  const monthMax = $derived(Math.max(1, ...(recap?.flightsPerMonth ?? [])));

  const change = (current: number, previous: number | null) => {
    if (!previous) return null;
    const delta = Math.round(((current - previous) / previous) * 100);
    return delta === 0 ? 'Same as' : `${delta > 0 ? '+' : ''}${delta}% vs`;
  };

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

  let shareCard = $state<SVGSVGElement>();
  let exporting = $state(false);
  const download = async () => {
    if (!shareCard || !recap) return;
    exporting = true;
    try {
      await downloadSvgAsPng(shareCard, `airtrail-passport-${recap.year}.png`);
    } catch (error) {
      console.error(error);
      toast.error('Could not create the image');
    } finally {
      exporting = false;
    }
  };
</script>

<svelte:head>
  <title>{year ? `${year} recap` : 'Recap'} - AirTrail</title>
</svelte:head>

<div class="h-full overflow-y-auto">
  <div class="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-36 pt-6 md:pt-10">
    {#if $rawFlights.isLoading}
      <div class="flex justify-center py-24 text-muted-foreground">
        <LoaderCircle class="animate-spin" />
      </div>
    {:else if !recap || year === null}
      <div class="py-24 text-center">
        <h1 class="font-serif text-3xl font-bold">No recap yet</h1>
        <p class="mt-2 text-muted-foreground">
          Your yearly passport appears once you have a completed flight.
        </p>
      </div>
    {:else}
      <!-- Cover -->
      <section
        class="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#1d2d50,#14213d_55%,#0a1222)] px-6 pb-8 pt-10 text-center text-[#e3c27a] shadow-xl ring-1 ring-[#e3c27a]/30 md:px-10"
      >
        <div
          class="pointer-events-none absolute inset-3 rounded-[22px] border border-[#e3c27a]/40"
        ></div>
        <svg
          viewBox="-60 -60 120 120"
          class="mx-auto size-20"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          aria-hidden="true"
        >
          <circle r="54" />
          <ellipse rx="24" ry="54" />
          <line x1="-54" x2="54" />
          <path d="M -47 -27 Q 0 -14 47 -27 M -47 27 Q 0 14 47 27" />
        </svg>
        <p class="mt-3 text-xs font-semibold tracking-[0.45em]">
          FLIGHT PASSPORT
        </p>
        <div class="mt-2 flex items-center justify-center gap-2 md:gap-6">
          <Button
            variant="ghost"
            size="icon"
            class="text-[#e3c27a] hover:bg-white/10 hover:text-[#f1d999] disabled:opacity-20"
            disabled={yearIndex >= years.length - 1}
            onclick={() => selectYear(years[yearIndex + 1]!)}
            aria-label="Previous year"
          >
            <ChevronLeft />
          </Button>
          <h1
            class="font-serif text-7xl font-bold tabular-nums tracking-tight md:text-9xl"
          >
            {recap.year}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            class="text-[#e3c27a] hover:bg-white/10 hover:text-[#f1d999] disabled:opacity-20"
            disabled={yearIndex <= 0}
            onclick={() => selectYear(years[yearIndex - 1]!)}
            aria-label="Next year"
          >
            <ChevronRight />
          </Button>
        </div>
        <p class="mt-1 text-lg text-[#f3ead6]/85">{name}</p>
        {#if recap.upcomingFlights}
          <p class="mt-2 text-sm text-[#f3ead6]/60">
            So far — {recap.upcomingFlights} more
            {recap.upcomingFlights === 1 ? 'flight' : 'flights'} booked this year
          </p>
        {/if}
      </section>

      <!-- Data page -->
      <section class="passport-page rounded-[24px] p-6 shadow-md md:p-8">
        <p class="page-label">Holder's record</p>
        <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
          {#each [{ label: 'Flights', value: recap.flights.toLocaleString() }, { label: `Distance (${unit})`, value: distance(recap.distanceKm) }, { label: 'Time aloft', value: duration(recap.durationSeconds) }, { label: 'Days flying', value: recap.daysFlying.toLocaleString() }, { label: 'Airports', value: recap.airports.toLocaleString() }, { label: 'Countries', value: recap.countries.toLocaleString() }, { label: 'Airlines', value: recap.airlines.toLocaleString() }, { label: 'Aircraft types', value: recap.aircraftTypes.toLocaleString() }] as stat (stat.label)}
            <div>
              <dt class="field-label">{stat.label}</dt>
              <dd
                class="font-serif text-3xl font-bold tabular-nums md:text-4xl"
              >
                {stat.value}
              </dd>
            </div>
          {/each}
        </dl>

        <p class="mt-6 font-serif text-lg italic text-[#5d5546]">
          {#if laps >= 0.1}
            That's {laps.toFixed(laps >= 10 ? 0 : 1)}× around the Earth, or {(
              moon * 100
            ).toFixed(moon >= 0.1 ? 0 : 1)}% of the way to the Moon.
          {:else}
            {recap.routes}
            {recap.routes === 1 ? 'route' : 'routes'} flown this year.
          {/if}
          {#if change(recap.flights, recap.previousYearFlights)}
            <span class="not-italic">
              · {change(recap.flights, recap.previousYearFlights)}
              {recap.year - 1} in flights
            </span>
          {/if}
        </p>

        <div class="mt-6" aria-label="Flights per month">
          <div class="flex h-20 items-end gap-1.5">
            {#each recap.flightsPerMonth as count, month (month)}
              <div
                class="flex-1 rounded-t-sm bg-[#1d4e89]/80"
                style:height="{(count / monthMax) * 100}%"
                style:min-height={count ? '4px' : '1px'}
                title="{MONTHS[month]}: {count}"
              ></div>
            {/each}
          </div>
          <div
            class="mt-1 flex gap-1.5 font-mono text-[10px] uppercase text-[#7a705c]"
          >
            {#each MONTHS as month (month)}
              <span class="flex-1 text-center">{month[0]}</span>
            {/each}
          </div>
        </div>

        {#if mrz}
          <div
            class="mt-6 overflow-x-auto border-t border-dashed border-[#bfb294] pt-4 font-mono text-[11px] leading-relaxed tracking-[0.18em] text-[#3d3a33] md:text-sm"
            aria-hidden="true"
          >
            <div class="whitespace-pre">{mrz[0]}</div>
            <div class="whitespace-pre">{mrz[1]}</div>
          </div>
        {/if}
      </section>

      <!-- Stamps -->
      {#if recap.stamps.length}
        <section class="passport-page rounded-[24px] p-6 shadow-md md:p-8">
          <div class="flex items-baseline justify-between gap-4">
            <p class="page-label">Entries</p>
            <p class="text-sm text-[#7a705c]">
              {entriesLabel}
            </p>
          </div>
          <div
            class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
          >
            {#each recap.stamps as stamp (stamp.country)}
              <PassportStamp
                seed={stamp.country}
                country={countryName(stamp.country)}
                code={airportCode(stamp.airport)}
                date={stampDate(stamp.date)}
                isNew={stamp.isNew}
                class="w-full mix-blend-multiply"
              />
            {/each}
          </div>
        </section>
      {/if}

      <!-- Highlights -->
      <section class="grid gap-4 md:grid-cols-2">
        {#if recap.longestFlight}
          {@const flight = recap.longestFlight}
          <article class="highlight">
            <p class="field-label">Longest flight</p>
            <p class="route">
              {airportCode(flight.from)} → {airportCode(flight.to)}
            </p>
            <p class="detail">
              {airportPlace(flight.from)} to {airportPlace(flight.to)} ·
              {distance(flight.distanceKm)}
              {unit}{#if flight.durationSeconds}
                · {duration(flight.durationSeconds)}{/if}
            </p>
          </article>
        {/if}
        {#if recap.shortestFlight}
          {@const flight = recap.shortestFlight}
          <article class="highlight">
            <p class="field-label">Shortest hop</p>
            <p class="route">
              {airportCode(flight.from)} → {airportCode(flight.to)}
            </p>
            <p class="detail">
              {airportPlace(flight.from)} to {airportPlace(flight.to)} ·
              {distance(flight.distanceKm)}
              {unit}
            </p>
          </article>
        {/if}
        {#if recap.topRoute && recap.topRoute.count > 1}
          <article class="highlight">
            <p class="field-label">Most flown route</p>
            <p class="route">
              {airportCode(recap.topRoute.item.from)} ↔ {airportCode(
                recap.topRoute.item.to,
              )}
            </p>
            <p class="detail">{recap.topRoute.count} times</p>
          </article>
        {/if}
        {#if recap.topAirport}
          <article class="highlight">
            <p class="field-label">Home base</p>
            <p class="route">{airportCode(recap.topAirport.item)}</p>
            <p class="detail">
              {recap.topAirport.item.name} · {recap.topAirport.count} visits
            </p>
          </article>
        {/if}
        {#if recap.topAirline}
          <article class="highlight">
            <p class="field-label">Favourite airline</p>
            <p class="route">{recap.topAirline.item.name}</p>
            <p class="detail">
              {recap.topAirline.count} of {recap.flights} flights
            </p>
          </article>
        {/if}
        {#if recap.topAircraft}
          <article class="highlight">
            <p class="field-label">Most flown aircraft</p>
            <p class="route">{recap.topAircraft.item}</p>
            <p class="detail">{recap.topAircraft.count} flights</p>
          </article>
        {/if}
        {#if recap.busiestMonth && recap.flights > 2}
          <article class="highlight">
            <p class="field-label">Busiest month</p>
            <p class="route">{MONTHS[recap.busiestMonth.item]}</p>
            <p class="detail">{recap.busiestMonth.count} flights</p>
          </article>
        {/if}
        {#if favourite(recap.seats) || favourite(recap.classes)}
          {@const seat = favourite(recap.seats)}
          {@const cabin = favourite(recap.classes)}
          <article class="highlight">
            <p class="field-label">Your seat</p>
            <p class="route">
              {[seat?.label, cabin?.label].filter(Boolean).join(' · ')}
            </p>
            <p class="detail">
              {[
                seat ? `${seat.share}% ${seat.label.toLowerCase()}` : null,
                cabin ? `${cabin.share}% ${cabin.label.toLowerCase()}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </article>
        {/if}
      </section>

      <!-- Firsts -->
      {#if recap.newAirports.length || recap.newAirlines.length || recap.newAircraft.length}
        <section class="highlight">
          <p class="field-label">Firsts this year</p>
          <dl class="mt-3 space-y-3 text-sm">
            {#each [{ label: 'Airports', items: recap.newAirports.map( (airport) => airportCode(airport) ) }, { label: 'Countries', items: recap.newCountries.map(countryName) }, { label: 'Airlines', items: recap.newAirlines.map((airline) => airline.name) }, { label: 'Aircraft', items: recap.newAircraft }].filter((group) => group.items.length) as group (group.label)}
              <div class="flex flex-col gap-1.5 md:flex-row md:gap-4">
                <dt class="w-24 shrink-0 text-muted-foreground">
                  {group.label}
                  <span class="tabular-nums">({group.items.length})</span>
                </dt>
                <dd class="flex flex-wrap gap-1.5">
                  {#each group.items as item (item)}
                    <span
                      class="rounded-full border bg-background px-2 py-0.5 text-xs"
                      >{item}</span
                    >
                  {/each}
                </dd>
              </div>
            {/each}
          </dl>
        </section>
      {/if}

      <!-- Share -->
      {#if mrz}
        <section class="highlight">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="field-label">Share</p>
              <p class="text-sm text-muted-foreground">
                A 1080 × 1350 image of your {recap.year} passport.
              </p>
            </div>
            <Button onclick={download} disabled={exporting}>
              {#if exporting}
                <LoaderCircle size={16} class="mr-2 animate-spin" />
              {:else}
                <Download size={16} class="mr-2" />
              {/if}
              Download image
            </Button>
          </div>
          <div
            class="mx-auto mt-4 w-full max-w-sm overflow-hidden rounded-xl shadow-lg"
          >
            <RecapShareCard
              bind:svg={shareCard}
              {recap}
              {name}
              {mrz}
              distance={distance(recap.distanceKm)}
              distanceUnit={unit}
              timeAloft={duration(recap.durationSeconds)}
            />
          </div>
        </section>
      {/if}
    {/if}
  </div>
</div>

<style>
  .passport-page {
    color: #2b2a28;
    background-color: #f5efe0;
    background-image:
      radial-gradient(
        circle at 0 0,
        transparent 15px,
        #d9cdb155 16px,
        transparent 17px
      ),
      radial-gradient(
        circle at 18px 18px,
        transparent 15px,
        #d9cdb155 16px,
        transparent 17px
      );
    background-size: 36px 36px;
  }

  .page-label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #7a705c;
  }

  .field-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #7a705c;
  }

  :global(.dark) .highlight .field-label {
    color: var(--muted-foreground);
  }

  .highlight {
    border-radius: 1.25rem;
    border: 1px solid var(--border);
    background: var(--card);
    padding: 1.25rem 1.5rem;
  }

  .route {
    margin-top: 0.35rem;
    font-family: ui-serif, Georgia, serif;
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.2;
  }

  .detail {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--muted-foreground);
  }
</style>
