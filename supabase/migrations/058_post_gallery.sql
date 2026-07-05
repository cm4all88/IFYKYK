-- 058_post_gallery.sql
-- Let one post hold an ordered gallery of media (images and videos), with no cap.
-- Backward compatible: the existing single media_url stays as the cover (first item),
-- and media_urls holds the full ordered list as [{ "url": "...", "type": "image|video" }].

alter table public.posts
  add column if not exists media_urls jsonb;

-- Backfill existing single-media posts into the array shape so old and new posts render
-- the same way.
update public.posts
   set media_urls = jsonb_build_array(jsonb_build_object('url', media_url, 'type', coalesce(nullif(media_type, 'gallery'), 'image')))
 where media_url is not null
   and media_urls is null;
