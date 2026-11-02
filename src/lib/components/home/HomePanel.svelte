<script lang="ts">
  import {
    ChartColumn,
    Earth,
    List,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Search,
    Sparkles,
    TowerControl,
    Wrench,
    X,
  } from '@o7/icon/lucide';
  import type { Component } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';

  import FlightTimeline from './FlightTimeline.svelte';

  import { browser } from '$app/environment';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import {
    canDeduplicateOwnFlights,
    hasClientPermission,
  } from '$lib/authorization/permissions';
  import { UserAvatar } from '$lib/components/display';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { yearTotals } from '$lib/stats/recap';
  import {
    homePanelState,
    mapDetailsState,
    openFlightDetails,
    openModalsState,
  } from '$lib/state.svelte';
  import { pluralize, type FlightData } from '$lib/utils';
  import {
    convertDistance,
    distanceUnitLabel,
    getPreferences,
  } from '$lib/utils/preferences';
  import { isMediumScreen } from '$lib/utils/size';

  let {
    flights,
    allFlights,
    seatUserId,
    filtered = false,
    onClearFilters,
  }: {
    /** Flights after the map's filters. */
    flights: FlightData[];
    allFlights: FlightData[];
    seatUserId?: string;
    filtered?: boolean;
    onClearFilters?: () => void;
  } = $props();

  const SIDEBAR_KEY = 'home-sidebar';
  const auth = $derived(page.data.authorization);
  const canAdd = $derived(hasClientPermission(auth, 'flight.create.own'));
  const canRead = $derived(hasClientPermission(auth, 'flight.read.own'));
  const canImport = $derived(hasClientPermission(auth, 'flight.import.own'));
  const canUseTools = $derived(
    canDeduplicateOwnFlights(auth) ||
      hasClientPermission(auth, 'tools.sql.execute'),
  );
  const prefs = $derived(getPreferences(page.data.user));

  let search = $state('');
  let searching = $state(false);
  const selectedId = $derived(
    mapDetailsState.selection?.type === 'flight'
      ? mapDetailsState.selection.flightId
      : null,
  );

  // This year so far, or every year when nothing has been flown yet this year.
  const summary = $derived.by(() => {
    const totals = yearTotals(allFlights);
    const thisYear = new Date().getFullYear();
    const current = totals.find((total) => total.year === thisYear);
    if (current) {
      return {
        ...current,
        label: `${thisYear} so far`,
        year: String(thisYear),
      };
    }
    const all = totals.reduce(
      (sum, total) => ({
        flights: sum.flights + total.flights,
        distanceKm: sum.distanceKm + total.distanceKm,
      }),
      { flights: 0, distanceKm: 0 },
    );
    return all.flights ? { label: 'All time', year: 'all', ...all } : null;
  });

  type NavItem = {
    label: string;
    icon: Component<{ size?: number }>;
    testId?: string;
    href?: string;
    onclick?: () => void;
  };
  const navItems = $derived(
    [
      canRead && {
        label: 'Flights',
        icon: List,
        testId: 'list-flights-button',
        onclick: () => (openModalsState.listFlights = true),
      },
      canRead && {
        label: 'Statistics',
        icon: ChartColumn,
        testId: 'statistics-button',
        onclick: () => (openModalsState.statistics = true),
      },
      canRead && { label: 'Recap', icon: Sparkles, href: resolve('/recap') },
      canRead && {
        label: 'Countries',
        icon: Earth,
        href: resolve('/visited-countries'),
      },
      canUseTools && { label: 'Tools', icon: Wrench, href: resolve('/tools') },
    ].filter(Boolean) as NavItem[],
  );

  const openSettings = () => {
    openModalsState.settingsTab = 'general';
    openModalsState.settings = true;
  };

  // Desktop sidebar: open unless the user closed it last time.
  const readSidebar = () => {
    if (!browser) return true;
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== 'closed';
    } catch {
      return true;
    }
  };
  homePanelState.sidebarOpen = readSidebar();
  const setSidebar = (open: boolean) => {
    homePanelState.sidebarOpen = open;
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? 'open' : 'closed');
    } catch {
      // Only a convenience.
    }
  };

  onMount(() => {
    homePanelState.mounted = true;
  });
  onDestroy(() => {
    homePanelState.mounted = false;
    homePanelState.sheetHeight = 0;
  });

  // Mobile sheet: three resting heights, dragged by its top.
  type Snap = 'peek' | 'half' | 'full';
  let snap = $state<Snap>('peek');
  let viewport = $state(browser ? window.innerHeight : 800);
  let dragHeight = $state<number | null>(null);
  const snapHeight = (value: Snap) =>
    value === 'peek'
      ? Math.min(300, viewport * 0.42)
      : value === 'half'
        ? viewport * 0.55
        : viewport - 16;
  const detailsOpen = $derived(!!mapDetailsState.selection);
  const sheetHeight = $derived(
    detailsOpen ? 0 : (dragHeight ?? snapHeight(snap)),
  );
  $effect(() => {
    // Only settled heights move the map, not every frame of a drag.
    homePanelState.sheetHeight =
      $isMediumScreen || detailsOpen ? 0 : snapHeight(snap);
  });

  let dragStart: { y: number; height: number; time: number } | null = null;
  const onDragStart = (event: PointerEvent) => {
    dragStart = {
      y: event.clientY,
      height: sheetHeight,
      time: event.timeStamp,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onDragMove = (event: PointerEvent) => {
    if (!dragStart) return;
    dragHeight = Math.max(
      120,
      Math.min(viewport - 16, dragStart.height + dragStart.y - event.clientY),
    );
  };
  const onDragEnd = (event: PointerEvent) => {
    if (!dragStart) return;
    const moved = dragStart.y - event.clientY;
    const velocity = moved / Math.max(1, event.timeStamp - dragStart.time);
    const height = dragHeight ?? dragStart.height;
    dragStart = null;
    dragHeight = null;
    const order: Snap[] = ['peek', 'half', 'full'];
    if (Math.abs(moved) < 4) {
      // A tap on the handle steps through the heights.
      snap = order[(order.indexOf(snap) + 1) % order.length]!;
      return;
    }
    if (Math.abs(velocity) > 0.5) {
      const index = order.indexOf(snap) + (velocity > 0 ? 1 : -1);
      snap = order[Math.max(0, Math.min(order.length - 1, index))]!;
      return;
    }
    snap = order.reduce((best, candidate) =>
      Math.abs(snapHeight(candidate) - height) <
      Math.abs(snapHeight(best) - height)
        ? candidate
        : best,
    );
  };

  // "/" searches and "n" adds a flight, unless typing or a dialog is open.
  const onShortcut = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (
      target?.closest('input, textarea, select, [contenteditable="true"]') ||
      document.querySelector('[role="dialog"]')
    ) {
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      if ($isMediumScreen) setSidebar(true);
      searching = true;
    } else if (event.key === 'n' && canAdd) {
      event.preventDefault();
      openModalsState.addFlight = true;
    }
  };

  const select = (flightId: number) => {
    openFlightDetails(flightId);
  };

  const distanceText = (km: number) =>
    `${Math.round(convertDistance(km, prefs)).toLocaleString()} ${distanceUnitLabel(prefs)}`;
</script>

<svelte:window
  onresize={() => (viewport = window.innerHeight)}
  onkeydown={onShortcut}
/>

{#snippet timelineOrEmpty()}
  {#if allFlights.length === 0}
    <div class="px-6 py-10 text-center">
      <span
        class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary dark:bg-primary/20"
      >
        <TowerControl size={24} />
      </span>
      <p class="mt-4 font-semibold">No flights yet</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Add the flights you've taken, or bring them in from another app.
      </p>
      <div class="mt-4 flex justify-center gap-2">
        {#if canAdd}
          <Button size="sm" onclick={() => (openModalsState.addFlight = true)}>
            <Plus size={16} />
            Add a flight
          </Button>
        {/if}
        {#if canImport}
          <Button
            size="sm"
            variant="outline"
            onclick={() => {
              openModalsState.settingsTab = 'import';
              openModalsState.settings = true;
            }}
          >
            Import
          </Button>
        {/if}
      </div>
    </div>
  {:else}
    <FlightTimeline
      {flights}
      {search}
      {seatUserId}
      {selectedId}
      onSelect={select}
    />
  {/if}
{/snippet}

{#snippet header(compact: boolean)}
  <div class="px-3 pt-3">
    <div class="flex items-center gap-2">
      {#if compact}
        <h2 class="flex-1 pl-1 text-xl font-bold tracking-tight">Flights</h2>
      {:else}
        <div class="flex flex-1 items-center gap-2 pl-1">
          <span
            class="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary dark:bg-primary/20"
          >
            <TowerControl size={18} />
          </span>
          <span class="text-[17px] font-bold tracking-tight">AirTrail</span>
        </div>
      {/if}
      <Button
        variant="ghost"
        size="icon"
        class="size-8"
        aria-label="Search flights"
        title="Search (/)"
        onclick={() => {
          searching = !searching;
          if (!searching) search = '';
        }}
      >
        {#if searching}<X size={17} />{:else}<Search size={17} />{/if}
      </Button>
      {#if !compact}
        <Button
          variant="ghost"
          size="icon"
          class="size-8"
          aria-label="Hide flights panel"
          onclick={() => setSidebar(false)}
        >
          <PanelLeftClose size={17} />
        </Button>
      {/if}
      {#if canAdd}
        <Button
          size="sm"
          class="h-8 gap-1 px-2.5"
          data-testid="add-flight-button"
          title="Add flight (N)"
          onclick={() => (openModalsState.addFlight = true)}
        >
          <Plus size={16} />
          Add
        </Button>
      {/if}
      <button
        type="button"
        id="settings-button"
        class="rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Settings"
        title="Settings"
        onclick={openSettings}
      >
        <UserAvatar size={30} class="rounded-full" />
      </button>
    </div>

    {#if searching}
      <div class="relative mt-2.5" in:fly={{ y: -4, duration: 150 }}>
        <Search
          size={14}
          class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          bind:value={search}
          autofocus
          placeholder="Airport, city, airline or flight number"
          class="h-9 bg-background/70 pl-8 text-sm"
          aria-label="Search flights"
          onkeydown={(event) => {
            if (event.key === 'Escape') {
              searching = false;
              search = '';
            }
          }}
        />
      </div>
    {/if}

    <nav
      aria-label="Sections"
      class="mt-2.5 grid gap-1"
      style:grid-template-columns="repeat({navItems.length}, minmax(0, 1fr))"
    >
      {#each navItems as item (item.label)}
        {@const classes =
          'flex h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-[11.5px] font-medium text-muted-foreground outline-none transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring'}
        {#if item.href}
          <!-- Built with resolve() in navItems. -->
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={item.href} class={classes}>
            <item.icon size={18} />
            <span class="max-w-full truncate">{item.label}</span>
          </a>
        {:else}
          <button
            type="button"
            data-testid={item.testId}
            class={classes}
            onclick={item.onclick}
          >
            <item.icon size={18} />
            <span class="max-w-full truncate">{item.label}</span>
          </button>
        {/if}
      {/each}
    </nav>

    {#if summary && !search}
      <a
        href="{resolve('/recap')}?year={summary.year}"
        class="mt-3 grid grid-cols-[auto_1fr_1fr] items-end gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2 outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span class="text-[12px] font-medium text-muted-foreground"
          >{summary.label}</span
        >
        <span class="text-right">
          <span class="block text-[15px] font-bold tabular-nums leading-tight"
            >{summary.flights.toLocaleString()}</span
          >
          <span class="block text-[11px] text-muted-foreground"
            >{pluralize(summary.flights, 'flight')}</span
          >
        </span>
        <span class="text-right">
          <span class="block text-[15px] font-bold tabular-nums leading-tight"
            >{distanceText(summary.distanceKm)}</span
          >
          <span class="block text-[11px] text-muted-foreground">flown</span>
        </span>
      </a>
    {/if}

    {#if filtered}
      <div
        class="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5 text-[12.5px] dark:bg-primary/20"
      >
        <span>Showing {flights.length} of {allFlights.length} flights</span>
        {#if onClearFilters}
          <button
            type="button"
            class="font-medium text-primary outline-none hover:underline"
            onclick={onClearFilters}>Clear filters</button
          >
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#if $isMediumScreen}
  <!-- Hidden, not removed, while a details pane covers it: the pane is
       translucent, and the list keeps its scroll position. -->
  {#if homePanelState.sidebarOpen}
    <aside
      class="glass-pane absolute bottom-3 left-3 top-3 z-10 flex w-[400px] flex-col overflow-hidden rounded-2xl"
      class:invisible={detailsOpen}
      aria-label="Flights"
      aria-hidden={detailsOpen}
      transition:fly={{ x: -420, duration: 260, easing: cubicOut }}
    >
      {@render header(false)}
      <div
        class="scrollbar-subtle mt-3 flex-1 overflow-y-auto border-t border-border/60 pb-4 pt-3"
      >
        {@render timelineOrEmpty()}
      </div>
    </aside>
  {:else}
    <div
      class="glass-pane absolute left-3 top-3 z-10 flex items-center gap-1 rounded-xl p-1"
      class:invisible={detailsOpen}
      transition:fly={{ x: -40, duration: 200 }}
    >
      <Button
        variant="ghost"
        size="sm"
        class="h-8 gap-1.5"
        onclick={() => setSidebar(true)}
      >
        <PanelLeftOpen size={16} />
        Flights
      </Button>
      {#if canAdd}
        <Button
          size="icon"
          class="size-8"
          aria-label="Add flight"
          data-testid="add-flight-button"
          onclick={() => (openModalsState.addFlight = true)}
        >
          <Plus size={16} />
        </Button>
      {/if}
      <button
        type="button"
        id="settings-button"
        class="ml-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Settings"
        onclick={openSettings}
      >
        <UserAvatar size={28} class="rounded-full" />
      </button>
    </div>
  {/if}
{:else}
  <section
    class="glass-pane fixed inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
    class:transition-[height]={dragHeight === null}
    class:duration-300={dragHeight === null}
    class:ease-out={dragHeight === null}
    style:height="{sheetHeight}px"
    aria-label="Flights"
  >
    <div
      class="flex shrink-0 cursor-grab touch-none justify-center pb-0.5 pt-2 active:cursor-grabbing"
      role="slider"
      tabindex="0"
      aria-label="Resize flights panel"
      aria-valuemin={0}
      aria-valuemax={2}
      aria-valuenow={['peek', 'half', 'full'].indexOf(snap)}
      onpointerdown={onDragStart}
      onpointermove={onDragMove}
      onpointerup={onDragEnd}
      onpointercancel={onDragEnd}
      onkeydown={(event) => {
        if (event.key === 'ArrowUp') snap = snap === 'peek' ? 'half' : 'full';
        if (event.key === 'ArrowDown') snap = snap === 'full' ? 'half' : 'peek';
      }}
    >
      <span class="h-1.5 w-10 rounded-full bg-muted-foreground/30"></span>
    </div>
    {@render header(true)}
    <div
      class="scrollbar-subtle mt-3 min-h-0 flex-1 overflow-y-auto border-t border-border/60 pb-6 pt-3"
    >
      {@render timelineOrEmpty()}
    </div>
  </section>
{/if}
