<script lang="ts">
  import type { Snippet } from 'svelte';

  import type { Aircraft, Airline } from '$lib/db/types';
  import { liveryUrl } from '$lib/liveries.svelte';
  import { cn } from '$lib/utils';

  // Images are 85x20: a side view of the aircraft in the airline's colours.
  let {
    airline,
    aircraft,
    registration,
    scale = 1,
    class: className,
    fallback,
  }: {
    airline: Airline | null;
    aircraft?: Aircraft | null;
    registration?: string | null;
    scale?: number;
    class?: string;
    /** Shown when the airline has no livery image. */
    fallback?: Snippet;
  } = $props();

  const src = $derived(
    liveryUrl(airline?.icao, aircraft?.icao, registration ?? null),
  );
  let failed = $state(false);
  $effect(() => {
    void src;
    failed = false;
  });
</script>

{#if src && !failed}
  <img
    {src}
    alt="{airline?.name ?? ''} {aircraft?.name ?? ''}"
    title="{airline?.name ?? ''}{aircraft ? ` · ${aircraft.name}` : ''}"
    width={85 * scale}
    height={20 * scale}
    loading="lazy"
    decoding="async"
    class={cn(
      'shrink-0 rounded-[3px] bg-white ring-1 ring-black/5 dark:ring-white/10',
      className,
    )}
    style:width="{85 * scale}px"
    style:height="{20 * scale}px"
    onerror={() => (failed = true)}
  />
{:else if src === undefined && airline}
  <!-- Holds the space while the index loads. -->
  <span
    class={cn('inline-block shrink-0', className)}
    style:width="{85 * scale}px"
    style:height="{20 * scale}px"
  ></span>
{:else if fallback}
  {@render fallback()}
{/if}
