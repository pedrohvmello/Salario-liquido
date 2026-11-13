-- Preparação de protocolos legíveis e conversa bidirecional.
-- Aplique primeiramente em HML, com validação de RLS, antes de PRD.
begin;

alter table public.support_tickets add column if not exists ticket_year integer;
alter table public.support_tickets add column if not exists ticket_sequence integer;

-- Os registros anteriores são numerados cronologicamente por ano.
with numbered as (
 select id,
  extract(year from created_at at time zone 'America/Sao_Paulo')::integer as yr,
  row_number() over (
   partition by extract(year from created_at at time zone 'America/Sao_Paulo')
   order by created_at,id
  )::integer as seq
 from public.support_tickets where ticket_year is null or ticket_sequence is null
)
update public.support_tickets t set ticket_year=n.yr,ticket_sequence=n.seq
from numbered n where t.id=n.id;

alter table public.support_tickets alter column ticket_year set not null;
alter table public.support_tickets alter column ticket_sequence set not null;
create unique index if not exists support_tickets_year_sequence_uidx
 on public.support_tickets(ticket_year,ticket_sequence);

create table if not exists private.support_ticket_counters (
 ticket_year integer primary key,
 last_number integer not null check (last_number>0)
);
alter table private.support_ticket_counters enable row level security;
revoke all on private.support_ticket_counters from public,anon,authenticated;
insert into private.support_ticket_counters(ticket_year,last_number)
select ticket_year,max(ticket_sequence) from public.support_tickets group by ticket_year
on conflict(ticket_year) do update
set last_number=greatest(private.support_ticket_counters.last_number,excluded.last_number);

create or replace function private.assign_support_ticket_number()
returns trigger language plpgsql security definer set search_path='' as $$
declare next_number integer;
begin
 new.created_at:=now();
 new.updated_at:=now();
 new.status:='open';
 new.ticket_year:=extract(year from now() at time zone 'America/Sao_Paulo')::integer;
 insert into private.support_ticket_counters(ticket_year,last_number)
 values(new.ticket_year,1)
 on conflict(ticket_year) do update
  set last_number=private.support_ticket_counters.last_number+1
 returning last_number into next_number;
 new.ticket_sequence:=next_number;
 return new;
end;
$$;
revoke all on function private.assign_support_ticket_number() from public,anon,authenticated;
drop trigger if exists support_tickets_number_before_insert on public.support_tickets;
create trigger support_tickets_number_before_insert
 before insert on public.support_tickets
 for each row execute function private.assign_support_ticket_number();

create table if not exists public.support_ticket_messages (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 sender_id uuid references auth.users(id) on delete set null,
 sender_role text not null default 'user' check (sender_role in ('user','admin')),
 body text not null check (char_length(btrim(body)) between 1 and 4000),
 created_at timestamptz not null default now()
);
create index if not exists support_ticket_messages_thread_idx
 on public.support_ticket_messages(ticket_id,created_at,id);
alter table public.support_ticket_messages enable row level security;
revoke all on public.support_ticket_messages from public,anon,authenticated;
grant select on public.support_ticket_messages to authenticated;
grant insert(ticket_id,sender_id,body) on public.support_ticket_messages to authenticated;

create or replace function private.assign_support_ticket_sender()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.sender_id:=auth.uid();
 if new.sender_id is null then raise exception 'Autenticação necessária'; end if;
 new.sender_role:=case when private.is_current_admin() then 'admin' else 'user' end;
 new.created_at:=now();
 return new;
end;
$$;
revoke all on function private.assign_support_ticket_sender() from public,anon,authenticated;
drop trigger if exists support_ticket_messages_before_insert on public.support_ticket_messages;
create trigger support_ticket_messages_before_insert
 before insert on public.support_ticket_messages
 for each row execute function private.assign_support_ticket_sender();

create policy "support_ticket_messages_read_owner_or_admin" on public.support_ticket_messages
 for select to authenticated using (
  (select private.current_mfa_satisfied()) and exists (
   select 1 from public.support_tickets t
   where t.id=ticket_id
    and (t.user_id=(select auth.uid()) or (select private.is_current_admin()))
  )
 );
create policy "support_ticket_messages_insert_owner_or_admin" on public.support_ticket_messages
 for insert to authenticated with check (
  sender_id=(select auth.uid())
  and (select private.current_mfa_satisfied())
  and exists (
   select 1 from public.app_members m
   where m.user_id=(select auth.uid()) and m.active and m.status='approved'
  )
  and exists (
   select 1 from public.support_tickets t
   where t.id=ticket_id and t.status<>'resolved'
    and (t.user_id=(select auth.uid()) or (select private.is_current_admin()))
  )
 );

-- A finalização é terminal. Nenhum cliente consegue reabrir um chamado resolvido.
create or replace function private.prevent_support_ticket_reopen()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='resolved' and new.status<>'resolved' then
  raise exception 'O chamado já foi finalizado e não pode ser reaberto';
 end if;
 return new;
end;
$$;
revoke all on function private.prevent_support_ticket_reopen() from public,anon,authenticated;
drop trigger if exists support_ticket_prevent_reopen on public.support_tickets;
create trigger support_ticket_prevent_reopen before update on public.support_tickets
 for each row execute function private.prevent_support_ticket_reopen();

commit;
