This is a very large request — 11 sections spanning real backend work, future-architecture documentation, and a testing center. Rather than try to fully ship every section at maximum depth, I'll deliver a coherent MVP slice and treat the "future" sections as designed/documented scaffolding, which is what Section 10 explicitly asks for. I want to confirm scope before I write ~30 files.

## What I'll build (real, working features)

### Database migration (one migration, all schema changes batched)
- `pairing_codes` — 6-char code, expires_at, claimed_by_device_id (for `/client` pairing).
- `playlists` + `playlist_items` (ordered, with duration_seconds).
- `schedules` — target (device/group/all), content_or_playlist, starts_at/ends_at, priority, cron-like recurrence (jsonb for now).
- `broadcasts` — target_type (device/group/all), target_id, command_type, payload, fan-out summary.
- Add `current_playlist_id`, `current_content_id` to `devices`.
- Future-architecture tables (created empty, RLS-locked, documented): `organizations`, `workspaces`, `branches`, `device_analytics_daily`, `command_metrics`.
- GRANTs + RLS on every new public table, realtime publication for `devices`, `commands`, `broadcasts`.

### Public device API additions
- `POST /api/public/devices/pair` — exchange pairing code for registration token (workspace claim flow).
- Extend heartbeat to return `current_playlist` and active `schedule` payload.

### Production client `/client` (browser-based, PWA-installable)
- Persistent identity in `localStorage` (device_id + registration_token).
- Pairing UI: shows 6-char code until admin claims it, then auto-registers.
- Fullscreen toggle, auto-reconnect with backoff, heartbeats every 30s.
- Restores last content on reload from localStorage.
- Renders URL / image / video / PDF; plays playlists with looped rotation; honors active schedule.
- Realtime channel subscription for instant command delivery (same pattern as simulator).

### Admin pages (new + enhanced)
- `/playlists` — CRUD, drag-free ordered item list, assign to device/group.
- `/schedules` — CRUD with priority + target picker.
- `/broadcasts` — compose broadcast → fans out to N commands → live status table (pending/delivered/ack/failed).
- `/groups` enhanced — member list, "Broadcast to group" action, group stats (online/total).
- `/devices/$id` enhanced — show current playlist + active schedule + assigned schedules.
- `/documentation`, `/roadmap`, `/project-status` — content pages with completion %, module status, known limitations, testing checklist, future roadmap.
- `/testing` — runs live integration checks against the backend (register → heartbeat → command → ack roundtrip, pairing flow, broadcast fan-out) and shows pass/fail.
- `/future` — single hub page with tabs for Android APK, Electron, Multi-Location, Analytics, Remote Controls. Each tab documents the planned architecture, shows the prepared DB schemas, lists the interfaces, and includes ASCII flow diagrams.

### PWA
- `public/manifest.webmanifest` + theme/icon meta in `__root.tsx`.
- Manifest-only (per PWA skill default): installable on home screen, no service worker — `/client` works fine online-only for MVP; offline mode is in the roadmap.

## What I'll explicitly NOT build this turn
- Native Android APK, Electron packaging, real multi-tenant org switching, real analytics aggregation jobs, real screenshot/reboot/volume/brightness wire protocol. These are Section 10 "prepare, don't build" — they get schemas, interfaces, and docs only.
- Service worker / offline mode for `/client` (listed as roadmap; PWA skill says manifest-only unless offline is explicitly requested).
- A real test runner with assertions library — `/testing` runs handcrafted end-to-end checks against the live API and shows results, not a full test framework.

## Tech notes
- All new tables: GRANT to authenticated + service_role, RLS via existing `is_workspace_member(auth.uid())`.
- Realtime: add new tables to `supabase_realtime` publication.
- `/client` uses the same public device API as `/simulator`; the simulator stays as a dev tool.
- No edge functions; all server logic stays in `src/routes/api/public/*` per the stack guidance.

## Rough file count
~25 new files (migration, 3 API routes, ~10 route pages, client component, PWA manifest, docs page content). I'll batch writes in parallel where independent.

Confirm and I'll proceed, or tell me which sections to drop / expand.