# Payrep V1.0 — HML → PRD release checklist

Authorized by user 2026-11-13. Keep public version V1.0.
Repository branch: `codex/payrep-email-inbound-hml`.

## Verified project isolation
- HML Vercel: `prj_ITIcspfIuBA6kOSQ2HJIkAKVNdrD` / Supabase: `nrpqcrhschztdwbfgnyo`
- PRD Vercel: `prj_4NI7IsHpASPdsREDx2IHwyiGQ7yf` / Supabase: `klvurrcmfrwetmynscjc`
- PRD requires verified administrator TOTP, not merely an optional factor.
- Never copy HML environment secrets or HML user tables into PRD.

## PRD database
- Additive migrations `0021`–`0025`: tickets, RLS, conversations, automatic activity, outbox.
- Use the explicitly adapted `supabase/prd/migrations/0026_prd_support_inbound_email.sql` **instead of** the HML `0026`/`0027`. PRD uses recipient prefix `chamado-`, not `hml-chamado-`, and uses signed JWT role validation.
- Use `supabase/prd/migrations/0028_prd_support_mailer_cron.sql` **instead of** HML `0028`.
- Verify MFA enforcement, owner vs admin policies and existing PRD data after migration.

## PRD Edge Functions
- Deploy `support-mailer` with `index.ts` and `template.ts`, `verify_jwt=false`. The worker authenticates `X-Payrep-Worker-Token`; unauthenticated requests return 401.
- Deploy `support-inbound` with `index.ts` and `validation.ts`, `verify_jwt=false`; remain disabled until secure inbound route exists. It verifies Maileroo's one-time validation URL.
- Configure PRD secrets only in project `klvurrcmfrwetmynscjc`:
  - `MAILEROO_API_KEY`: own authorized PRD sending key, never from HML.
  - `SUPPORT_FROM_EMAIL=suporte@payrep.com.br` (verified Maileroo sender).
  - `SUPPORT_APP_URL=https://payrep.com.br` (live app domain; verify exact URL).
  - `SUPPORT_MAILER_WORKER_TOKEN`: independent random 32+ byte secret.
  - `SUPPORT_REPLY_PREFIX=chamado`.
  - `SUPPORT_EMAIL_REPLIES_ENABLED=false` and `SUPPORT_INBOUND_ENABLED=false` until separate PRD email round-trip and Maileroo rule are verified.
- Create Vault secret `payrep_prd_support_mailer_worker_token` with exactly PRD `SUPPORT_MAILER_WORKER_TOKEN`. Do not reveal or paste in Git, logs or SQL.
- Create separate Maileroo inbound route for `chamado-<year>-<number>-<token>@payrep.com.br` to the **PRD** `support-inbound` endpoint. Preserve existing `suporte@payrep.com.br` and `hml-chamado-...` routes.

## Automated notifications
- PRD Cron is gate-protected by encrypted Vault token and pending outbox. Without it, `cron.job` succeeds but sends no HTTP request.
- Avoid sending test emails accumulated while outbound worker is disabled. Review PRD `support_email_outbox` before enabling worker.

## User interface release
- CI `npm test` and `npm run build` must pass on the exact commit.
- Existing PRD Vercel project `payrep` currently deploys from `codex/foundation-multiuser-payroll`. Promote tested SHA of `codex/payrep-email-inbound-hml` to **this exact PRD project**, not the HML project.
- Verify login (Google, password, passkey), compulsory admin TOTP, multiuser RLS, finance calculations, user profile, subscription, help/tickets, responsive dialogs and HTML email notifications.
- Check that `VITE_SUPABASE_URL` points to `klvurrcmfrwetmynscjc` in PRD and does not inherit `VITE_HML_SUPABASE_PROJECT_REF`.
- Vercel Free deployment daily cap returned HTTP 402. Hourly ChatGPT automation will retry safely, with security gates.
