-- HML: CPF only for voluntary paid checkout; never require CPF to open a Free account.
-- Preserve birth_date and other profile fields if supplied earlier.
create or replace function public.save_my_checkout_cpf(p_cpf text)
returns jsonb language plpgsql security definer set search_path=''
as $fn$
declare v_uid uuid:=(select auth.uid());
        v_cpf text:=pg_catalog.regexp_replace(coalesce(p_cpf,''),'[^0-9]','','g');
begin
 if v_uid is null or not private.current_mfa_satisfied() then
  raise exception 'Sessão inválida.' using errcode='42501';
 end if;
 if v_cpf is null or not private.valid_br_cpf(v_cpf) then
  raise exception 'CPF inválido. Confira os dígitos verificadores.' using errcode='22023';
 end if;
 insert into private.payrep_billing_identity(user_id,cpf)
  values(v_uid,v_cpf)
  on conflict(user_id) do update set cpf=excluded.cpf,updated_at=now();
 return pg_catalog.jsonb_build_object('saved',true);
end
$fn$;
revoke all on function public.save_my_checkout_cpf(text) from public,anon;
grant execute on function public.save_my_checkout_cpf(text) to authenticated;