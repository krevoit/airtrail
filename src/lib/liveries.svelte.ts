// Airline livery images (static/liveries, from scripts/data/generate-liveries.js).
// The index is split by the first character of the airline's ICAO code and
// fetched on demand.

type AirlineLiveries = {
  /** Image per aircraft type. */
  t: Record<string, string>;
  /** Special schemes per registration (no hyphen). */
  r?: Record<string, string>;
  /** The airline on an unspecified aircraft. */
  g?: string;
};

type Shard = Record<string, AirlineLiveries>;

const shards = $state<Record<string, Shard>>({});
// Only remembers what has been asked for; nothing renders from it.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const requested = new Set<string>();

const loadShard = (key: string) => {
  if (requested.has(key)) return;
  requested.add(key);
  fetch(`/liveries/index/${encodeURIComponent(key)}.json`)
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}))
    .then((shard: Shard) => {
      shards[key] = shard;
    });
};

// Types close enough that one stands in for another when an airline's exact
// type has no image.
const FAMILIES = [
  ['B738', 'B38M', 'B737', 'B37M', 'B739', 'B39M', 'B3XM', 'B736'],
  ['A320', 'A20N', 'A321', 'A21N', 'A319', 'A19N', 'A318'],
  ['A332', 'A333', 'A339', 'A338'],
  ['A359', 'A35K'],
  ['B789', 'B788', 'B78X'],
  ['B77W', 'B773', 'B772', 'B77L', 'B779', 'B778'],
  ['B744', 'B748', 'B74S'],
  ['B763', 'B762', 'B764'],
  ['B752', 'B753'],
  ['E190', 'E195', 'E75L', 'E75S', 'E170', 'E290', 'E295'],
  ['BCS3', 'BCS1'],
  ['AT76', 'AT75', 'AT72', 'AT45', 'AT46', 'AT43'],
  ['DH8D', 'DH8C', 'DH8B', 'DH8A'],
  ['CRJ9', 'CRJ7', 'CRJX', 'CRJ2'],
  ['A343', 'A346', 'A345', 'A342'],
];

const relative = (types: Record<string, string>, type: string) => {
  const family = FAMILIES.find((members) => members.includes(type));
  const match = family?.find((member) => types[member]);
  return match ? types[match] : undefined;
};

/**
 * URL of the livery image for an airline, aircraft type and registration;
 * null when there is none, undefined while the index is loading.
 */
export const liveryUrl = (
  airlineIcao: string | null | undefined,
  typeIcao: string | null | undefined,
  registration?: string | null,
): string | null | undefined => {
  const code = airlineIcao?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{3}$/.test(code)) return null;
  const key = code[0]!;
  const shard = shards[key];
  if (!shard) {
    loadShard(key);
    return undefined;
  }
  const entry = shard[code];
  if (!entry) return null;
  const reg = registration?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const type = typeIcao?.trim().toUpperCase();
  const file =
    (reg && entry.r?.[reg]) ||
    (type && (entry.t[type] ?? relative(entry.t, type))) ||
    entry.g;
  return file ? `/liveries/${file}.webp` : null;
};
