
-- pg_cron + pg_net: controlled monitor for direct official HTML documents.
-- No CAPTCHA bypass or automated publication.
create policy "collective notifications admin insert" on public.collective_profile_notifications
 for insert to authenticated with check((select public.is_app_admin()));
grant insert on public.collective_profile_notifications to authenticated;

create function private.collective_scan_sources()
returns integer language plpgsql security invoker set search_path='' as $$
declare
 s record;
 requested integer:=0;
 req bigint;
begin
 for s in
  select id,source_url from public.collective_sources
  where enabled=true and source_url is not null
    and source_url ~* '^https://(mediador\.trabalho\.gov\.br|www\.gov\.br)/'
  order by last_checked_at asc nulls first limit 10
 loop
  if exists(select 1 from public.collective_scan_runs r where r.source_id=s.id
    and r.status='queued' and r.started_at > now()-interval '35 minutes') then
    continue;
  end if;
  begin
   req:=net.http_get(
    url:=s.source_url,
    headers:='{"accept":"text/html, text/plain;q=0.9", "user-agent":"PayrepPolicyMonitor/1.0 (compliance review; no automated publishing)"}'::jsonb,
    timeout_milliseconds:=10000
   );
   insert into public.collective_scan_runs(source_id,request_id) values(s.id,req);
   update public.collective_sources set last_checked_at=now(),status='ready',updated_at=now()
    where id=s.id;
   requested:=requested+1;
  exception when others then
   insert into public.collective_scan_runs(source_id,status,error_message,completed_at)
    values(s.id,'error',left(sqlerrm,500),now());
   update public.collective_sources
    set status='failed',last_error=left(sqlerrm,500),last_checked_at=now(),updated_at=now()
    where id=s.id;
  end;
 end loop;
 return requested;
end $$;
create function private.collective_reconcile_scans()
returns integer language plpgsql security invoker set search_path='' as $$
declare
 r record;
 response record;
 h text;
 new_doc boolean;
 done_count integer:=0;
 excerpt text;
 pos integer;
begin
 for r in select run.id,run.source_id,run.request_id,s.organization,s.uf,s.source_url,s.last_hash
 from public.collective_scan_runs run
 join public.collective_sources s on s.id=run.source_id
 where run.status='queued' and run.started_at > now()-interval '12 hours'
 order by run.started_at limit 30
 loop
  select * into response from net._http_response where id=r.request_id;
  if not found then continue; end if;
  if response.timed_out or response.error_msg is not null or response.status_code is null
      or response.status_code<200 or response.status_code>=300 then
   update public.collective_scan_runs
    set status=case when response.status_code in (401,403,429) then 'blocked' else 'error' end,
     status_code=response.status_code,error_message=left(coalesce(response.error_msg,'HTTP '||response.status_code),500),
     completed_at=now() where id=r.id;
   update public.collective_sources
    set status=case when response.status_code in (401,403,429) then 'blocked' else 'failed' end,
      last_http_status=response.status_code,last_error=left(coalesce(response.error_msg,'HTTP '||response.status_code),500),
      updated_at=now() where id=r.source_id;
   done_count:=done_count+1;continue;
  end if;
  -- pg_net exposes UTF-8 text; raw binary PDF is not processed as text.
  if coalesce(response.content_type,'') not ilike '%text/html%'
    and coalesce(response.content_type,'') not ilike '%text/plain%' then
   update public.collective_scan_runs set status='unsupported',status_code=response.status_code,
    error_message='Formato não suportado para extração automática. Faça upload do documento na revisão.',
    completed_at=now() where id=r.id;
   update public.collective_sources set last_http_status=response.status_code,status='checked',
    last_error='Documento requer importação manual para extração.',updated_at=now() where id=r.source_id;
   done_count:=done_count+1;continue;
  end if;
  -- Search pages are not agreements. Require documentary terminology.
  if response.content is null or length(response.content)>450000
   or (response.content !~* '(acordo coletivo|convenção coletiva|termo aditivo)')
   or response.content !~* '(cláusula|clausula)' then
   update public.collective_scan_runs set status='unsupported',status_code=response.status_code,
    error_message='Resposta não identificada como instrumento coletivo. Informe URL direta de documento.',
    completed_at=now() where id=r.id;
   update public.collective_sources set status='checked',last_http_status=response.status_code,
    last_error='URL não retornou documento identificável.',updated_at=now() where id=r.source_id;
   done_count:=done_count+1;continue;
  end if;
  h:=md5(response.content);
  if h=r.last_hash then
   update public.collective_scan_runs set status='unchanged',status_code=response.status_code,
    content_hash=h,completed_at=now() where id=r.id;
  else
   pos:=position('banco de horas' in lower(response.content));
   excerpt:=case when pos>0
    then substring(response.content from greatest(1,pos-200) for 1400)
    else null end;
   insert into public.collective_documents(
    source_id,title,document_type,source_url,content_hash,raw_text,bank_clause_excerpt
   ) values(
    r.source_id,'Documento detectado · '||r.organization||' / '||r.uf,
    'UNKNOWN',r.source_url,h,response.content,excerpt
   ) on conflict do nothing;
   update public.collective_scan_runs set status='new_document',
    status_code=response.status_code,content_hash=h,completed_at=now() where id=r.id;
  end if;
  update public.collective_sources set status='checked',last_http_status=response.status_code,
   last_hash=h,last_error=null,updated_at=now() where id=r.source_id;
  done_count:=done_count+1;
 end loop;
 -- Explicitly expire requests with no response; never claim they succeeded.
 update public.collective_scan_runs set status='error',completed_at=now(),
  error_message='Sem resposta do serviço no prazo de retenção do pg_net.'
 where status='queued' and started_at<now()-interval '35 minutes';
 return done_count;
end $$;
revoke all on function private.collective_scan_sources() from public;
revoke all on function private.collective_reconcile_scans() from public;

select cron.schedule(
 'payrep-hml-collective-weekly-scan',
 '0 11 * * 1',
 $job$select private.collective_scan_sources()$job$
);
select cron.schedule(
 'payrep-hml-collective-response-reconciliation',
 '*/10 * * * *',
 $job$select private.collective_reconcile_scans()$job$
);
