
ALTER TABLE public.content
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS storage_path text;

-- Storage policies for media bucket (created via storage tool)
CREATE POLICY "media read" ON storage.objects FOR SELECT
  USING (bucket_id = 'media');
CREATE POLICY "media write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.is_workspace_member(auth.uid()));
CREATE POLICY "media update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.is_workspace_member(auth.uid()));
CREATE POLICY "media delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.is_workspace_member(auth.uid()));
