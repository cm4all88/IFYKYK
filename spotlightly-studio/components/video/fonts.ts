import {loadFont as loadCormorant} from '@remotion/google-fonts/CormorantGaramond';
import {loadFont as loadInter} from '@remotion/google-fonts/Inter';

// Cormorant Garamond is the locked Spotlightly brand serif (the logo + serif accents).
// Inter is the clean modern sans for headlines and UI. To match the brand brief exactly
// you can swap Inter for PlusJakartaSans (also in @remotion/google-fonts).
export const {fontFamily: serifFamily} = loadCormorant('normal', {
  weights: ['300', '400', '500', '600'],
  subsets: ['latin'],
});

export const {fontFamily: sansFamily} = loadInter('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});
