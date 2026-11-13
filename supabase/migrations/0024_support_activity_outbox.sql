-- Payrep: fila de atendimento e notificações assíncronas. Somente HML antes de GO.
-- Sem alteração de protocolos/UUIDs ou das políticas existentes de acesso aos chamados.
alter table public.support_tickets
 add column if not exists last_user_activity_at timestamptz not null default now(),
 add column if not exists last_admin_activity_at timestamptz;

-- Cada chamado começa com a solicitação inicial enviada pelo usuário.
update public.support_tickets t set
 last_user_activity_at=greatest(t.created_at,coalesce((
  select max(m.created_at) from public.support_ticket_messages m
  where m.ticket_id=t.id and m.sender_role='user'
 ),t.created_at)),
 last_admin_activity_at=(
  select max(m.created_at) from public.support_ticket_messages m
  where m.ticket_id=t.id and m.sender_role='admin'
 );

-- Não confundir estado do ticket com estado do e-mail.
-- Esta fila armazena identificadores e eventos, não os dados financeiros dos clientes.
create table if not exists public.support_email_outbox(
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 message_id uuid references public.support_ticket_messages(id) on delete cascade,
 kind text not null check(kind in ('ticket_opened','user_message','admin_message','ticket_closed')),
 state text not null default 'pending' check(state in ('pending','processing','sent','failed')),
 created_at timestamptz not null default now(),
 claimed_at timestamptz,
 sent_at timestamptz,
 attempts integer not null default 0 check(attempts>=0),
 next_attempt_at timestamptz not null default now(),
 last_error text
);
create index if not exists support_email_outbox_pending_idx
 on public.support_email_outbox(state,next_attempt_at,created_at);
create unique index if not exists support_email_outbox_message_once_idx
 on public.support_email_outbox(message_id,kind) where message_id is not null;
create unique index if not exists support_email_outbox_ticket_once_idx
 on public.support_email_outbox(ticket_id,kind) where message_id is null;
alter table public.support_email_outbox enable row level security;
revoke all on public.support_email_outbox from public,anon,authenticated;

create or replace function private.support_ticket_created()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.support_email_outbox(ticket_id,kind)
 values(new.id,'ticket_opened') on conflict do nothing;
 return new;
end;
$$;
revoke all on function private.support_ticket_created() from public,anon,authenticated;
drop trigger if exists support_ticket_created_notify on public.support_tickets;
create trigger support_ticket_created_notify after insert on public.support_tickets
 for each row execute function private.support_ticket_created();

create or replace function private.support_ticket_message_activity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.sender_role='admin' then
  update public.support_tickets set
   status=case when status='open' then 'in_progress' else status end,
   last_admin_activity_at=new.created_at,
   updated_at=now()
  where id=new.ticket_id and status<>'resolved';
  insert into public.support_email_outbox(ticket_id,message_id,kind)
  values(new.ticket_id,new.id,'admin_message') on conflict do nothing;
 else
  update public.support_tickets set
   last_user_activity_at=new.created_at,
   updated_at=now()
  where id=new.ticket_id and status<>'resolved';
  insert into public.support_email_outbox(ticket_id,message_id,kind)
  values(new.ticket_id,new.id,'user_message') on conflict do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.support_ticket_message_activity() from public,anon,authenticated;
drop trigger if exists support_ticket_message_activity on public.support_ticket_messages;
create trigger support_ticket_message_activity after insert on public.support_ticket_messages
 for each row execute function private.support_ticket_message_activity();

create or replace function private.support_ticket_closed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status<>'resolved' and new.status='resolved' then
  insert into public.support_email_outbox(ticket_id,kind)
  values(new.id,'ticket_closed') on conflict do nothing;
 end if;
 return new;
end;
$$;
revoke all on function private.support_ticket_closed() from public,anon,authenticated;
drop trigger if exists support_ticket_closed_notify on public.support_tickets;
create trigger support_ticket_closed_notify after update of status on public.support_tickets
 for each row execute function private.support_ticket_closed();

-- Nenhuma mensagem retroativa é enviada ao ativar a integração.
-- As novas notificações só serão entregues após configurar o Maileroo e a rotina de envio.
