
ALTER TYPE public.command_type ADD VALUE IF NOT EXISTS 'play_playlist';
ALTER TYPE public.command_type ADD VALUE IF NOT EXISTS 'stop_playback';
ALTER TYPE public.command_type ADD VALUE IF NOT EXISTS 'refresh_device';
ALTER TYPE public.command_type ADD VALUE IF NOT EXISTS 'reload_content';

ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
