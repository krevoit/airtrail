<script lang="ts">
  import { Plane } from '@o7/icon/lucide';
  import { onMount } from 'svelte';

  import { page } from '$app/state';
  import { AirlineIcon, TimeDisplay } from '$lib/components/display';
  import {
    airportCity,
    airportCode,
    durationLabel,
    flagUrl,
    flightLabel,
    localDay,
  } from '$lib/components/home/format';
  import { countdownLabel, toEntry } from '$lib/components/home/timeline';
  import {
    arrivalDelayMinutes,
    DELAY_THRESHOLD_MINUTES,
  } from '$lib/stats/aggregations';
  import type { FlightData } from '$lib/utils';
  import {
    convertDistance,
    distanceUnitLabel,
    formatFlightDate,
    getPreferences,
  } from '$lib/utils/preferences';

  let {
    flight,
    onShowRoute,
  }: {
    flight: FlightData;
    onShowRoute?: () => void;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));
  let now = $state(new Date());
  onMount(() => {
    const timer = setInterval(() => (now = new Date()), 30_000);
    return () => clearInterval(timer);
  });

  const entry = $derived(toEntry(flight));
  const label = $derived(flightLabel(flight) ?? 'Flight');
  const exactDay = $derived(flight.datePrecision === 'day');
  const dateLabel = $derived(
    flight.date
      ? exactDay
        ? new Intl.DateTimeFormat(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: flight.from?.tz,
          }).format(flight.date)
        : formatFlightDate(flight.date, flight.datePrecision ?? 'day', prefs)
      : null,
  );
  const duration = $derived(durationLabel(flight.duration));
  const distance = $derived(
    typeof flight.distance === 'number'
      ? `${Math.round(convertDistance(flight.distance, prefs)).toLocaleString()} ${distanceUnitLabel(prefs)}`
      : null,
  );

  const status = $derived.by(() => {
    const departed = entry.departure && entry.departure <= now;
    const landed = entry.arrival ? entry.arrival <= now : departed;
    if (departed && !landed) {
      return { tone: 'live', text: 'In the air' } as const;
    }
    if (!departed) {
      const countdown = countdownLabel(
        entry.departure,
        now,
        !!flight.departure,
      );
      return countdown
        ? ({ tone: 'upcoming', text: countdown } as const)
        : null;
    }
    const days = Math.round(
      (now.getTime() - (entry.arrival ?? entry.departure!).getTime()) /
        86_400_000,
    );
    if (days < 1) return { tone: 'past', text: 'Landed today' } as const;
    const relative = new Intl.RelativeTimeFormat(undefined, {
      numeric: 'auto',
    });
    const text =
      days < 14
        ? relative.format(-days, 'day')
        : days < 60
          ? relative.format(-Math.round(days / 7), 'week')
          : days < 365
            ? relative.format(-Math.round(days / 30.44), 'month')
            : relative.format(-Math.round(days / 365.25), 'year');
    return { tone: 'past', text: `Flown ${text}` } as const;
  });

  const delay = $derived.by(() => {
    if (status?.tone !== 'past') return null;
    const minutes = arrivalDelayMinutes(flight);
    if (minutes === null) return null;
    const rounded = Math.round(minutes);
    if (Math.abs(rounded) < 1) return { late: false, text: 'Arrived on time' };
    const amount =
      Math.abs(rounded) >= 60
        ? `${Math.floor(Math.abs(rounded) / 60)}h ${Math.abs(rounded) % 60}m`
        : `${Math.abs(rounded)} min`;
    return rounded > 0
      ? {
          late: rounded >= DELAY_THRESHOLD_MINUTES,
          text: `Arrived ${amount} late`,
        }
      : { late: false, text: `Arrived ${amount} early` };
  });

  const canShowRoute = $derived(!!(flight.from && flight.to) && !!onShowRoute);
</script>

<div class="flex flex-col gap-4 px-4 pb-4 pt-4">
  <div class="flex items-start gap-3 pr-1">
    <AirlineIcon airline={flight.airline} size={40} fallback="plane" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-lg font-bold leading-tight tracking-tight">
        {label}
      </p>
      <p class="truncate text-[13px] text-muted-foreground">
        {[
          label !== flight.airline?.name ? flight.airline?.name : null,
          dateLabel,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
    {#if status}
      <span
        class={[
          'mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold',
          status.tone === 'live' &&
            'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
          status.tone === 'upcoming' &&
            'bg-primary/12 text-primary dark:bg-primary/20',
          status.tone === 'past' && 'bg-muted text-muted-foreground',
        ]}
      >
        {#if status.tone === 'live'}
          <span class="size-1.5 animate-pulse rounded-full bg-emerald-500"
          ></span>
        {/if}
        {status.text}
      </span>
    {/if}
  </div>

  {#snippet endpoint(
    airport: FlightData['from'],
    time: Date | null,
    align: 'left' | 'right',
  )}
    <span
      class={[
        'flex min-w-0 flex-col',
        align === 'right' ? 'items-end text-right' : 'items-start',
      ]}
    >
      <span
        class={[
          'flex items-center gap-1.5',
          align === 'right' && 'flex-row-reverse',
        ]}
      >
        {#if airport}
          <img
            src={flagUrl(airport.country)}
            alt={airport.country}
            class="h-3.5 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-border"
          />
        {/if}
        <span class="text-[34px] font-bold leading-none tracking-tight"
          >{airportCode(airport)}</span
        >
      </span>
      <span class="mt-1 max-w-full truncate text-[12.5px] text-muted-foreground"
        >{airportCity(airport)}</span
      >
      {#if time && airport && exactDay}
        <TimeDisplay
          date={time}
          airportTz={airport.tz}
          airportLabel={airport.iata}
          side="bottom"
          variant="time"
          class="mt-2 text-[17px] font-semibold tabular-nums"
        />
        <span class="text-[12px] text-muted-foreground"
          >{localDay(time, airport)}</span
        >
      {/if}
    </span>
  {/snippet}

  <button
    type="button"
    class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 rounded-xl border border-border/70 bg-background/55 p-3 text-left outline-none transition-colors enabled:hover:bg-background/80 focus-visible:ring-1 focus-visible:ring-ring"
    disabled={!canShowRoute}
    onclick={() => onShowRoute?.()}
    aria-label="Open route details"
  >
    {@render endpoint(flight.from, flight.departure, 'left')}
    <span
      class="flex w-20 flex-col items-center gap-1 pt-2 text-[11.5px] text-muted-foreground"
    >
      {#if duration}<span class="tabular-nums">{duration}</span>{/if}
      <span class="flex w-full items-center gap-1">
        <span class="h-px flex-1 border-t border-dashed border-border"></span>
        <Plane size={14} class="rotate-45 text-primary" />
        <span class="h-px flex-1 border-t border-dashed border-border"></span>
      </span>
      {#if distance}<span class="tabular-nums">{distance}</span>{/if}
    </span>
    {@render endpoint(flight.to, flight.arrival, 'right')}
  </button>

  {#if delay}
    <p
      class={[
        'flex items-center gap-2 text-[12.5px] font-medium',
        delay.late
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-emerald-700 dark:text-emerald-400',
      ]}
    >
      <span
        class={[
          'size-1.5 rounded-full',
          delay.late ? 'bg-amber-500' : 'bg-emerald-500',
        ]}
      ></span>
      {delay.text}
    </p>
  {/if}
</div>
