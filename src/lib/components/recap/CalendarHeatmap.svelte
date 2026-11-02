<script lang="ts">
  import { SHORT_MONTHS } from '$lib/data/datetime';
  import { dayKey } from '$lib/stats/recap';
  import { pluralize } from '$lib/utils';

  let {
    year,
    days,
  }: {
    year: number;
    /** Flights per `YYYY-MM-DD`. */
    days: Record<string, number>;
  } = $props();

  const CELL = 11;
  const GAP = 3;
  const STEP = CELL + GAP;
  const LEFT = 30;
  const TOP = 16;
  const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

  // Weeks run Monday to Sunday, as columns.
  const cells = $derived.by(() => {
    const first = new Date(year, 0, 1);
    const offset = (first.getDay() + 6) % 7;
    const list: { key: string; week: number; weekday: number; date: Date }[] =
      [];
    const length = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
    for (let index = 0; index < length; index++) {
      const date = new Date(year, 0, 1 + index);
      list.push({
        key: dayKey(date),
        week: Math.floor((index + offset) / 7),
        weekday: (date.getDay() + 6) % 7,
        date,
      });
    }
    return list;
  });
  const weeks = $derived((cells.at(-1)?.week ?? 52) + 1);
  const months = $derived(
    SHORT_MONTHS.map((label, month) => ({
      label,
      week:
        cells.find(
          (cell) => cell.date.getMonth() === month && cell.date.getDate() === 1,
        )?.week ?? 0,
    })),
  );
  const most = $derived(Math.max(1, ...Object.values(days)));
  const level = (count: number) =>
    count === 0 ? 0 : Math.min(4, Math.ceil((count / most) * 4));
  const OPACITY = [0, 0.3, 0.55, 0.8, 1];
  const label = (date: Date, count: number) =>
    `${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}: ${count ? `${count} ${pluralize(count, 'flight')}` : 'no flights'}`;
</script>

<div class="overflow-x-auto">
  <svg
    viewBox="0 0 {LEFT + weeks * STEP} {TOP + 7 * STEP}"
    class="w-full min-w-[640px]"
    role="img"
    aria-label="Days with flights in {year}"
  >
    {#each months as month (month.label)}
      <text
        x={LEFT + month.week * STEP}
        y="10"
        class="fill-muted-foreground text-[9px]">{month.label}</text
      >
    {/each}
    {#each WEEKDAYS as weekday, index (index)}
      {#if weekday}
        <text
          x="0"
          y={TOP + index * STEP + CELL - 2}
          class="fill-muted-foreground text-[9px]">{weekday}</text
        >
      {/if}
    {/each}
    {#each cells as cell (cell.key)}
      {@const count = days[cell.key] ?? 0}
      <rect
        x={LEFT + cell.week * STEP}
        y={TOP + cell.weekday * STEP}
        width={CELL}
        height={CELL}
        rx="2.5"
        class={count ? 'fill-primary' : 'fill-muted'}
        fill-opacity={count ? OPACITY[level(count)] : 1}
      >
        <title>{label(cell.date, count)}</title>
      </rect>
    {/each}
  </svg>
</div>
<div
  class="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground"
>
  Fewer
  {#each OPACITY as opacity, index (index)}
    <span
      class={['size-2.5 rounded-[2.5px]', index ? 'bg-primary' : 'bg-muted']}
      style:opacity={index ? opacity : 1}
    ></span>
  {/each}
  More
</div>
