import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({ db: {} }));

import {
  countryOfSubdivision,
  placesAtPoints,
  subdivisionCounts,
  subdivisionsOfCountry,
} from './visited-subdivisions';

describe('subdivision catalog', () => {
  it('lists the top-level divisions people expect', () => {
    expect(subdivisionsOfCountry('IN')).toHaveLength(36);
    expect(subdivisionsOfCountry('GB').map((item) => item.code)).toEqual([
      'GB-ENG',
      'GB-NIR',
      'GB-SCT',
      'GB-WLS',
    ]);
    expect(subdivisionCounts().US).toBe(51);
  });

  it('keeps names unique within a country', () => {
    for (const country of Object.keys(subdivisionCounts())) {
      const names = subdivisionsOfCountry(country).map((item) => item.name);
      expect(new Set(names).size, country).toBe(names.length);
    }
  });

  it('assigns Crimea to Ukraine', () => {
    expect(countryOfSubdivision('UA-43')).toBe('UA');
  });
});

describe('placesAtPoints', () => {
  it('finds subdivisions and disputed territories of airports', async () => {
    const places = await placesAtPoints([
      { lon: 77.7066, lat: 13.1986 }, // BLR
      { lon: 74.7742, lat: 33.9871 }, // SXR
      { lon: 91.8594, lat: 27.5861 }, // Tawang
      { lon: -0.4543, lat: 51.47 }, // LHR
    ]);

    expect([...places.subdivisions].sort()).toEqual([
      'GB-ENG',
      'IN-AR',
      'IN-JK',
      'IN-KA',
    ]);
    expect([...places.territories].sort()).toEqual(['XD', 'XH']);
  });
});
