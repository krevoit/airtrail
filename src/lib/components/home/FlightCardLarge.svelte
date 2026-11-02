<script lang="ts">
  import { Plane } from '@o7/icon/lucide';

  import {
    airportCity,
    airportCode,
    durationLabel,
    flagUrl,
    flightLabel,
    localDay,
    localTime,
  } from './format';
  import {
    countdownLabel,
    flightProgress,
    type TimelineEntry,
  } from './timeline';

  import { page } from '$app/state';
  import { AirlineIcon } from '$lib/components/display';
  import { formatSeatForUser } from '$lib/utils';
  import { getPreferences } from '$lib/utils/preferences';

  let {
    entry,
    live = false,
    now,
    seatUserId,
    selected = false,
    onSelect,
  }: {
    entry: TimelineEntry;
    /** In the air right now. */
    live?: boolean;
    now: Date;
    seatUserId?: string;
    selected?: boolean;
    onSelect: (flightId: number) => void;
  } = $props();

  const prefs = $derived(getPreferences(page.data.user));
  const flight = $derived(entry.flight);
  const exactDay = $derived(flight.datePrecision === 'day');
  const hasTimes = $derived(!!flight.departure || !!flight.arrival);
  const label = $derived(flightLabel(flight));
  const duration = $derived(durationLabel(flight.duration));
  const seat = $derived(formatSeatForUser(flight, seatUserId));
  const progress = $derived(live ? flightProgress(entry, now) : 0);
  const badge = $derived.by(() => {
    if (live) {
      const left = entry.arrival
        ? Math.max(0, entry.arrival.getTime() - now.getTime())
        : 0;
      const hours = Math.floor(left / 3_600_000);
      const minutes = Math.round((left % 3_600_000) / 60_000);
      return left
        ? `Lands in ${hours ? `${hours}h ` : ''}${minutes}m`
        : 'Landing';
    }
    return countdownLabel(entry.departure, now, hasTimes);
  });
  const details = $derived(
    [flight.aircraft?.name, duration, seat].filter(Boolean).join(' · '),
  );
</script>

<button
  type="button"
  class={[
    'block w-full rounded-xl border bg-card p-4 text-left shadow-xs outline-none transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
    selected && 'border-primary/60 ring-1 ring-primary/30',
  ]}
  data-flight-id={flight.id}
  onclick={() => onSelect(flight.id)}
>
  <span class="flex items-center justify-between gap-2">
    <span
      class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {live ? 'In the air' : 'Next flight'}
    </span>
    {#if badge}
      <span
        class={[
          'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold',
          live
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            : 'bg-primary/12 text-primary dark:bg-primary/20',
        ]}
      >
        {#if live}
          <span class="relative flex size-1.5">
            <span
              class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75"
            ></span>
            <span
              class="relative inline-flex size-1.5 rounded-full bg-emerald-500"
            ></span>
          </span>
        {/if}
        {badge}
      </span>
    {/if}
  </span>

  <span class="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
    <span class="min-w-0">
      <span class="flex items-center gap-1.5">
        {#if flight.from}
          <img
            src={flagUrl(flight.from.country)}
            alt=""
            class="h-3 w-4 rounded-[2px] object-cover ring-1 ring-border"
          />
        {/if}
        <span class="text-3xl font-bold leading-none tracking-tight"
          >{airportCode(flight.from)}</span
        >
      </span>
      <span class="mt-1 block truncate text-[12.5px] text-muted-foreground"
        >{airportCity(flight.from)}</span
      >
    </span>

    <span class="relative flex w-20 items-center text-muted-foreground">
      <span class="h-px flex-1 border-t border-dashed border-border"></span>
      {#if live}
        <span
          class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400"
          style:left="{progress * 100}%"
        >
          <Plane size={16} class="rotate-45" />
        </span>
      {:else}
        <Plane size={16} class="mx-1 rotate-45 text-primary" />
        <span class="h-px flex-1 border-t border-dashed border-border"></span>
      {/if}
    </span>

    <span class="min-w-0 text-right">
      <span class="flex items-center justify-end gap-1.5">
        <span class="text-3xl font-bold leading-none tracking-tight"
          >{airportCode(flight.to)}</span
        >
        {#if flight.to}
          <img
            src={flagUrl(flight.to.country)}
            alt=""
            class="h-3 w-4 rounded-[2px] object-cover ring-1 ring-border"
          />
        {/if}
      </span>
      <span class="mt-1 block truncate text-[12.5px] text-muted-foreground"
        >{airportCity(flight.to)}</span
      >
    </span>
  </span>

  {#if live}
    <span class="mt-3 block h-1 overflow-hidden rounded-full bg-muted">
      <span
        class="block h-full rounded-full bg-emerald-500"
        style:width="{progress * 100}%"
      ></span>
    </span>
  {/if}

  {#if exactDay}
    <span class="mt-3 grid grid-cols-2 gap-3">
      <span>
        <span class="block text-[11px] text-muted-foreground">Departs</span>
        <span class="block text-[15px] font-semibold tabular-nums">
          {localTime(entry.departure, flight.from, prefs) ??
            localDay(entry.departure, flight.from)}
        </span>
        {#if hasTimes}
          <span class="block text-[12px] text-muted-foreground"
            >{localDay(entry.departure, flight.from)}</span
          >
        {/if}
      </span>
      {#if entry.arrival}
        <span class="text-right">
          <span class="block text-[11px] text-muted-foreground">Arrives</span>
          <span class="block text-[15px] font-semibold tabular-nums"
            >{localTime(entry.arrival, flight.to, prefs)}</span
          >
          <span class="block text-[12px] text-muted-foreground"
            >{localDay(entry.arrival, flight.to)}</span
          >
        </span>
      {/if}
    </span>
  {/if}

  {#if label || details}
    <span
      class="mt-3 flex items-center gap-2 border-t pt-3 text-[12.5px] text-muted-foreground"
    >
      {#if flight.airline}
        <AirlineIcon airline={flight.airline} size={18} />
      {/if}
      <span class="flex min-w-0 items-center gap-1.5 truncate">
        {#if label}<span class="shrink-0 font-medium text-foreground"
            >{label}</span
          >{/if}
        {#if label && details}<span aria-hidden="true">·</span>{/if}
        <span class="truncate">{details}</span>
      </span>
    </span>
  {/if}
</button>
