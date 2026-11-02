#!/usr/bin/env node
// Builds the state/province data used by the visited-countries map.
//
// Outputs:
//   static/subdivisions.pmtiles                 map tiles (layer `subdivisions`)
//   src/lib/server/data/subdivisions.json        per-country list with bounds
//   src/lib/server/data/visited-place-shapes.json
//       simplified shapes the server uses to find which subdivision (or
//       disputed territory) an airport lies in when filling from flights
//
// Requires tippecanoe on PATH. mapshaper is run through npx.

import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ADMIN1_SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson';
// Same world data set as generate-country-tiles.js; only its disputed
// territories (codes starting with X) are used here.
const GISCO_SOURCE_URL =
  'https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_01M_2024_4326.geojson';
const MAPSHAPER = ['--yes', 'mapshaper@0.7.101'];

const WORK_DIR = join(tmpdir(), 'airtrail-subdivisions');
const RAW_GEOJSON = join(WORK_DIR, 'raw.geojson');
const DISSOLVED_GEOJSON = join(WORK_DIR, 'dissolved.geojson');
const TERRITORY_GEOJSON = join(WORK_DIR, 'territories.geojson');
const LOOKUP_GEOJSON = join(WORK_DIR, 'lookup.geojson');
const OUTPUT_PMTILES = join(process.cwd(), 'static/subdivisions.pmtiles');
const OUTPUT_LIST = join(
  process.cwd(),
  'src/lib/server/data/subdivisions.json',
);
const OUTPUT_LOOKUP = join(
  process.cwd(),
  'src/lib/server/data/visited-place-shapes.json',
);

// Natural Earth splits some countries into hundreds of councils or
// municipalities. These are merged into the level people think of as a
// country's states or regions, keyed by the Natural Earth field to group on.
const GROUP_BY = {
  AZ: 'region',
  FR: 'region',
  GB: 'geonunit',
  IT: 'region',
  LV: 'region',
  MK: 'region',
  MT: 'region',
  PH: 'region',
  SI: 'region',
  UG: 'region',
};

// ISO 3166-2 codes for merged groups that have one. Other groups get a code
// derived from their name.
const GROUP_CODES = {
  FR: {
    'Auvergne-Rhône-Alpes': 'FR-ARA',
    'Bourgogne-Franche-Comté': 'FR-BFC',
    Bretagne: 'FR-BRE',
    'Centre-Val de Loire': 'FR-CVL',
    Corse: 'FR-20R',
    'Grand Est': 'FR-GES',
    Guadeloupe: 'FR-971',
    'Guyane française': 'FR-973',
    'Hauts-de-France': 'FR-HDF',
    Martinique: 'FR-972',
    Mayotte: 'FR-976',
    Normandie: 'FR-NOR',
    'Nouvelle-Aquitaine': 'FR-NAQ',
    Occitanie: 'FR-OCC',
    'Pays de la Loire': 'FR-PDL',
    "Provence-Alpes-Côte-d'Azur": 'FR-PAC',
    Réunion: 'FR-974',
    'Île-de-France': 'FR-IDF',
  },
  GB: {
    England: 'GB-ENG',
    'Northern Ireland': 'GB-NIR',
    Scotland: 'GB-SCT',
    Wales: 'GB-WLS',
  },
  IT: {
    Abruzzo: 'IT-65',
    Apulia: 'IT-75',
    Basilicata: 'IT-77',
    Calabria: 'IT-78',
    Campania: 'IT-72',
    'Emilia-Romagna': 'IT-45',
    'Friuli-Venezia Giulia': 'IT-36',
    Lazio: 'IT-62',
    Liguria: 'IT-42',
    Lombardia: 'IT-25',
    Marche: 'IT-57',
    Molise: 'IT-67',
    Piemonte: 'IT-21',
    Sardegna: 'IT-88',
    Sicily: 'IT-82',
    Toscana: 'IT-52',
    'Trentino-Alto Adige': 'IT-32',
    Umbria: 'IT-55',
    "Valle d'Aosta": 'IT-23',
    Veneto: 'IT-34',
  },
};

const GROUP_NAMES = {
  'FR-973': 'French Guiana',
  'FR-20R': 'Corsica',
};

// Natural Earth sometimes gives several units one ISO code. They are merged,
// and take the name of the largest unless one is set here.
const NAME_OVERRIDES = {
  'AR-B': 'Buenos Aires Province',
  'AR-C': 'Buenos Aires City',
  'BA-BIH': 'Federation of Bosnia and Herzegovina',
  'IE-D': 'Dublin',
  'MD-SN': 'Transnistria',
  'MG-A': 'Toamasina',
  'MG-D': 'Antsiranana',
  'MG-F': 'Fianarantsoa',
  'MG-M': 'Mahajanga',
  'MG-T': 'Antananarivo',
  'MG-U': 'Toliara',
  'PH-MNL': 'Metro Manila',
  'RU-AL': 'Altai Republic',
  'RU-ALT': 'Altai Krai',
  'US-DC': 'District of Columbia',
};

// Natural Earth assigns these to the country in control; AirTrail's country
// map follows ISO 3166.
const COUNTRY_OVERRIDES = {
  'UA-40': 'UA',
  'UA-43': 'UA',
};

const slug = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
    .slice(0, 24);

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  return response.json();
};

const subdivisionFeatures = (admin1) => {
  const features = [];
  for (const feature of admin1.features) {
    const p = feature.properties;
    const iso = p.iso_3166_2;
    // Natural Earth placeholders such as `-99-X06~`, `CU-99` and `MX-X01~`.
    if (!iso || iso.startsWith('-') || /-(99|X\d+~?)$/.test(iso)) continue;
    if (!/^[A-Z]{2}$/.test(p.iso_a2)) continue;

    const country = COUNTRY_OVERRIDES[iso] ?? p.iso_a2;
    const groupField = GROUP_BY[country];
    let code = iso;
    let name = p.name_en || p.name;
    if (groupField) {
      const group = p[groupField] || p.name;
      code = GROUP_CODES[country]?.[group] ?? `${country}-R-${slug(group)}`;
      name = GROUP_NAMES[code] ?? group;
    }

    features.push({
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        SUBDIVISION_CODE: code,
        COUNTRY_CODE: country,
        NAME: name,
        AREA: Number(p.area_sqkm) || 0,
        TYPE: groupField ? null : p.type_en,
      },
    });
  }

  // Give every part of a code the same name before the parts are merged.
  const best = new Map();
  for (const { properties } of features) {
    const current = best.get(properties.SUBDIVISION_CODE);
    if (!current || properties.AREA > current.AREA) {
      best.set(properties.SUBDIVISION_CODE, properties);
    }
  }
  for (const { properties } of features) {
    const code = properties.SUBDIVISION_CODE;
    properties.NAME = NAME_OVERRIDES[code] ?? best.get(code).NAME;
    properties.TYPE = best.get(code).TYPE;
  }

  // A city and the region around it often share a name (Kyiv, Minsk, Sofia);
  // tell them apart by type, then by code if the type is shared too.
  const disambiguate = (label) => {
    const byName = new Map();
    for (const [code, properties] of best) {
      const key = `${properties.COUNTRY_CODE}|${properties.NAME}`;
      byName.set(key, [...(byName.get(key) ?? []), code]);
    }
    const renamed = new Map();
    for (const codes of byName.values()) {
      if (codes.length < 2) continue;
      for (const code of codes) renamed.set(code, label(best.get(code), code));
    }
    for (const { properties } of features) {
      const name = renamed.get(properties.SUBDIVISION_CODE);
      if (name) properties.NAME = name;
    }
  };
  disambiguate((properties) =>
    properties.TYPE
      ? `${properties.NAME} (${properties.TYPE})`
      : properties.NAME,
  );
  disambiguate((properties, code) => `${properties.NAME} (${code})`);

  for (const { properties } of features) {
    delete properties.AREA;
    delete properties.TYPE;
  }

  return features;
};

const mapshaper = (args) =>
  execFileAsync('npx', [...MAPSHAPER, ...args], { maxBuffer: 1 << 26 });

const walkCoords = (coords, bounds) => {
  if (typeof coords[0] === 'number') {
    bounds[0] = Math.min(bounds[0], coords[0]);
    bounds[1] = Math.min(bounds[1], coords[1]);
    bounds[2] = Math.max(bounds[2], coords[0]);
    bounds[3] = Math.max(bounds[3], coords[1]);
    return;
  }
  for (const coord of coords) walkCoords(coord, bounds);
};

const round = (value) => Math.round(value * 1000) / 1000;

const writeList = (dissolved) => {
  const byCountry = {};
  for (const feature of dissolved.features) {
    const { SUBDIVISION_CODE, COUNTRY_CODE, NAME } = feature.properties;
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    walkCoords(feature.geometry.coordinates, bounds);
    (byCountry[COUNTRY_CODE] ??= []).push({
      code: SUBDIVISION_CODE,
      name: NAME,
      bounds: bounds.map(round),
    });
  }

  const sorted = Object.fromEntries(
    Object.keys(byCountry)
      .sort()
      .map((country) => [
        country,
        byCountry[country].sort((a, b) => a.name.localeCompare(b.name)),
      ]),
  );
  writeFileSync(OUTPUT_LIST, `${JSON.stringify(sorted)}\n`);
  return Object.values(sorted).reduce((sum, list) => sum + list.length, 0);
};

const main = async () => {
  try {
    await execFileAsync('tippecanoe', ['--version']);
  } catch {
    console.error('tippecanoe is required (apt install tippecanoe).');
    process.exit(1);
  }
  mkdirSync(WORK_DIR, { recursive: true });

  console.log('Downloading Natural Earth admin-1 and GISCO countries...');
  const [admin1, gisco] = await Promise.all([
    fetchJson(ADMIN1_SOURCE_URL),
    fetchJson(GISCO_SOURCE_URL),
  ]);

  writeFileSync(
    RAW_GEOJSON,
    JSON.stringify({
      type: 'FeatureCollection',
      features: subdivisionFeatures(admin1),
    }),
  );
  writeFileSync(
    TERRITORY_GEOJSON,
    JSON.stringify({
      type: 'FeatureCollection',
      features: gisco.features
        .filter((feature) => feature.properties.CNTR_ID?.startsWith('X'))
        .filter((feature) => feature.properties.CNTR_ID !== 'XK')
        .map((feature) => ({
          type: 'Feature',
          geometry: feature.geometry,
          properties: { TERRITORY_CODE: feature.properties.CNTR_ID },
        })),
    }),
  );

  console.log('Merging subdivisions...');
  await mapshaper([
    RAW_GEOJSON,
    '-dissolve2',
    'SUBDIVISION_CODE',
    'copy-fields=COUNTRY_CODE,NAME',
    '-o',
    'format=geojson',
    DISSOLVED_GEOJSON,
  ]);
  const dissolved = JSON.parse(readFileSync(DISSOLVED_GEOJSON, 'utf8'));

  console.log('Generating PMTiles...');
  await execFileAsync('tippecanoe', [
    '--force',
    '-o',
    OUTPUT_PMTILES,
    '-l',
    'subdivisions',
    '-Z2',
    '-z8',
    '--coalesce-densest-as-needed',
    '--simplify-only-low-zooms',
    '--detect-shared-borders',
    '-y',
    'SUBDIVISION_CODE',
    '-y',
    'COUNTRY_CODE',
    DISSOLVED_GEOJSON,
  ]);

  console.log('Generating lookup shapes...');
  await mapshaper([
    '-i',
    DISSOLVED_GEOJSON,
    TERRITORY_GEOJSON,
    'combine-files',
    '-merge-layers',
    'force',
    '-simplify',
    '10%',
    'keep-shapes',
    '-filter-fields',
    'SUBDIVISION_CODE,COUNTRY_CODE,TERRITORY_CODE',
    '-o',
    'format=geojson',
    'precision=0.001',
    LOOKUP_GEOJSON,
  ]);
  mkdirSync(join(process.cwd(), 'src/lib/server/data'), { recursive: true });
  writeFileSync(OUTPUT_LOOKUP, readFileSync(LOOKUP_GEOJSON));

  const count = writeList(dissolved);
  console.log(`Done: ${count} subdivisions.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
