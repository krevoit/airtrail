import { describe, expect, it } from 'vitest';

import { formatRegistration } from './registration';

describe('formatRegistration', () => {
  it('adds the hyphen after the country prefix', () => {
    expect(formatRegistration('VHYIL')).toBe('VH-YIL');
    expect(formatRegistration('9vsmf')).toBe('9V-SMF');
    expect(formatRegistration('GEUUA')).toBe('G-EUUA');
    expect(formatRegistration('B1234')).toBe('B-1234');
  });

  it('leaves registrations without a hyphen as they are written', () => {
    expect(formatRegistration('N285AM')).toBe('N285AM');
    expect(formatRegistration('JA8089')).toBe('JA8089');
    expect(formatRegistration('VH-YIL')).toBe('VH-YIL');
  });
});
