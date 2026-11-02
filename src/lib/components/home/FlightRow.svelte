<script lang="ts">
  import {
    airportCity,
    airportCode,
    dateBlock,
    durationLabel,
    flightLabel,
  } from './format';

  import { AirlineIcon, LiveryImage } from '$lib/components/display';
  import { liveryUrl } from '$lib/liveries.svelte';
  import type { FlightData } from '$lib/utils';

  let {
    flight,
    selected = false,
    onSelect,
  }: {
    flight: FlightData;
    selected?: boolean;
    onSelect: (flightId: number) => void;
  } = $props();

  const date = $derived(dateBlock(flight));
  const label = $derived(flightLabel(flight));
  const duration = $derived(durationLabel(flight.duration));
  // A livery image replaces the airline icon; null when the airline has none.
  const livery = $derived(
    liveryUrl(flight.airline?.icao, flight.aircraft?.icao, flight.aircraftReg),
  );
</script>

<button
  type="button"
  class={[
    'group grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring',
    selected && 'bg-primary/10 hover:bg-primary/15',
  ]}
  aria-current={selected ? 'true' : undefined}
  data-flight-id={flight.id}
  onclick={() => onSelect(flight.id)}
>
  <span class="flex flex-col items-center leading-none">
    <span
      class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      >{date.top}</span
    >
    <span class="mt-1 text-[17px] font-bold tabular-nums tracking-tight"
      >{date.main}</span
    >
  </span>
  <span class="min-w-0">
    <span
      class="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight"
    >
      {airportCode(flight.from)}
      <svg
        viewBox="0 0 16 8"
        class="h-2 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
        ><path
          d="M0 4h14M11 1l3 3-3 3"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
        /></svg
      >
      {airportCode(flight.to)}
    </span>
    <span class="block truncate text-[12.5px] text-muted-foreground">
      {airportCity(flight.from)} to {airportCity(flight.to)}
    </span>
  </span>
  <span class="flex min-w-0 flex-col items-end gap-1">
    {#if livery !== null && flight.airline}
      <LiveryImage
        airline={flight.airline}
        aircraft={flight.aircraft}
        registration={flight.aircraftReg}
      />
      <span
        class="max-w-[8.5rem] truncate text-[12px] tabular-nums text-muted-foreground"
      >
        {[label !== flight.airline.name ? label : null, duration]
          .filter(Boolean)
          .join(' · ')}
      </span>
    {:else}
      {#if label}
        <span
          class="flex max-w-[8.5rem] items-center gap-1.5 text-[12.5px] font-medium"
        >
          {#if flight.airline}
            <AirlineIcon airline={flight.airline} size={16} />
          {/if}
          <span class="truncate">{label}</span>
        </span>
      {/if}
      {#if duration}
        <span class="text-[12px] tabular-nums text-muted-foreground"
          >{duration}</span
        >
      {/if}
    {/if}
  </span>
</button>
