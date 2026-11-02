<script lang="ts">
  import {
    ChartColumn,
    Earth,
    GitBranchPlus,
    LayoutList,
    Map,
    Settings,
    Sparkles,
    Wrench,
  } from '@o7/icon/lucide';

  import { page } from '$app/state';
  import {
    canDeduplicateOwnFlights,
    hasClientPermission,
  } from '$lib/authorization/permissions';
  import {
    Dock,
    DockFloatingItem,
    DockTooltipItem,
  } from '$lib/components/dock';
  import { Separator } from '$lib/components/ui/separator';
  import { openModalsState } from '$lib/state.svelte';
  import { flyAndScale } from '$lib/utils';

  const addFlightItem = {
    label: 'Add flight',
    icon: GitBranchPlus,
    testId: 'add-flight-button',
    onClick: () => {
      openModalsState.addFlight = true;
    },
  };
  const listFlightsItem = {
    label: 'List flights',
    icon: LayoutList,
    testId: 'list-flights-button',
    onClick: () => {
      openModalsState.listFlights = true;
    },
  };
  const flightsStatisticsItem = {
    label: 'Statistics',
    icon: ChartColumn,
    testId: 'statistics-button',
    onClick: () => {
      openModalsState.statistics = true;
    },
  };
  const settingsItem = {
    label: 'Settings',
    icon: Settings,
    id: 'settings-button',
    onClick: () => {
      openModalsState.settingsTab = 'general';
      openModalsState.settings = true;
    },
  };

  // Pages reachable from anywhere; the home page's flights panel has its own.
  const pageItems = $derived.by(() => {
    const items = [];
    const path = page.url.pathname;
    if (hasClientPermission(page.data.authorization, 'flight.read.own')) {
      items.push({
        label: 'Yearly recap',
        icon: Sparkles,
        href: '/recap',
        active: path.startsWith('/recap'),
      });
      items.push({
        label: 'Visited countries',
        icon: Earth,
        href: '/visited-countries',
        active: path.startsWith('/visited-countries'),
      });
    }
    if (
      canDeduplicateOwnFlights(page.data.authorization) ||
      hasClientPermission(page.data.authorization, 'tools.sql.execute')
    ) {
      items.push({
        label: 'Tools',
        icon: Wrench,
        href: '/tools',
        active: path.startsWith('/tools'),
      });
    }
    return items;
  });
</script>

<!-- The home page has its own flights panel with these destinations. -->
{#if !(page.url.pathname === '/' && hasClientPermission(page.data.authorization, 'flight.read.own'))}
  <nav
    aria-label="Main navigation"
    class="z-10 absolute bottom-6 left-1/2 translate-x-[-50%]"
  >
    <div class="flex gap-4">
      {#if page.url.pathname !== '/'}
        <div transition:flyAndScale>
          <DockFloatingItem href="/" label="Home">
            <Map />
          </DockFloatingItem>
        </div>
      {/if}
      <Dock>
        {#if hasClientPermission(page.data.authorization, 'flight.create.own')}
          <DockTooltipItem item={addFlightItem} />
        {/if}
        {#if page.url.pathname === '/' && hasClientPermission(page.data.authorization, 'flight.read.own')}
          <DockTooltipItem item={listFlightsItem} />
          <DockTooltipItem item={flightsStatisticsItem} />
        {/if}
        {#each pageItems as item (item.href)}
          <DockTooltipItem {item} />
        {/each}
        <Separator orientation="vertical" class="h-full w-px" />
        <DockTooltipItem item={settingsItem} />
      </Dock>
    </div>
  </nav>
{/if}
