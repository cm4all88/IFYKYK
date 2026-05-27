-- Migration 027: Add video_url to marketplace_listings
alter table public.marketplace_listings
  add column if not exists video_url text;

comment on column public.marketplace_listings.video_url is
  'BunnyCDN CDN URL for video preview. Uploaded direct-to-CDN from browser.';
