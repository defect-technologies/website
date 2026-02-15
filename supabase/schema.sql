-- Devlog Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

create table public.users (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  display_name text not null default '',
  avatar_url text,
  bio text,
  joined_at timestamptz not null default now(),
  total_points numeric not null default 0
);

create table public.circles (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  prize_description text,
  member_count int not null default 0,
  invite_code text unique default encode(gen_random_bytes(6), 'hex')
);

create table public.circle_memberships (
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  points_this_week numeric not null default 0,
  points_this_month numeric not null default 0,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  color text not null default '#6366f1',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references public.users(id) on delete cascade not null,
  circle_id uuid references public.circles(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  visibility text not null default 'circle' check (visibility in ('personal', 'group', 'circle', 'public')),
  content text not null check (char_length(content) <= 2500),
  posted_at timestamptz not null default now(),
  ai_score numeric not null default 0,
  novelty_score numeric not null default 0,
  engagement_score numeric not null default 0,
  total_score numeric not null default 0,
  flag_count int not null default 0,
  is_flagged boolean not null default false
);

create table public.media (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.posts(id) on delete cascade not null,
  type text not null check (type in ('image', 'video', 'file')),
  url text not null,
  thumbnail_url text,
  width int,
  height int,
  uploaded_at timestamptz not null default now()
);

create table public.reactions (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  type text not null check (type in ('thumbsup', 'heart', 'thumbsdown')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.posts(id) on delete cascade not null,
  author_id uuid references public.users(id) on delete cascade not null,
  content text not null check (char_length(content) <= 300),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null check (type in ('new_post', 'reaction', 'comment', 'leaderboard', 'invite')),
  title text not null,
  body text not null default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_posts_author on public.posts(author_id);
create index idx_posts_circle on public.posts(circle_id);
create index idx_posts_posted_at on public.posts(posted_at desc);
create index idx_posts_circle_posted on public.posts(circle_id, posted_at desc);
create index idx_comments_post on public.comments(post_id);
create index idx_reactions_post on public.reactions(post_id);
create index idx_notifications_user on public.notifications(user_id, read, created_at desc);
create index idx_circle_memberships_user on public.circle_memberships(user_id);
create index idx_users_username on public.users(username);
create index idx_groups_owner on public.groups(owner_id);
create index idx_group_members_user on public.group_members(user_id);
create index idx_posts_group on public.posts(group_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create user profile on signup
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update circle member_count on membership changes
create or replace function public.update_circle_member_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.circles set member_count = member_count + 1 where id = new.circle_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.circles set member_count = member_count - 1 where id = old.circle_id;
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_membership_change
  after insert or delete on public.circle_memberships
  for each row execute function public.update_circle_member_count();

-- Update user total_points when post scores change
create or replace function public.update_user_points()
returns trigger as $$
begin
  update public.users
  set total_points = (
    select coalesce(sum(total_score), 0) from public.posts where author_id = new.author_id
  )
  where id = new.author_id;

  -- Also update circle membership points
  if new.circle_id is not null then
    update public.circle_memberships
    set
      points_this_week = (
        select coalesce(sum(total_score), 0) from public.posts
        where author_id = new.author_id and circle_id = new.circle_id
        and posted_at >= date_trunc('week', now())
      ),
      points_this_month = (
        select coalesce(sum(total_score), 0) from public.posts
        where author_id = new.author_id and circle_id = new.circle_id
        and posted_at >= date_trunc('month', now())
      )
    where user_id = new.author_id and circle_id = new.circle_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_post_score_update
  after insert or update of total_score on public.posts
  for each row execute function public.update_user_points();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.circles enable row level security;
alter table public.circle_memberships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.posts enable row level security;
alter table public.media enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;

-- Users
create policy "Public profiles are viewable by everyone"
  on public.users for select using (true);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

-- Circles
create policy "Circles are viewable by everyone"
  on public.circles for select using (true);

create policy "Authenticated users can create circles"
  on public.circles for insert with check (auth.uid() = created_by);

create policy "Circle creators can update their circles"
  on public.circles for update using (
    auth.uid() = created_by
    or exists (
      select 1 from public.circle_memberships
      where circle_id = id and user_id = auth.uid() and role = 'admin'
    )
  );

create policy "Circle creators can delete their circles"
  on public.circles for delete using (auth.uid() = created_by);

-- Circle Memberships
create policy "Memberships viewable by circle members"
  on public.circle_memberships for select using (true);

create policy "Users can join circles"
  on public.circle_memberships for insert with check (auth.uid() = user_id);

create policy "Users can leave circles"
  on public.circle_memberships for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.circle_memberships cm
      where cm.circle_id = circle_memberships.circle_id and cm.user_id = auth.uid() and cm.role = 'admin'
    )
  );

-- Groups
create policy "Owners can view own groups"
  on public.groups for select using (auth.uid() = owner_id);

create policy "Owners can create groups"
  on public.groups for insert with check (auth.uid() = owner_id);

create policy "Owners can update own groups"
  on public.groups for update using (auth.uid() = owner_id);

create policy "Owners can delete non-default groups"
  on public.groups for delete using (auth.uid() = owner_id and is_default = false);

-- Group Members
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

-- Posts
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

create policy "Authenticated users can create posts"
  on public.posts for insert with check (auth.uid() = author_id);

create policy "Users can update own posts"
  on public.posts for update using (auth.uid() = author_id);

create policy "Users can delete own posts"
  on public.posts for delete using (auth.uid() = author_id);

-- Media
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

create policy "Post authors can add media"
  on public.media for insert with check (
    exists (select 1 from public.posts where id = post_id and author_id = auth.uid())
  );

-- Reactions
create policy "Reactions are viewable"
  on public.reactions for select using (true);

create policy "Authenticated users can react"
  on public.reactions for insert with check (auth.uid() = user_id);

create policy "Users can remove own reactions"
  on public.reactions for delete using (auth.uid() = user_id);

-- Comments
create policy "Comments are viewable"
  on public.comments for select using (true);

create policy "Authenticated users can comment"
  on public.comments for insert with check (auth.uid() = author_id);

create policy "Users can delete own comments"
  on public.comments for delete using (auth.uid() = author_id);

-- Notifications
create policy "Users can view own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update using (auth.uid() = user_id);

-- ============================================================
-- STORAGE
-- ============================================================

insert into storage.buckets (id, name, public)
values ('post-media', 'post-media', true)
on conflict do nothing;

create policy "Anyone can view post media"
  on storage.objects for select
  using (bucket_id = 'post-media');

create policy "Authenticated users can upload media"
  on storage.objects for insert
  with check (bucket_id = 'post-media' and auth.role() = 'authenticated');

create policy "Users can delete own media"
  on storage.objects for delete
  using (bucket_id = 'post-media' and auth.uid()::text = (storage.foldername(name))[1]);
