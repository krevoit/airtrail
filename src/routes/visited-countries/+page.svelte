<script lang="ts">
  import { PanelLeft, RefreshCw } from '@o7/icon/lucide';
  import type * as maplibregl from 'maplibre-gl';
  import { mode } from 'mode-watcher';
  import { onDestroy } from 'svelte';
  import {
    MapLibre,
    Control,
    ControlGroup,
    ControlButton,
    GeolocateControl,
    AttributionControl,
    NavigationControl,
    VectorTileSource,
    FillLayer,
    LineLayer,
    type LayerClickInfo,
  } from 'svelte-maplibre';
  import { toast } from 'svelte-sonner';

  import { browser } from '$app/environment';
  import { replaceState } from '$app/navigation';
  import { base, resolve } from '$app/paths';
  import { page } from '$app/state';
  import { OnResizeEnd } from '$lib/components/helpers';
  import {
    EditVisitedCountry,
    SetupVisitedCountries,
  } from '$lib/components/modals';
  import SubdivisionPanel from '$lib/components/modals/visited-countries/SubdivisionPanel.svelte';
  import VisitedOverviewPanel from '$lib/components/modals/visited-countries/VisitedOverviewPanel.svelte';
  import type { VisitedCountryStatus } from '$lib/db/types';
  import {
    getAppMapImages,
    getConfiguredAppMapStyleUrl,
  } from '$lib/map/app-style';
  import { registerPmtilesProtocol } from '$lib/map/pmtiles';
  import { exposeRenderState } from '$lib/map/render-state';
  import { appConfig } from '$lib/state.svelte';
  import { api, trpc } from '$lib/trpc';
  import { pluralize } from '$lib/utils';
  import { visitedPlaceFromCode } from '$lib/utils/data/countries';

  type Status = (typeof VisitedCountryStatus)[number];
  type Bounds = [number, number, number, number];
  type Subdivision = { code: string; name: string; bounds: Bounds };

  const STATUS_COLORS: Record<Status, string> = {
    lived: '#4ade80',
    visited: '#3C82F6',
    layover: '#66d9ef',
    wishlist: '#8b5cf6',
  };
  const STATUS_ORDER: Status[] = ['lived', 'visited', 'layover', 'wishlist'];

  const unregisterPmtiles = browser ? registerPmtilesProtocol() : null;

  onDestroy(() => unregisterPmtiles?.());

  const countriesResult = trpc.visitedCountries.list.query();
  const countries = $derived.by(() => $countriesResult.data || []);
  const livedCountries = $derived.by(() =>
    countries.filter((c) => c.status === 'lived'),
  );
  const visitedCountries = $derived.by(() =>
    countries.filter((c) => c.status === 'visited'),
  );
  const layoverCountries = $derived.by(() =>
    countries.filter((c) => c.status === 'layover'),
  );
  const wishlistCountries = $derived.by(() =>
    countries.filter((c) => c.status === 'wishlist'),
  );

  const subdivisionsResult = trpc.visitedCountries.listSubdivisions.query();
  const visitedSubdivisions = $derived($subdivisionsResult.data ?? []);
  const countsResult = trpc.visitedCountries.subdivisionCounts.query();
  const subdivisionCounts = $derived($countsResult.data ?? {});

  /** Country whose states/provinces are being shown, or null for the world. */
  let focusCountry: string | null = $state(
    page.url.searchParams.get('country')?.toUpperCase() || null,
  );

  // The world overview panel. Open by default on wide screens, and the
  // choice is remembered.
  const OVERVIEW_KEY = 'visited-countries-overview';
  const readOverviewPreference = () => {
    if (!browser) return false;
    if (page.url.searchParams.get('view') === 'overview') return true;
    try {
      const saved = localStorage.getItem(OVERVIEW_KEY);
      if (saved !== null) return saved === 'open';
    } catch {
      // Storage can be unavailable; fall back to the screen size.
    }
    return window.matchMedia('(min-width: 768px)').matches;
  };
  let overviewOpen = $state(readOverviewPreference());
  const setOverview = (open: boolean) => {
    overviewOpen = open;
    try {
      localStorage.setItem(OVERVIEW_KEY, open ? 'open' : 'closed');
    } catch {
      // Not remembered; nothing else depends on it.
    }
    void fitCountries();
  };

  // Keep the open country in the URL so a refresh or a shared link lands on it.
  $effect(() => {
    const country = focusCountry;
    if (!browser) return;
    // Only the country is compared, so other parameters (such as the
    // overview link's) don't trigger a rewrite before the router is ready.
    const current = page.url.searchParams.get('country')?.toUpperCase() || null;
    if (current === country) return;
    const search = country ? `?country=${country}` : '';
    // Only the query changes; the path comes from resolve().
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    replaceState(`${resolve('/visited-countries')}${search}`, page.state);
  });
  // Plain cache; nothing renders from it directly.
  const subdivisionCache: Record<string, Subdivision[]> = {};
  let focusSubdivisions: Subdivision[] | null = $state(null);

  $effect(() => {
    const country = focusCountry;
    if (!country) {
      focusSubdivisions = null;
      return;
    }
    const cached = subdivisionCache[country];
    if (cached) {
      focusSubdivisions = cached;
      fitSubdivisions(cached);
      return;
    }
    focusSubdivisions = null;
    api.visitedCountries.subdivisions
      .query({ country })
      .then((list) => {
        const typed = list as Subdivision[];
        subdivisionCache[country] = typed;
        if (focusCountry !== country) return;
        focusSubdivisions = typed;
        fitSubdivisions(typed);
      })
      .catch((error) => {
        console.error(error);
        toast.error('Failed to load states and provinces');
      });
  });

  const statusMatch = (
    property: string,
    entries: { code: string; status: Status }[],
    fallback: string,
  ): maplibregl.ExpressionSpecification | string => {
    const branches = STATUS_ORDER.flatMap((status) => {
      const codes = entries
        .filter((entry) => entry.status === status)
        .map((entry) => entry.code);
      return codes.length ? [codes, STATUS_COLORS[status]] : [];
    });
    if (!branches.length) return fallback;
    return [
      'match',
      ['get', property],
      ...branches,
      fallback,
    ] as unknown as maplibregl.ExpressionSpecification;
  };

  const buildFillColor = () =>
    statusMatch('COUNTRY_CODE', countries, 'rgba(0,0,0,0)');

  // While a country is open, its own fill steps aside for its subdivisions
  // and every other country fades back.
  const countryFillOpacity = $derived<
    maplibregl.ExpressionSpecification | number
  >(
    focusCountry
      ? ['case', ['==', ['get', 'COUNTRY_CODE'], focusCountry], 0, 0.3]
      : 1,
  );

  const subdivisionFilter = $derived<maplibregl.ExpressionSpecification>([
    '==',
    ['get', 'COUNTRY_CODE'],
    focusCountry ?? '',
  ]);
  const subdivisionFillColor = $derived(
    statusMatch(
      'SUBDIVISION_CODE',
      visitedSubdivisions,
      mode.current === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    ),
  );
  const subdivisionLineColor = $derived(
    mode.current === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(30,41,59,0.45)',
  );

  let map: maplibregl.Map | undefined = $state(undefined);

  $effect(() => {
    if (map) return exposeRenderState(map);
  });
  let loaded = $state(false);
  const style = $derived(
    getConfiguredAppMapStyleUrl(mode.current, appConfig.config?.map),
  );
  const images = $derived(getAppMapImages(base));

  let editing = $state(false);
  let editingInfo: {
    code: string;
    status: Status | null;
    note: string | null;
    subdivision?: { name: string; country: string };
  } | null = $state(null);

  const editingProgress = $derived.by(() => {
    if (!editingInfo || editingInfo.subdivision) return null;
    const total = subdivisionCounts[editingInfo.code];
    if (!total) return null;
    const visited = visitedSubdivisions.filter(
      (entry) =>
        entry.country === editingInfo!.code &&
        (entry.status === 'visited' || entry.status === 'lived'),
    ).length;
    return { visited, total };
  });

  let firstLabelLayerId = $state<string | undefined>(undefined);

  const updateLabelLayerId = (currentMap: maplibregl.Map) => {
    const layers = currentMap.getStyle().layers ?? [];
    firstLabelLayerId = layers.find(
      (layer) =>
        layer.type === 'symbol' && layer.layout && layer.layout['text-field'],
    )?.id;
  };

  const load = async () => {
    const currentMap = map;
    if (!currentMap) return;

    updateLabelLayerId(currentMap);
    currentMap.on('style.load', () => updateLabelLayerId(currentMap));

    await fitCountries();
  };

  const handleCountryClick = (event: LayerClickInfo) => {
    if (event.features?.length) {
      const country = event.features[0];
      const code = country?.properties?.['COUNTRY_CODE'];
      // Inside the open country, clicks belong to its subdivisions.
      if (code && code === focusCountry) return;
      if (visitedPlaceFromCode(code)) {
        const countryData = countries.find((country) => country.code === code);
        editingInfo = {
          code,
          status: countryData?.status ?? null,
          note: countryData?.note ?? null,
        };
        editing = true;
      }
    }
  };

  const editSubdivision = (subdivision: Subdivision) => {
    if (!focusCountry) return;
    const entry = visitedSubdivisions.find(
      (item) => item.code === subdivision.code,
    );
    editingInfo = {
      code: subdivision.code,
      status: entry?.status ?? null,
      note: entry?.note ?? null,
      subdivision: { name: subdivision.name, country: focusCountry },
    };
    editing = true;
  };

  const handleSubdivisionClick = (event: LayerClickInfo) => {
    const code = event.features?.[0]?.properties?.['SUBDIVISION_CODE'];
    const subdivision = focusSubdivisions?.find((item) => item.code === code);
    if (subdivision) editSubdivision(subdivision);
  };

  const panelPadding = (): maplibregl.PaddingOptions => {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    return mobile
      ? {
          top: 40,
          right: 20,
          bottom: window.innerHeight * 0.42 + 110,
          left: 20,
        }
      : { top: 40, right: 60, bottom: 110, left: 360 };
  };

  const fitBounds = (bounds: Bounds, padding: maplibregl.PaddingOptions) => {
    map?.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding, linear: false, maxZoom: 9 },
    );
  };

  /*
   * Fit to the country's subdivisions. Ones that cross the antimeridian (the
   * Aleutians, Chukotka) have a bounding box spanning the globe, so they are
   * left out.
   */
  const fitSubdivisions = (list: Subdivision[]) => {
    const usable = list.filter(({ bounds }) => bounds[2] - bounds[0] < 180);
    if (!usable.length) return;
    const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const { bounds: item } of usable) {
      bounds[0] = Math.min(bounds[0], item[0]);
      bounds[1] = Math.min(bounds[1], item[1]);
      bounds[2] = Math.max(bounds[2], item[2]);
      bounds[3] = Math.max(bounds[3], item[3]);
    }
    fitBounds(bounds, panelPadding());
  };

  const focusSubdivision = (subdivision: Subdivision) => {
    if (subdivision.bounds[2] - subdivision.bounds[0] >= 180) return;
    fitBounds(subdivision.bounds, panelPadding());
  };

  const exploreCountry = (country: string) => {
    focusCountry = country;
  };

  /** From the overview list: open its states, or else its edit dialog. */
  const selectCountry = (code: string) => {
    if (subdivisionCounts[code]) {
      exploreCountry(code);
      return;
    }
    const entry = countries.find((country) => country.code === code);
    editingInfo = {
      code,
      status: entry?.status ?? null,
      note: entry?.note ?? null,
    };
    editing = true;
  };

  const leaveCountry = async () => {
    focusCountry = null;
    await fitCountries();
  };

  type CountryBounds = Record<string, [number, number, number, number]>;
  let countryBounds: CountryBounds | null = null;
  const fitCountries = async () => {
    if (focusCountry) {
      if (focusSubdivisions) fitSubdivisions(focusSubdivisions);
      return;
    }
    const codes: string[] = [
      ...livedCountries,
      ...visitedCountries,
      ...layoverCountries,
      ...wishlistCountries,
    ].map((country) => country.code);

    if (!map || !codes.length) return;

    if (!countryBounds) {
      const response = await fetch('/countries-bounds.json');
      countryBounds = (await response.json()) as CountryBounds;
    }

    let west = Infinity;
    let south = Infinity;
    let east = -Infinity;
    let north = -Infinity;

    for (const code of codes) {
      const bounds = countryBounds[code];
      if (!bounds) continue;
      const [minX, minY, maxX, maxY] = bounds;
      west = Math.min(west, minX);
      south = Math.min(south, minY);
      east = Math.max(east, maxX);
      north = Math.max(north, maxY);
    }

    if (!Number.isFinite(west)) return;

    const bounds: [[number, number], [number, number]] = [
      [west, south],
      [east, north],
    ];
    map.fitBounds(bounds, {
      padding: overviewOpen ? panelPadding() : 20,
      linear: false,
    });
  };

  let syncing = $state(false);
  const syncFlights = async () => {
    if (syncing) return;
    syncing = true;
    try {
      await runSync();
    } catch (error) {
      console.error(error);
      toast.error('Failed to fill in from flights');
    } finally {
      syncing = false;
    }
  };
  const runSync = async () => {
    const result = await api.visitedCountries.importFlights.mutate();
    if (result) {
      await Promise.all([
        trpc.visitedCountries.list.utils.invalidate(),
        trpc.visitedCountries.listSubdivisions.utils.invalidate(),
      ]);
      await fitCountries();
      toast.success(
        `Marked ${result} ${pluralize(result, 'place', 'places')} as visited`,
      );
    } else {
      toast.error('No changes found.');
    }
  };
</script>

<OnResizeEnd callback={fitCountries} />
<SetupVisitedCountries {countries} {fitCountries} />
<EditVisitedCountry
  bind:open={editing}
  {editingInfo}
  subdivisionProgress={editingProgress}
  onExplore={exploreCountry}
/>

{#if !focusCountry && overviewOpen}
  <VisitedOverviewPanel
    {countries}
    subdivisions={visitedSubdivisions}
    {subdivisionCounts}
    statusColors={STATUS_COLORS}
    {syncing}
    onClose={() => setOverview(false)}
    onSelect={selectCountry}
    onSync={syncFlights}
  />
{/if}

{#if focusCountry}
  <SubdivisionPanel
    country={focusCountry}
    subdivisions={focusSubdivisions}
    visited={visitedSubdivisions}
    statusColors={STATUS_COLORS}
    onBack={leaveCountry}
    onEdit={editSubdivision}
    onFocus={focusSubdivision}
  />
{/if}

<!--
  The layout fills in the map config after this page mounts. Creating the map
  before then gives it a provisional style URL, and swapping to the real one
  with diffStyleUpdates drops the country and subdivision layers.
-->
{#if appConfig.config}
  <MapLibre
    {style}
    {images}
    projection={{ type: 'globe' }}
    diffStyleUpdates
    zoom={2}
    bind:map
    bind:loaded
    onload={load}
    attributionControl={false}
  >
    <AttributionControl compact={true} />
    <NavigationControl position="top-right" />
    <GeolocateControl position="top-right" />

    <VectorTileSource id="countries" url="pmtiles:///countries.pmtiles">
      <FillLayer
        id="countries"
        sourceLayer="countries"
        beforeId={firstLabelLayerId}
        beforeLayerType="symbol"
        hoverCursor="pointer"
        interactive
        paint={{
          'fill-color': buildFillColor(),
          'fill-opacity': countryFillOpacity,
        }}
        onclick={handleCountryClick}
      />
    </VectorTileSource>

    {#if focusCountry}
      <VectorTileSource id="subdivisions" url="pmtiles:///subdivisions.pmtiles">
        <FillLayer
          id="subdivisions-fill"
          sourceLayer="subdivisions"
          beforeId={firstLabelLayerId}
          beforeLayerType="symbol"
          filter={subdivisionFilter}
          hoverCursor="pointer"
          interactive
          paint={{ 'fill-color': subdivisionFillColor }}
          onclick={handleSubdivisionClick}
        />
        <LineLayer
          id="subdivisions-line"
          sourceLayer="subdivisions"
          beforeId={firstLabelLayerId}
          beforeLayerType="symbol"
          filter={subdivisionFilter}
          paint={{ 'line-color': subdivisionLineColor, 'line-width': 0.8 }}
        />
      </VectorTileSource>
    {/if}

    <Control position="top-right">
      <ControlGroup>
        {#if !focusCountry}
          <ControlButton
            onclick={() => setOverview(!overviewOpen)}
            title={overviewOpen ? 'Hide overview' : 'Show overview'}
          >
            <PanelLeft size={20} />
          </ControlButton>
        {/if}
        <ControlButton
          onclick={syncFlights}
          title="Sync from flights (will never overwrite)"
        >
          <RefreshCw size={20} />
        </ControlButton>
      </ControlGroup>
    </Control>
  </MapLibre>
{/if}
