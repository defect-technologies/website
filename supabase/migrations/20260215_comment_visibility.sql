ALTER TABLE public.comments ADD COLUMN visibility text NOT NULL DEFAULT 'author_only'
  CHECK (visibility IN ('author_only', 'public'));
