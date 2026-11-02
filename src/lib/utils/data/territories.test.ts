import { describe, expect, it } from 'vitest';

import countryBounds from '../../../../static/countries-bounds.json';

import { TERRITORIES } from '$lib/data/territories';
import {
  isKnownCountryCode,
  isKnownVisitedPlaceCode,
  visitedPlaceFromCode,
} from '$lib/utils/data/countries';

describe('disputed territories', () => {
  it('can be marked but are not countries', () => {
    expect(isKnownVisitedPlaceCode('XH')).toBe(true);
    expect(isKnownCountryCode('XH')).toBe(false);
    expect(visitedPlaceFromCode('XD')).toMatchObject({
      name: 'Arunachal Pradesh',
      kind: 'territory',
    });
    expect(visitedPlaceFromCode('IN')?.kind).toBe('country');
  });

  it('all have a shape on the country map', () => {
    for (const territory of TERRITORIES) {
      expect(countryBounds, territory.code).toHaveProperty(territory.code);
      expect(isKnownCountryCode(territory.code), territory.code).toBe(false);
    }
  });
});
