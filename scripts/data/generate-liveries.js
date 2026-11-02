#!/usr/bin/env node
// Builds the small airline livery images shown next to flights.
//
// Source: the operator flags of rikgale/VRSOperatorFlags (GPL-3.0), side views
// of aircraft in airline paint, 85x20 px, named by airline and aircraft type:
// `QFA-B738` (Qantas 737-800), `ASL-A332YU-ARB` (one airframe's special
// scheme), or `QFA` (the airline, any type).
//
// Outputs:
//   static/liveries/<NAME>.webp   lossless images
//   static/liveries/index/<C>.json airlines whose code starts with C:
//                                 { [ICAO]: { t: {type: file},
//                                   r: {registration: file}, g: file } }
//
// Requires `unzip` on PATH.

import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';

const COMMIT = 'c4b208370081e849af3106b6e1d78b5140b28a97';
const SOURCE_URL = `https://github.com/rikgale/VRSOperatorFlags/raw/${COMMIT}/OperatorFlags.zip`;
const WORK_DIR = join(tmpdir(), 'airtrail-liveries');
const OUTPUT_DIR = join(process.cwd(), 'static/liveries');

/** Uncompressed BMP (1, 4, 8, 24 or 32 bit) to raw RGB. */
const decodeBmp = (buffer) => {
  const offset = buffer.readUInt32LE(10);
  const headerSize = buffer.readUInt32LE(14);
  const width = buffer.readInt32LE(18);
  const rawHeight = buffer.readInt32LE(22);
  const bits = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);
  if (compression !== 0 && compression !== 3) {
    throw new Error(`Unsupported BMP compression (${compression})`);
  }
  const height = Math.abs(rawHeight);
  const stride = Math.ceil((width * bits) / 32) * 4;
  let palette = null;
  if (bits <= 8) {
    const colours = buffer.readUInt32LE(46) || 1 << bits;
    palette = [];
    for (let index = 0; index < colours; index++) {
      const at = 14 + headerSize + index * 4;
      palette.push([buffer[at + 2], buffer[at + 1], buffer[at]]);
    }
  }
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    const row = offset + (rawHeight > 0 ? height - 1 - y : y) * stride;
    for (let x = 0; x < width; x++) {
      let rgb;
      if (palette) {
        const bit = x * bits;
        const byte = buffer[row + (bit >> 3)];
        const shift = 8 - bits - (bit & 7);
        rgb = palette[(byte >> shift) & ((1 << bits) - 1)] ?? [255, 255, 255];
      } else {
        const at = row + x * (bits / 8);
        rgb = [buffer[at + 2], buffer[at + 1], buffer[at]];
      }
      out.set(rgb, (y * width + x) * 3);
    }
  }
  return { width, height, out };
};

rmSync(WORK_DIR, { recursive: true, force: true });
mkdirSync(WORK_DIR, { recursive: true });
console.log('Downloading operator flags…');
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
writeFileSync(
  join(WORK_DIR, 'flags.zip'),
  Buffer.from(await response.arrayBuffer()),
);
execFileSync('unzip', ['-q', '-j', '-o', 'flags.zip', '-d', 'flags'], {
  cwd: WORK_DIR,
});

const files = readdirSync(join(WORK_DIR, 'flags')).filter((file) =>
  /\.bmp$/i.test(file),
);
const names = new Map(
  files.map((file) => [file.replace(/\.bmp$/i, '').toUpperCase(), file]),
);

// Aircraft types are learned from the plain `AAA-TYPE` names, then used to
// split the type from a registration in the special ones.
const types = new Set();
for (const name of names.keys()) {
  const match = /^[A-Z0-9]{3}-([A-Z0-9]{2,4})$/.exec(name);
  if (match) types.add(match[1]);
}

const index = {};
const keep = new Map();
const entry = (airline) => (index[airline] ??= { t: {} });

for (const name of names.keys()) {
  // Skips stray copies such as `EWG-A320 - COPY`.
  if (!/^[A-Z0-9-]+$/.test(name)) continue;
  if (/^[A-Z]{3}$/.test(name)) {
    entry(name).g = name;
    keep.set(name, names.get(name));
    continue;
  }
  const match = /^([A-Z0-9]{3})-(.+)$/.exec(name);
  if (!match) continue;
  const [, airline, rest] = match;
  if (types.has(rest)) {
    entry(airline).t[rest] = name;
    keep.set(name, names.get(name));
    continue;
  }
  // A special scheme: the longest known type, then a registration.
  const type = [4, 3, 2]
    .map((length) => rest.slice(0, length))
    .find((candidate) => types.has(candidate));
  if (!type) continue;
  const registration = rest.slice(type.length).replace(/[^A-Z0-9]/g, '');
  // Alliance and anniversary codes (SA, OW, 75) aren't registrations.
  if (registration.length < 4 || !/[A-Z]/.test(registration)) continue;
  (entry(airline).r ??= {})[registration] = name;
  keep.set(name, names.get(name));
}

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });
let bytes = 0;
let count = 0;
for (const [name, file] of keep) {
  const { width, height, out } = decodeBmp(
    readFileSync(join(WORK_DIR, 'flags', file)),
  );
  const webp = await sharp(out, { raw: { width, height, channels: 3 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  writeFileSync(join(OUTPUT_DIR, `${name}.webp`), webp);
  bytes += webp.length;
  count++;
}
// The index is split by the airline code's first character, so a page only
// downloads the few small parts it needs.
const shards = {};
for (const [airline, value] of Object.entries(index)) {
  (shards[airline[0]] ??= {})[airline] = value;
}
mkdirSync(join(OUTPUT_DIR, 'index'), { recursive: true });
for (const [key, value] of Object.entries(shards)) {
  writeFileSync(
    join(OUTPUT_DIR, 'index', `${key}.json`),
    JSON.stringify(value),
  );
}

console.log(
  `Wrote ${count} liveries for ${Object.keys(index).length} airlines (${Math.round(bytes / 1024)} KB)`,
);
