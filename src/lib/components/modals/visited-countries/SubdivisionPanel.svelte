<script lang="ts">
  import { ArrowLeft, Ellipsis, Search } from '@o7/icon/lucide';
  import { SvelteSet } from 'svelte/reactivity';
  import { toast } from 'svelte-sonner';

  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Input } from '$lib/components/ui/input';
  import type { VisitedCountryStatus } from '$lib/db/types';
  import { api, trpc } from '$lib/trpc';
  import { cn } from '$lib/utils';
  import { visitedPlaceFromCode } from '$lib/utils/data/countries';

  type Status = (typeof VisitedCountryStatus)[number];
  type Subdivision = {
    code: string;
    name: string;
    bounds: [number, number, number, number];
  };

  let {
    country,
    subdivisions,
    visited,
    statusColors,
    onBack,
    onEdit,
    onFocus,
  }: {
    country: string;
    subdivisions: Subdivision[] | null;
    visited: { code: string; status: Status; note: string | null }[];
    statusColors: Record<Status, string>;
    onBack: () => void;
    onEdit: (subdivision: Subdivision) => void;
    onFocus: (subdivision: Subdivision) => void;
  } = $props();

  const countryName = $derived(visitedPlaceFromCode(country)?.name ?? country);
  const statusByCode = $derived(
    new Map(visited.map((entry) => [entry.code, entry.status])),
  );

  let query = $state('');
  const filtered = $derived.by(() => {
    const list = subdivisions ?? [];
    const needle = query.trim().toLocaleLowerCase();
    return needle
      ? list.filter((item) => item.name.toLocaleLowerCase().includes(needle))
      : list;
  });

  const visitedCount = $derived(
    (subdivisions ?? []).filter((item) => {
      const status = statusByCode.get(item.code);
      return status === 'visited' || status === 'lived';
    }).length,
  );
  const total = $derived(subdivisions?.length ?? 0);

  const STATUS_LABELS: Record<Status, string> = {
    lived: 'Lived',
    visited: 'Visited',
    layover: 'Layover',
    wishlist: 'Wishlist',
  };

  const pending = new SvelteSet<string>();
  const toggle = async (item: Subdivision) => {
    if (pending.has(item.code)) return;
    pending.add(item.code);
    const current = statusByCode.get(item.code);
    try {
      await api.visitedCountries.saveSubdivision.mutate({
        code: item.code,
        status: current ? null : 'visited',
        note: null,
      });
      await Promise.all([
        trpc.visitedCountries.listSubdivisions.utils.invalidate(),
        trpc.visitedCountries.list.utils.invalidate(),
      ]);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to update ${item.name}`);
    } finally {
      pending.delete(item.code);
    }
  };
</script>

<aside
  class="absolute z-10 flex flex-col overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur max-md:inset-x-3 max-md:bottom-24 max-md:h-[42vh] md:left-3 md:top-16 md:bottom-24 md:w-80"
  aria-label="States and provinces of {countryName}"
>
  <header class="space-y-3 border-b p-3">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        class="size-8 shrink-0"
        onclick={onBack}
        aria-label="Back to world map"
      >
        <ArrowLeft size={18} />
      </Button>
      <div class="min-w-0">
        <h2 class="truncate font-semibold leading-tight">{countryName}</h2>
        <p class="text-xs text-muted-foreground">
          {visitedCount} of {total} visited
        </p>
      </div>
    </div>
    <div class="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        class="h-full rounded-full bg-primary transition-[width]"
        style:width="{total ? (visitedCount / total) * 100 : 0}%"
      ></div>
    </div>
    <div class="relative">
      <Search
        size={14}
        class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        bind:value={query}
        placeholder="Search"
        class="h-8 pl-8 text-sm"
        aria-label="Search states and provinces"
      />
    </div>
  </header>

  <ul class="flex-1 overflow-y-auto p-1.5">
    {#if subdivisions === null}
      <li class="p-3 text-sm text-muted-foreground">Loading…</li>
    {:else if filtered.length === 0}
      <li class="p-3 text-sm text-muted-foreground">No matches</li>
    {/if}
    {#each filtered as item (item.code)}
      {@const status = statusByCode.get(item.code)}
      <li
        class="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
      >
        <Checkbox
          checked={Boolean(status)}
          disabled={pending.has(item.code)}
          onCheckedChange={() => toggle(item)}
          aria-label="Visited {item.name}"
        />
        <button
          type="button"
          class="min-w-0 flex-1 truncate text-left text-sm"
          onclick={() => onFocus(item)}
        >
          {item.name}
        </button>
        {#if status}
          <span
            class="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
          >
            <span
              class="size-2 rounded-full"
              style:background-color={statusColors[status]}
            ></span>
            {STATUS_LABELS[status]}
          </span>
        {/if}
        <Button
          variant="ghost"
          size="icon"
          class={cn(
            'size-7 shrink-0 opacity-60 group-hover:opacity-100',
            !status && 'md:opacity-0',
          )}
          onclick={() => onEdit(item)}
          aria-label="Edit {item.name}"
        >
          <Ellipsis size={16} />
        </Button>
      </li>
    {/each}
  </ul>
</aside>
