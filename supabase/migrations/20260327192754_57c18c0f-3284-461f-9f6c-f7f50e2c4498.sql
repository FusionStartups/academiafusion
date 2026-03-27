INSERT INTO storage.buckets (id, name, public) VALUES ('course-covers', 'course-covers', true);
CREATE POLICY "Course covers are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'course-covers');
CREATE POLICY "Admins can upload course covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'course-covers');