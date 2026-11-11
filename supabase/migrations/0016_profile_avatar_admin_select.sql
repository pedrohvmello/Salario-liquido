-- Restrict cross-user private avatar reads to active, approved Payrep administrators.
-- Normal users keep their existing owner-only storage policy.
create policy "profile_avatar_admin_select" on storage.objects
 for select to authenticated
 using (bucket_id='profile-avatars' and (select private.is_current_admin()));
