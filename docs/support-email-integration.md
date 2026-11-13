# Payrep HML: replies by email, Maileroo → Supabase

## Current state / activation gates
- Inbound function source: `supabase/functions/support-inbound/index.ts`.
- Inbound SQL migration: `0026_support_inbound_email.sql`. It creates opaque reply
  addresses and a privileged, idempotent ingestion RPC, without opening table access.
- `support-mailer` creates unique Reply-To addresses for admin replies only when
  `SUPPORT_EMAIL_REPLIES_ENABLED=true`. Without the flag, existing Reply-To is unchanged.
- The inbound endpoint refuses every webhook with 503 until
  `SUPPORT_INBOUND_ENABLED=true` is configured in the **HML** Edge Function secrets.
- Neither the Maileroo inbound route nor the mail sender scheduler should be activated
  before a manual GO decision for HML. Do not enable these in PRD.

## Endpoints
HML webhook:
`https://nrpqcrhschztdwbfgnyo.supabase.co/functions/v1/support-inbound`

HML sender worker:
`https://nrpqcrhschztdwbfgnyo.supabase.co/functions/v1/support-mailer`

## Existing DNS
The primary domain `payrep.com.br` already uses the Maileroo MX hosts. Leave
DNS untouched. Do not modify the current `suporte@payrep.com.br` inbound route.
Make an additional route on this **same existing domain**.

## Maileroo Inbound Routing
1. Open Domains → payrep.com.br → Inbound Routing → New Route.
2. Use Match Recipient and the wildcard
   `hml-chamado-*@payrep.com.br`.
3. Enable DMARC alignment requirements. Prefer blocking known spam.
4. Add webhook action pointing to HML `support-inbound` endpoint above.
5. Keep the existing route for `suporte@payrep.com.br` unchanged.
6. Test with a new HML ticket. Do not use synthetic "Test Callback" to create
   fake business replies; payloads without validated recipients are discarded.

## Supabase secrets (HML only)
- `SUPPORT_INBOUND_ENABLED=true` only when ready to accept real inbound events.
- `SUPPORT_EMAIL_REPLIES_ENABLED=true` only after the inbound route works.
- Outbound `support-mailer`: `MAILEROO_API_KEY`, `SUPPORT_FROM_EMAIL`,
  `SUPPORT_APP_URL=https://payrep-hml.vercel.app`, `SUPPORT_MAILER_WORKER_TOKEN`.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are Supabase-provided backend
  environment variables. Do not put them in Git or any `VITE_*` variable.
- Publish the sender worker and schedule a trusted POST with
  `X-Payrep-Worker-Token`, **after** isolating old pending queue records.
- Be aware that Maileroo reports acceptance, not final mailbox delivery.

## Security constraints
- Incoming Maileroo callbacks require fresh validation via the exact
  `https://inbound-api.maileroo.net/validate-callback/...` URL.
- DMARC must be aligned. Reject spam, attachments and automated replies.
- Match authenticated From against ticket owner's verified account email.
- Address contains 128-bit random token; do not trust the visible ticket number.
- Database does final authorization and duplicate protection transactionally.
- A closed ticket is read-only. No reopening through email.
- The validation URL is single-use. If database ingestion fails *after* URL
  validation, the webhook retry may not be able to validate again; investigate
  logs and manually reconcile rather than blindly replaying.
- Keep user financial documents and email bodies out of logs.

## HML acceptance
1. New ticket created and unique reply route exists in the private table.
2. Admin replies in HML → worker sends a Maileroo e-mail with unique Reply-To.
3. User replies through Gmail/Outlook → new message appears inside the same
   ticket, with source channel `email` in the database.
4. Repeated Maileroo message-id does not create a duplicate message.
5. Wrong sender and DMARC failure are rejected.
6. Closing the ticket prevents further inbound messages.
7. All unrelated pages and accounting calculations remain unchanged.

### Maileroo docs
- https://maileroo.com/docs/inbound-routing/overview
- https://maileroo.com/docs/inbound-routing/webhooks
- https://maileroo.com/docs/api-reference/emails/send-email
