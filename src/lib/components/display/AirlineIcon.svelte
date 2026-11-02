<script lang="ts">
  import { Plane } from '@o7/icon/lucide';
  import { Airlines } from '@o7/icon/material/solid';

  import * as Avatar from '$lib/components/ui/avatar';
  import type { Airline } from '$lib/db/types';

  let {
    airline,
    size = 24,
    class: className = '',
    fallback = 'airline',
  }: {
    airline: Airline | null;
    size?: number;
    class?: string;
    fallback?: 'airline' | 'plane';
  } = $props();

  let loadingStatus = $state<'loading' | 'loaded' | 'error'>('loading');
  let isDarkIcon = $state(false);
  let imageRef = $state<HTMLImageElement | null>(null);

  const iconPath = $derived(airline?.iconPath ?? null);
  const monogram = $derived(
    airline
      ? (
          airline.iata ??
          airline.icao ??
          airline.name
            .split(/\s+/)
            .map((word) => word[0])
            .join('')
            .slice(0, 2)
        ).toUpperCase()
      : null,
  );
  const hasIcon = $derived(!!iconPath);
  const iconSrc = $derived(iconPath ? `/api/uploads/${iconPath}` : '');

  $effect(() => {
    iconPath;
    isDarkIcon = false;
  });

  const analyzeIcon = (image: HTMLImageElement) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!image.naturalWidth) {
      return;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const sampleSize = 24;
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    try {
      context.drawImage(image, 0, 0, sampleSize, sampleSize);
      const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
      let luminanceTotal = 0;
      let sampleCount = 0;

      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3] ?? 0;

        if (alpha < 40) {
          continue;
        }

        const red = data[index] ?? 0;
        const green = data[index + 1] ?? 0;
        const blue = data[index + 2] ?? 0;
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

        luminanceTotal += luminance;
        sampleCount += 1;
      }

      if (sampleCount === 0) {
        return;
      }

      isDarkIcon = luminanceTotal / sampleCount < 50;
    } catch {
      return;
    }
  };

  $effect(() => {
    const currentImage = imageRef;

    if (!currentImage) {
      return;
    }

    const handleLoad = () => {
      analyzeIcon(currentImage);
    };

    currentImage.addEventListener('load', handleLoad);

    if (currentImage.complete) {
      handleLoad();
    }

    return () => {
      currentImage.removeEventListener('load', handleLoad);
    };
  });
</script>

{#if hasIcon}
  <Avatar.Root
    bind:loadingStatus
    class="rounded-none bg-transparent {className}"
    style="width: {size}px; height: {size}px;"
  >
    <Avatar.Image
      bind:ref={imageRef}
      src={iconSrc}
      alt={airline?.name}
      title={airline?.name || isDarkIcon
        ? `${airline?.name ?? ''}${isDarkIcon ? ' (icon adjusted for dark theme visibility)' : ''}`.trim()
        : undefined}
      class="object-contain {isDarkIcon ? 'dark:brightness-0 dark:invert' : ''}"
    />
    <Avatar.Fallback class="rounded-none bg-transparent">
      <div
        class="flex items-center justify-center text-muted-foreground"
        style:width="{size}px"
        style:height="{size}px"
        title={airline?.name}
      >
        {@render fallbackIcon()}
      </div>
    </Avatar.Fallback>
  </Avatar.Root>
{:else}
  <div
    class="flex items-center justify-center shrink-0 text-muted-foreground {className}"
    style:width="{size}px"
    style:height="{size}px"
  >
    {@render fallbackIcon()}
  </div>
{/if}

{#snippet fallbackIcon()}
  {#if monogram}
    <!-- The airline's code, when there's no logo to show. -->
    <span
      class="flex size-full items-center justify-center rounded-[22%] bg-muted font-semibold tracking-tight text-muted-foreground ring-1 ring-border/60"
      style:font-size="{Math.max(
        8,
        size * (monogram.length > 2 ? 0.3 : 0.36),
      )}px"
      title={airline?.name}
    >
      {monogram}
    </span>
  {:else if fallback === 'plane'}
    <Plane size={size * 0.7} />
  {:else}
    <Airlines size={size * 0.8} />
  {/if}
{/snippet}
