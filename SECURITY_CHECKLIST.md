# Production security checklist — Supra v. Agency OS

Use this before and after go-live at `https://app.suprav3.com`.

## Secrets

- [ ] Never commit `.env.local` or any file containing real keys.
- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY` if it was ever exposed (chat, screenshot, public repo).
- [ ] Store all secrets in Vercel **Environment Variables** (Production + Preview as needed).
- [ ] Generate `CRON_SECRET` with `openssl rand -hex 32` — unique per environment.
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` only on the server; never prefix with `NEXT_PUBLIC_`.
- [ ] `POST /api/dev/send-test-email` requires an **admin** session; it never returns the API key. Prefer disabling or monitoring abuse if you expose admin accounts.

## Supabase

- [ ] Row Level Security remains **enabled** on all public tables (do not disable globally).
- [ ] **Auth** → URL configuration:
  - Site URL: `https://app.suprav3.com`
  - Redirect URLs include:
    - `https://app.suprav3.com/**`
    - `http://localhost:3000/**`
    - `http://localhost:3001/**`
- [ ] Service role is used only in server-only modules (cron, portal token validation, bulk notifications, Storage uploads / signed URLs).
- [ ] Private Storage buckets (`documents`, `deliverables`, `reports`, `quotes`, `invoices`) are **not** public; staff and portal use **signed URLs** or authenticated download routes only.

## Content-Security-Policy (production)

- [ ] `vercel.json` sets a CSP on all routes. Current policy allows `unsafe-inline` / `unsafe-eval` for **Next.js** and `connect-src` to **Supabase** (`https://*.supabase.co`, `wss://*.supabase.co`) and **Vercel** tooling. Adjust if you add new third-party scripts or CDNs.
- [ ] After changing CSP, smoke-test: **login** (Supabase auth), **dashboard**, **portal** (`/portal/...` + token), **PDF** routes (`/api/quotes/.../pdf`, `/api/invoices/.../pdf`, `/api/reports/.../pdf`, portal variants), **Storage** redirects (`/api/documents/.../download`, `/api/portal/documents/.../download`), **dev email preview** (`/api/dev/email-preview` — dev only), in-app **fetch** to Supabase, and **cron** (401 without secret).
- [ ] Stricter CSP (nonces, hashed scripts) is recommended in a follow-up; document blockers in the internal runbook before tightening `script-src`.

## Application

- [ ] No `createClient` with service role in Client Components or shared client bundles.
- [ ] Cron routes return **401** when `Authorization: Bearer` or `x-cron-secret` does not match `CRON_SECRET`.
- [ ] **Vercel Hobby** : un seul cron planifié dans `vercel.json` — `/api/cron/daily` (les autres routes `/api/cron/*` restent pour tests manuels ou après upgrade Pro).
- [ ] Client portal: token validation stays server-side; no internal notes, margins, or workload in portal payloads.
- [ ] Portal quote response endpoint (`/api/portal/quotes/[id]/respond`) is server-only, validates token + client ownership, and refuses non-`sent` statuses.
- [ ] Quote PDF routes (staff + portal) never render internal notes or private costing data.

## DNS & hosting

- [ ] Vercel project linked; domain `app.suprav3.com` added.
- [ ] DNS: **CNAME** `app` → `cname.vercel-dns.com` (or provider-specific target Vercel shows).

## Verification commands

```bash
# Cron must reject without secret (production uses consolidated /api/cron/daily on Hobby)
curl -s -o /dev/null -w "%{http_code}" https://app.suprav3.com/api/cron/daily
# expect 401

# With secret (replace VALUE)
curl -s -H "Authorization: Bearer VALUE" https://app.suprav3.com/api/cron/daily
```

Individual routes (`/api/cron/morning-reminders`, etc.) use the same `CRON_SECRET` and remain available for manual tests.

## After incidents

- [ ] Revoke leaked keys, redeploy, update Vercel env, document in internal runbook.
