<script lang="ts" module>
  export const STAMP_INKS = [
    '#b23a48',
    '#1d4e89',
    '#2a7f62',
    '#6a4c93',
    '#b5651d',
    '#2f5d62',
  ];

  /** Small stable hash so a country always gets the same stamp. */
  export const stampSeed = (value: string) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };
</script>

<script lang="ts">
  let {
    country,
    code,
    date,
    isNew = false,
    seed,
    class: className = '',
  }: {
    country: string;
    code: string;
    date: string;
    isNew?: boolean;
    seed: string;
    class?: string;
  } = $props();

  const hash = $derived(stampSeed(seed));
  const ink = $derived(STAMP_INKS[hash % STAMP_INKS.length]);
  const shape = $derived(
    (['circle', 'rect', 'oval'] as const)[(hash >>> 4) % 3],
  );
  const rotation = $derived(((hash >>> 8) % 25) - 12);
  const id = $derived(`stamp-${hash.toString(36)}`);
  const label = $derived(country.toUpperCase());
  const fitted = $derived(label.length > 18 ? `${label.slice(0, 17)}…` : label);
</script>

<svg
  viewBox="0 0 200 200"
  class={className}
  style:transform="rotate({rotation}deg)"
  role="img"
  aria-label="{country}, {code}, {date}{isNew ? ', first visit' : ''}"
>
  <defs>
    <path id="{id}-top" d="M 30 100 A 70 70 0 0 1 170 100" />
    <path id="{id}-bottom" d="M 22 100 A 78 78 0 0 0 178 100" />
    <filter id="{id}-rough">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.9"
        numOctaves="2"
        seed={hash % 100}
      />
      <feDisplacementMap in="SourceGraphic" scale="2.2" />
    </filter>
  </defs>

  <g
    fill="none"
    stroke={ink}
    color={ink}
    opacity="0.88"
    filter="url(#{id}-rough)"
  >
    {#if shape === 'circle'}
      <circle cx="100" cy="100" r="92" stroke-width="5" />
      <circle cx="100" cy="100" r="84" stroke-width="1.5" />
      <circle cx="100" cy="100" r="50" stroke-width="1.5" />
      <text
        fill="currentColor"
        stroke="none"
        font-family="ui-sans-serif, system-ui, sans-serif"
        font-weight="700"
        font-size="15"
        letter-spacing="2"
        text-anchor="middle"
      >
        <textPath href="#{id}-top" startOffset="50%">{fitted}</textPath>
      </text>
      <text
        fill="currentColor"
        stroke="none"
        font-family="ui-monospace, monospace"
        font-size="13"
        letter-spacing="2"
        text-anchor="middle"
      >
        <textPath href="#{id}-bottom" startOffset="50%">{date}</textPath>
      </text>
      <text
        x="100"
        y="112"
        fill="currentColor"
        stroke="none"
        font-family="ui-serif, Georgia, serif"
        font-weight="700"
        font-size="34"
        text-anchor="middle">{code}</text
      >
    {:else}
      {@const oval = shape === 'oval'}
      {#if oval}
        <ellipse cx="100" cy="100" rx="94" ry="66" stroke-width="5" />
        <ellipse cx="100" cy="100" rx="85" ry="58" stroke-width="1.5" />
      {:else}
        <rect x="14" y="38" width="172" height="124" rx="10" stroke-width="5" />
        <rect
          x="23"
          y="47"
          width="154"
          height="106"
          rx="6"
          stroke-width="1.5"
        />
      {/if}
      <text
        x="100"
        y="80"
        fill="currentColor"
        stroke="none"
        font-family="ui-sans-serif, system-ui, sans-serif"
        font-weight="700"
        font-size="14"
        letter-spacing="1.5"
        text-anchor="middle">{fitted}</text
      >
      <text
        x="100"
        y="118"
        fill="currentColor"
        stroke="none"
        font-family="ui-serif, Georgia, serif"
        font-weight="700"
        font-size="32"
        text-anchor="middle">{code}</text
      >
      <text
        x="100"
        y="140"
        fill="currentColor"
        stroke="none"
        font-family="ui-monospace, monospace"
        font-size="12"
        letter-spacing="2"
        text-anchor="middle">{date}</text
      >
    {/if}
    {#if isNew}
      <g transform="translate(146 30) rotate(18)">
        <rect
          x="-26"
          y="-11"
          width="52"
          height="22"
          rx="3"
          fill={ink}
          stroke="none"
        />
        <text
          y="5"
          fill="#fff"
          stroke="none"
          font-family="ui-sans-serif, system-ui, sans-serif"
          font-weight="800"
          font-size="12"
          letter-spacing="1.5"
          text-anchor="middle">NEW</text
        >
      </g>
    {/if}
  </g>
</svg>
