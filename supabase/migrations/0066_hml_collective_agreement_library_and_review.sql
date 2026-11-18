
-- HML: monitored public collective agreements, with human review before publication.
create table public.collective_sources (
 id uuid primary key default gen_random_uuid(),
 organization text not null check (length(trim(organization)) between 2 and 140),
 uf char(2) not null check (uf ~ '^[A-Z]{2}$'),
 cnpj text,
 source_url text,
 enabled boolean not null default false,
 status text not null default 'awaiting_direct_url' check(status in ('awaiting_direct_url','ready','checked','blocked','failed')),
 last_checked_at timestamptz,
 last_http_status integer,
 last_hash text,
 last_error text,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint collective_official_url check (
  source_url is null or source_url ~* '^https://(mediador\.trabalho\.gov\.br|www\.gov\.br)/[A-Za-z0-9/_?&=%.,~+-]*$'
 )
);
create unique index collective_sources_unique on public.collective_sources(lower(organization),uf);
create table public.collective_scan_runs (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.collective_sources(id),
 request_id bigint unique,
 status text not null default 'queued' check(status in ('queued','unchanged','new_document','blocked','error','unsupported')),
 status_code integer,
 content_hash text,
 error_message text,
 started_at timestamptz not null default now(),
 completed_at timestamptz
);
create index collective_scans_source_date on public.collective_scan_runs(source_id,started_at desc);
create table public.collective_documents (
 id uuid primary key default gen_random_uuid(),
 source_id uuid references public.collective_sources(id),
 title text not null check (length(trim(title)) between 3 and 200),
 document_type text not null default 'UNKNOWN' check(document_type in ('ACT','CCT','ADITIVO','UNKNOWN')),
 registration_code text,
 source_url text,
 storage_path text,
 content_hash text,
 raw_text text,
 bank_clause_excerpt text,
 valid_from date,
 valid_until date,
 review_status text not null default 'pending' check(review_status in ('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 review_note text,
 imported_by uuid references auth.users(id),
 imported_at timestamptz not null default now(),
 constraint collective_document_date_order check (valid_until is null or valid_from is null or valid_from <= valid_until),
 constraint collective_document_origin check (source_url is not null or storage_path is not null or raw_text is not null)
);
create unique index collective_documents_source_hash on public.collective_documents(source_id,content_hash)
 where source_id is not null and content_hash is not null;
create table public.collective_profiles (
 id uuid primary key default gen_random_uuid(),
 organization text not null,
 uf char(2) not null,
 name text not null,
 created_at timestamptz not null default now(),
 unique(organization,uf,name)
);
create table public.collective_profile_versions (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.collective_profiles(id),
 document_id uuid not null references public.collective_documents(id),
 version integer not null check(version>0),
 valid_from date not null,
 valid_until date not null,
 weekday_factor numeric(4,2) not null check(weekday_factor between 0.25 and 4),
 saturday_factor numeric(4,2) not null check(saturday_factor between 0.25 and 4),
 sunday_factor numeric(4,2) not null check(sunday_factor between 0.25 and 4),
 holiday_factor numeric(4,2) not null check(holiday_factor between 0.25 and 4),
 daily_target_minutes integer not null default 480 check(daily_target_minutes between 60 and 720),
 settlement_interval_months integer not null default 6 check(settlement_interval_months between 1 and 12),
 settlement_months smallint[] not null default array[2,8]::smallint[],
 settlement_half smallint not null default 1 check (settlement_half in (1,2)),
 published_at timestamptz not null default now(),
 published_by uuid not null references auth.users(id),
 constraint collective_profile_version_date check(valid_from <= valid_until),
 unique(profile_id,version),
 unique(profile_id,valid_from,valid_until)
);
alter table public.time_bank_policies
 add column if not exists catalog_profile_version_id uuid references public.collective_profile_versions(id) on delete restrict;
create table public.collective_profile_followers (
 user_id uuid not null references auth.users(id) on delete cascade,
 profile_id uuid not null references public.collective_profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,profile_id)
);
create table public.collective_profile_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 profile_version_id uuid not null references public.collective_profile_versions(id) on delete cascade,
 message text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(user_id,profile_version_id)
);
create table public.collective_company_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 organization text not null check(length(trim(organization)) between 2 and 140),
 uf char(2) not null check(uf ~ '^[A-Z]{2}$'),
 notes text,
 status text not null default 'requested' check(status in ('requested','reviewing','completed','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index collective_requests_status_date on public.collective_company_requests(status,created_at desc);

alter table public.collective_sources enable row level security;
alter table public.collective_scan_runs enable row level security;
alter table public.collective_documents enable row level security;
alter table public.collective_profiles enable row level security;
alter table public.collective_profile_versions enable row level security;
alter table public.collective_profile_followers enable row level security;
alter table public.collective_profile_notifications enable row level security;
alter table public.collective_company_requests enable row level security;
create policy "sources admin read" on public.collective_sources for select to authenticated using ((select public.is_app_admin()));
create policy "sources admin insert" on public.collective_sources for insert to authenticated with check ((select public.is_app_admin()));
create policy "sources admin update" on public.collective_sources for update to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "runs admin read" on public.collective_scan_runs for select to authenticated using ((select public.is_app_admin()));
create policy "documents admin read" on public.collective_documents for select to authenticated using ((select public.is_app_admin()));
create policy "documents admin insert" on public.collective_documents for insert to authenticated with check ((select public.is_app_admin()));
create policy "documents admin update" on public.collective_documents for update to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "profiles read published or admin" on public.collective_profiles for select to authenticated using (
 (select public.is_app_admin()) or exists(select 1 from public.collective_profile_versions v where v.profile_id=id)
);
create policy "profiles admin insert" on public.collective_profiles for insert to authenticated with check ((select public.is_app_admin()));
create policy "profiles admin update" on public.collective_profiles for update to authenticated using ((select public.is_app_admin())) with check ((select public.is_app_admin()));
create policy "versions read" on public.collective_profile_versions for select to authenticated using(true);
create policy "versions admin insert" on public.collective_profile_versions for insert to authenticated with check ((select public.is_app_admin()));
create policy "followers own or admin read" on public.collective_profile_followers for select to authenticated using (user_id=(select auth.uid()) or (select public.is_app_admin()));
create policy "followers own insert" on public.collective_profile_followers for insert to authenticated with check (user_id=(select auth.uid()));
create policy "followers own delete" on public.collective_profile_followers for delete to authenticated using (user_id=(select auth.uid()));
create policy "notifications own read" on public.collective_profile_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy "notifications own update" on public.collective_profile_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "requests own/admin read" on public.collective_company_requests for select to authenticated using(user_id=(select auth.uid()) or (select public.is_app_admin()));
create policy "requests own insert" on public.collective_company_requests for insert to authenticated with check(user_id=(select auth.uid()));
create policy "requests admin update" on public.collective_company_requests for update to authenticated using((select public.is_app_admin())) with check((select public.is_app_admin()));
grant select,insert,update on public.collective_sources to authenticated;
grant select on public.collective_scan_runs to authenticated;
grant select,insert,update on public.collective_documents to authenticated;
grant select,insert,update on public.collective_profiles to authenticated;
grant select,insert on public.collective_profile_versions to authenticated;
grant select,insert,delete on public.collective_profile_followers to authenticated;
grant select,update on public.collective_profile_notifications to authenticated;
grant select,insert,update on public.collective_company_requests to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('collective-agreements','collective-agreements',false,10485760,
 array['application/pdf','text/plain','text/html'])
 on conflict(id) do nothing;
create policy "collective documents admins upload" on storage.objects for insert to authenticated
 with check(bucket_id='collective-agreements' and (select public.is_app_admin()));
create policy "collective documents admins view" on storage.objects for select to authenticated
 using(bucket_id='collective-agreements' and (select public.is_app_admin()));

-- Notification is informational. Publishing never silently changes a user's active policy.
create function private.collective_notify_version() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 insert into public.collective_profile_notifications(user_id,profile_version_id,message)
 select f.user_id,new.id,'Nova versão disponível para o perfil de Banco de Horas acompanhado.'
 from public.collective_profile_followers f where f.profile_id=new.profile_id
 on conflict do nothing;
 return new;
end $$;
create trigger collective_version_published after insert on public.collective_profile_versions
 for each row execute function private.collective_notify_version();

-- Reject publication of an unreviewed or unverifiable source.
create function private.collective_assert_publication() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.collective_documents d
  where d.id=new.document_id and d.review_status='approved'
    and d.valid_from is not null and d.valid_until is not null
    and d.valid_from <= new.valid_from and d.valid_until >= new.valid_until
 ) then
  raise exception using errcode='23514',message='Publicação exige documento aprovado e vigência compatível.';
 end if;
 return new;
end $$;
create trigger collective_version_must_be_verified before insert on public.collective_profile_versions
 for each row execute function private.collective_assert_publication();
revoke all on function private.collective_notify_version() from public;
revoke all on function private.collective_assert_publication() from public;

-- Seed one tracked company, without assuming an unverified direct document URL.
insert into public.collective_sources(organization,uf,enabled,notes)
 values ('Accenture','SP',false,'Piloto. Informar URL direta de instrumento oficial do Mediador antes de ativar.')
 on conflict do nothing;
