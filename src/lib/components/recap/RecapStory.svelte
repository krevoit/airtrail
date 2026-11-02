<script lang="ts">
  import { Pause, Play, Share, X } from '@o7/icon/lucide';
  import { mode } from 'mode-watcher';
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';

  import CountUp from './CountUp.svelte';
  import { laps, moonShare, type Fact, type RecapFormat } from './format';
  import { mapAirports, mapRoutes } from './geo';
  import { PALETTES } from './palette';
  import RouteMap from './RouteMap.svelte';

  import { Button } from '$lib/components/ui/button';
  import { MONTHS } from '$lib/data/datetime';
  import type { Recap } from '$lib/stats/recap';
  import { pluralize } from '$lib/utils';
  import { round } from '$lib/utils/number';

  let {
    recap,
    name,
    title,
    f,
    facts,
    rank,
    onClose,
    onShare,
  }: {
    recap: Recap;
    name: string;
    title: string;
    f: RecapFormat;
    facts: Fact[];
    rank: string | null;
    onClose: () => void;
    onShare: () => void;
  } = $props();

  const SLIDE_MS = 6500;

  type Slide =
    | 'intro'
    | 'distance'
    | 'time'
    | 'map'
    | 'countries'
    | 'airport'
    | 'airline'
    | 'longest'
    | 'facts'
    | 'busiest'
    | 'outro';

  const slides = $derived(
    (
      [
        'intro',
        'distance',
        recap.durationSeconds > 0 && 'time',
        'map',
        recap.countryVisits.length > 0 && 'countries',
        recap.topAirport && 'airport',
        (recap.topAirline || recap.topAircraft) && 'airline',
        recap.longestFlight && 'longest',
        facts.length >= 2 && 'facts',
        recap.busiestMonth && recap.period !== 'all' && 'busiest',
        'outro',
      ] as (Slide | false | null)[]
    ).filter((slide): slide is Slide => Boolean(slide)),
  );

  let index = $state(0);
  let elapsed = $state(0);
  let paused = $state(false);
  let holding = $state(false);
  const slide = $derived(slides[index] ?? 'outro');
  const last = $derived(index === slides.length - 1);

  const palette = $derived(
    PALETTES[mode.current === 'dark' ? 'dark' : 'light'],
  );
  const routes = $derived(mapRoutes(recap.flightList));
  const airports = $derived(mapAirports(recap.flightList));
  const countries = $derived(
    new Set(recap.countryVisits.map((v) => v.country)),
  );
  const durationParts = $derived({
    days: Math.floor(recap.durationSeconds / 86_400),
    hours: Math.floor((recap.durationSeconds % 86_400) / 3600),
  });
  const monthMax = $derived(Math.max(1, ...recap.flightsPerMonth));

  const go = (next: number) => {
    if (next < 0) next = 0;
    if (next >= slides.length) {
      onClose();
      return;
    }
    index = next;
    elapsed = 0;
  };

  onMount(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduceMotion) paused = true;
    let previous = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const step = time - previous;
      previous = time;
      if (!paused && !holding && !last) {
        elapsed += step;
        if (elapsed >= SLIDE_MS) go(index + 1);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  });

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowRight') go(index + 1);
    else if (event.key === 'ArrowLeft') go(index - 1);
    else if (event.key === ' ') {
      event.preventDefault();
      paused = !paused;
    }
  };

  // Tap the left third to go back, anywhere else to go on; hold to pause.
  let pressStart = 0;
  const onPointerDown = () => {
    pressStart = performance.now();
    holding = true;
  };
  const onPointerUp = (event: PointerEvent) => {
    holding = false;
    if (performance.now() - pressStart > 350) return;
    const target = event.currentTarget as HTMLElement;
    const x = event.clientX - target.getBoundingClientRect().left;
    go(x < target.clientWidth / 3 ? index - 1 : index + 1);
  };
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
  role="dialog"
  aria-modal="true"
  aria-label="{title} recap story"
  transition:fade={{ duration: 200 }}
>
  <div
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_60%)] opacity-[0.08] dark:opacity-[0.16]"
  ></div>

  <div class="relative z-10 mx-auto flex w-full max-w-2xl gap-1 px-4 pt-4">
    {#each slides as item, slideIndex (item)}
      <div class="h-1 flex-1 overflow-hidden rounded-full bg-foreground/15">
        <div
          class="h-full rounded-full bg-foreground"
          style:width="{slideIndex < index
            ? 100
            : slideIndex === index
              ? last
                ? 100
                : (elapsed / SLIDE_MS) * 100
              : 0}%"
        ></div>
      </div>
    {/each}
  </div>
  <div
    class="relative z-10 mx-auto flex w-full max-w-2xl items-center justify-between px-4 pt-3"
  >
    <div class="flex gap-1.5 text-sm font-medium">
      <span>{title}</span>
      <span class="text-muted-foreground">· {name}</span>
    </div>
    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={paused ? 'Play' : 'Pause'}
        onclick={() => (paused = !paused)}
      >
        {#if paused}<Play size={18} />{:else}<Pause size={18} />{/if}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Close" onclick={onClose}>
        <X size={18} />
      </Button>
    </div>
  </div>

  <!-- The slide area handles taps; the buttons above sit outside it. -->
  <div
    class="relative z-0 flex min-h-0 flex-1 cursor-pointer select-none items-center justify-center overflow-hidden px-6 pb-10"
    role="presentation"
    onpointerdown={onPointerDown}
    onpointerup={onPointerUp}
    onpointercancel={() => (holding = false)}
  >
    {#key index}
      <div
        class="flex w-full max-w-xl flex-col"
        in:fly={{ y: 24, duration: 450, delay: 120 }}
        out:fade={{ duration: 120 }}
      >
        {#if slide === 'intro'}
          <p class="text-lg text-muted-foreground">
            {recap.period === 'all'
              ? 'Every flight so far'
              : 'Your year in flights'}
          </p>
          <h2
            class="mt-1 text-[clamp(4.5rem,22vw,9rem)] font-bold leading-none tracking-tighter"
          >
            {title}
          </h2>
          <p class="mt-6 text-2xl font-semibold tracking-tight">
            <CountUp value={recap.flights} />
            {pluralize(recap.flights, 'flight')}, {recap.countries}
            {pluralize(recap.countries, 'country', 'countries')}.
          </p>
          {#if rank}
            <p class="mt-2 text-lg text-primary">{rank}.</p>
          {/if}
          <p class="mt-10 text-sm text-muted-foreground">
            Tap to go on, hold to pause.
          </p>
        {:else if slide === 'distance'}
          <p class="text-lg text-muted-foreground">You flew</p>
          <p
            class="mt-1 text-[clamp(3.5rem,16vw,7rem)] font-bold leading-none tracking-tighter"
          >
            <CountUp
              value={Number(f.distance(recap.distanceKm).replace(/\D/g, ''))}
            />
          </p>
          <p class="mt-1 text-2xl font-semibold text-muted-foreground">
            {f.unit}
          </p>
          <div class="mt-10 space-y-3 text-xl">
            <p in:fly={{ y: 12, delay: 900, duration: 400 }}>
              That's <span class="font-semibold text-primary"
                >{round(laps(recap), 1)}×</span
              > around the Earth
            </p>
            <p in:fly={{ y: 12, delay: 1300, duration: 400 }}>
              or <span class="font-semibold text-primary"
                >{round(
                  moonShare(recap) * 100,
                  moonShare(recap) < 0.1 ? 1 : 0,
                )}%</span
              > of the way to the Moon.
            </p>
          </div>
        {:else if slide === 'time'}
          <p class="text-lg text-muted-foreground">In the air for</p>
          <p
            class="mt-1 text-[clamp(3.5rem,16vw,7rem)] font-bold leading-none tracking-tighter"
          >
            {#if durationParts.days}<CountUp value={durationParts.days} />d{/if}
            <CountUp value={durationParts.hours} />h
          </p>
          <div class="mt-10 space-y-3 text-xl">
            <p in:fly={{ y: 12, delay: 900, duration: 400 }}>
              <span class="font-semibold text-primary"
                >{f.number(recap.durationSeconds / 3600)} hours</span
              >
              across {recap.daysFlying}
              {pluralize(recap.daysFlying, 'day')} of flying.
            </p>
            {#if recap.flights}
              <p in:fly={{ y: 12, delay: 1300, duration: 400 }}>
                About <span class="font-semibold text-primary"
                  >{f.duration(recap.durationSeconds / recap.flights)}</span
                > a flight.
              </p>
            {/if}
          </div>
        {:else if slide === 'map'}
          <p class="text-lg text-muted-foreground">Where you went</p>
          <p class="mt-1 text-4xl font-bold tracking-tight">
            {recap.routes}
            {pluralize(recap.routes, 'route')}, {recap.airports} airports
          </p>
          <svg
            viewBox="0 0 900 560"
            class="mt-6 w-full overflow-hidden rounded-xl"
            role="img"
            aria-label="Map of routes"
          >
            <RouteMap
              {routes}
              {airports}
              {countries}
              {palette}
              width={900}
              height={560}
              padding={36}
              radius={16}
              animate
            />
          </svg>
        {:else if slide === 'countries'}
          <p class="text-lg text-muted-foreground">Countries</p>
          <p
            class="mt-1 text-[clamp(3.5rem,16vw,7rem)] font-bold leading-none tracking-tighter"
          >
            <CountUp value={recap.countryVisits.length} />
          </p>
          {#if recap.newCountries.length}
            <p class="mt-2 text-xl">
              <span class="font-semibold text-primary"
                >{recap.newCountries.length} for the first time</span
              >
            </p>
          {/if}
          <div class="mt-8 flex flex-wrap gap-3">
            {#each recap.countryVisits.slice(0, 24) as visit, visitIndex (visit.country)}
              <div
                class="flex flex-col items-center gap-1"
                in:scale={{
                  start: 0.4,
                  delay: 300 + visitIndex * 90,
                  duration: 350,
                }}
              >
                <img
                  src="https://flagcdn.com/{visit.country.toLowerCase()}.svg"
                  alt={f.countryName(visit.country)}
                  title={f.countryName(visit.country)}
                  class="h-10 w-14 rounded-md object-cover shadow-sm ring-1 ring-border"
                />
                <span class="text-[11px] font-medium text-muted-foreground"
                  >{visit.country}</span
                >
              </div>
            {/each}
          </div>
        {:else if slide === 'airport' && recap.topAirport}
          {@const { item, count } = recap.topAirport}
          <p class="text-lg text-muted-foreground">Your most visited airport</p>
          <p
            class="mt-1 text-[clamp(4.5rem,22vw,9rem)] font-bold leading-none tracking-tighter"
          >
            {f.airportCode(item)}
          </p>
          <p class="mt-3 text-2xl font-semibold tracking-tight">{item.name}</p>
          <p class="mt-1 text-lg text-muted-foreground">
            {count}
            {pluralize(count, 'visit')} · {recap.airports} airports in all
          </p>
        {:else if slide === 'airline'}
          {#if recap.topAirline}
            <p class="text-lg text-muted-foreground">You flew most with</p>
            <p class="mt-1 text-5xl font-bold tracking-tight">
              {recap.topAirline.item.name}
            </p>
            <p class="mt-2 text-lg text-muted-foreground">
              {recap.topAirline.count} of {recap.flights} flights · {recap.airlines}
              {pluralize(recap.airlines, 'airline')} in all
            </p>
          {/if}
          {#if recap.topAircraft}
            <div
              class="mt-12"
              in:fly={{
                y: 12,
                delay: recap.topAirline ? 900 : 0,
                duration: 400,
              }}
            >
              <p class="text-lg text-muted-foreground">Mostly aboard</p>
              <p class="mt-1 text-4xl font-bold tracking-tight">
                {recap.topAircraft.item}
              </p>
              <p class="mt-2 text-lg text-muted-foreground">
                {recap.topAircraft.count}
                {pluralize(recap.topAircraft.count, 'flight')} · {recap.aircraftTypes}
                {pluralize(recap.aircraftTypes, 'type')} flown
              </p>
            </div>
          {/if}
        {:else if slide === 'longest' && recap.longestFlight}
          {@const flight = recap.longestFlight}
          <p class="text-lg text-muted-foreground">Your longest flight</p>
          <p
            class="mt-1 flex items-center gap-4 text-[clamp(3.5rem,14vw,6.5rem)] font-bold leading-none tracking-tighter"
          >
            {f.airportCode(flight.from)}
            <span class="text-primary">→</span>
            {f.airportCode(flight.to)}
          </p>
          <p class="mt-4 text-2xl font-semibold tracking-tight">
            {f.airportPlace(flight.from)} to {f.airportPlace(flight.to)}
          </p>
          <p class="mt-1 text-lg text-muted-foreground">
            {[
              f.distanceWithUnit(flight.distanceKm),
              flight.durationSeconds ? f.duration(flight.durationSeconds) : '',
              f.shortDate(flight.date),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        {:else if slide === 'facts'}
          <p class="text-lg text-muted-foreground">Did you notice?</p>
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            {#each facts.slice(0, 4) as fact, factIndex (fact.label)}
              <div
                class="rounded-xl border bg-card/60 p-4 backdrop-blur"
                in:fly={{ y: 16, delay: 200 + factIndex * 250, duration: 400 }}
              >
                <fact.icon size={20} class="text-primary" />
                <div class="mt-3 text-3xl font-bold tracking-tight">
                  {fact.value}
                </div>
                <div class="mt-0.5 font-medium">{fact.label}</div>
                <div class="text-sm text-muted-foreground">{fact.detail}</div>
              </div>
            {/each}
          </div>
        {:else if slide === 'busiest' && recap.busiestMonth}
          <p class="text-lg text-muted-foreground">Your busiest month</p>
          <p class="mt-1 text-6xl font-bold tracking-tighter">
            {MONTHS[recap.busiestMonth.item]}
          </p>
          <p class="mt-2 text-lg text-muted-foreground">
            {recap.busiestMonth.count}
            {pluralize(recap.busiestMonth.count, 'flight')}
          </p>
          <div class="mt-10 flex h-40 items-end gap-1.5">
            {#each recap.flightsPerMonth as count, month (month)}
              <div class="flex flex-1 flex-col items-center gap-1.5">
                <div
                  class={[
                    'w-full origin-bottom animate-[grow_700ms_ease-out_both] rounded-t-md',
                    month === recap.busiestMonth.item
                      ? 'bg-primary'
                      : 'bg-primary/30',
                  ]}
                  style:height="{Math.max(3, (count / monthMax) * 136)}px"
                  style:animation-delay="{200 + month * 60}ms"
                ></div>
                <span class="text-[11px] text-muted-foreground"
                  >{MONTHS[month]?.[0]}</span
                >
              </div>
            {/each}
          </div>
        {:else if slide === 'outro'}
          <p class="text-lg text-muted-foreground">That was</p>
          <h2
            class="mt-1 text-[clamp(4rem,18vw,8rem)] font-bold leading-none tracking-tighter"
          >
            {title}
          </h2>
          <dl class="mt-8 grid grid-cols-3 gap-4">
            {#each [{ label: 'Flights', value: recap.flights.toLocaleString() }, { label: `Distance (${f.unit})`, value: f.distance(recap.distanceKm) }, { label: 'Countries', value: String(recap.countries) }] as stat (stat.label)}
              <div class="border-t pt-2">
                <dt class="text-[13px] text-muted-foreground">{stat.label}</dt>
                <dd class="text-2xl font-bold tracking-tight">{stat.value}</dd>
              </div>
            {/each}
          </dl>
          <div
            class="mt-10 flex flex-wrap gap-2"
            role="presentation"
            onpointerdown={(event) => event.stopPropagation()}
            onpointerup={(event) => event.stopPropagation()}
          >
            <Button size="lg" onclick={onShare}>
              <Share size={16} />
              Share
            </Button>
            <Button size="lg" variant="outline" onclick={() => go(0)}>
              Watch again
            </Button>
            <Button size="lg" variant="ghost" onclick={onClose}>Close</Button>
          </div>
        {/if}
      </div>
    {/key}
  </div>
</div>

<style>
  @keyframes -global-grow {
    from {
      transform: scaleY(0);
    }
    to {
      transform: scaleY(1);
    }
  }
</style>
