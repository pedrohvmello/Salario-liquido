-- Approved admin emails are stored privately in the database, never committed.
-- Adding an email does NOT create an Auth user or send an invite.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.approved_admin_emails (
 email text primary key,
 approved_at timestamptz not null default now(),
 constraint admin_email_lowercase check (email = lower(btrim(email)))
);
revoke all on table private.approved_admin_emails from public, anon, authenticated;
create or replace function private.activate_approved_admin()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.email_confirmed_at is not null
     and new.email is not null
     and exists (select 1 from private.approved_admin_emails a where a.email = lower(btrim(new.email))) then
    insert into public.app_members(user_id,active,role)
    values (new.id,true,'admin')
    on conflict(user_id) do update set active=true,role='admin';
  elsif tg_op = 'UPDATE'
     and old.email is distinct from new.email
     and exists (select 1 from private.approved_admin_emails a where a.email = lower(btrim(old.email))) then
    update public.app_members set active=false,role='member'
      where user_id=new.id and role='admin';
  end if;
  return new;
end
$function$;
revoke all on function private.activate_approved_admin() from public, anon, authenticated;
drop trigger if exists on_auth_admin_approval on auth.users;
create trigger on_auth_admin_approval
after insert or update of email,email_confirmed_at on auth.users
for each row execute function private.activate_approved_admin();
