create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  recipient_user_id text not null references public.users(id) on delete cascade,
  actor_user_id text references public.users(id) on delete set null,
  kind text not null,
  title text not null,
  body text not null default '',
  path text not null,
  is_read boolean not null default false,
  read_at timestamptz,
  source_table text,
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

create unique index if not exists notifications_source_dedupe_idx
  on public.notifications (recipient_user_id, source_table, source_record_id, kind)
  where source_table is not null and source_record_id is not null;

create or replace function public.notifications_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row
execute function public.notifications_set_updated_at();

create or replace function public.notify_on_chat_mention()
returns trigger
language plpgsql
as $$
declare
  actor_name text;
  group_name text;
  message_content text;
  preview text;
begin
  if new.mentioned_user_id = new.mentioned_by_user_id then
    return new;
  end if;

  select u.name into actor_name
  from public.users u
  where u.id = new.mentioned_by_user_id;

  select g.name into group_name
  from public.groups g
  where g.id = new.group_id;

  select m.content into message_content
  from public.community_chat_messages m
  where m.id = new.message_id;

  preview := trim(regexp_replace(coalesce(message_content, ''), '\s+', ' ', 'g'));
  if preview = '' then
    preview := coalesce(actor_name, 'Someone') || ' mentioned you in chat.';
  end if;
  if length(preview) > 180 then
    preview := left(preview, 179) || '...';
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    kind,
    title,
    body,
    path,
    source_table,
    source_record_id,
    metadata
  )
  values (
    new.mentioned_user_id,
    new.mentioned_by_user_id,
    'chat_mention',
    coalesce(actor_name, 'Someone') || ' mentioned you in ' || coalesce(group_name, 'community chat'),
    preview,
    '/community/' || new.group_id || '/chat',
    'community_chat_message_mentions',
    new.message_id,
    jsonb_build_object(
      'group_id', new.group_id,
      'message_id', new.message_id,
      'mention_text', new.mention_text
    )
  )
  on conflict (recipient_user_id, source_table, source_record_id, kind) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_chat_mention on public.community_chat_message_mentions;
create trigger trg_notify_on_chat_mention
after insert on public.community_chat_message_mentions
for each row
execute function public.notify_on_chat_mention();
