ALTER TABLE public.notifications ADD COLUMN related_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_post ON public.notifications(related_post_id, type, read);
