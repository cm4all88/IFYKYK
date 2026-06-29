// Spotlightly reel music library.
//
// LICENSING NOTE (read before adding tracks):
// Reels are rendered into an MP4 that the creator then posts on their own channel.
// That means the music must be licensed ON THE TRACK, not tied to one account or
// channel. Channel-whitelist subscriptions (Epidemic Sound, Uppbeat, Artlist) do
// NOT cover a video posted by a different creator, so they are the wrong fit for a
// shared library. Use track-licensed sources instead:
//   . Pixabay Music  (Pixabay License: commercial, no attribution, no channel tie)
//   . Mixkit         (Mixkit License: commercial, no attribution)
// Keep each track's license receipt on file.
//
// WORKFLOW to add a track:
//   1. Download the MP3 from Pixabay or Mixkit.
//   2. Upload it to Bunny CDN (same place as your other media).
//   3. Add an entry below with its public url and a genre from MUSIC_GENRES.
// Both the admin Video Studio and (later) the creator-facing generator read this
// list, so anything added here becomes pickable everywhere.

export type MusicGenre =
  | 'modernPop'
  | 'lifestyle'
  | 'upbeat'
  | 'emotional'
  | 'cinematic'
  | 'documentary';

export const MUSIC_GENRES: {id: MusicGenre; label: string}[] = [
  {id: 'modernPop', label: 'Modern Pop'},
  {id: 'lifestyle', label: 'Lifestyle'},
  {id: 'upbeat', label: 'Upbeat'},
  {id: 'emotional', label: 'Emotional'},
  {id: 'cinematic', label: 'Cinematic'},
  {id: 'documentary', label: 'Documentary'},
];

export interface MusicTrack {
  id: string;          // stable unique id, e.g. "upbeat-sunny-days"
  title: string;       // shown in the picker
  genre: MusicGenre;
  url: string;         // public Bunny CDN url to the mp3
  source?: string;     // where it came from, for your records (e.g. "Pixabay")
  volume?: number;     // optional per-track base volume 0..1 (default 0.6)
}

// Add your hosted, licensed tracks here. Example shape (delete the example, it has
// no real url):
//   {id: 'upbeat-golden-hour', title: 'Golden Hour', genre: 'upbeat',
//    url: 'https://spotlightly.b-cdn.net/music/golden-hour.mp3', source: 'Pixabay'},
// AI-GENERATED TRACKS BELOW: these were made with an AI music tool. Confirm that
// tool's terms actually grant commercial use AND allow the audio to be reposted by a
// third party (your creators), since the reels get baked into MP4s creators publish on
// their own channels. AI-music licensing and ownership are still unsettled, so keep the
// generator's commercial-use receipt on file the same way you would for Pixabay.
// Genres are a first guess from tempo and loudness. Listen and change `genre` to match
// how each one actually sounds.
export const MUSIC_LIBRARY: MusicTrack[] = [
  {id: 'spotlight-drift-1', title: 'Drift (take 1)', genre: 'lifestyle', url: 'https://spotlightly.b-cdn.net/music/spotlight-drift-1.mp3', source: 'AI generated (confirm license)', volume: 0.6},
  {id: 'spotlight-drift-2', title: 'Drift (take 2)', genre: 'lifestyle', url: 'https://spotlightly.b-cdn.net/music/spotlight-drift-2.mp3', source: 'AI generated (confirm license)', volume: 0.6},
  {id: 'spotlight-pulse-1', title: 'Pulse (take 1)', genre: 'upbeat', url: 'https://spotlightly.b-cdn.net/music/spotlight-pulse-1.mp3', source: 'AI generated (confirm license)', volume: 0.55},
  {id: 'spotlight-pulse-2', title: 'Pulse (take 2)', genre: 'upbeat', url: 'https://spotlightly.b-cdn.net/music/spotlight-pulse-2.mp3', source: 'AI generated (confirm license)', volume: 0.55},
];

export const tracksByGenre = (genre: MusicGenre | 'all'): MusicTrack[] =>
  genre === 'all' ? MUSIC_LIBRARY : MUSIC_LIBRARY.filter((t) => t.genre === genre);
