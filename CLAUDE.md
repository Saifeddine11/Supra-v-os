This folder contains the project “Supra v. Agency OS”.

Supra v. Agency OS is an internal premium SaaS for a digital/video agency. The goal is to manage clients, projects, video production, editorial planning, tasks, team workload, invoices, quotes, payments, reports, documents, client portal, notifications, employee reminders, cron jobs and production deployment.

Stack:
- Next.js
- TypeScript
- Supabase Auth / Database / RLS
- Tailwind CSS
- shadcn/ui
- React-PDF
- Resend
- Vercel target deployment
- Domain target: app.suprav3.com

Design identity:
- Premium black + Supra orange
- Main orange: #FF3D0A
- Alternative orange: #FF450F
- Orange glow: #FF6A2A
- Deep black: #080706
- Brown black: #1A0703
- Off-white: #F8F4EF
- Muted gray: #A8A19A
- Style must be modern, clean, premium, professional, no generic AI-looking UI, no flashy/gaming style.

Important rules:
- Do not break Supabase Auth, sessions, middleware, protected routes, /login, /dashboard, /api/auth/login.
- Never expose SUPABASE_SERVICE_ROLE_KEY or RESEND_API_KEY client-side.
- Do not commit .env.local or real secrets.
- Keep RLS enabled.
- Client portal must never expose internal notes, margins, employee workload or private comments.
- PDF templates can keep fixed black + orange branding.
- App UI supports dark/light/system theme.

Current project status:
- Auth works.
- Dashboard exists.
- Clients, tasks, videos, invoices, quotes, documents, reports, notifications and portal are partially/mostly implemented.
- Quotes have premium proposal PDF and portal accept/refuse.
- Notifications, cron reminders and email templates exist.
- Some sidebar pages may still be placeholders; audit before assuming complete.

When working:
1. Inspect existing files first.
2. Do not rebuild from scratch.
3. Make small, safe, production-minded changes.
4. Keep TypeScript clean.
5. Keep UI premium and consistent.
6. Run or ask to run npm run build after changes.
7. Clearly report files changed, what was fixed, what remains, and whether build passes.

If asked for an audit:
- Compare the implementation against the original agency OS vision.
- Identify completed modules, partial modules, placeholder pages, mock data, Supabase-backed data, security issues, UI/UX issues, production blockers.
- Give priorities as P0 urgent, P1 important, P2 improvement, P3 later.