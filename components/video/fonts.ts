import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadDMSans} from '@remotion/google-fonts/DMSans';

// Cormorant Garamond is the locked Spotlightly brand serif (the logo + serif accents).
// DM Sans is the brand body/UI sans.
export const {fontFamily: serifFamily} = loadCormorant('normal', {
  weights: ['300', '400', '500', '600'],
  subsets: ['latin'],
});

export const {fontFamily: sansFamily} = loadDMSans('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});
