-- HML: separate personal billing identity from broadly consumed profile views.
-- The CPF and birth date never enter auth.user_metadata, JWTs or admin dashboards.
create or replace function private.valid_br_cpf(p_cpf text)
returns boolean language plpgsql immutable strict set search_path=''
as $fn$
declare
 i integer; total integer; digit integer;
begin
 if p_cpf !~ '^[0-9]{11}$' or p_cpf ~ '^([0-9])\1{10}$' then return false;end if;
 total:=0;
 for i in 1..9 loop total:=total+(substring(p_cpf,i,1)::integer)*(11-i);end loop;
 digit:=(total*10)%11;
 if digit=10 then digit:=0;end if;
 if digit<>substring(p_cpf,10,1)::integer then return false;end if;
 total:=0;
 for i in 1..10 loop total:=total+(substring(p_cpf,i,1)::integer)*(12-i);end loop;
 digit:=(total*10)%11;
 if digit=10 then digit:=0;end if;
 return digit=substring(p_cpf,11,1)::integer;
end
$fn$;
revoke all on function private.valid_br_cpf(text) from public,anon,authenticated;

create table if not exists private.payrep_billing_identity(
 user_id uuid primary key references auth.users(id) on delete cascade,
 cpf text,
 birth_date date,
 updated_at timestamptz not null default now(),
 constraint payrep_identity_cpf_valid check(cpf is null or private.valid_br_cpf(cpf)),
 constraint payrep_identity_birth_date_valid
  check(birth_date is null or (birth_date>=date '1900-01-01' and birth_date<=current_date))
);
alter table private.payrep_billing_identity enable row level security;
revoke all on private.payrep_billing_identity from public,anon,authenticated;
-- service operations use narrowly authorized SECURITY DEFINER RPCs.

create or replace function public.my_payrep_billing_identity()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_uid uuid:=(select auth.uid()); v_row private.payrep_billing_identity%rowtype;
begin
 if v_uid is null or not private.current_mfa_satisfied() then
  raise exception 'Sessão inválida para consultar os dados cadastrais.' using errcode='42501';
 end if;
 select * into v_row from private.payrep_billing_identity where user_id=v_uid;
 return pg_catalog.jsonb_build_object('cpf',coalesce(v_row.cpf,''),
  'birth_date',coalesce(v_row.birth_date::text,''));
end
$fn$;
revoke all on function public.my_payrep_billing_identity() from public,anon;
grant execute on function public.my_payrep_billing_identity() to authenticated;

create or replace function public.save_my_payrep_billing_identity(
 p_cpf text,p_birth_date date
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_uid uuid:=(select auth.uid());
 v_cpf text:=nullif(pg_catalog.regexp_replace(coalesce(p_cpf,''),'[^0-9]','','g'),'');
begin
 if v_uid is null or not private.current_mfa_satisfied() then
  raise exception 'Sessão inválida para salvar os dados cadastrais.' using errcode='42501';
 end if;
 if v_cpf is not null and not private.valid_br_cpf(v_cpf) then
  raise exception 'CPF inválido. Confira os números informados.' using errcode='22023';
 end if;
 if p_birth_date is not null and
  (p_birth_date<date '1900-01-01' or p_birth_date>current_date) then
  raise exception 'Data de nascimento inválida.' using errcode='22023';
 end if;
 insert into private.payrep_billing_identity(user_id,cpf,birth_date)
 values(v_uid,v_cpf,p_birth_date)
 on conflict(user_id) do update set
  cpf=excluded.cpf,birth_date=excluded.birth_date,updated_at=now();
 return pg_catalog.jsonb_build_object('saved',true);
end
$fn$;
revoke all on function public.save_my_payrep_billing_identity(text,date) from public,anon;
grant execute on function public.save_my_payrep_billing_identity(text,date) to authenticated;

create or replace function public.billing_identity_for_asaas(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_row private.payrep_billing_identity%rowtype;
begin
 if (select auth.role())<>'service_role' or p_user_id is null then
  raise exception 'Operação restrita ao serviço de pagamentos.' using errcode='42501';
 end if;
 select * into v_row from private.payrep_billing_identity where user_id=p_user_id;
 return pg_catalog.jsonb_build_object('cpf',coalesce(v_row.cpf,''));
end
$fn$;
revoke all on function public.billing_identity_for_asaas(uuid) from public,anon,authenticated;
grant execute on function public.billing_identity_for_asaas(uuid) to service_role;

-- Fix a pre-existing broad permissive ALL policy; it was OR-combined with
-- the owner policies and could allow cross-user reads during authenticated MFA.
drop policy if exists mfa_verified_profile on public.user_profiles;
create policy mfa_verified_profile on public.user_profiles
 as restrictive for all to authenticated
 using ((select private.current_mfa_satisfied()))
 with check ((select private.current_mfa_satisfied()));
