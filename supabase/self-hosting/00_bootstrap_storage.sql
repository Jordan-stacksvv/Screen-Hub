-- Bootstrap SQL for self-hosted Supabase deployments.
-- Run this ONCE against a fresh Supabase project BEFORE `supabase db push`.
-- (On the managed Lovable Cloud backend the bucket already exists — skip this file.)

-- Private media bucket used by the Content Library. RLS policies for it
-- are created by supabase/migrations/20260615150332_*.sql.
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO NOTHING;
