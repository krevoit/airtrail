<script lang="ts">
  import { List } from '@o7/icon/lucide';

  import AircraftPhotoCard from './AircraftPhotoCard.svelte';

  import { Button } from '$lib/components/ui/button';
  import type { FlightPassenger } from '$lib/db/types';
  import { appConfig } from '$lib/state.svelte';
  import {
    formatSeatForUser,
    getFlightPassengerLabel,
    toTitleCase,
    type FlightData,
  } from '$lib/utils';
  import { formatRegistration } from '$lib/utils/registration';
  import type { Preferences } from '$lib/zod/user';

  let {
    flight,
    prefs: _prefs,
    seatUserId,
    onShowInList,
  }: {
    flight: FlightData;
    prefs: Preferences;
    seatUserId?: string;
    onShowInList: () => void;
  } = $props();

  const seatLabel = $derived(formatSeatForUser(flight, seatUserId));
  const you = $derived(
    seatUserId
      ? flight.passengers.find((passenger) => passenger.userId === seatUserId)
      : flight.passengers[0],
  );

  const seatDescriptor = (passenger: FlightPassenger) =>
    [
      passenger.seatClass ? toTitleCase(passenger.seatClass) : null,
      [
        passenger.seat ? toTitleCase(passenger.seat) : null,
        passenger.seatNumber,
      ]
        .filter(Boolean)
        .join(' '),
    ]
      .filter(Boolean)
      .join(' · ') || null;

  const passengers = $derived(
    flight.passengers
      .map((passenger) => ({
        name: getFlightPassengerLabel(passenger),
        seat: seatDescriptor(passenger),
        reason: passenger.flightReason
          ? toTitleCase(passenger.flightReason)
          : null,
      }))
      .filter(
        (
          p,
        ): p is { name: string; seat: string | null; reason: string | null } =>
          !!p.name,
      ),
  );

  const gate = (terminal: string | null, gateNumber: string | null) =>
    [
      terminal ? `Terminal ${terminal}` : null,
      gateNumber ? `Gate ${gateNumber}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || null;

  type Tile = { label: string; value: string };
  const tiles = $derived(
    (
      [
        flight.airline?.name && {
          label: 'Airline',
          value: flight.airline.name,
        },
        flight.flightNumber && {
          label: 'Flight',
          value: flight.flightNumber,
        },
        flight.aircraft && { label: 'Aircraft', value: flight.aircraft.name },
        flight.aircraftReg && {
          label: 'Registration',
          value: formatRegistration(flight.aircraftReg),
        },
        seatLabel && { label: 'Seat', value: seatLabel },
        you?.flightReason && {
          label: 'Reason',
          value: toTitleCase(you.flightReason),
        },
        gate(flight.departureTerminal, flight.departureGate) && {
          label: 'Departure',
          value: gate(flight.departureTerminal, flight.departureGate)!,
        },
        gate(flight.arrivalTerminal, flight.arrivalGate) && {
          label: 'Arrival',
          value: gate(flight.arrivalTerminal, flight.arrivalGate)!,
        },
      ] as (Tile | null | undefined | '' | false)[]
    ).filter((tile): tile is Tile => Boolean(tile)),
  );
</script>

<section class="flex flex-col gap-4 px-4 py-4">
  {#if flight.aircraftReg && appConfig.config?.integrations?.aircraftPhotosEnabled}
    <AircraftPhotoCard reg={flight.aircraftReg} />
  {/if}

  {#if tiles.length}
    <dl class="grid grid-cols-2 gap-2">
      {#each tiles as tile, index (tile.label)}
        <div
          class={[
            'min-w-0 rounded-lg border border-border/60 bg-background/45 px-3 py-2',
            index === tiles.length - 1 &&
              tiles.length % 2 === 1 &&
              'col-span-2',
          ]}
        >
          <dt class="text-[11.5px] text-muted-foreground">{tile.label}</dt>
          <dd class="truncate text-[14px] font-semibold" title={tile.value}>
            {tile.value}
          </dd>
        </div>
      {/each}
    </dl>
  {/if}

  {#if passengers.length > 1 || (passengers.length === 1 && passengers[0]?.name && !you)}
    <div>
      <h4 class="mb-1.5 text-[12px] font-semibold text-muted-foreground">
        Passengers
      </h4>
      <ul class="divide-y divide-border/60 rounded-lg border border-border/60">
        {#each passengers as passenger, index (index)}
          <li class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span class="truncate font-medium">{passenger.name}</span>
            <span class="truncate text-[12.5px] text-muted-foreground">
              {[passenger.seat, passenger.reason].filter(Boolean).join(' · ')}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if flight.note}
    <div>
      <h4 class="mb-1.5 text-[12px] font-semibold text-muted-foreground">
        Note
      </h4>
      <p
        class="whitespace-pre-wrap rounded-lg border border-border/60 bg-background/45 px-3 py-2 text-sm"
      >
        {flight.note}
      </p>
    </div>
  {/if}

  {#if !tiles.length && !passengers.length && !flight.note}
    <p class="py-1 text-sm text-muted-foreground">
      No other details for this flight yet.
    </p>
  {/if}
</section>

<section class="px-4 pb-4">
  <Button
    variant="outline"
    size="sm"
    class="w-full justify-center gap-2 bg-background/50"
    onclick={onShowInList}
  >
    <List size={16} />
    Show in all flights
  </Button>
</section>
