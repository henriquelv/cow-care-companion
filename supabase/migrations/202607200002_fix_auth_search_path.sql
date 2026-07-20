alter function public.authenticate_hoof_employee(text, text, text)
  set search_path = public, extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "hoof media read" on storage.objects;
create policy "hoof media read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'media');

drop policy if exists "hoof media insert" on storage.objects;
create policy "hoof media insert"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'media');

drop policy if exists "hoof media update" on storage.objects;
create policy "hoof media update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'media')
with check (bucket_id = 'media');

drop policy if exists "hoof media delete" on storage.objects;
create policy "hoof media delete"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'media');
