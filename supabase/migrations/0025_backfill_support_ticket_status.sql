-- Regulariza chamados anteriores à automação de status.
-- Se o administrador já respondeu, o chamado não deve permanecer "Aberto".
-- Mantém intactos chamados finalizados e não reenvia e-mails retroativos.
update public.support_tickets t
set status='in_progress', updated_at=now()
where t.status='open'
  and exists (
    select 1 from public.support_ticket_messages m
    where m.ticket_id=t.id and m.sender_role='admin'
  );
