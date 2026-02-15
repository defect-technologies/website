-- Enable realtime on notifications and follows tables

alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.follows;
alter publication supabase_realtime add table public.posts;
