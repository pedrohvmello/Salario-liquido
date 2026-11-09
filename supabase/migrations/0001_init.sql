-- Salário Líquido: private multi-tenant foundation.
-- Execute in the Supabase SQL editor in a NEW private project.
-- NO sample payroll, CPF, real paystubs, addresses or service-role keys in git.
create extension if not exists pgcrypto;
create table if not exists public.app_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active boolean not null default false,
 role text not null default 'member' check (role in ('member','admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.user_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 parameters jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create table if not exists public.salary_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null,
 effective_date date not null,
 value numeric(16,4) not null,
 notes text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists salary_events_user_date on public.salary_events(user_id,effective_date);
create table if not exists public.time_entries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 date date not null,
 start_at time not null,
 lunch_start time not null,
 lunch_end time not null,
 end_at time not null,
 holiday_override boolean,
 created_at timestamptz not null default now(),
 unique(user_id,date)
);
create table if not exists public.statements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 period text not null check (period ~ '^[0-9]{4}-[0-9]{2}),
 format text not null check (format in ('old','new')),
 source_sha256 text not null,
 source_page integer not null check (source_page > 0),
 source_file text not null,
 storage_key text not null,
 salary_contract numeric(16,2),
 trienio numeric(16,2),
 credits numeric(16,2),
 debits numeric(16,2),
 net numeric(16,2),
 ir_base numeric(16,2),
 fgts numeric(16,2),
 warnings jsonb not null default '[]'::jsonb,
 uploaded_at timestamptz not null default now(),
 unique(user_id,source_sha256,source_page)
);
create index if not exists statements_user_period on public.statements(user_id,period);
create table if not exists public.statement_lines (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 statement_id uuid not null references public.statements(id) on delete cascade,
 ordinal integer not null,
 code text not null,
 description text not null,
 amount numeric(16,2) not null,
 side text not null check(side in ('credit','debit','unknown')),
 unique(statement_id,ordinal)
);
create index if not exists statements_lines_owner on public.statement_lines(user_id,statement_id);

alter table public.app_members enable row level security;
alter table public.user_settings enable row level security;
alter table public.salary_events enable row level security;
alter table public.time_entries enable row level security;
alter table public.statements enable row level security;
alter table public.statement_lines enable row level security;

create policy "read own membership" on public.app_members for select to authenticated using (user_id=auth.uid());
-- Users cannot self-grant access or edit membership. Admin invites are provisioned server-side.
create policy "user_settings_owner" on public.user_settings for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active))
 with check (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "salary_events_owner" on public.salary_events for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active))
 with check (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "time_entries_owner" on public.time_entries for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active))
 with check (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "statements_owner" on public.statements for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active))
 with check (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "statement_lines_owner" on public.statement_lines for all to authenticated
 using (user_id=auth.uid() and exists (select 1 from public.statements s where s.id=statement_id and s.user_id=auth.uid()))
 with check (user_id=auth.uid() and exists (select 1 from public.statements s where s.id=statement_id and s.user_id=auth.uid()));
-- Private bucket. Users access only objects inside <auth.uid()>/.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values('payslips','payslips',false,15000000,array['application/pdf'])
on conflict (id) do update set public=false;
create policy "upload only own PDFs" on storage.objects for insert to authenticated
 with check(bucket_id='payslips' and (storage.foldername(name))[1]=auth.uid()::text and
 exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "read own PDFs" on storage.objects for select to authenticated
 using (bucket_id='payslips' and (storage.foldername(name))[1]=auth.uid()::text and
 exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
-- No client delete/update of originals: keep audit trail until explicit admin privacy workflow.
),
 format text not null check (format in ('old','new')),
 source_sha256 text not null,
 source_page integer not null check (source_page > 0),
 source_file text not null,
 storage_key text not null,
 salary_contract numeric(16,2),
 trienio numeric(16,2),
 credits numeric(16,2),
 debits numeric(16,2),
 net numeric(16,2),
 ir_base numeric(16,2),
 fgts numeric(16,2),
 warnings jsonb not null default '[]'::jsonb,
 uploaded_at timestamptz not null default now(),
 unique(user_id,source_sha256,source_page)
);
create index if not exists statements_user_period on public.statements(user_id,period);
create table if not exists public.statement_lines (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 statement_id uuid not null references public.statements(id) on delete cascade,
 ordinal integer not null,
 code text not null,
 description text not null,
 amount numeric(16,2) not null,
 side text not null check(side in ('credit','debit','unknown')),
 unique(statement_id,ordinal)
);
create index if not exists statements_lines_owner on public.statement_lines(user_id,statement_id);

alter table public.app_members enable row level security;
alter table public.user_settings enable row level security;
alter table public.salary_events enable row level security;
alter table public.time_entries enable row level security;
alter table public.statements enable row level security;
alter table public.statement_lines enable row level security;

create policy "read own membership" on public.app_members for select to authenticated using (user_id=auth.uid());
-- Users cannot self-grant access or edit membership. Admin invites are provisioned server-side.
create policy "user_settings_owner" on public.user_settings for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active))
 with check (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "salary_events_owner" on public.salary_events for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active))
 with check (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "time_entries_owner" on public.time_entries for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active))
 with check (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "statements_owner" on public.statements for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active))
 with check (user_id=auth.uid() and exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "statement_lines_owner" on public.statement_lines for all to authenticated
 using (user_id=auth.uid() and exists (select 1 from public.statements s where s.id=statement_id and s.user_id=auth.uid()))
 with check (user_id=auth.uid() and exists (select 1 from public.statements s where s.id=statement_id and s.user_id=auth.uid()));
-- Private bucket. Users access only objects inside <auth.uid()>/.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values('payslips','payslips',false,15000000,array['application/pdf'])
on conflict (id) do update set public=false;
create policy "upload only own PDFs" on storage.objects for insert to authenticated
 with check(bucket_id='payslips' and (storage.foldername(name))[1]=auth.uid()::text and
 exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
create policy "read own PDFs" on storage.objects for select to authenticated
 using (bucket_id='payslips' and (storage.foldername(name))[1]=auth.uid()::text and
 exists(select 1 from public.app_members m where m.user_id=auth.uid() and m.active));
-- No client delete/update of originals: keep audit trail until explicit admin privacy workflow.
