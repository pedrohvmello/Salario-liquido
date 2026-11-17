-- HML only. Promo codes are redeemable bearer strings. Persist them in
-- private.payrep_promo_codes (RLS + no direct anon/authenticated grants).
-- Only authenticated MFA-verified administrators may query the full code via
-- list_hml_promo_codes(). Do not expose this column through ordinary views.
alter table private.payrep_promo_codes
 add column if not exists code_value text;
alter table private.payrep_promo_codes
 add constraint payrep_promo_code_value_hash_check
 check (code_value is null or (
  code_value=pg_catalog.upper(code_value)
  and pg_catalog.md5(code_value)=code_hash
  and code_value ~ '^[A-Z0-9_-]{4,64}$'
 ));

create or replace function public.create_hml_promo_code(
 p_plan text,
 p_days integer,
 p_last_date date,
 p_code text,
 p_max_redemptions integer default null
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_code text:=pg_catalog.upper(pg_catalog.btrim(coalesce(p_code,'')));
 v_hash text;
 v_until timestamptz;
 v_existing_active boolean;
 v_reuse_after timestamptz;
 v_record private.payrep_promo_codes%rowtype;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Acesso restrito ao administrador verificado.' using errcode='42501';
 end if;
 if v_code !~ '^[A-Z0-9_-]{4,12}$' then
  raise exception 'Informe um código entre 4 e 12 caracteres, usando letras, números, hífen ou sublinhado.' using errcode='22023';
 end if;
 if p_plan is null or p_plan not in ('basic','full') or p_days is null or p_days not between 1 and 365
  or p_last_date is null
  or p_last_date<(now() at time zone 'America/Sao_Paulo')::date
  or p_last_date>(now() at time zone 'America/Sao_Paulo')::date+interval '730 days'
  or (p_max_redemptions is not null and p_max_redemptions not between 1 and 10000) then
  raise exception 'Plano, duração, vencimento ou limite de usos inválido.' using errcode='22023';
 end if;

 v_hash:=pg_catalog.md5(v_code);
 -- Serialize simultaneous creation attempts for the SAME text, independently
 -- from the partial unique index. Advisory lock is scoped to the transaction.
 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('payrep_promo:'||v_hash,0)
 );
 select exists(
  select 1 from private.payrep_promo_codes
  where code_hash=v_hash and disabled_at is null
 ) into v_existing_active;
 if v_existing_active then
  raise exception 'Este código já foi cadastrado. Desative-o antes de reutilizá-lo.' using errcode='23505';
 end if;
 -- Historical disabled records remain. Check latest disabled time even when
 -- the code was used in a previous campaign or on another plan.
 select max(disabled_at + interval '6 months') into v_reuse_after
 from private.payrep_promo_codes
 where code_hash=v_hash and disabled_at is not null;
 if v_reuse_after is not null and now()<v_reuse_after then
  raise exception 'Código desativado: reutilização permitida somente a partir de %.',
   to_char(v_reuse_after at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')
   using errcode='23514';
 end if;

 v_until:=((p_last_date+1)::timestamp at time zone 'America/Sao_Paulo');
 insert into private.payrep_promo_codes
  (code_hash,code_suffix,code_value,plan_code,access_days,redeem_until,max_redemptions,created_by)
 values(v_hash,pg_catalog.right(v_code,4),v_code,p_plan,p_days,v_until,p_max_redemptions,v_actor)
 returning * into v_record;

 return pg_catalog.jsonb_build_object(
  'id',v_record.id,'code',v_code,'plan',p_plan,'days',p_days,
  'redeemUntil',v_until,'maxRedemptions',p_max_redemptions);
end
$fn$;
revoke all on function public.create_hml_promo_code(text,integer,date,text,integer) from public,anon;
grant execute on function public.create_hml_promo_code(text,integer,date,text,integer) to authenticated;


create or replace function public.list_hml_promo_codes()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not private.is_current_admin() then
  raise exception 'Acesso restrito ao administrador verificado.' using errcode='42501';
 end if;
 return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',p.id,'codeSuffix',p.code_suffix,'code',p.code_value,'plan',p.plan_code,'days',p.access_days,
  'redeemUntil',p.redeem_until,'maxRedemptions',p.max_redemptions,
  'redeemedCount',(select count(*) from private.payrep_promo_redemptions r where r.code_id=p.id),
  'createdAt',p.created_at,
  'disabledAt',p.disabled_at,
  'status',case when p.disabled_at is not null then 'disabled'
    when p.redeem_until<=now() then 'expired'
    when p.max_redemptions is not null and
      (select count(*) from private.payrep_promo_redemptions r where r.code_id=p.id)>=p.max_redemptions
      then 'exhausted'
    else 'active' end
 ) order by p.created_at desc)
 from private.payrep_promo_codes p),'[]'::jsonb);
end
$fn$;
revoke all on function public.list_hml_promo_codes() from public,anon;
grant execute on function public.list_hml_promo_codes() to authenticated;


create or replace function public.restore_hml_promo_code_label(
 p_code_id uuid,p_code text
) returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_code text:=pg_catalog.upper(pg_catalog.btrim(coalesce(p_code,'')));
 v_record private.payrep_promo_codes%rowtype;
begin
 if v_actor is null or not private.is_current_admin() then
  raise exception 'Acesso restrito ao administrador verificado.' using errcode='42501';
 end if;
 if p_code_id is null or length(v_code)<4 or length(v_code)>64 or
  v_code !~ '^[A-Z0-9_-]+$' then
  raise exception 'Informe o código original completo.' using errcode='22023';
 end if;
 select * into v_record from private.payrep_promo_codes
  where id=p_code_id for update;
 if v_record.id is null then
  raise exception 'Código promocional não encontrado.' using errcode='22023';
 end if;
 if v_record.code_value is not null then
  raise exception 'Este código já está visível na lista.' using errcode='23514';
 end if;
 if pg_catalog.md5(v_code)<>v_record.code_hash then
  raise exception 'O código informado não corresponde ao registro original.' using errcode='22023';
 end if;
 update private.payrep_promo_codes set code_value=v_code where id=p_code_id;
 return pg_catalog.jsonb_build_object('restored',true);
end
$fn$;
revoke all on function public.restore_hml_promo_code_label(uuid,text) from public,anon;
grant execute on function public.restore_hml_promo_code_label(uuid,text) to authenticated;

