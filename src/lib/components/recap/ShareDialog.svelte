<script lang="ts">
  import { Check, Copy, Download, LoaderCircle, Share } from '@o7/icon/lucide';
  import { mode } from 'mode-watcher';
  import { toast } from 'svelte-sonner';

  import {
    canCopyImages,
    canShareImages,
    copyBlob,
    downloadBlob,
    shareBlob,
    svgToPng,
  } from './export-image';
  import type { RecapTheme } from './palette';
  import RecapShareCard, { type ShareLayout } from './RecapShareCard.svelte';

  import { Button } from '$lib/components/ui/button';
  import { Modal } from '$lib/components/ui/modal';
  import * as Tabs from '$lib/components/ui/tabs';
  import type { Recap } from '$lib/stats/recap';

  let {
    open = $bindable(false),
    recap,
    name,
    title,
    subtitle,
    stats,
  }: {
    open?: boolean;
    recap: Recap;
    name: string;
    title: string;
    subtitle: string;
    stats: { label: string; value: string }[];
  } = $props();

  let layout = $state<ShareLayout>('summary');
  let theme = $state<RecapTheme>(mode.current === 'dark' ? 'dark' : 'light');
  let svg = $state<SVGSVGElement>();
  let busy = $state<'download' | 'share' | 'copy' | null>(null);
  let copied = $state(false);

  const filename = $derived(
    `airtrail-${title.toLowerCase().replace(/\s+/g, '-')}-${layout}.png`,
  );
  const shareable = canShareImages();
  const copyable = canCopyImages();

  const run = async (
    action: 'download' | 'share' | 'copy',
    work: (blob: Blob) => Promise<void> | void,
  ) => {
    if (!svg) return;
    busy = action;
    try {
      await work(await svgToPng(svg));
    } catch (error) {
      // Closing the share sheet isn't a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error(error);
      toast.error('Could not create the image');
    } finally {
      busy = null;
    }
  };
</script>

<Modal bind:open class="max-w-3xl">
  <div class="max-md:mb-2">
    <h2 class="text-lg font-bold">Share {title}</h2>
    <p class="text-sm text-muted-foreground">
      An image to post or send. Nothing leaves your device until you share it.
    </p>
  </div>
  <div class="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
    <div
      class="mx-auto w-full overflow-hidden rounded-lg border bg-muted"
      class:max-w-[300px]={layout === 'story'}
      class:max-w-[380px]={layout !== 'story'}
    >
      <RecapShareCard
        bind:svg
        {recap}
        {name}
        {title}
        {subtitle}
        {stats}
        {layout}
        {theme}
      />
    </div>
    <div class="flex flex-col gap-4">
      <div class="space-y-1.5">
        <div class="text-[13px] text-muted-foreground">Layout</div>
        <Tabs.Root bind:value={layout}>
          <Tabs.List class="w-full">
            <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
            <Tabs.Trigger value="map">Map</Tabs.Trigger>
            <Tabs.Trigger value="story">Story</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>
      <div class="space-y-1.5">
        <div class="text-[13px] text-muted-foreground">Theme</div>
        <Tabs.Root bind:value={theme}>
          <Tabs.List class="w-full">
            <Tabs.Trigger value="light">Light</Tabs.Trigger>
            <Tabs.Trigger value="dark">Dark</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
      </div>
      <div class="mt-auto flex flex-col gap-2">
        {#if shareable}
          <Button
            disabled={busy !== null}
            onclick={() =>
              run('share', (blob) => shareBlob(blob, filename, title))}
          >
            {#if busy === 'share'}
              <LoaderCircle size={16} class="animate-spin" />
            {:else}
              <Share size={16} />
            {/if}
            Share
          </Button>
        {/if}
        <Button
          variant={shareable ? 'outline' : 'default'}
          disabled={busy !== null}
          onclick={() =>
            run('download', (blob) => downloadBlob(blob, filename))}
        >
          {#if busy === 'download'}
            <LoaderCircle size={16} class="animate-spin" />
          {:else}
            <Download size={16} />
          {/if}
          Download PNG
        </Button>
        {#if copyable}
          <Button
            variant="outline"
            disabled={busy !== null}
            onclick={() =>
              run('copy', async (blob) => {
                await copyBlob(blob);
                copied = true;
                setTimeout(() => (copied = false), 2000);
              })}
          >
            {#if busy === 'copy'}
              <LoaderCircle size={16} class="animate-spin" />
            {:else if copied}
              <Check size={16} />
            {:else}
              <Copy size={16} />
            {/if}
            {copied ? 'Copied' : 'Copy image'}
          </Button>
        {/if}
      </div>
    </div>
  </div>
</Modal>
