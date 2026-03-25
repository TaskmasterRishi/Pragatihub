-- Private one-to-one chat schema
create extension if not exists pgcrypto;

create table if not exists public.private_chats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz
);

create table if not exists public.private_chat_participants (
  chat_id uuid not null references public.private_chats(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table if not exists public.private_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.private_chats(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  content text not null default '',
  media_type text,
  media_url text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'private_chat_messages'
  ) then
    alter publication supabase_realtime add table public.private_chat_messages;
  end if;
end
$$;

create index if not exists idx_private_chat_participants_user_id
  on public.private_chat_participants(user_id);

create index if not exists idx_private_chat_messages_chat_created
  on public.private_chat_messages(chat_id, created_at);

create index if not exists idx_private_chats_last_message_at
  on public.private_chats(last_message_at desc nulls last);

alter table public.private_chats enable row level security;
alter table public.private_chat_participants enable row level security;
alter table public.private_chat_messages enable row level security;

drop policy if exists "participants_read_own_chats" on public.private_chat_participants;
create policy "participants_read_own_chats"
on public.private_chat_participants
for select
using (user_id = requesting_user_id());

drop policy if exists "participants_insert_self" on public.private_chat_participants;
create policy "participants_insert_self"
on public.private_chat_participants
for insert
with check (user_id = requesting_user_id());

drop policy if exists "chats_visible_to_participants" on public.private_chats;
create policy "chats_visible_to_participants"
on public.private_chats
for select
using (
  exists (
    select 1
    from public.private_chat_participants p
    where p.chat_id = private_chats.id
      and p.user_id = requesting_user_id()
  )
);

drop policy if exists "chats_create_any_authenticated" on public.private_chats;
create policy "chats_create_any_authenticated"
on public.private_chats
for insert
with check (requesting_user_id() is not null);

drop policy if exists "chats_update_participants_only" on public.private_chats;
create policy "chats_update_participants_only"
on public.private_chats
for update
using (
  exists (
    select 1
    from public.private_chat_participants p
    where p.chat_id = private_chats.id
      and p.user_id = requesting_user_id()
  )
)
with check (
  exists (
    select 1
    from public.private_chat_participants p
    where p.chat_id = private_chats.id
      and p.user_id = requesting_user_id()
  )
);

drop policy if exists "messages_read_participants_only" on public.private_chat_messages;
create policy "messages_read_participants_only"
on public.private_chat_messages
for select
using (
  exists (
    select 1
    from public.private_chat_participants p
    where p.chat_id = private_chat_messages.chat_id
      and p.user_id = requesting_user_id()
  )
);

drop policy if exists "messages_insert_participants_only" on public.private_chat_messages;
create policy "messages_insert_participants_only"
on public.private_chat_messages
for insert
with check (
  user_id = requesting_user_id()
  and exists (
    select 1
    from public.private_chat_participants p
    where p.chat_id = private_chat_messages.chat_id
      and p.user_id = requesting_user_id()
  )
);
