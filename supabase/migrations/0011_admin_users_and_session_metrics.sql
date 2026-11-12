-- Administration and approval gate for Salário Líquido.
-- Authorization uses app_members.active from the database, not editable JWT user metadata.
-- Existing active members remain active; users without a membership become pending.
alter table public.app_members
 add column if not exists status text not null default 'pending';
alter table public.app_members
 drop constraint if exists app_members_status_check;
alter table public.app_members
 add constraint app_members_status_check
 check (status in ('pending','approved','suspended','rejected'));
update public.app_members
set status=case when active then 'approved' else 'pending' end
where (active and status<>'approved') or (not active and status='approved');

create table if not exists public.app_admin_settings(
 id integer primary key default 1 check(id=1),
 require_approval boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
insert into public.app_admin_settings(id,require_approval) values(1,true)
on conflict (id) do nothing;

create table if not exists public.app_session_visits(
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 primary key(user_id,session_id)
);
create index if not exists app_session_visits_date_idx on public.app_session_visits(first_seen_at);

create table if not exists public.app_admin_audit(
 id bigint generated always as identity primary key,
 actor_id uuid not null references auth.users(id) on delete cascade,
 target_user_id uuid references auth.users(id) on delete set null,
 action text not null,
 old_value text,
 new_value text,
 performed_at timestamptz not null default now()
);
create index if not exists app_admin_audit_date_idx on public.app_admin_audit(performed_at desc);

alter table public.app_admin_settings enable row level security;
alter table public.app_session_visits enable row level security;
alter table public.app_admin_audit enable row level security;
revoke all on public.app_admin_settings,public.app_session_visits,public.app_admin_audit from public,anon,authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_current_admin()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.app_members m
  where m.user_id=auth.uid() and m.role='admin' and m.active and m.status='approved'
 )
$$;
revoke all on function private.is_current_admin() from public,anon;
grant execute on function private.is_current_admin() to authenticated;

create or replace function public.is_app_admin()
returns boolean language sql stable security invoker set search_path=''
as $$select private.is_current_admin()$$;
revoke all on function public.is_app_admin() from public,anon;
grant execute on function public.is_app_admin() to authenticated;

-- New email/password or OAuth Auth users get a membership automatically.
-- No privilege can be obtained from user_metadata, including the display name.
create or replace function private.create_member_on_signup()
returns trigger language plpgsql security definer set search_path=''
as $$
declare approval_required boolean;
begin
 select require_approval into approval_required
 from public.app_admin_settings where id=1;
 insert into public.app_members(user_id,role,active,status)
 values(new.id,'member',not coalesce(approval_required,true),
  case when coalesce(approval_required,true) then 'pending' else 'approved' end)
 on conflict(user_id) do nothing;
 return new;
end
$$;
revoke all on function private.create_member_on_signup() from public,anon,authenticated;
drop trigger if exists on_auth_member_created on auth.users;
create trigger on_auth_member_created
 after insert on auth.users for each row
 execute function private.create_member_on_signup();

-- Keep pre-existing Auth accounts visible as pending; do not grant past access.
insert into public.app_members(user_id,role,active,status)
select u.id,'member',false,'pending' from auth.users u
where not exists(select 1 from public.app_members m where m.user_id=u.id)
on conflict(user_id) do nothing;

create or replace function private.admin_dashboard_data()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if not private.is_current_admin() then
   raise exception 'Administrator access required' using errcode='42501';
 end if;
 select pg_catalog.jsonb_build_object(
   'requireApproval',(select s.require_approval from public.app_admin_settings s where s.id=1),
   'trackingSince',(select min(first_seen_at) from public.app_session_visits),
   'users',coalesce((
     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'id',u.id,'email',u.email,'createdAt',u.created_at,
       'lastSignInAt',u.last_sign_in_at,
       'emailConfirmed',u.email_confirmed_at is not null,
       'role',coalesce(m.role,'member'),'status',coalesce(m.status,'pending'),
       'active',coalesce(m.active,false),
       'sessions',coalesce(visits.total,0),
       'sessions30d',coalesce(visits.recent,0),
       'lastAppAccess',visits.last_visit
     ) order by u.created_at desc)
     from auth.users u
     left join public.app_members m on m.user_id=u.id
     left join lateral(
       select count(*)::integer as total,
        count(*) filter(where a.first_seen_at>=now()-interval '30 days')::integer as recent,
        max(a.last_seen_at) as last_visit
       from public.app_session_visits a where a.user_id=u.id
     ) visits on true
    ),'[]'::jsonb),
   'sessions30d',(select count(*) from public.app_session_visits where first_seen_at>=now()-interval '30 days'),
   'uniqueUsers30d',(select count(distinct user_id) from public.app_session_visits where first_seen_at>=now()-interval '30 days'),
   'recentActions',coalesce((
      select pg_catalog.jsonb_agg(z.info order by z.performed_at desc)
      from (
        select pg_catalog.jsonb_build_object(
         'action',a.action,'targetId',a.target_user_id,
         'performedAt',a.performed_at,'old',a.old_value,'new',a.new_value
        ) as info,a.performed_at
        from public.app_admin_audit a order by a.performed_at desc limit 15
      ) z
   ),'[]'::jsonb)
 ) into result;
 return result;
end
$$;
revoke all on function private.admin_dashboard_data() from public,anon;
grant execute on function private.admin_dashboard_data() to authenticated;
create or replace function public.get_admin_dashboard()
returns jsonb language sql stable security invoker set search_path=''
as $$ select private.admin_dashboard_data() $$;
revoke all on function public.get_admin_dashboard() from public,anon;
grant execute on function public.get_admin_dashboard() to authenticated;

create or replace function private.admin_change_member(p_target uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $$
declare old_row public.app_members%rowtype;
begin
 if not private.is_current_admin() then
   raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_target is null or p_status not in ('approved','suspended','rejected','pending') then
   raise exception 'Invalid account or status' using errcode='22023';
 end if;
 select * into old_row from public.app_members where user_id=p_target for update;
 if not found then raise exception 'User does not exist' using errcode='22023'; end if;
 if old_row.role='admin' or p_target=auth.uid() then
   raise exception 'Admin accounts cannot be changed here' using errcode='42501';
 end if;
 if old_row.status=p_status then return; end if;
 update public.app_members
 set status=p_status,active=(p_status='approved')
 where user_id=p_target;
 insert into public.app_admin_audit(actor_id,target_user_id,action,old_value,new_value)
 values(auth.uid(),p_target,'access_status',old_row.status,p_status);
end
$$;
revoke all on function private.admin_change_member(uuid,text) from public,anon;
grant execute on function private.admin_change_member(uuid,text) to authenticated;
create or replace function public.set_member_status(p_target uuid,p_status text)
returns void language sql security invoker set search_path=''
as $$ select private.admin_change_member(p_target,p_status) $$;
revoke all on function public.set_member_status(uuid,text) from public,anon;
grant execute on function public.set_member_status(uuid,text) to authenticated;

create or replace function private.admin_update_approval(p_required boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare was_required boolean;
begin
 if not private.is_current_admin() then
   raise exception 'Administrator access required' using errcode='42501';
 end if;
 if p_required is null then
   raise exception 'Approval requirement cannot be null' using errcode='22023';
 end if;
 select require_approval into was_required from public.app_admin_settings where id=1 for update;
 if was_required is not distinct from p_required then return; end if;
 update public.app_admin_settings
 set require_approval=p_required,updated_at=now(),updated_by=auth.uid() where id=1;
 insert into public.app_admin_audit(actor_id,action,old_value,new_value)
 values(auth.uid(),'require_approval',was_required::text,p_required::text);
end
$$;
revoke all on function private.admin_update_approval(boolean) from public,anon;
grant execute on function private.admin_update_approval(boolean) to authenticated;
create or replace function public.set_approval_requirement(p_required boolean)
returns void language sql security invoker set search_path=''
as $$ select private.admin_update_approval(p_required) $$;
revoke all on function public.set_approval_requirement(boolean) from public,anon;
grant execute on function public.set_approval_requirement(boolean) to authenticated;

-- One event per authenticated Supabase session, so refreshes do not inflate logins.
create or replace function private.record_active_session()
returns void language plpgsql security definer set search_path=''
as $$
declare sid uuid;
begin
 if not exists(select 1 from public.app_members where user_id=auth.uid() and active) then return; end if;
 begin
  sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 exception when invalid_text_representation then return;
 end;
 if sid is null then return; end if;
 insert into public.app_session_visits(user_id,session_id)
 values(auth.uid(),sid)
 on conflict(user_id,session_id) do update set last_seen_at=now();
end
$$;
revoke all on function private.record_active_session() from public,anon;
grant execute on function private.record_active_session() to authenticated;
create or replace function public.record_app_session()
returns void language sql security invoker set search_path=''
as $$ select private.record_active_session() $$;
revoke all on function public.record_app_session() from public,anon;
grant execute on function public.record_app_session() to authenticated;

-- A suspended account must not retain access to already-imported rubrics.
drop policy if exists "statement_lines_owner" on public.statement_lines;
create policy "statement_lines_owner" on public.statement_lines
for all to authenticated
using(
 user_id=(select auth.uid())
 and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active)
 and exists(select 1 from public.statements s where s.id=statement_id and s.user_id=(select auth.uid()))
)
with check(
 user_id=(select auth.uid())
 and exists(select 1 from public.app_members m where m.user_id=(select auth.uid()) and m.active)
 and exists(select 1 from public.statements s where s.id=statement_id and s.user_id=(select auth.uid()))
);
