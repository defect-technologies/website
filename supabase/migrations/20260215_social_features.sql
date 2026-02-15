-- Migration: Social features — follows, circle last seen, notification type updates

-- ============================================================
-- 1. Create follows table
-- ============================================================

create table if not exists public.follows (
  follower_id uuid references public.users(id) on delete cascade not null,
  following_id uuid references public.users(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id != following_id)
);

create index if not exists idx_follows_follower on public.follows(follower_id);
create index if not exists idx_follows_following on public.follows(following_id);
create index if not exists idx_follows_pending on public.follows(following_id, status);

-- ============================================================
-- 2. Create circle_last_seen table
-- ============================================================

create table if not exists public.circle_last_seen (
  user_id uuid references public.users(id) on delete cascade not null,
  circle_id uuid references public.circles(id) on delete cascade not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, circle_id)
);

-- ============================================================
-- 3. RLS on follows
-- ============================================================

alter table public.follows enable row level security;

create policy "Users can view their own follow relationships"
  on public.follows for select using (
    auth.uid() = follower_id or auth.uid() = following_id
  );

create policy "Users can view accepted follows for any user"
  on public.follows for select using (
    status = 'accepted'
  );

create policy "Users can send follow requests"
  on public.follows for insert with check (
    auth.uid() = follower_id
  );

create policy "Target user can update follow status"
  on public.follows for update using (
    auth.uid() = following_id
  );

create policy "Follower can delete their follow"
  on public.follows for delete using (
    auth.uid() = follower_id
  );

create policy "Target can delete follow requests"
  on public.follows for delete using (
    auth.uid() = following_id
  );

-- ============================================================
-- 4. RLS on circle_last_seen
-- ============================================================

alter table public.circle_last_seen enable row level security;

create policy "Users can view their own last seen"
  on public.circle_last_seen for select using (
    auth.uid() = user_id
  );

create policy "Users can upsert their own last seen"
  on public.circle_last_seen for insert with check (
    auth.uid() = user_id
  );

create policy "Users can update their own last seen"
  on public.circle_last_seen for update using (
    auth.uid() = user_id
  );

-- ============================================================
-- 5. Update notifications type constraint
-- ============================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('new_post', 'reaction', 'comment', 'leaderboard', 'invite', 'mention', 'follow_request', 'follow_accepted'));
