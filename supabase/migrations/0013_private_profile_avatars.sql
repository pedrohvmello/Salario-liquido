-- Private profile avatar objects; no public access and no cross-user reads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('profile-avatars','profile-avatars',false,1048576,array['image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy "profile_avatar_self_select" on storage.objects
 for select to authenticated
 using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create policy "profile_avatar_self_insert" on storage.objects
 for insert to authenticated
 with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.filename(name))='avatar.webp');

create policy "profile_avatar_self_update" on storage.objects
 for update to authenticated
 using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
 with check(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.filename(name))='avatar.webp');

create policy "profile_avatar_self_delete" on storage.objects
 for delete to authenticated
 using(bucket_id='profile-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
