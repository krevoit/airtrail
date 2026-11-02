// The app's theme colours (src/app.css), written out for drawing on canvas and
// for images exported as PNG, which can't read CSS variables.

export type RecapTheme = 'light' | 'dark';

export type Palette = {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  /** Sea, land and borders for maps, close to the app's light/dark basemaps. */
  water: string;
  land: string;
  landBorder: string;
  /** Countries reached in the period. */
  visited: string;
};

export const PALETTES: Record<RecapTheme, Palette> = {
  light: {
    background: '#ffffff',
    foreground: '#09090b',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    border: '#e4e4e7',
    primary: '#3b82f6',
    water: '#dfe6ee',
    land: '#fbfbfc',
    landBorder: '#d4d4d8',
    visited: '#c9dcfb',
  },
  dark: {
    background: '#09090b',
    foreground: '#fafafa',
    muted: '#27272a',
    mutedForeground: '#a1a1aa',
    border: '#27272a',
    primary: '#3b82f6',
    water: '#0b1018',
    land: '#2a2b31',
    landBorder: '#3f3f46',
    visited: '#1e3a6b',
  },
};

export const FONT = 'Public Sans, ui-sans-serif, system-ui, sans-serif';
