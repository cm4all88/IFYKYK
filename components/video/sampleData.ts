import {VideoData} from './types';

// In-app default. Uses structured cards and no local image files, so the preview
// is clean out of the box. Paste hosted (BunnyCDN) urls for real screenshots.
export const sampleData: VideoData = {
  creator: {name: 'Bella Reed', handle: '@bellasbrew', founding: true, tagline: 'Running a tiny vintage coffee trailer.'},
  intro: {headline: 'One place for your biggest supporters.'},
  cta: {headline: 'Turn followers into supporters.', sub: 'Your stage is waiting.', url: 'spotlightly.app'},
  memberships: [
    {name: 'Regular', price: '$5', cadence: 'mo', perks: ['Secret menu drinks', 'Behind the scenes', 'Monthly recipes']},
    {name: 'Coffee Club', price: '$15', cadence: 'mo', perks: ['Exclusive recipes', 'Business lessons', 'Live classes'], featured: true},
  ],
  campaign: {title: 'Upgrade Our Espresso Bar', raised: '$1,500', goal: '$2,000', pct: 75, backers: 35},
  marketplace: [
    {title: "Bella's Brew Sticker", price: '$4'},
    {title: 'Recipe Cards Set', price: '$10'},
    {title: 'Brewing Guide', price: '$12'},
    {title: 'Drink Menu', price: '$8'},
  ],
  merch: [
    {name: 'Stand Mug', price: '$16'},
    {name: 'Steel Tumbler', price: '$24'},
    {name: 'Logo Tee', price: '$26'},
    {name: 'Beanie', price: '$22'},
  ],
};
