# Phase 6 – ScreenHub Desktop Control Center

Build a Windows-first Electron shell that reuses the existing web app's data layer (auth, devices, media, commands, broadcasts, playlists, schedules, realtime) but ships **desktop-native workflows** — not a browser wrapper. The web app stays untouched except for a shared UI package split and a handful of `window.screenhub` bridge hooks.

## Architecture

```text
/electron
  main.cjs              BrowserWindow, tray, IPC, autoUpdater hooks
  preload.cjs           contextBridge → window.screenhub
  ipc/
    fs.cjs              native file dialogs, drag-drop paths
    notify.cjs          native OS notifications
    tray.cjs            tray menu + quick actions
    window-state.cjs    persist size/pos to userData/window.json
    net.cjs             online/offline + auto-reconnect signals
  assets/
    icon.ico, tray.png
/src/desktop            Desktop-only React routes/components
  layout.tsx            Sidebar + command palette + activity dock
  routes/
    dashboard.tsx
    devices.tsx         Cards, multi-select, bulk actions, quick actions
    live-control.tsx    Grid of live device tiles, hotkeys
    media.tsx           Drag-drop uploader, batch, one-click broadcast
    broadcasts.tsx      Preview → target picker → send
    playlists.tsx
    schedules.tsx
    activity.tsx
    settings.tsx
  hooks/
    use-desktop-bridge.ts     typed wrapper over window.screenhub
    use-hotkeys.ts
    use-recent.ts             recent devices / broadcasts / favorites (localStorage)
    use-activity-feed.ts      supabase realtime subscription
```

The desktop React bundle is built from the same Vite project using a second entry (`vite.electron.config.ts`, `base: './'`) so it can load via `file://`. In the browser, `window.screenhub` is undefined and the desktop routes are simply unreachable (Electron loads a dedicated `/desktop` entry HTML).

## Native bridge (`window.screenhub`)

Exposed via `contextBridge` — no `nodeIntegration`. Every method is a thin IPC call.

```ts
window.screenhub = {
  platform: 'win32' | 'darwin' | 'linux',
  pickFiles(opts): Promise<{ path, name, size, mime }[]>
  onFileDrop(cb): unsubscribe                // paths dropped on window
  notify({ title, body, deviceId? }): void
  tray.setBadge(count): void
  tray.setStatus('online'|'offline'|'degraded'): void
  window.getState(): { w, h, x, y, maximized }
  net.onStatus(cb): unsubscribe              // online/offline events
  openExternal(url): void
  contextMenu(items): Promise<string|null>   // native right-click menus
}
```

When running in the browser, a no-op shim keeps the desktop routes renderable for development.

## Desktop-specific workflows (not present in the web app)

1. **Media drop zone** — drop files anywhere in the window → native paths arrive via IPC → uploaded to the existing `media` bucket via the existing `uploadMedia` helper → preview → "Broadcast to…" opens the target picker. No manual "choose file" step.
2. **Live Control grid** — one tile per online device with current content, last heartbeat, playback state, and 1-key quick actions (P play, S stop, R refresh, B broadcast). Uses existing commands API.
3. **Command palette** (Ctrl+K) — fuzzy search devices, playlists, media, recent broadcasts; Enter runs the natural action.
4. **Activity dock** — collapsible right rail subscribed to `commands`, `broadcasts`, `devices` realtime channels. OS notifications on failures/acks (throttled).
5. **Tray icon** — shows online/total device count; menu: Show Window, Live Control, New Broadcast, Recent Broadcasts, Quit.
6. **Right-click context menus** — native menus on device cards, media items, playlist rows (Rename, Duplicate, Broadcast, Remove).
7. **Recents & favorites** — per-machine (localStorage in the renderer): recent devices, recent broadcasts, starred playlists, starred devices; surfaced in sidebar and command palette.
8. **Auto-reconnect** — on `net.onStatus('online')`, invalidate all queries and re-subscribe realtime channels; show a subtle reconnect toast.
9. **Window state persistence** — main process saves size/pos/maximized to `app.getPath('userData')/window.json`.
10. **Keyboard shortcuts** — Ctrl+K palette, Ctrl+B new broadcast, Ctrl+U upload, Ctrl+, settings, Ctrl+1..9 switch section, Del removes selected device (with confirm).

## Device Manager upgrades

Card grid with search, type/status/group filters, multi-select checkboxes, and a sticky bulk-action bar (Play Playlist, Broadcast, Open URL, Stop, Refresh, Move to Group, Remove). Each card shows: name, type, group, connection quality (derived from heartbeat gap: <45s good, <90s degraded, else offline), current content title, last-seen timestamp, playback status. Quick-action buttons on hover. Right-click for the same actions natively.

## Broadcast workspace

Three-pane layout: **Content preview** (reuses `ContentPicker`) → **Targets** (device list + groups + "recent targets" chips) → **Review** (summary, ETA, send). History rail on the right with duplicate/cancel/retry, wired to the existing `broadcasts` routes.

## Pairing hardening (fixes existing bug)

The current `/client` mints a pairing code each render. Change to:
- On first launch: generate & persist a `device_local_id` + `pairing_code` in `localStorage`.
- Only regenerate on explicit **Reset device** button (clears localStorage).
- Refresh keeps the same code.
- Once paired (device row exists for this local id), stop showing the code and store the returned server token locally.

## Backend

No schema changes needed — Phase 5 already provides everything. One tiny addition: a `desktop_sessions` scratch table is **not** required; recents/favorites stay client-side per machine.

## Build & packaging

- Add `vite.electron.config.ts` with `base: './'`, `build.outDir: 'dist-desktop'`, entry `src/desktop/main.tsx`.
- Add `electron/main.cjs` (CommonJS because `package.json` is `"type":"module"`), loads `dist-desktop/index.html`.
- Install `electron` + `@electron/packager` as devDeps.
- Scripts: `desktop:dev` (vite + electron with hot reload via `file://` on rebuild), `desktop:build` (vite build then packager for `win32-x64`, output to `electron-release/`, zipped to `/mnt/documents/ScreenHub-Control-Center-win32-x64.zip`). macOS/Linux builds available via the same packager invocation with `--platform`.

## Integration rules

- All data reads/writes go through the existing Supabase client and existing helpers (`uploadMedia`, `selectionToCommand`, heartbeat/pair/ack routes). No duplicated business logic.
- Realtime uses the existing Postgres changes channels.
- Auth uses the existing email/password + Google flow; the Electron window loads the same auth route on first launch and persists the session in the renderer's localStorage.

## Deliverables

1. `electron/` folder with `main.cjs`, `preload.cjs`, IPC modules, tray, window-state.
2. `src/desktop/` React app (layout + 8 routes + hooks + bridge shim).
3. Native drag-drop upload, command palette, activity dock, tray, notifications, context menus, hotkeys.
4. Pairing bug fix on `/client`.
5. `vite.electron.config.ts` + `package.json` scripts.
6. `README-desktop.md` with dev + package instructions and a downloadable Windows zip built at the end.

Not in scope: auto-updater backend, code signing, installer (`.exe`/`.dmg`) — those need signing certs and a release channel. The packaged output is a portable zip; installer wiring is a follow-up.
