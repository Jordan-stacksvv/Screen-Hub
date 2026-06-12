
-- Helper: any signed in user with admin OR operator
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','operator'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Replace permissive policies
DROP POLICY "groups all auth" ON public.device_groups;
CREATE POLICY "groups read" ON public.device_groups FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "groups write" ON public.device_groups FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "groups update" ON public.device_groups FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "groups delete" ON public.device_groups FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY "devices all auth" ON public.devices;
CREATE POLICY "devices read" ON public.devices FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "devices write" ON public.devices FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "devices update" ON public.devices FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "devices delete" ON public.devices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY "content all auth" ON public.content;
CREATE POLICY "content read" ON public.content FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "content write" ON public.content FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "content update" ON public.content FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "content delete" ON public.content FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid()));

DROP POLICY "commands all auth" ON public.commands;
CREATE POLICY "commands read" ON public.commands FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid()));
CREATE POLICY "commands write" ON public.commands FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "commands update" ON public.commands FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid())) WITH CHECK (public.is_workspace_member(auth.uid()));
CREATE POLICY "commands delete" ON public.commands FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid()));

DROP POLICY "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY "profiles self insert" ON public.profiles;
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
