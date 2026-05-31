# Supra v OS — Full QA Logic & Functionality Audit

**Audit date:** 2026-05-29  
**Auditor:** Automated read-only code audit (Cursor agent)  
**Repository:** Supra v. Agency OS (`supra-os`)  
**Baseline commit inspected:** `056aa30` (*bouttons fixed*)  
**Working tree:** 29 uncommitted files (date/deadline validation work — **not deployed**)

> **Important:** This audit inspected the codebase and ran safe build commands only. **No application code, migrations, commits, or pushes were made** as part of this audit. One file was created: this report.

---

## 1. Executive Summary

Supra v OS is a **mature, well-structured** internal agency OS with centralized RBAC (`capabilities.ts`), data scoping (`data-scope.ts`), SupAI guardrails, and consistent alert exclusion rules. Server-side permission checks on mutations and AI confirm routes are generally solid.

**Overall stability:** Moderate — core task/video CRUD and alert logic are sound, but **one critical workflow bug blocks task archiving everywhere**, and **past-date validation is absent on the deployed baseline** (only present in uncommitted local changes).

### Top risks

| Priority | Issue |
|----------|-------|
| **Critical** | Task **Archiver** always fails — `archived` status rejected by workflow guard |
| **High** | **No past-date validation on deployed HEAD** — users can create overdue tasks/videos |
| **High** | Task edit form displays deadlines in **UTC** while new validation (local only) uses **Europe/Paris** |
| **High** | Middleware enforces **auth only**, not RBAC — defense relies on per-route layouts/actions |
| **Medium** | Nested Radix dialogs (detail → edit) may trap focus on mobile/desktop |
| **Medium** | Video kanban drag does not refresh global critical alert bar |

### Issue counts (this audit)

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 5 |
| Medium | 8 |
| Low | 5 |
| **Total** | **19** |

---

## 2. Scope

Audited areas (static code review + safe commands):

- Role & permission matrix (11 role types)
- SupAI architecture, guardrails, scoped data, drafts, confirmations
- Task workflow (create, update, delete, archive, kanban, calendar)
- Video workflow (CRUD, kanban, shooting, delivery, statuses)
- Calendar (`/tasks/calendar`, agenda drawer, day view)
- Global critical alert bar and alert data rules
- Date/deadline validation (deployed vs working tree)
- Button/interaction patterns (Radix Dialog, nested modals)
- Security (secrets, service role, RLS, portal isolation)
- Mobile/responsive risk patterns

**Not performed:** Live browser E2E with real Supabase roles, RLS penetration testing, or production Vercel log review.

---

## 3. Commands Run

| Command | Result |
|---------|--------|
| `npm run build` | **PASS** after `rm -rf .next` (first attempt failed: Turbopack chunk cache `MODULE_NOT_FOUND`; known flaky cache issue) |
| `npm run type-check` (`tsc --noEmit`) | **PASS** — no TypeScript errors |
| `npm run lint` | **NOT RUN** — `next lint` prompts interactive ESLint setup (non-interactive environment); script deprecated in Next.js 16 |
| `npm test` | **N/A** — no test script in `package.json` |
| `supabase db push` | **Not run** (per audit constraints) |

### Test methodology

1. **Static analysis** — read server actions, API routes, RBAC helpers, SupAI pipeline, alert rules, form components.
2. **Cross-reference** — capabilities ↔ nav-policy ↔ data-scope ↔ supai-permissions ↔ server mutations.
3. **Git baseline** — compare `HEAD` (deployed) vs working tree (uncommitted date validation).
4. **Build verification** — compile + type-check on current workspace.
5. **Pattern search** — grep for secrets exposure, workflow guards, modal nesting, alert exclusions.

---

## 4. Role Permission Matrix

Legend: **Full** = org-wide where applicable · **Scoped** = assigned/visible records only · **None** = denied · **Nav** = navigation visible · **Create** = manual create · **SupAI±** = draft/confirm via SupAI (admin/PM only for create/update)

| Role | Nav (key modules) | SupAI | Task read | Task create/edit | Task delete/archive | Video read | Video create | Calendar scope | Finance | Global team data |
|------|-------------------|-------|-----------|------------------|---------------------|------------|--------------|----------------|---------|------------------|
| **admin** | Broad (all staff routes) | Yes | Full | Full | Full | Full | Yes | Global | Global KPIs | Yes |
| **project_manager** | Ops (no invoices/payments unless commercial path) | Yes | Full | Full | Full | Full | Yes | Global | **None** (by design) | Yes |
| **editor** | Dashboard, tasks, calendar, videos, documents | Yes | Scoped (assignments) | Create own tasks | None | Scoped | Yes | Personal + assigned | None | None |
| **cameraman** | Dashboard, tasks, calendar, videos, documents | Yes | Scoped | Create own tasks | None | Scoped | Yes | Personal + shootings | None | None |
| **designer** | Same nav as **developer** (`navKey` alias) | Yes | Scoped | Create own tasks | None | Via projects only | No videos nav | Personal | None | None |
| **developer** | Dashboard, tasks, calendar, projects, documents | Yes | Scoped | Create own tasks | None | None (no `/videos` nav) | No | Personal | None | None |
| **seo** | Dashboard, tasks, calendar, projects, reports, documents | Yes | Scoped | Create own tasks | None | None | No | Personal | None | None |
| **community_manager** | Dashboard, tasks, calendar, videos, editorial, documents | Yes | Scoped | Create own tasks | None | Scoped | Yes | Personal | None | None |
| **commercial** | Clients, projects, quotes, invoices, documents | Yes | **None** (`taskListingDenied`) | None | None | None | Yes (UI) / SupAI video create **No** | N/A tasks | Revenue (not global KPIs) | Portfolio clients only |
| **finance** | Invoices, quotes, payments, reports | Yes | **None** | None | None | None | No | N/A | Global finance | None |
| **client portal** | Token `/portal/client/[id]` only | **None** | Portal-safe fields only | None | None | Portal-safe | None | None | None | None |

### Permission mismatches / notes

| ID | Severity | Finding |
|----|----------|---------|
| PERM-01 | Medium | **Middleware** (`src/middleware.ts`) checks auth only — RBAC deferred to layouts (`enforceRouteAccess`) and server actions. `/dashboard`, `/settings`, `/notifications`, `/ai-assistant` are open to **any authenticated staff** without segment layout guard (SupAI page self-checks `canUseSupAI`). |
| PERM-02 | Low | **`designer`** maps to **`developer`** for navigation — intentional but may confuse audits. |
| PERM-03 | Info | **Commercial** can `canManageVideos` in UI but **SupAI video create** requires `hasFullOrgDataAccess` — intentional stricter SupAI gate. |
| PERM-04 | Info | **Finance/commercial** cannot list tasks at all (`taskListingDenied`) — matches product intent but blocks SupAI task search for those roles. |

**Sources:** `src/lib/auth/capabilities.ts`, `src/lib/auth/nav-policy.ts`, `src/lib/auth/data-scope.ts`, `src/lib/ai/supai-permissions.ts`

---

## 5. SupAI Audit

| # | Requirement | Verdict | Evidence |
|---|-------------|---------|----------|
| 1 | Staff-only | **PASS** | `requireStaffAiContext()`, `isStaff()`, inactive employee blocked |
| 2 | Portal users blocked | **PASS** | Portal is token-based public path; no staff session |
| 3 | Role quick actions | **PASS** | `getVisibleQuickActionIds(supai, role)` |
| 4 | Real scoped data (personal/calendar) | **PASS** | `getScopedCalendarWork`, `buildCalendarStructuredResponse`, `buildMyWorkStructuredResponse` bypass LLM |
| 5 | No invented tasks/videos | **PASS** (deterministic paths) / **RISK** (LLM paths) | Structured routes use DB; general chat may hallucinate (no write without confirm) |
| 6 | Structured cards | **PARTIAL** | Calendar/personal work → `resultGroups`; search/priorities still use `contextLinks` pills |
| 7 | No raw URLs in cards | **PASS** for structured cards | `supai-result-groups.tsx` uses `href` on buttons |
| 8 | Finance refusal | **PASS** | `guardrails.ts` + `canUseSupAIFinanceContext` |
| 9 | Secrets refusal | **PASS** | Regex guardrails + system prompt |
| 10 | Destructive refusal | **PASS** | Delete/archive/auto-send blocked |
| 11 | Create without confirm | **PASS** | Draft cards + separate `/api/ai/actions/create-*` |
| 12 | Update without confirm | **PASS** | `update-task` route + draft card |
| 13 | Same logic as manual create | **PASS** | `normalizeCreateTaskPayload` → `createTaskCore` |
| 14 | Same logic as manual video | **PASS** | `createVideoCore` |
| 15 | Alias resolution | **PARTIAL** | Hardcoded maps in `client-aliases.ts`, `employee-aliases.ts`; ambiguous → picker |
| 16 | Past dates | **PARTIAL** | Guardrails + normalize strips past ISO **in working tree**; **not on deployed HEAD** |

**Key files:** `src/app/api/ai/chat/route.ts`, `src/lib/ai/guardrails.ts`, `src/lib/ai/scoped-calendar-work.ts`, `src/lib/ai/build-result-groups.ts`, `src/components/ai/*`

---

## 6. Task Workflow Audit

| # | Requirement | Verdict |
|---|-------------|---------|
| Manual create | **PASS** — `createTaskAction` → `createTaskCore`, assignments, notifications |
| Required fields | **PASS** — title required server-side |
| Client / assignee linkage | **PASS** — `resolveClientRecordVisible`, `replaceTaskAssignments` |
| Multiple assignees | **PASS** — JSON `assignee_ids` + pivot table |
| Card display | **PASS** — enriched tasks with client/assignees |
| SupAI-created tasks | **PASS** — same core |
| Update (PM/admin) | **PASS** — `updateTaskAction` |
| Delete | **PASS** — admin/PM only |
| **Archive** | **FAIL** — see BUG-001 |
| Editor/cameraman delete | **PASS** — hidden via `canDeleteTask` |
| Button click handling | **PARTIAL** — calendar drawer fixed; kanban inline confirm weak |
| Confirm delete/archive | **PASS** — `ConfirmTaskActionDialog` |
| Board/calendar sync | **PASS** — `revalidatePath` on mutations |
| Drag/drop | **PASS** — optimistic kanban + rollback |
| Status → alerts | **PASS** — exclusions in `active-alert-rules.ts` |
| Done/archived/waiting/review excluded from stress alerts | **PASS** |

**Key files:** `src/app/(app)/tasks/actions.ts`, `src/lib/tasks/create-task-core.ts`, `src/lib/tasks/update-task-core.ts`, `src/app/(app)/tasks/kanban/*`

---

## 7. Video Workflow Audit

| # | Requirement | Verdict |
|---|-------------|---------|
| Manual create/update | **PASS** — `videos/actions.ts`, assignment guards, production task sync |
| Client linkage | **PASS** |
| Shooting / delivery dates | **PASS** (logic) / **FAIL** on deployed HEAD for past-date block |
| Editor/cameraman assignment | **PASS** — skill guards + overlap allowed |
| Status transitions | **PASS** — role-limited kanban (`assertVideoKanbanStatusTransitionAllowed`) |
| Delivered/archived/cancelled leave alerts | **PASS** — `VIDEO_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL` |
| Kanban buttons | **PASS** (functional) |
| Kanban alert refresh | **FAIL** — no `requestCriticalAlertsRefresh` after drag |
| SupAI video create | **PASS** — admin/PM only, `createVideoCore` |
| Scoped video visibility | **PASS** — `data-scope` + RLS complement |

**Key files:** `src/app/(app)/videos/actions.ts`, `src/lib/videos/create-video-core.ts`, `src/app/(app)/videos/videos-kanban.tsx`, `src/lib/alerts/video-alert-rules.ts`

---

## 8. Calendar Audit

| # | Requirement | Verdict |
|---|-------------|---------|
| Tasks with deadline on correct date | **PASS** — calendar data loaders |
| Tasks without deadline excluded | **PASS** |
| Month/week/day ranges | **PASS** |
| PM/Admin global calendar | **PASS** — `hasFullOrgDataAccess` |
| Limited roles scoped | **PASS** |
| Agenda drawer buttons | **PASS** (fixed in `056aa30`) — modals lifted outside drawer |
| Modal nesting (drawer) | **PASS** — `day-tasks-drawer.tsx` closes drawer then opens sibling modals |
| Modal nesting (detail→edit) | **FAIL** — `TaskDetailDialog` embeds `TaskFormDialog` |
| Mobile usability | **PARTIAL** — bottom sheet drawer; nested modal risk remains |
| Video deep link | **PASS** — `hrefVideosOpenDetailKanban` |

**Key files:** `src/app/(app)/tasks/calendar/*`, especially `day-tasks-drawer.tsx`, `calendar-task-action-host.tsx`, `calendar-task-agenda-actions.tsx`

---

## 9. Alerts Audit

| # | Requirement | Verdict |
|---|-------------|---------|
| Opaque background | **PASS** — `bg-background` on bar (`global-critical-alert-bar.tsx`) |
| No dashboard bleed-through expanded | **PASS** — solid backgrounds |
| Collapse on scroll | **PASS** — `SCROLL_COLLAPSE_THRESHOLD_PX = 8` |
| Compact bar stays visible | **PASS** |
| Détail / Fermer / Masquer / Voir | **PASS** — wired in component |
| Real totals (not preview limit only) | **PASS** — API returns `totals.totalActionableCount` |
| Task exclusions | **PASS** — `TASK_CRITICAL_ALERT_EXCLUDED_STATUSES_SQL = '(done,archived,waiting_client,review)'` |
| Video delivery exclusions | **PASS** — archived, cancelled, published, validated |
| Separated categories | **PASS** — tasks overdue, deliveries, shootings in `critical-alerts.ts` |
| Voir links | **PASS** — task/video deep links |
| PM global wording | **PASS** — scoped labels in builders |
| Personal vs team confusion | **LOW RISK** — SupAI calendar intent defaults global for PM on “demain” without “mes” |

**Key files:** `src/components/app/global-critical-alert-bar.tsx`, `src/lib/data/critical-alerts.ts`, `src/lib/alerts/active-alert-rules.ts`, `src/app/api/notifications/critical-active/route.ts`

---

## 10. Date Validation Audit

### Deployed baseline (`HEAD` / production)

| # | Requirement | Verdict |
|---|-------------|---------|
| New task past date blocked | **FAIL** — bare `datetime-local`, no server check |
| Today + past time blocked | **FAIL** |
| Edit task past deadline blocked | **FAIL** |
| SupAI past deadline | **PARTIAL** — guardrails for “hier” only; no server validation on confirm |
| Video past shooting/delivery | **FAIL** — shooting postpone has ad-hoc check only |
| Existing overdue visible | **PASS** |
| Timezone consistency | **FAIL** — task form uses UTC slice for display |
| Calendar local dates | **PASS** — date-fns local formatting |

### Working tree (uncommitted — **not deployed**)

Local changes add `src/lib/dates/validate-future-date.ts`, `OperationalDatetimeField`, server validation in cores/actions, SupAI guardrails. **Still has gaps:**

| Gap | Severity |
|-----|----------|
| Task form still initializes deadline via `toISOString().slice(0,16)` (UTC) | High |
| `normalize-update-task-payload.ts` validates deadline without `unchangedFrom` | High |
| `npm run build` on this tree passes | — |

**Recommendation:** Deploy date validation as a single release after fixing UTC display + SupAI update normalize.

---

## 11. Buttons / UI Interaction Audit

| Area | Verdict | Notes |
|------|---------|-------|
| Calendar agenda drawer | **PASS** | Fixed: buttons → parent `openTaskAction` → sibling modals |
| Kanban task card | **PARTIAL** | Inline `ConfirmDialog` without error toast; archive hits BUG-001 |
| Task detail → Modifier | **FAIL** | Nested `TaskFormDialog` inside `TaskDetailDialog` |
| Calendar day view host | **PARTIAL** | Can open detail + edit simultaneously |
| Video kanban | **PASS** | Standard patterns |
| SupAI draft cards | **PASS** | Confirm buttons disabled when blocked |

**Common anti-pattern:** Radix `Dialog` inside `DialogContent` — mitigated in drawer, not in detail dialog.

---

## 12. Security Audit

| # | Requirement | Verdict |
|---|-------------|---------|
| Service role not in frontend | **PASS** — `admin.ts` is `server-only` |
| API keys not committed | **PASS** — `.env.local` gitignored; `.env.example` placeholders only |
| SupAI secrets blocked | **PASS** |
| SupAI finance blocked for PM | **PASS** |
| SupAI cannot bypass RLS directly | **PASS** — uses user session; admin/PM mutations use service role **after** RBAC |
| Portal isolated from internal APIs | **PASS** — `/api/portal/*` public with token validation |
| Server routes enforce permissions | **PASS** on audited mutations; **RISK** middleware auth-only |
| Dangerous actions blocked | **PASS** in SupAI; manual delete/archive gated |
| No raw DB errors to users | **PASS** — formatted messages in actions |
| Passwords via Supabase Auth | **PASS** |

**Risks:** Service-role reads in `critical-alerts.ts` and `resolveTaskMutationClient` are intentional but high-trust — any scoping bug would leak data.

---

## 13. Mobile Audit

| Area | Risk | Notes |
|------|------|-------|
| Calendar month + agenda drawer | Medium | Bottom sheet OK; action buttons need tap target (`min-h-11`) — present |
| Nested modals | High | Detail→edit on small screens |
| SupAI result cards | Low | Responsive grid in `supai-result-groups.tsx` |
| Alert bar | Low | Scroll collapse helps; fixed bar |
| Sticky header | Low | App shell standard |
| Safari safe area | Medium | Drawer uses `env(safe-area-inset-bottom)` |
| Horizontal kanban | Medium | Expected scroll; DnD on touch varies by device |
| Confirmation dialogs | Medium | AlertDialog z-index elevated in detail dialog — partial fix |

---

## 14. Bugs Found

### BUG-001 — Task archive always fails

| Field | Value |
|-------|-------|
| **Severity** | **Critical** |
| **Area** | Tasks |
| **Description** | `archiveTaskAction` calls `updateTaskStatusAction(id, 'archived')`, but `isTaskStatusAllowedInWorkflow` only allows `TASK_KANBAN_STATUSES`, which **excludes** `archived`. |
| **Steps to reproduce** | 1. Login as admin or PM. 2. Open any task. 3. Click **Archiver**. 4. Confirm. |
| **Expected** | Task status → `archived`, removed from active board, toast success. |
| **Actual** | Error: *« Statut non disponible dans le workflow. »* — no status change. |
| **Likely files** | `src/app/(app)/tasks/actions.ts` (L347–349, L241–243), `src/types/domain.ts` (L252–278), `src/app/(app)/tasks/confirm-task-action-dialog.tsx` |
| **Recommended fix** | Dedicated archive mutation bypassing kanban workflow check, or allow `archived` in archive-only path. |

---

### BUG-002 — No past-date validation on deployed production

| Field | Value |
|-------|-------|
| **Severity** | **High** |
| **Area** | Tasks / Videos / Planning |
| **Description** | On `HEAD`, task/video forms use unrestricted `datetime-local` inputs; server actions accept any parsed ISO deadline/shooting/delivery date. |
| **Steps to reproduce** | 1. Open **Nouvelle tâche**. 2. Pick yesterday. 3. Save — task created as already overdue. |
| **Expected** | Blocked with inline + server error. |
| **Actual** | Task/video saved with past date; pollutes alerts. |
| **Likely files** | `src/app/(app)/tasks/task-form-dialog.tsx`, `src/app/(app)/tasks/actions.ts`, `src/lib/tasks/create-task-core.ts`, `src/app/(app)/videos/video-form-dialog.tsx` |
| **Recommended fix** | Deploy uncommitted `validate-future-date.ts` work after QA of edge cases. |

---

### BUG-003 — Task deadline displayed in UTC, not local/Paris

| Field | Value |
|-------|-------|
| **Severity** | **High** |
| **Area** | Tasks |
| **Description** | Task form uses `new Date(task.deadline).toISOString().slice(0, 16)` for `datetime-local`. Video form correctly uses `format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")`. |
| **Steps to reproduce** | 1. Save task deadline 15:00 Paris. 2. Reopen edit — field may show 13:00/14:00. |
| **Expected** | Local wall-clock matching stored intent. |
| **Actual** | UTC-based display; conflicts with Paris validation in working tree. |
| **Likely files** | `src/app/(app)/tasks/task-form-dialog.tsx` (L77–82) |
| **Recommended fix** | Reuse video `toDatetimeLocalValue` pattern. |

---

### BUG-004 — SupAI task update rejects unchanged past deadlines

| Field | Value |
|-------|-------|
| **Severity** | **High** |
| **Area** | SupAI / Tasks |
| **Description** | `normalize-update-task-payload.ts` validates deadline without `unchangedFrom`. Manual `updateTaskCore` allows unchanged past deadlines for other field edits. |
| **Steps to reproduce** | 1. Overdue task with past deadline. 2. SupAI: change title only (draft includes existing deadline ISO). 3. Confirm. |
| **Expected** | Title updates; deadline unchanged. |
| **Actual** | Normalization fails before core update. |
| **Likely files** | `src/lib/tasks/normalize-update-task-payload.ts` |
| **Recommended fix** | Pass current task deadline as `unchangedFrom` during normalize. |

---

### BUG-005 — Middleware does not enforce RBAC

| Field | Value |
|-------|-------|
| **Severity** | **High** (defense-in-depth) |
| **Area** | Security / Auth |
| **Description** | Middleware only checks Supabase session. Role-based path denial relies on optional `enforceRouteAccess` layouts. |
| **Steps to reproduce** | 1. Authenticated finance user navigates to `/tasks` URL directly. |
| **Expected** | Redirect `/access-denied` (tasks layout calls `enforceRouteAccess`). |
| **Actual** | **Blocked** by tasks layout — but `/dashboard` and other unguarded staff routes remain reachable. Low exploit if actions enforce RBAC. |
| **Likely files** | `src/middleware.ts`, `src/lib/auth/nav-access.ts` |
| **Recommended fix** | Add RBAC check in middleware or layouts for all `(app)` segments. |

---

### BUG-006 — Video kanban drag does not refresh critical alert bar

| Field | Value |
|-------|-------|
| **Severity** | **Medium** |
| **Area** | Videos / Alerts |
| **Description** | Task kanban calls `requestCriticalAlertsRefresh()` after status drag; video kanban only `router.refresh()`. |
| **Steps to reproduce** | 1. Video in delivery alert. 2. Drag to published on kanban. 3. Alert bar may show stale count until 5‑min poll. |
| **Expected** | Immediate alert bar update. |
| **Actual** | Delayed update. |
| **Likely files** | `src/app/(app)/videos/videos-kanban.tsx` |
| **Recommended fix** | Call `requestCriticalAlertsRefresh()` after successful video status mutation. |

---

### BUG-007 — Nested Dialog: detail → edit

| Field | Value |
|-------|-------|
| **Severity** | **Medium** |
| **Area** | Tasks / UI |
| **Description** | `TaskDetailDialog` renders `TaskFormDialog` as child. Opening **Modifier** from detail creates dialog-on-dialog. |
| **Steps to reproduce** | 1. Kanban or calendar → **Détails**. 2. **Modifier** inside detail. |
| **Expected** | Smooth edit flow. |
| **Actual** | Possible focus trap, extra dismiss steps, mobile friction. |
| **Likely files** | `src/app/(app)/tasks/kanban/task-detail-dialog.tsx` (L276+) |
| **Recommended fix** | Hoist edit modal sibling pattern (same as calendar drawer). |

---

### BUG-008 — CalendarTaskActionHost can stack detail + edit modals

| Field | Value |
|-------|-------|
| **Severity** | **Medium** |
| **Area** | Calendar |
| **Description** | Independent `detailOpen` and `editOpen` states — both can be true. |
| **Likely files** | `src/app/(app)/tasks/calendar/calendar-task-action-host.tsx` |
| **Recommended fix** | Mutual exclusion or single `taskAction` state machine. |

---

### BUG-009 — Kanban inline archive/delete confirm lacks error feedback

| Field | Value |
|-------|-------|
| **Severity** | **Medium** |
| **Area** | Tasks / Kanban |
| **Description** | `draggable-task-card.tsx` uses legacy trigger-based confirm without checking `res.ok` or toasting errors. |
| **Likely files** | `src/app/(app)/tasks/kanban/draggable-task-card.tsx` |
| **Recommended fix** | Use `ConfirmTaskActionDialog` pattern with toast + alert refresh. |

---

### BUG-010 — SupAI mixed structured cards vs link pills

| Field | Value |
|-------|-------|
| **Severity** | **Medium** |
| **Area** | SupAI UX |
| **Description** | Calendar/personal work use `resultGroups` cards; search/priorities use `contextLinks` text buttons. |
| **Likely files** | `src/app/(app)/ai-assistant/ai-assistant-client.tsx`, `src/lib/ai/context-tools.ts` |
| **Recommended fix** | Extend structured cards to all operational result types. |

---

### BUG-011 — Hardcoded SupAI alias dictionaries

| Field | Value |
|-------|-------|
| **Severity** | **Medium** |
| **Area** | SupAI |
| **Description** | Client/employee nicknames (jul, mymy, emara, etc.) are hardcoded — brittle for new hires/clients. |
| **Likely files** | `src/lib/ai/client-aliases.ts`, `src/lib/ai/employee-aliases.ts` |
| **Recommended fix** | DB-backed aliases or fuzzy match on visible roster. |

---

### BUG-012 — Build cache flake without clean `.next`

| Field | Value |
|-------|-------|
| **Severity** | **Medium** |
| **Area** | DevOps |
| **Description** | First `npm run build` failed: `Cannot find module '../chunks/ssr/[turbopack]_runtime.js'`. Succeeded after `rm -rf .next`. |
| **Recommended fix** | Document clean build in CI; investigate Turbopack/webpack cache. |

---

### BUG-013 — `completed_at` not cleared when leaving `done`

| Field | Value |
|-------|-------|
| **Severity** | **Low** |
| **Area** | Tasks |
| **Description** | `updateTaskStatusAction` sets `completed_at` on done but never nulls when moving back to todo. |
| **Likely files** | `src/app/(app)/tasks/actions.ts` |
| **Recommended fix** | Clear `completed_at` when status ≠ done. |

---

### BUG-014 — Alert deep-link rejects paused task statuses

| Field | Value |
|-------|-------|
| **Severity** | **Low** |
| **Area** | Tasks |
| **Description** | Kanban highlight action treats `waiting_client` / `review` as “already resolved” for deep link. |
| **Likely files** | `src/app/(app)/tasks/tasks-kanban.tsx` |
| **Recommended fix** | Allow highlight for paused statuses if alerts ever link to them. |

---

### BUG-015 — ESLint not configured for CI

| Field | Value |
|-------|-------|
| **Severity** | **Low** |
| **Area** | DevOps |
| **Description** | `npm run lint` triggers interactive setup — not suitable for automated QA. |
| **Recommended fix** | Migrate to ESLint CLI per Next.js 16 guidance. |

---

### BUG-016 — No automated test suite

| Field | Value |
|-------|-------|
| **Severity** | **Low** |
| **Area** | QA |
| **Description** | No `npm test` script — regression risk on RBAC, alerts, SupAI. |
| **Recommended fix** | Add unit tests for `validate-future-date`, alert rules, workflow guards. |

---

### BUG-017 — PM calendar queries default to global scope

| Field | Value |
|-------|-------|
| **Severity** | **Low** |
| **Area** | SupAI |
| **Description** | “On a quoi demain” without “mes” resolves to global calendar for PM/admin — correct but easy to misread. |
| **Likely files** | `src/lib/ai/calendar-intent.ts` |
| **Recommended fix** | UX copy clarifying team vs personal scope. |

---

### BUG-018 — Shooting confirmation expected-end date has min only in working tree

| Field | Value |
|-------|-------|
| **Severity** | **Low** |
| **Area** | Videos |
| **Description** | Postpone shooting uses validation on server; UI `min` on datetime added in uncommitted files only. |
| **Likely files** | `shooting-confirmation-modal.tsx`, `shooting-actions.ts` |

---

### BUG-019 — Uncommitted date validation not on production

| Field | Value |
|-------|-------|
| **Severity** | **High** (deployment gap) |
| **Area** | Release process |
| **Description** | 29 modified/untracked files for date validation exist locally but are **not committed** to `HEAD`. Production at `056aa30` lacks this module entirely. |
| **Recommended fix** | Commit, QA, deploy as dedicated release after fixing BUG-003/004. |

---

## 15. Recommended Fix Order

1. **Critical blockers**
   - BUG-001: Fix task archive workflow

2. **Security / data integrity**
   - BUG-005: RBAC defense-in-depth (middleware or universal layout)
   - Verify service-role scoping on any change to alerts/mutations

3. **Role / scope**
   - Document commercial/finance task denial for SupAI users

4. **Date / alert logic**
   - BUG-002/019: Deploy date validation (after BUG-003/004 fixes)
   - BUG-006: Video kanban alert refresh

5. **UI / interaction polish**
   - BUG-007/008: Modal nesting
   - BUG-009: Kanban confirm error handling
   - BUG-010/011: SupAI UX consistency

6. **DevOps / QA**
   - BUG-012/015/016: Build reliability, lint, tests

---

## 16. Final QA Checklist (manual retest)

Use after fixes are deployed. Test on **mobile width (375px)** and **desktop**.

### Auth & roles
- [ ] Admin can access tasks, videos, calendar, SupAI, settings technical (admin only)
- [ ] PM can create/edit/delete/archive tasks and manage videos; **cannot** access payments/global finance KPIs
- [ ] Editor sees only assigned tasks/videos; cannot delete tasks
- [ ] Cameraman sees shootings + assigned work; can postpone shooting with future date only
- [ ] Finance/commercial cannot open `/tasks` (access denied)
- [ ] Client portal token URL shows no internal data, no SupAI

### Tasks
- [ ] Create task with future deadline — success
- [ ] Create task with past deadline — **blocked** (after date fix deployed)
- [ ] Edit task title on overdue task without changing deadline — success
- [ ] **Archive task — success** (after BUG-001 fix)
- [ ] Delete task — confirm dialog → removed
- [ ] Kanban drag changes status; alert bar updates

### Calendar
- [ ] Task appears on deadline date only
- [ ] Mobile: tap day → agenda drawer → **Détails / Modifier / Archiver / Supprimer** all respond
- [ ] **Ouvrir la production vidéo** navigates to correct video kanban deep link
- [ ] Modifier from detail does not freeze UI

### Videos
- [ ] Create video with future shooting + delivery dates
- [ ] Past shooting/delivery — **blocked** (after date fix)
- [ ] Kanban drag to published removes delivery alert promptly
- [ ] Cameraman role-limited status transitions enforced

### SupAI
- [ ] “J’ai quoi comme tâches ?” — real assigned data, structured cards
- [ ] “On a quoi le 29 ?” — PM sees team scope; editor sees personal only
- [ ] “Crée une tâche hier” — refusal, no draft with past date
- [ ] Create task draft → confirm → appears on board
- [ ] Finance question as PM — refused
- [ ] Secrets question — refused

### Alerts
- [ ] Overdue task in `done` / `archived` / `waiting_client` / `review` — **not** in critical bar
- [ ] Delivered video — not in delivery alert
- [ ] Expand details → opaque panel; scroll page → details collapse, compact bar remains
- [ ] **Voir** opens correct task/video

### Security smoke
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` in browser network tab or page source
- [ ] `/api/ai/chat` returns 401 when logged out

---

## Appendix — Key file index

| Domain | Primary files |
|--------|----------------|
| RBAC | `src/lib/auth/capabilities.ts`, `nav-policy.ts`, `data-scope.ts`, `nav-access.ts` |
| SupAI | `src/app/api/ai/chat/route.ts`, `src/lib/ai/guardrails.ts`, `supai-permissions.ts`, `scoped-calendar-work.ts` |
| Tasks | `src/app/(app)/tasks/actions.ts`, `src/lib/tasks/create-task-core.ts`, `update-task-core.ts` |
| Calendar | `src/app/(app)/tasks/calendar/day-tasks-drawer.tsx`, `calendar-task-action-host.tsx` |
| Videos | `src/app/(app)/videos/actions.ts`, `src/lib/videos/create-video-core.ts` |
| Alerts | `src/lib/alerts/active-alert-rules.ts`, `src/lib/data/critical-alerts.ts`, `global-critical-alert-bar.tsx` |
| Dates (local only) | `src/lib/dates/validate-future-date.ts`, `operational-datetime-field.tsx` |
| Security | `src/lib/supabase/admin.ts`, `src/middleware.ts` |

---

*End of report — no application code was modified during this audit.*
