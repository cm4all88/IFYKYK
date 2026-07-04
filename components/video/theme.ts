import {serifFamily, sansFamily} from './fonts';

// Spotlightly visual system: dark near-black stage, gold spotlight accent, light text.
// Matches the brand (deep black backgrounds, gold #F2B84B, Cormorant serif, DM Sans).
export const theme = {
  colors: {
    bg: '#101114',
    ink: '#F3F3F1',        // primary text (light on dark)
    sub: '#9C9CA8',        // secondary text
    gold: '#F2B84B',
    goldDeep: '#C68A12',
    line: 'rgba(255,255,255,0.10)',
    cardBg: '#191A20',     // dark surface cards
    shadow: '0 40px 90px rgba(0,0,0,0.55)',
    shadowSoft: '0 18px 50px rgba(0,0,0,0.42)',
  },
  font: {serif: serifFamily, sans: sansFamily},
  radius: 36,
} as const;
