<script lang="ts">
  import {
    ChevronRight,
    LoaderCircle,
    House,
    Gift,
    Plane,
  } from '@o7/icon/lucide';
  import { Tour } from '@o7/icon/material';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label';
  import { Modal } from '$lib/components/ui/modal';
  import type { VisitedCountryStatus } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import {
    countryFromAlpha2,
    type VisitedPlace,
    visitedPlaceFromCode,
  } from '$lib/utils/data/countries';

  let {
    open = $bindable(),
    editingInfo,
    subdivisionProgress = null,
    onExplore,
  }: {
    open: boolean;
    editingInfo: {
      code: string;
      status: (typeof VisitedCountryStatus)[number] | null;
      note: string | null;
      /** Set when editing a state or province rather than a country. */
      subdivision?: { name: string; country: string };
    } | null;
    /** Visited and total states/provinces of the country being edited. */
    subdivisionProgress?: { visited: number; total: number } | null;
    onExplore?: (country: string) => void;
  } = $props();

  const subdivision = $derived(editingInfo?.subdivision);

  let countryData = $state<VisitedPlace | undefined>(undefined);
  const claimants = $derived(
    (countryData?.claimants ?? [])
      .map((code) => countryFromAlpha2(code)?.name ?? code)
      .join(', '),
  );
  let status: (typeof VisitedCountryStatus)[number] | null = $state(null);
  let note: string = $state('');
  $effect(() => {
    if (!editingInfo) {
      status = null;
      note = '';
      return;
    }

    countryData = visitedPlaceFromCode(
      editingInfo.subdivision?.country ?? editingInfo.code,
    );
    status = editingInfo?.status;
    note = editingInfo.note ?? '';
  });

  let loading = $state(false);
  const save = async () => {
    if (!countryData || loading) return;

    loading = true;
    try {
      const success = subdivision
        ? await api.visitedCountries.saveSubdivision.mutate({
            code: editingInfo!.code,
            status,
            note: note || null,
          })
        : await api.visitedCountries.save.mutate({
            code: countryData.code,
            status,
            note: note ?? undefined,
          });
      if (success) {
        await Promise.all([
          trpc.visitedCountries.list.utils.invalidate(),
          trpc.visitedCountries.listSubdivisions.utils.invalidate(),
        ]);
        open = false;
      } else {
        toast.error('Failed to save');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save');
    } finally {
      loading = false;
    }
  };
</script>

<Modal
  bind:open
  dismissal="form"
  dirty={editingInfo?.status !== status || (editingInfo?.note ?? '') !== note}
  busy={loading}
  onDiscard={() => {
    status = editingInfo?.status ?? null;
    note = editingInfo?.note ?? '';
  }}
>
  <div class="max-md:mb-2">
    <h2 class="text-lg font-bold">{subdivision?.name ?? countryData?.name}</h2>
    {#if subdivision}
      <p class="text-sm text-muted-foreground">{countryData?.name}</p>
    {:else if countryData?.kind === 'territory'}
      <p class="text-sm text-muted-foreground">
        Disputed territory{claimants ? ` · ${claimants}` : ''}. Not counted as a
        country in statistics.
      </p>
    {/if}
  </div>
  <div class="grid grid-cols-2 gap-2">
    {@render statusRadioItem('visited', 'Visited')}
    {@render statusRadioItem('lived', 'Lived')}
    {@render statusRadioItem('wishlist', 'Wishlist')}
    {@render statusRadioItem('layover', 'Layover')}
  </div>
  {#if !subdivision && subdivisionProgress && onExplore}
    <Button
      variant="outline"
      class="justify-between"
      onclick={() => {
        open = false;
        onExplore(countryData!.code);
      }}
    >
      <span>States &amp; provinces</span>
      <span class="flex items-center gap-1 text-muted-foreground">
        {subdivisionProgress.visited}/{subdivisionProgress.total}
        <ChevronRight size={16} />
      </span>
    </Button>
  {/if}
  <Textarea
    bind:value={note}
    placeholder="Note"
    class="resize-y h-20 min-h-10 max-h-64 w-full mt-2"
  />
  <Button
    onclick={save}
    disabled={(editingInfo?.status === status && editingInfo?.note === note) ||
      (!status && !editingInfo?.status) ||
      loading}
  >
    {#if loading}
      <LoaderCircle size={16} class="animate-spin mr-2" />
    {/if}
    Save
  </Button>
</Modal>

{#snippet statusRadioItem(
  value: (typeof VisitedCountryStatus)[number],
  label: string,
)}
  <Label
    onclick={() => {
      if (status === value) {
        status = null;
      } else {
        status = value;
      }
    }}
    class={cn('w-full cursor-pointer', {
      '[&>div]:border-primary': value === status,
    })}
  >
    <div
      class="border-muted bg-popover hover:bg-accent items-center rounded-md border-2 p-4"
    >
      <div class="flex items-center justify-center gap-1">
        {#if value === 'lived'}
          <House class="w-6 h-6" />
        {:else if value === 'visited'}
          <Tour class="w-6 h-6" />
        {:else if value === 'wishlist'}
          <Gift class="w-6 h-6" />
        {:else if value === 'layover'}
          <Plane class="w-6 h-6" />
        {/if}
        <span class="text-2xl font-bold">{label}</span>
      </div>
    </div>
  </Label>
{/snippet}
