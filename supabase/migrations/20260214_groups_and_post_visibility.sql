-- Migration: Groups system, post visibility update, handle_new_user updates
-- Run this in your Supabase SQL Editor

-- ============================================================
-- 1. Create groups tables
-- ============================================================

create table if not exists public.groups (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#6366f1',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists idx_groups_owner on public.groups(owner_id);
create index if not exists idx_group_members_user on public.group_members(user_id);

-- ============================================================
-- 2. Add group_id to posts, update visibility constraint
-- ============================================================

alter table public.posts
  add column if not exists group_id uuid references public.groups(id) on delete set null;

create index if not exists idx_posts_group on public.posts(group_id);

-- Drop old constraint and add new one (close_friends → group)
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('personal', 'group', 'circle', 'public'));

-- Migrate any existing close_friends posts to group visibility
update public.posts set visibility = 'group' where visibility = 'close_friends';

-- ============================================================
-- 3. RLS on new tables
-- ============================================================

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Groups policies
create policy "Owners can view own groups"
  on public.groups for select using (auth.uid() = owner_id);

create policy "Owners can create groups"
  on public.groups for insert with check (auth.uid() = owner_id);

create policy "Owners can update own groups"
  on public.groups for update using (auth.uid() = owner_id);

create policy "Owners can delete non-default groups"
  on public.groups for delete using (auth.uid() = owner_id and is_default = false);

-- Group members policies
create policy "Group owners can view members"
  on public.group_members for select using (
    exists (select 1 from public.groups where id = group_id and owner_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "Group owners can add members"
  on public.group_members for insert with check (
    exists (select 1 from public.groups where id = group_id and owner_id = auth.uid())
  );

create policy "Group owners can remove members"
  on public.group_members for delete using (
    exists (select 1 from public.groups where id = group_id and owner_id = auth.uid())
  );

-- ============================================================
-- 4. Update posts select policy to include group visibility
-- ============================================================

drop policy if exists "Users can view posts in their circles" on public.posts;
create policy "Users can view posts in their circles"
  on public.posts for select using (
    visibility = 'public'
    or author_id = auth.uid()
    or (visibility = 'circle' and circle_id in (
      select circle_id from public.circle_memberships where user_id = auth.uid()
    ))
    or (visibility = 'group' and group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    ))
  );

-- Update media policy too
drop policy if exists "Media viewable with post access" on public.media;
create policy "Media viewable with post access"
  on public.media for select using (
    exists (
      select 1 from public.posts where id = post_id and (
        visibility = 'public'
        or author_id = auth.uid()
        or (visibility = 'circle' and circle_id in (
          select circle_id from public.circle_memberships where user_id = auth.uid()
        ))
        or (visibility = 'group' and group_id in (
          select group_id from public.group_members where user_id = auth.uid()
        ))
      )
    )
  );

-- ============================================================
-- 5. Update handle_new_user to set username + create default group
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    new.raw_user_meta_data->>'username'
  );

  insert into public.groups (owner_id, name, color, is_default)
  values (new.id, 'Close Friends', '#ec4899', true);

  return new;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 6. Create default "Close Friends" group for existing users
-- ============================================================

insert into public.groups (owner_id, name, color, is_default)
select id, 'Close Friends', '#ec4899', true
from public.users
where id not in (select owner_id from public.groups where is_default = true);
