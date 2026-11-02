<script lang="ts">
  import { onMount } from 'svelte';

  let {
    value,
    format = (n: number) => Math.round(n).toLocaleString(),
    duration = 1400,
    delay = 150,
  }: {
    value: number;
    format?: (value: number) => string;
    duration?: number;
    delay?: number;
  } = $props();

  let shown = $state(0);

  onMount(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown = value;
      return;
    }
    let frame = 0;
    const start = performance.now() + delay;
    const step = (time: number) => {
      const t = Math.min(1, Math.max(0, (time - start) / duration));
      // Ease out, so the last digits settle slowly.
      shown = value * (1 - Math.pow(1 - t, 4));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  });
</script>

<span class="tabular-nums">{format(shown)}</span>
