-- Fix RLS policies for circle invites and notifications

-- ============================================================
-- 1. Allow circle members to invite others
-- ============================================================

create policy "Circle members can invite others"
  on public.circle_memberships for insert with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.circle_memberships cm
      where cm.circle_id = circle_memberships.circle_id
        and cm.user_id = auth.uid()
    )
  );

-- Drop the old restrictive policy and let the new combined one handle it
drop policy if exists "Users can join circles" on public.circle_memberships;

-- ============================================================
-- 2. Allow authenticated users to insert notifications
-- ============================================================

create policy "Authenticated users can create notifications"
  on public.notifications for insert with check (
    auth.uid() is not null
  );

-- ============================================================
-- 3. Create avatars storage bucket (for profile photo uploads)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Authenticated users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
