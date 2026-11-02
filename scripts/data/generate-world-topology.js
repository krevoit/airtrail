#!/usr/bin/env node
// Builds the small world map the yearly recap draws as SVG (its globe, route
// map and share images).
//
// Output: src/lib/data/world-topology.json, a TopoJSON object `countries`
// with one feature per GISCO country, its id the same code the
// visited-countries map uses (ISO 3166-1 alpha-2, or X* for disputed areas).
//
// mapshaper is run through npx.

import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// The coarsest GISCO scale; it only has to read well at a few hundred pixels.
const SOURCE_URL =
  'https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_60M_2024_4326.geojson';
const MAPSHAPER = ['--yes', 'mapshaper@0.7.101'];

const WORK_DIR = join(tmpdir(), 'airtrail-world-topology');
const RAW = join(WORK_DIR, 'raw.geojson');
const OUTPUT = join(process.cwd(), 'src/lib/data/world-topology.json');

mkdirSync(WORK_DIR, { recursive: true });

console.log('Downloading GISCO countries…');
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
writeFileSync(RAW, await response.text());

console.log('Simplifying…');
await execFileAsync('npx', [
  ...MAPSHAPER,
  RAW,
  'name=countries',
  '-filter-fields',
  'CNTR_ID',
  '-rename-fields',
  'id=CNTR_ID',
  // Antarctica is mostly off the edge of every view and costs a lot of points.
  '-filter',
  "id !== 'AQ'",
  '-simplify',
  'visvalingam',
  'weighted',
  '8%',
  'keep-shapes',
  '-o',
  OUTPUT,
  'format=topojson',
  'id-field=id',
  'quantization=1e4',
  'force',
]);

console.log(`Wrote ${OUTPUT}`);
