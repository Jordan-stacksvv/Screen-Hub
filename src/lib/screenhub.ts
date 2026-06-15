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

export const COMMAND_TYPES: { value: CommandType; label: string }[] = [
  { value: "open_url", label: "Open URL" },
  { value: "show_image", label: "Show Image" },
  { value: "play_video", label: "Play Video" },
  { value: "show_pdf", label: "Show PDF" },
  { value: "reboot", label: "Reboot" },
  { value: "screenshot", label: "Screenshot" },
];

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

export const sb = supabase;
