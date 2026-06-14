
-- ============ Pairing codes ============
CREATE TABLE public.pairing_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE,
  claimed_at timestamptz,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pairing_codes_code ON public.pairing_codes(code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pairing_codes TO authenticated;
GRANT ALL ON public.pairing_codes TO service_role;
ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pc read" ON public.pairing_codes FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "pc update" ON public.pairing_codes FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "pc delete" ON public.pairing_codes FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid()));

-- ============ Playlists ============
CREATE TABLE public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  loop_enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl read" ON public.playlists FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "pl write" ON public.playlists FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "pl update" ON public.playlists FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "pl delete" ON public.playlists FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE TRIGGER trg_pl_updated BEFORE UPDATE ON public.playlists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  duration_seconds int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pli_playlist ON public.playlist_items(playlist_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_items TO authenticated;
GRANT ALL ON public.playlist_items TO service_role;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pli read" ON public.playlist_items FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "pli write" ON public.playlist_items FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "pli update" ON public.playlist_items FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "pli delete" ON public.playlist_items FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid()));

-- ============ Schedules ============
CREATE TYPE public.schedule_target AS ENUM ('device','group','all');
CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_type public.schedule_target NOT NULL,
  target_id uuid, -- device or group id; null for 'all'
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE,
  content_id uuid REFERENCES public.content(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  priority int NOT NULL DEFAULT 0,
  recurrence jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sch read" ON public.schedules FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "sch write" ON public.schedules FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "sch update" ON public.schedules FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "sch delete" ON public.schedules FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE TRIGGER trg_sch_updated BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Broadcasts ============
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  target_type public.schedule_target NOT NULL,
  target_id uuid,
  command_type public.command_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_targets int NOT NULL DEFAULT 0,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcasts TO authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bc read" ON public.broadcasts FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "bc write" ON public.broadcasts FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "bc update" ON public.broadcasts FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "bc delete" ON public.broadcasts FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid()));

ALTER TABLE public.commands ADD COLUMN broadcast_id uuid REFERENCES public.broadcasts(id) ON DELETE SET NULL;
CREATE INDEX idx_commands_broadcast ON public.commands(broadcast_id);

ALTER TABLE public.devices ADD COLUMN current_playlist_id uuid REFERENCES public.playlists(id) ON DELETE SET NULL;
ALTER TABLE public.devices ADD COLUMN current_content_id uuid REFERENCES public.content(id) ON DELETE SET NULL;
ALTER TABLE public.devices ADD COLUMN paired_at timestamptz;

-- ============ Future-architecture scaffolding (locked) ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orgs read" ON public.organizations FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws read" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));

CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br read" ON public.branches FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));

CREATE TABLE public.device_analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  day date NOT NULL,
  uptime_seconds int NOT NULL DEFAULT 0,
  heartbeats int NOT NULL DEFAULT 0,
  content_displayed int NOT NULL DEFAULT 0,
  UNIQUE (device_id, day)
);
GRANT SELECT ON public.device_analytics_daily TO authenticated;
GRANT ALL ON public.device_analytics_daily TO service_role;
ALTER TABLE public.device_analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dad read" ON public.device_analytics_daily FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));

CREATE TABLE public.command_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  command_type public.command_type NOT NULL,
  issued int NOT NULL DEFAULT 0,
  delivered int NOT NULL DEFAULT 0,
  acknowledged int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  UNIQUE (day, command_type)
);
GRANT SELECT ON public.command_metrics TO authenticated;
GRANT ALL ON public.command_metrics TO service_role;
ALTER TABLE public.command_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cm read" ON public.command_metrics FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pairing_codes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
