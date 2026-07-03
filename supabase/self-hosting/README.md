# Self-Hosting Bootstrap

Files in this folder are **not** applied by `supabase db push`. They set up
one-time resources that live outside the migration graph (storage buckets,
optional seed data) so you can point ScreenHub at your own Supabase project.

## Order of operations for a fresh Supabase project

```bash
# 1. Link the Supabase CLI to your project
supabase link --project-ref YOUR-PROJECT-REF

# 2. Create the private "media" storage bucket
supabase db execute --file supabase/self-hosting/00_bootstrap_storage.sql
# (or paste the SQL into the Supabase SQL editor once)

# 3. Apply the full schema, RLS, and storage policies
supabase db push
```

See `../../SELF_HOSTING.md` for the full guide.
