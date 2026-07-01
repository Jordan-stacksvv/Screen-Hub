import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DeviceType = Database["public"]["Enums"]["device_type"];
export type DeviceStatus = Database["public"]["Enums"]["device_status"];
export type ContentType = Database["public"]["Enums"]["content_type"];
export type CommandType = Database["public"]["Enums"]["command_type"];
export type CommandStatus = Database["public"]["Enums"]["command_status"];

export const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: "android_tv", label: "Android TV" },
  { value: "android_phone", label: "Android Phone" },
  { value: "android_tablet", label: "Android Tablet" },
  { value: "windows_pc", label: "Windows PC" },
  { value: "mini_pc", label: "Mini PC" },
  { value: "other", label: "Other" },
];

export const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "url", label: "Website URL" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "pdf", label: "PDF" },
];

// Every command the platform can send. Media commands are derived from content.
export const COMMAND_TYPES: { value: CommandType; label: string; category: "playback" | "control" }[] = [
  { value: "open_url", label: "Open URL", category: "playback" },
  { value: "show_image", label: "Show Image", category: "playback" },
  { value: "play_video", label: "Play Video", category: "playback" },
  { value: "show_pdf", label: "Show PDF", category: "playback" },
  { value: "play_playlist", label: "Play Playlist", category: "playback" },
  { value: "stop_playback", label: "Stop Playback", category: "control" },
  { value: "refresh_device", label: "Refresh Device", category: "control" },
  { value: "reload_content", label: "Reload Content", category: "control" },
  { value: "reboot", label: "Reboot", category: "control" },
  { value: "screenshot", label: "Screenshot", category: "control" },
];

export const CONTROL_COMMANDS: { value: CommandType; label: string; description: string }[] = [
  { value: "stop_playback", label: "Stop Playback", description: "Return the screen to the idle state" },
  { value: "refresh_device", label: "Refresh Device", description: "Reload the client app on the device" },
  { value: "reload_content", label: "Reload Current Content", description: "Re-play the current content without changing it" },
  { value: "reboot", label: "Reboot", description: "Reboot the device (if supported)" },
];

// Map a library ContentType → the playback command required to display it.
export function commandForContentType(t: ContentType): CommandType {
  switch (t) {
    case "url": return "open_url";
    case "image": return "show_image";
    case "video": return "play_video";
    case "pdf": return "show_pdf";
  }
}

export function labelForCommand(c: CommandType): string {
  return COMMAND_TYPES.find(t => t.value === c)?.label ?? c;
}

export const MEDIA_BUCKET = "media";
export const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5; // 5 years

export const ACCEPTED_MEDIA = {
  image: ["image/png", "image/jpeg", "image/webp"],
  video: ["video/mp4", "video/webm"],
  pdf: ["application/pdf"],
} as const;

export const ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp,.mp4,.webm,.pdf";

export function mimeToContentType(mime: string): ContentType | null {
  if (ACCEPTED_MEDIA.image.includes(mime as never)) return "image";
  if (ACCEPTED_MEDIA.video.includes(mime as never)) return "video";
  if (mime === "application/pdf") return "pdf";
  return null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || (!h && !m)) parts.push(`${s}s`);
  return parts.join(" ");
}

export async function uploadMedia(file: File): Promise<{
  storage_path: string;
  file_url: string;
  content_type: ContentType;
  mime_type: string;
  file_size: number;
}> {
  const ct = mimeToContentType(file.type);
  if (!ct) throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (upErr) throw upErr;
  const { data: signed, error: signErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr || !signed) throw signErr ?? new Error("Failed to sign URL");
  return { storage_path: path, file_url: signed.signedUrl, content_type: ct, mime_type: file.type, file_size: file.size };
}

// ────────── Content selection helpers ──────────
// A LibrarySelection wraps either a Content row or a Playlist row. Consumers
// use `toCommand()` to obtain the {command_type, payload} required to display
// the selection on a device.
export type LibraryContent = {
  kind: "content";
  id: string;
  title: string;
  content_type: ContentType;
  file_url: string;
};
export type LibraryPlaylist = {
  kind: "playlist";
  id: string;
  title: string;
  items: number;
};
export type LibrarySelection = LibraryContent | LibraryPlaylist;

export function selectionToCommand(sel: LibrarySelection): { command_type: CommandType; payload: Record<string, string> } {
  if (sel.kind === "playlist") {
    return { command_type: "play_playlist", payload: { playlist_id: sel.id } };
  }
  return {
    command_type: commandForContentType(sel.content_type),
    payload: { target: sel.file_url, content_id: sel.id },
  };
}

// ────────── Schedule recurrence ──────────
export type Recurrence =
  | { kind: "none" }
  | { kind: "daily"; time_start?: string; time_end?: string }
  | { kind: "weekly"; days_of_week: number[]; time_start?: string; time_end?: string };

export function parseRecurrence(json: unknown): Recurrence {
  if (!json || typeof json !== "object") return { kind: "none" };
  const r = json as Record<string, unknown>;
  if (r.kind === "daily") return { kind: "daily", time_start: r.time_start as string | undefined, time_end: r.time_end as string | undefined };
  if (r.kind === "weekly") return {
    kind: "weekly",
    days_of_week: Array.isArray(r.days_of_week) ? (r.days_of_week as number[]) : [],
    time_start: r.time_start as string | undefined,
    time_end: r.time_end as string | undefined,
  };
  return { kind: "none" };
}

export function describeRecurrence(r: Recurrence): string {
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (r.kind === "none") return "One-time";
  const window = r.time_start && r.time_end ? ` · ${r.time_start}–${r.time_end}` : "";
  if (r.kind === "daily") return `Daily${window}`;
  return `Weekly · ${(r.days_of_week ?? []).map(d => DAYS[d]).join(", ")}${window}`;
}

export const sb = supabase;
