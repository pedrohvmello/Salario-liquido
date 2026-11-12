-- Only the administrative ticket status and update timestamp can be changed from the client.
-- RLS still restricts this operation to verified, active administrators.
revoke update on public.support_tickets from authenticated;
grant update(status,updated_at) on public.support_tickets to authenticated;
