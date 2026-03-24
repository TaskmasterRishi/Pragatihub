-- Chat media support for community chat
-- 1) Adds media columns to community_chat_messages
-- 2) Ensures chat_media bucket exists
-- 3) Adds anon storage policies for insert/delete/select in chat_media

alter table if exists public.community_chat_messages
  add column if not exists media_type text,
  add column if not exists media_url text;

alter table if exists public.community_chat_messages
  alter column media_type set default 'text';

update public.community_chat_messages
set media_type = coalesce(media_type, 'text')
where media_type is null;

insert into storage.buckets (id, name, public)
values ('chat_media', 'chat_media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "chat_media_anon_select" on storage.objects;
create policy "chat_media_anon_select"
on storage.objects
for select
to anon
using (bucket_id = 'chat_media');

drop policy if exists "chat_media_anon_insert" on storage.objects;
create policy "chat_media_anon_insert"
on storage.objects
for insert
to anon
with check (bucket_id = 'chat_media');

drop policy if exists "chat_media_anon_delete" on storage.objects;
create policy "chat_media_anon_delete"
on storage.objects
for delete
to anon
using (bucket_id = 'chat_media');

