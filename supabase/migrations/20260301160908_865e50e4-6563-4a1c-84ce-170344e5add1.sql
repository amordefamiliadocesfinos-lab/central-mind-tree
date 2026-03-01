
-- Create storage bucket for contact avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-avatars', 'contact-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for contact avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'contact-avatars');

-- Allow anyone to upload (no auth required based on current app pattern)
CREATE POLICY "Allow upload contact avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contact-avatars');

-- Allow anyone to update
CREATE POLICY "Allow update contact avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'contact-avatars');

-- Allow anyone to delete
CREATE POLICY "Allow delete contact avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'contact-avatars');
