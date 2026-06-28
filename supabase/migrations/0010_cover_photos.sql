-- Cover/banner photo for the Twitter-style profile header, alongside the
-- existing avatar. Same per-user-folder Storage convention as migration 0005.

alter table public.profiles add column if not exists cover_url text null;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select
  using (bucket_id in ('avatars', 'covers', 'meal-photos', 'post-images'));

drop policy if exists storage_own_folder_insert on storage.objects;
create policy storage_own_folder_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'covers', 'meal-photos', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_own_folder_update on storage.objects;
create policy storage_own_folder_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'meal-photos', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_own_folder_delete on storage.objects;
create policy storage_own_folder_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'covers', 'meal-photos', 'post-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
