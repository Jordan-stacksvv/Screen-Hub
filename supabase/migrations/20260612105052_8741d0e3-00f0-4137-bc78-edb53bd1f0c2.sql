
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');
CREATE TYPE public.device_type AS ENUM ('android_tv', 'android_phone', 'android_tablet', 'windows_pc', 'mini_pc', 'other');
CREATE TYPE public.device_status AS ENUM ('online', 'offline', 'unregistered');
CREATE TYPE public.content_type AS ENUM ('url', 'image', 'video', 'pdf');
CREATE TYPE public.command_type AS ENUM ('open_url', 'show_image', 'play_video', 'show_pdf', 'reboot', 'screenshot');
CREATE TYPE public.command_status AS ENUM ('pending', 'delivered', 'acknowledged', 'failed');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all signed in" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile and assign first user as admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url');

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DEVICE GROUPS
CREATE TABLE public.device_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_groups TO authenticated;
GRANT ALL ON public.device_groups TO service_role;
ALTER TABLE public.device_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups all auth" ON public.device_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON public.device_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DEVICES
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name TEXT NOT NULL,
  device_type public.device_type NOT NULL DEFAULT 'other',
  operating_system TEXT,
  unique_identifier TEXT NOT NULL UNIQUE,
  registration_token TEXT UNIQUE,
  status public.device_status NOT NULL DEFAULT 'unregistered',
  last_seen TIMESTAMPTZ,
  group_id UUID REFERENCES public.device_groups(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_status ON public.devices(status);
CREATE INDEX idx_devices_group ON public.devices(group_id);
CREATE INDEX idx_devices_last_seen ON public.devices(last_seen DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devices all auth" ON public.devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CONTENT
CREATE TABLE public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_type public.content_type NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_type ON public.content(content_type);
CREATE INDEX idx_content_created ON public.content(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content TO authenticated;
GRANT ALL ON public.content TO service_role;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content all auth" ON public.content FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_content_updated BEFORE UPDATE ON public.content FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- COMMANDS
CREATE TABLE public.commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  command_type public.command_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.command_status NOT NULL DEFAULT 'pending',
  result JSONB,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX idx_commands_device ON public.commands(device_id);
CREATE INDEX idx_commands_status ON public.commands(status);
CREATE INDEX idx_commands_created ON public.commands(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commands TO authenticated;
GRANT ALL ON public.commands TO service_role;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commands all auth" ON public.commands FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commands;
