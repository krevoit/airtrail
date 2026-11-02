<script lang="ts">
  import {
    geoDistance,
    geoGraticule10,
    geoOrthographic,
    geoPath,
  } from 'd3-geo';
  import { mode } from 'mode-watcher';
  import { onMount } from 'svelte';

  import {
    centroid,
    routeLine,
    worldCountries,
    type LonLat,
    type MapRoute,
  } from './geo';
  import { PALETTES } from './palette';

  let {
    routes,
    airports,
    countries,
    class: className = '',
  }: {
    routes: MapRoute[];
    airports: LonLat[];
    /** Country codes to fill. */
    countries: Set<string>;
    class?: string;
  } = $props();

  const DRAW_MS = 1800;
  const SPIN_DEGREES_PER_SECOND = 4;
  const graticule = geoGraticule10();

  let canvas = $state<HTMLCanvasElement>();
  let size = $state(0);
  let rotation: [number, number] = [0, -20];
  let progress = 0;
  let dragging = false;
  let lastInteraction = 0;

  const palette = $derived(
    PALETTES[mode.current === 'dark' ? 'dark' : 'light'],
  );
  const filled = $derived(
    worldCountries.filter((country) => countries.has(country.properties.id)),
  );
  const widest = $derived(Math.max(1, ...routes.map((route) => route.count)));

  // Point at the routes whenever the set of routes changes.
  $effect(() => {
    const [lon, lat] = centroid(airports);
    rotation = [-lon, -Math.max(-35, Math.min(35, lat))];
    progress = 0;
  });

  const draw = () => {
    const context = canvas?.getContext('2d');
    if (!context || !size) return;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size, size);

    const projection = geoOrthographic()
      .rotate(rotation)
      .fitExtent(
        [
          [2, 2],
          [size - 2, size - 2],
        ],
        { type: 'Sphere' },
      );
    const path = geoPath(projection, context);

    context.beginPath();
    path({ type: 'Sphere' });
    context.fillStyle = palette.water;
    context.fill();
    context.strokeStyle = palette.landBorder;
    context.lineWidth = 1;
    context.stroke();

    context.beginPath();
    path(graticule);
    context.strokeStyle = palette.landBorder;
    context.globalAlpha = 0.35;
    context.lineWidth = 0.5;
    context.stroke();
    context.globalAlpha = 1;

    context.beginPath();
    for (const country of worldCountries) path(country);
    context.fillStyle = palette.land;
    context.fill();
    context.strokeStyle = palette.landBorder;
    context.lineWidth = 0.5;
    context.stroke();

    if (filled.length) {
      context.beginPath();
      for (const country of filled) path(country);
      context.fillStyle = palette.visited;
      context.fill();
    }

    context.strokeStyle = palette.primary;
    context.lineCap = 'round';
    for (const [index, route] of routes.entries()) {
      // Arcs start one after another, so the map draws itself in.
      const start = (index / Math.max(1, routes.length)) * 0.6;
      const local = Math.min(1, Math.max(0, (progress - start) / 0.4));
      if (local <= 0) continue;
      context.beginPath();
      path(routeLine(route, local));
      context.lineWidth = 1.2 + (route.count / widest) * 1.8;
      context.stroke();
    }

    if (progress >= 0.6) {
      context.globalAlpha = Math.min(1, (progress - 0.6) / 0.4);
      const center: LonLat = [-rotation[0], -rotation[1]];
      for (const airport of airports) {
        // Skip airports on the far side of the globe.
        const visible = geoDistance(airport, center) < Math.PI / 2;
        const point = projection(airport);
        if (!visible || !point) continue;
        context.beginPath();
        context.arc(point[0], point[1], 3, 0, Math.PI * 2);
        context.fillStyle = palette.background;
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = palette.primary;
        context.stroke();
      }
      context.globalAlpha = 1;
    }
  };

  onMount(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reduceMotion) progress = 1;

    const observer = new ResizeObserver(([entry]) => {
      size = Math.floor(entry?.contentRect.width ?? 0);
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = size * ratio;
      canvas.height = size * ratio;
      draw();
    });
    if (canvas?.parentElement) observer.observe(canvas.parentElement);

    let frame = 0;
    let onScreen = true;
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
    });
    if (canvas) visibility.observe(canvas);

    let previous = performance.now();
    const tick = (time: number) => {
      // Long pauses (a hidden tab) shouldn't jump the globe round.
      const elapsed = Math.min(100, time - previous);
      previous = time;
      if (!onScreen) {
        frame = requestAnimationFrame(tick);
        return;
      }
      if (progress < 1) progress = Math.min(1, progress + elapsed / DRAW_MS);
      // Spin slowly, pausing for a few seconds after the globe is dragged.
      if (!reduceMotion && !dragging && time - lastInteraction > 4000) {
        rotation = [
          rotation[0] + (SPIN_DEGREES_PER_SECOND * elapsed) / 1000,
          rotation[1],
        ];
      }
      draw();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
    };
  });

  let dragStart: { x: number; y: number; rotation: [number, number] } | null =
    null;
  const onPointerDown = (event: PointerEvent) => {
    dragging = true;
    dragStart = { x: event.clientX, y: event.clientY, rotation };
    canvas?.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || !dragStart || !size) return;
    const degreesPerPixel = 180 / size;
    rotation = [
      dragStart.rotation[0] + (event.clientX - dragStart.x) * degreesPerPixel,
      Math.max(
        -80,
        Math.min(
          80,
          dragStart.rotation[1] -
            (event.clientY - dragStart.y) * degreesPerPixel,
        ),
      ),
    ];
  };
  const onPointerUp = () => {
    dragging = false;
    dragStart = null;
    lastInteraction = performance.now();
  };
</script>

<div class={['relative aspect-square w-full', className]}>
  <canvas
    bind:this={canvas}
    class="absolute inset-0 size-full cursor-grab touch-none active:cursor-grabbing"
    style:width="{size}px"
    style:height="{size}px"
    role="img"
    aria-label="Globe showing {routes.length} routes"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  ></canvas>
</div>
