-- Keep the pre-existing private administrator email allowlist compatible with
-- app_members.status added in 0011. Access must never be granted via client metadata.
create or replace function private.activate_approved_admin()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if new.email_confirmed_at is not null
   and new.email is not null
   and exists(select 1 from private.approved_admin_emails a where a.email=lower(btrim(new.email))) then
  insert into public.app_members(user_id,active,role,status)
   values(new.id,true,'admin','approved')
  on conflict(user_id) do update set active=true,role='admin',status='approved';
 elsif tg_op='UPDATE'
   and old.email is distinct from new.email
   and exists(select 1 from private.approved_admin_emails a where a.email=lower(btrim(old.email))) then
  update public.app_members
   set active=false,role='member',status='suspended'
   where user_id=new.id and role='admin';
 end if;
 return new;
end
$function$;
revoke all on function private.activate_approved_admin() from public,anon,authenticated;
