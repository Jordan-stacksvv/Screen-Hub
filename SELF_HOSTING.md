# Self-Hosting ScreenHub

ScreenHub runs on **TanStack Start** (React 19 + Vite) with a **Supabase** backend
(Postgres, Auth, Storage, Realtime). You can host the entire stack yourself
against your own Supabase project — either Supabase Cloud or a self-hosted
Supabase instance. No feature is removed; everything (auth, devices,
broadcasts, commands, media library, playlists, schedules, realtime, device
pairing, and the device client) works against your own backend.

---

## 1. Prerequisites

- **Node 20+** and **Bun** (or npm/pnpm)
- **Supabase CLI** — https://supabase.com/docs/guides/cli
- A Supabase project (Cloud) **or** a local `supabase start` stack

---

## 2. Create your Supabase project

### Option A — Supabase Cloud
1. Create a project at https://supabase.com/dashboard
2. Note the **Project Ref**, **Project URL**, **anon/publishable key**, and
   **service_role key** (Project Settings → API).

### Option B — Self-hosted Supabase
Follow https://supabase.com/docs/guides/self-hosting. The values above come
from your `.env` on the Supabase host.

---

## 3. Apply the database schema

The complete schema lives in `supabase/migrations/`. It creates:

- **Enums:** `app_role`, `device_type`, `device_status`, `content_type`,
  `command_type`, `command_status`, schedule target type
- **Tables:** `organizations`, `workspaces`, `branches`, `profiles`,
  `user_roles`, `device_groups`, `devices`, `content`, `playlists`,
  `playlist_items`, `commands`, `broadcasts`, `schedules`, `pairing_codes`,
  `command_metrics`, `device_analytics_daily`
- **Functions:** `has_role`, `is_workspace_member`, `handle_new_user`,
  `set_updated_at`
- **RLS policies** on every public table, plus the `media` storage bucket
  and its policies
- **Triggers:** `on_auth_user_created` (auto-creates a profile + role;
  first user becomes admin)

Link the CLI and push migrations:

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
```

For a local stack: `supabase start` then `supabase db reset` (migrations run
automatically).

The bootstrap migration (`00000000000000_storage_bucket.sql`) creates the
private `media` storage bucket used by the Content Library. Storage RLS
policies are applied by the later migration.

---

## 4. Configure authentication

In **Supabase Dashboard → Authentication → Providers**:

- **Email** — enabled by default. For local dev, either enable
  "Auto-confirm email" or configure SMTP.
- **Google** (optional) — enable and add your OAuth Client ID/Secret.

**Redirect URLs** (Authentication → URL Configuration):
- Site URL: `http://localhost:8080` (dev) and your production URL
- Additional Redirect URLs: same origins

The first user to sign up is automatically promoted to `admin`
(see `handle_new_user`). Everyone else becomes `operator`.

---

## 5. Configure the app

```bash
cp .env.example .env
```

Fill in the values from step 2. The variables:

| Variable | Where used | Secret? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | No |
| `VITE_SUPABASE_PROJECT_ID` | Browser | No |
| `SUPABASE_URL` | Server (SSR, API routes) | No |
| `SUPABASE_PUBLISHABLE_KEY` | Server | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — bypasses RLS | **Yes** |
| `SUPABASE_PROJECT_ID` | Server | No |

The app reads these via `import.meta.env.VITE_*` in the browser and
`process.env.*` on the server. No code changes are required to point at
your backend — only the `.env` file.

---

## 6. Storage

The `media` bucket is **private**. The client uploads with the user's
Supabase session and requests time-limited signed URLs (5-year TTL — see
`SIGNED_URL_TTL` in `src/lib/screenhub.ts`). No public bucket is required.

Accepted MIME types: `image/png`, `image/jpeg`, `image/webp`, `video/mp4`,
`video/webm`, `application/pdf`.

---

## 7. Edge Functions

**None.** All server logic runs inside the TanStack Start app as either
`createServerFn` handlers or public API routes under `src/routes/api/public/`
(device pairing, register, heartbeat, ack). There is nothing to deploy to
Supabase Edge Functions.

---

## 8. Realtime

Realtime works out of the box against your Supabase project — the
Activity Dock, Live Control, and device status subscribe to Postgres
changes on `devices`, `commands`, and `broadcasts`. No extra config is
needed; RLS still applies to realtime payloads.

---

## 9. Run the app

```bash
bun install
bun run dev            # http://localhost:8080
```

Production build:

```bash
bun run build
bun run start
```

The Electron Control Center (`electron/main.cjs`) reuses the same backend —
point its bundled web app at the same `.env` values.

---

## 10. Device client

Devices pair against **your** deployment. On a screen device, open:

```
https://YOUR-DEPLOYMENT/client
```

The client generates a pairing code, POSTs to
`/api/public/devices/pair`, then heartbeats `/api/public/devices/heartbeat`.
All three public endpoints live in `src/routes/api/public/devices/` and
authenticate devices via the `registration_token` stored in the `devices`
table.

---

## 11. Backup & migration

- **Schema:** everything is in `supabase/migrations/` — commit it.
- **Data:** `supabase db dump --data-only > data.sql` (or use pg_dump).
- **Storage:** `supabase storage cp` or the S3-compatible API.

---

## 12. Upgrading

Pull new code, then:

```bash
supabase db push        # apply any new migrations
bun install
bun run build
```

New migrations are additive and idempotent where possible.

---

## Troubleshooting

- **`Missing Supabase environment variable(s)`** — `.env` is missing or
  the dev server wasn't restarted after editing it.
- **`permission denied for table X`** — a migration was skipped; re-run
  `supabase db push`. Every public table has explicit `GRANT` statements.
- **`Expected 3 parts in JWT; got 1`** — you used the new
  `sb_publishable_*` / `sb_secret_*` key format. Use the classic
  JWT-format anon and service_role keys shown on the API settings page.
- **First user isn't admin** — the `handle_new_user` trigger promotes the
  very first `auth.users` row. If you signed up before the trigger existed,
  manually insert into `public.user_roles`.
- **Device won't pair** — check that the browser can reach
  `/api/public/devices/pair` on your deployment (no auth required on that
  path) and that `SUPABASE_SERVICE_ROLE_KEY` is set on the server.
