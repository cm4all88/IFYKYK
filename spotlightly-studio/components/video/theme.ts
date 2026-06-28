import {serifFamily, sansFamily} from './fonts';

// Spotlightly visual system: clean warm-white stage, gold spotlight accent, ink text.
export const theme = {
  colors: {
    bg: '#FBFAF7',
    ink: '#17181B',
    sub: '#6E6E76',
    gold: '#F0B429',
    goldDeep: '#C68A12',
    line: 'rgba(23,24,27,0.08)',
    cardBg: '#FFFFFF',
    shadow: '0 40px 90px rgba(23,24,27,0.13)',
    shadowSoft: '0 18px 50px rgba(23,24,27,0.10)',
  },
  font: {serif: serifFamily, sans: sansFamily},
  radius: 36,
} as const;
