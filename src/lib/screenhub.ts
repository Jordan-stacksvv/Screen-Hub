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

export const sb = supabase;
