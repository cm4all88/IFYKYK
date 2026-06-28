import {VideoData} from '../types';

// Default props shown in Remotion Studio. This is the template: copy it to a JSON
// file per creator (see data/bella.json) and render with --props to make new videos
// without touching code.
export const sampleData: VideoData = {
  creator: {
    name: 'Bella Reed',
    handle: '@bellasbrew',
    avatar: 'assets/bella/avatar.jpg',
    founding: true,
    tagline: 'Running Bella\u2019s Brew from a tiny vintage coffee trailer.',
  },
  intro: {headline: 'One place for your biggest supporters.'},
  cta: {
    headline: 'Turn followers into supporters.',
    sub: 'Your stage is waiting.',
    url: 'spotlightly.app',
  },
  profileScreenshot: 'assets/bella/profile.png',
  memberships: [
    {name: 'Regular', price: '$5', cadence: 'mo', perks: ['Secret menu drinks', 'Behind the scenes', 'Monthly recipes']},
    {name: 'Coffee Club', price: '$15', cadence: 'mo', perks: ['Exclusive recipes', 'Business lessons', 'Live classes'], featured: true},
  ],
  campaign: {title: 'Upgrade Our Espresso Bar', raised: '$1,500', goal: '$2,000', pct: 75, backers: 35},
  marketplace: [
    {title: "Bella's Brew Sticker", price: '$4', image: 'assets/bella/sticker.jpg'},
    {title: 'Recipe Cards Set', price: '$10', image: 'assets/bella/merch_mug.jpg'},
    {title: 'Brewing Guide', price: '$12', image: 'assets/bella/merch_tee.jpg'},
    {title: 'Drink Menu', price: '$8', image: 'assets/bella/sticker.jpg'},
  ],
  merch: [
    {name: 'Stand Mug', price: '$16', image: 'assets/bella/merch_mug.jpg'},
    {name: 'Steel Tumbler', price: '$24', image: 'assets/bella/merch_tumbler.jpg'},
    {name: 'Logo Tee', price: '$26', image: 'assets/bella/merch_tee.jpg'},
    {name: 'Beanie', price: '$22', image: 'assets/bella/merch_beanie.jpg'},
  ],
  // feedScreenshots: ['assets/bella/feed.png'], // add to enable the exclusive-posts scene
  // music: 'assets/music/track.mp3',
  // musicVolume: 0.6,
};
