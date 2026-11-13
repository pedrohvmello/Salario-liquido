-- Replace outdated PostgREST role GUC with signed JWT claims and repair email validation.
-- HML first; never bypass the service_role role check.
begin;
create or replace function private.assign_support_ticket_sender()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')='service_role'
    and new.channel='email' then
  if new.sender_id is null or new.sender_role<>'user' then
   raise exception 'Invalid verified email sender';
  end if;
 else
  new.sender_id:=auth.uid();
  if new.sender_id is null then raise exception 'Autenticação necessária'; end if;
  new.sender_role:=case when private.is_current_admin() then 'admin' else 'user' end;
  new.channel:='web';
 end if;
 new.created_at:=now();
 return new;
end;
$$;
revoke all on function private.assign_support_ticket_sender() from public,anon,authenticated;


create or replace function public.ingest_support_inbound_email(
 p_recipient text, p_sender_email text, p_source_message_id text, p_body text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_ticket record;
 v_receipt_id text;
 v_message_id uuid;
 v_recipient text:=lower(btrim(coalesce(p_recipient,'')));
 v_sender text:=lower(btrim(coalesce(p_sender_email,'')));
 v_body text:=btrim(coalesce(p_body,''));
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then
  raise exception 'Backend authorization required';
 end if;
 if p_source_message_id is null or char_length(p_source_message_id) not between 5 and 255
   or char_length(v_body) not between 1 and 4000
   or v_sender !~ '^[a-z0-9.!#$%&''*+/=?^`{|}~_-]+@[a-z0-9.-]+[.][a-z]{2,}$'
 then
  raise exception 'Invalid email payload';
 end if;
 select t.id,t.user_id,t.status,t.ticket_year,t.ticket_sequence,r.token
 into v_ticket
 from public.support_ticket_reply_routes r
 join public.support_tickets t on t.id=r.ticket_id
 join auth.users u on u.id=t.user_id
 join public.app_members m on m.user_id=t.user_id and m.active and m.status='approved'
 where r.revoked_at is null
  and u.email is not null and lower(btrim(u.email))=v_sender
  and v_recipient=(
   'hml-chamado-'||t.ticket_year||'-'||lpad(t.ticket_sequence::text,4,'0')||'-'||r.token||'@payrep.com.br'
  )
 for update of t;
 if not found then raise exception 'Unknown recipient or sender'; end if;
 if v_ticket.status='resolved' then
  return jsonb_build_object('result','closed');
 end if;
 insert into public.support_inbound_receipts(source_message_id,ticket_id)
 values(p_source_message_id,v_ticket.id)
 on conflict(source_message_id) do nothing
 returning source_message_id into v_receipt_id;
 if v_receipt_id is null then
  return jsonb_build_object('result','duplicate');
 end if;
 insert into public.support_ticket_messages(ticket_id,sender_id,sender_role,body,channel)
 values(v_ticket.id,v_ticket.user_id,'user',v_body,'email')
 returning id into v_message_id;
 update public.support_inbound_receipts
 set message_id=v_message_id where source_message_id=p_source_message_id;
 return jsonb_build_object('result','inserted');
end;
$$;
revoke all on function public.ingest_support_inbound_email(text,text,text,text) from public,anon,authenticated;
grant execute on function public.ingest_support_inbound_email(text,text,text,text) to service_role;


commit;
