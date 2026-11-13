-- Payrep support conversations: minimum privileges needed by the existing UI.
-- RLS continues to enforce ownership, administrator + TOTP (PRD), status, and MFA.
-- Insert only columns supplied by TicketConversation; sender_role and timestamp
-- are supplied by the protected trigger.
begin;
grant insert (ticket_id, sender_id, body)
 on table public.support_ticket_messages to authenticated;
-- The administration screen updates only these two columns.
grant update (status, updated_at)
 on table public.support_tickets to authenticated;
-- Explicitly forbid public or user access to private notification storage.
revoke all on table public.support_email_outbox,
 public.support_ticket_reply_routes, public.support_inbound_receipts
 from anon, authenticated;
commit;
