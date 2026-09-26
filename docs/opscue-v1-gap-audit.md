# OPSCUE-0 — OpsCue V1 Product Rebaseline & Gap Audit

## 0. Executive summary

This audit rebaselines the current `dispatch-os` repository against the OpsCue V1 pilot direction. It is a repository audit, not an implementation phase. No existing canonical contract is renamed or reinterpreted here.

The repository already contains a substantial, security-conscious operations core: Project / Job / Shift management, Application review, canonical Assignment creation, explainable Candidate Eligibility, Candidate Picker, Placement and break planning, Coverage, pre-shift confirmation, day-of monitoring, Attention, Incident / Help Request, Availability / Work Conditions, in-app Notification, and append-only history in selected domains. These foundations should be reused.

The critical V1 gap is on the Worker journey and its unifying operational model. There is no Worker recruitment discovery or application UI, no explicit Wake / Departure / Arrival facts, and no canonical `One Shift, One Timeline` projection. The current attendance contract records `start_work` and `end_work`; it must not be relabeled as Arrival. LINE delivery and external deep-link entry are also absent. Admin capabilities are much closer to pilot-ready, but reminders are operator-triggered rather than scheduled/delivery-backed, and day-of monitoring cannot show states that do not yet exist.

Recommended roadmap namespace: **`OCV1-01`, `OCV1-02`, ...**. It is distinct from the historical `OPS-*`, `STAFF-*`, `DB-*`, `UI-*`, and `NOTIF-*` identifiers.

### Classification rules

| Classification | Meaning in this audit |
| --- | --- |
| `COMPLETE` | Canonical persistence/read model, authorization, normal product UI, and relevant verification evidence exist for the stated V1 capability. |
| `PARTIAL` | Useful and reusable pieces exist, but the V1 user journey, state coverage, delivery path, or verification is incomplete. |
| `MISSING` | No product-capable implementation was found. Visual references or unused schema fields alone do not count. |
| `CONTRACT CONFLICT` | The requested OpsCue meaning cannot safely be obtained by renaming or reinterpreting an existing canonical fact. A deliberate additive contract decision is required. |
| `OUT OF V1` | Implemented or contemplated functionality is not required to complete the stated pilot. It may remain in the product without becoming a pilot dependency. |

## 1. Current architecture summary

### Application architecture

- Next.js 16.3.1 App Router, React 19, TypeScript, Tailwind CSS, and Supabase/PostgreSQL/Auth.
- Routes are separated into `/admin/*` and `/worker/*`, with server-side `requireAdmin` / `requireWorker` guards. `profiles.account_type` remains the role source of truth.
- Pages are predominantly Server Components. Interactive drawers, forms, dialogs, and inbox behavior are isolated into Client Components. Reads live under `lib/admin/*` and `lib/worker/*`; mutations use Server Actions under `app/actions/*`.
- Supabase RLS is defense in depth. Sensitive writes use narrow `SECURITY DEFINER` RPCs with server-derived actor, Worker, Branch, and source context. Canonical command paths use idempotency, locking, and controlled result/error shapes.

### Current domain chain

```text
Project
  -> Job (recruitment/work conditions)
    -> Shift Slot
      -> Shift Application
      -> Assignment
        -> Placement Plan / Position / Break
        -> Pre-shift Confirmation
        -> Attendance Event (start_work / end_work)
        -> Operational Incident
        -> Notification projection
```

Supporting domains include Worker Skill / Qualification holdings, structured Job requirements, Worker Availability / Work Conditions, Candidate Eligibility, Attention projections, time-band Coverage, Announcements, and selected append-only histories.

### Important architectural boundary

The repository does **not** currently have one canonical Shift Timeline aggregate. The UI composes separate facts from Assignment, pre-shift confirmation, attendance, Incident, Notification, and planning tables. This is reusable source material, but it does not yet satisfy the OpsCue promise of one ordered Worker/Admin operational timeline.

## 2. Capability matrix

### 2.1 Worker

| Capability | Status | Current evidence | V1 gap / decision |
| --- | --- | --- | --- |
| Home | `PARTIAL` | `/worker` is an action-oriented “次の勤務” list with pre-shift and attendance status; responsive evidence exists. | It is assignment-centric and has no recruitment/application cards or computed “next required action” spanning confirmation, Wake, Departure, and Arrival. |
| Recruitment discovery | `MISSING` | Recruiting Project/Job/Shift fields and Worker read RLS exist; Figma references exist. | No Worker route, query model, eligibility-aware listing, filters, or empty/error flow. |
| Application | `PARTIAL` | `shift_applications`, Worker insert/update RLS, Admin application list/review actions, and Application-to-Assignment paths exist. | No Worker apply/withdraw UI or Worker application history/status surface was found. Application deadlines and eligibility need presentation/command integration. |
| My Shifts | `PARTIAL` | `/worker` queries Worker-owned Assignments and links to details. | It is titled/structured as “next shifts,” with no explicit upcoming/past/cancelled grouping, application-pending state, or timeline-based next action. |
| Shift Detail | `COMPLETE` | `/worker/assignments/[assignmentId]` shows authorized Assignment context, preparation, pre-shift confirmation, attendance, and Help Request. | Reuse as the shell for the OpsCue timeline; extend rather than replace. |
| Preparation information | `COMPLETE` | Existing Job/Workplace fields cover clothing, belongings, access, meeting, lodging, transport, meal/manual/recruitment notes; Worker Assignment detail reads the assigned context. | Audit content completeness per pilot operator; no new generic content model is required for V1. |
| Pre-shift confirmation | `COMPLETE` | Worker form, server action/RPC/RLS, Admin detail and monitor, rules and integration tests exist. | Reuse unchanged as a timeline fact. |
| Wake | `MISSING` | No Wake event, command, read model, or UI was found. | Define an explicit operational event and time window; do not infer it from login or notification read. |
| Departure | `MISSING` | No Departure event, command, read model, or UI was found. | Define explicit state/event semantics and correction/idempotency behavior. |
| Arrival | `CONTRACT CONFLICT` | Current attendance supports `start_work` / `end_work` only. | Arrival is earlier/different from work start in field operations. Renaming `start_work` to Arrival would corrupt the attendance contract and downstream day-of meaning. Add a distinct fact or explicitly decide they are equal for a narrowly documented pilot—do not assume equivalence. |
| Incident / SOS | `COMPLETE` | Assignment-scoped Help Request supports create, retract, status/history; Admin list, acknowledge, resolve, Day-of cue, append-only events, RLS, and notification integration exist. | Current vocabulary is Help Request rather than severity-based emergency SOS. That is sufficient for V1 if pilot escalation remains operational/manual. |
| Availability / Work Conditions | `COMPLETE` | STAFF-2D/2E/2I provide canonical interval/preference persistence, Worker-owned UI, Admin read-only view, RLS, and Candidate consumption. | Recurrence and Admin override are intentionally not part of the current contract. |

### 2.2 Admin

| Capability | Status | Current evidence | V1 gap / decision |
| --- | --- | --- | --- |
| Project / Shift management | `COMPLETE` | Project, Job, Workplace, Shift create/edit/list/detail flows; bulk Shift creation; server validation; authorization; history and extensive UI regression evidence. | Preserve current hierarchy and canonical routes. |
| Recruitment | `PARTIAL` | Project/Job/Shift lifecycle and recruitment fields, deadlines, wages/conditions, structured requirements, and Admin editors exist. | No clear publication preview/audience validation or Worker-facing end-to-end recruitment proof. Recruitment is configured, not yet completed as a two-sided flow. |
| Applications | `COMPLETE` | Shift detail lists Applications and supports accept/reject lifecycle with server actions and protected DB behavior. | Worker-side submission/history remains separate gap. |
| Assignment | `COMPLETE` | Canonical Application Assignment and STAFF-2G `ensure_candidate_assignment` command cover accepted-application/direct-admin paths, capacity, eligibility, idempotency, and concurrency. | Reuse; do not introduce a second Assignment lifecycle for OpsCue. |
| Placement | `COMPLETE` | Canonical Placement plan, positions, time segments, breaks, versioned atomic save, warnings, editor, and Assignment handoff exist. | Reuse Assignment UUID boundary and existing optimistic concurrency. |
| Candidate Picker | `COMPLETE` | Explainable eligibility, bounded candidate reader, search/groups/reasons, explicit Assignment decision, and Placement handoff exist. | Keep “implemented hard rules only”; do not present it as AI ranking or final universal eligibility. |
| Coverage | `COMPLETE` | Time-band coverage and Placement shortage warnings are derived from canonical staffing/placement facts and tested. | Coverage is planning coverage, not Wake/Departure/Arrival compliance. Keep the terms distinct. |
| Pre-shift confirmation | `COMPLETE` | Cross-shift monitor, detail Drawer/section, confirmation state, and tests exist. | Reuse as an Admin timeline/Attention source. |
| Day-of monitoring | `PARTIAL` | `/admin/shifts/day-of` aggregates scheduled/working/finished, missing work-start attention, pre-shift state, and Incident attention. | Cannot monitor Wake/Departure/Arrival until those facts exist. Current “scheduled/working/finished” is attendance-centric. |
| Attention | `COMPLETE` | Derived priority queue, action-first dashboard, source links, reminders/re-notify actions, and tests exist. | Extend sources after new operational events exist; do not replace the projection with a second task table without need. |
| Reminders | `PARTIAL` | Pre-confirmation reminder projection, Worker inbox item, Admin Attention reminder/re-notify action, idempotency, and source navigation exist. | No scheduler, durable outbound delivery, LINE provider, retry/receipt model, or automatic escalation evidence. Current reminders require an operator/action path. |
| Incident / SOS | `COMPLETE` | Admin Incident queue/detail, acknowledge/resolve, audit events, Day-of integration, Worker notification, and security tests exist. | Emergency escalation, severity, SLA, phone/LINE dispatch, GPS, and realtime are explicitly absent and not required unless pilot operations demand them. |

### 2.3 Platform

| Capability | Status | Current evidence | V1 gap / decision |
| --- | --- | --- | --- |
| Notification | `PARTIAL` | Recipient-owned in-app inbox, incident/announcement/pre-confirmation projections, unread/read behavior, safe source resolver, pagination, and integration tests exist. | In-app only; not a general delivery/outbox system. No provider delivery status, retry policy, scheduler, or LINE channel. |
| LINE / deep-link readiness | `MISSING` | Internal source navigation builds links to authorized Worker Assignment/Announcement routes. | No LINE integration, account linking, signed/stateful entry, universal/app link contract, login-return flow, campaign parameters, or provider webhook/delivery receipts. Internal links alone are not external deep-link readiness. |
| Auth / role boundaries | `COMPLETE` | Server route guards, `profiles.account_type`, active-profile checks, Branch authorization, RLS, RPC-only sensitive writes, IDOR/security tests. | Pilot provisioning/recovery/runbook and production identity configuration still need operational verification. |
| Operational state model | `CONTRACT CONFLICT` | Strong canonical models exist for Application, Assignment, Placement, Confirmation, attendance, Incident, and Notification. | OpsCue needs Wake/Departure/Arrival and a cross-domain timeline. Existing facts have independent lifecycles; collapsing them into Assignment status or attendance event names would destroy canonical meanings. Build an additive event/projection contract. |
| Responsive / mobile readiness | `PARTIAL` | Many Admin and Worker flows have 390×844/1280/1440 Chrome evidence, keyboard/focus/overflow/console checks, and shared responsive shells. | Recruitment/application and future Timeline/Wake/Departure/Arrival have no UI to verify. Full pilot journey regression is not yet available. |
| Audit / history | `PARTIAL` | Operational Incident events, Placement revisions, Project/Job/Shift history, attendance revisions, immutable availability corrections, and command receipts exist. | There is no unified per-Shift operational history or audit coverage for future Wake/Departure/Arrival/LINE actions. Retention/export policy is not established. |
| Production blockers | `PARTIAL` | Production builds and extensive local integration/browser suites have passed in prior phase evidence. | No evidence in this audit of a deployed pilot environment, production Supabase parity for the newest local contracts, seeded/provisioned pilot identities, LINE credentials/config, observability/alerting, backup/restore exercise, retention policy, or an end-to-end pilot smoke test. Treat all as release gates, not as confirmed failures. |

## 3. Reusable completed foundations

The following contracts are valuable, already validated foundations and should not be reimplemented under new OpsCue names.

1. **STAFF-2 Skill / Qualification / structured requirements**
   - Canonical Worker holdings and Job requirements.
   - Explainable, closed reason codes and server-side authorization.

2. **Candidate Eligibility**
   - Composes Worker status, requirements, Availability, Assignment overlap, and informational preferences.
   - Explicitly scoped as `implemented_hard_rules_only`; unknown/consultable availability and preference mismatch retain their frozen nonblocking meanings.

3. **Candidate Assignment**
   - `ensure_candidate_assignment` is the canonical idempotent command for accepted-application and direct-admin decisions.
   - Capacity, Shift lifecycle, eligibility, provenance, Branch access, and concurrency are revalidated server-side.

4. **Placement**
   - Canonical Assignment-to-position/time/break plan with versioned atomic save and append-only revisions.
   - Candidate selection, Assignment creation, and Placement save remain intentionally distinct steps.

5. **Attention**
   - Derived from source facts rather than stored as a competing workflow truth.
   - Existing priority/source navigation and action-first home are the right extension point for new overdue operational events.

6. **Coverage**
   - Existing time-band and shortage derivation should remain the staffing/placement planning view.
   - Do not overload it with day-of Worker journey compliance.

7. **Notification**
   - Recipient-owned immutable in-app projections, safe content, source authorization, first-read semantics, and idempotent projection patterns are reusable.
   - Add channels/delivery around this boundary; do not make Notification the source of operational state.

8. **Pre-shift, Incident, Availability, and security foundations**
   - These already supply normal UI paths, server-side rules, RLS, narrow commands, and focused verification suites.

## 4. Missing V1 capabilities

### P0: blocks the stated Worker pilot flow

- Worker recruitment discovery query and mobile UI.
- Worker Shift/recruitment detail before Assignment.
- Worker apply, withdraw, and application-status/history flow using the existing Application contract.
- Explicit Wake event and Worker action.
- Explicit Departure event and Worker action.
- Explicit Arrival event and Worker action, separate from `start_work` unless a documented product decision proves equivalence.
- A canonical, ordered Shift Timeline read model that composes existing and new source facts without becoming a second source of truth.
- Worker Home/My Shifts “next required action” projection across confirmation, Wake, Departure, and Arrival.
- Admin day-of and Attention integration for missing/late Wake, Departure, and Arrival.

### P1: blocks a credible operational pilot/release

- LINE entry/deep-link authentication and return-to-intended-route contract.
- Notification delivery boundary for LINE, including consent/account link, safe templates, idempotency, provider result/receipt, retry/reconciliation, and opt-out/fallback decisions.
- Scheduled reminder orchestration. Existing manual re-notify remains useful but is not automation.
- Pilot-wide mobile/keyboard/console/browser regression covering both Worker and Admin journeys.
- Production environment parity, provisioning, observability, retention, backup/restore, and runbooks.

## 5. Contract conflicts and protected boundaries

### 5.1 Arrival is not `start_work`

`attendance_events.event_type = start_work | end_work` and the related Worker/Admin actions are attendance facts. Arrival is a site-progress fact that may happen before work begins and may trigger different operational intervention. Reusing the same event would make it impossible to distinguish “arrived but not started” from “not arrived,” and would change existing attendance reports/tests. The new contract must be additive.

### 5.2 One Timeline is a projection, not a replacement aggregate

Application, Assignment, Placement, confirmation, attendance, Incident, and Notification have different ownership and lifecycle rules. A V1 Timeline should order authorized references/snapshots of canonical facts. It should not rewrite those tables into a generic mutable status log or make client-provided event order authoritative.

### 5.3 Assignment and Placement remain separate

Candidate selection is UI state; Assignment is a staffing decision; Placement is the on-site position/time plan. The current STAFF-2G handoff explicitly preserves these boundaries. OpsCue naming must not merge them into one ambiguous “assigned/placed” status.

### 5.4 Eligibility scope must remain explainable

Current Candidate Eligibility does not include travel time, free-text area/category matching, ranking, AI scoring, or universal “final placement eligibility.” OpsCue recruitment UI may expose the result, but must retain its scope and reason semantics.

### 5.5 Notification is not operational truth

Read/unread and provider delivery cannot mean confirmed, awake, departed, or arrived. Notifications invite the Worker to act; only the relevant command records the operational fact.

### 5.6 Attendance/payroll stays external to the pilot promise

The repository contains start/end attendance, confirmation, revisions, absence/no-show, and attendance Admin UI. The stated OpsCue pilot ends at Arrival and keeps formal attendance/payroll/billing external. Existing functionality may remain, but the pilot must not depend on positioning it as a payroll system of record.

## 6. Recommended implementation order

| Phase | Outcome | Reuse / gate |
| --- | --- | --- |
| `OCV1-01` | Freeze OpsCue journey/event vocabulary and Timeline projection contract. Decide event identity, allowed windows, correction, idempotency, overdue rules, and Arrival-vs-start-work boundary. | Read-only design phase. Reuse Assignment, confirmation, attendance, Incident, Notification, and Attention semantics without changing them. |
| `OCV1-02` | Worker recruitment discovery and pre-assignment Shift detail. | Reuse Project/Job/Shift recruitment fields, structured requirements, Availability and Candidate Eligibility. Prove RLS-safe bounded reads. |
| `OCV1-03` | Worker application lifecycle UI and My Applications/My Shifts integration. | Reuse `shift_applications` and existing review/Assignment commands. Do not create a second application table or status set. |
| `OCV1-04` | Persist Wake / Departure / Arrival through narrow Worker-owned commands and expose the canonical Shift Timeline reader. | Additive migration only; server-derived Assignment/Worker/Branch; idempotent and concurrency-safe; preserve attendance. |
| `OCV1-05` | Worker action-first Home, My Shifts, and Timeline UI. | Reuse current Assignment detail, preparation, pre-shift, Incident, and responsive Worker shell. |
| `OCV1-06` | Admin day-of and Attention extensions for new event states and overdue cues. | Extend current derived monitors/queues; keep Coverage semantics separate. |
| `OCV1-07` | Reminder automation plus LINE/deep-link entry and delivery. | Reuse in-app Notification/source resolver patterns. Freeze consent, account linking, provider receipts, retries, and fallback before implementation. |
| `OCV1-08` | Pilot hardening and release evidence. | Production parity, identity provisioning, observability, retention/runbooks, security regression, responsive E2E, failure drills, and pilot acceptance. |

The next implementation phase should be **`OCV1-01`**, because Wake/Departure/Arrival semantics and the Timeline boundary affect Worker UI, Admin monitoring, Attention, reminders, and LINE templates. Starting with UI would force those consumers to guess the state model.

## 7. V1 pilot completion criteria

### Worker acceptance

- An authenticated active Worker can discover only eligible/visible recruiting Shifts within authorized scope, inspect complete preparation/conditions, apply, withdraw where allowed, and see an unambiguous application result.
- After Assignment, the Worker sees My Shifts and one Shift Timeline with exactly one next required action.
- Pre-shift confirmation, Wake, Departure, and Arrival are recorded through server-authorized, idempotent commands with clear time-window and replay behavior.
- Arrival remains distinguishable from work start unless the approved OCV1-01 contract explicitly states otherwise.
- The Worker can submit and track a Help Request without exposing sensitive/internal Admin data.
- The complete Worker path works at the pilot mobile viewport with keyboard/focus, error, offline/retry, duplicate-submit, and expired-link behavior verified.

### Admin acceptance

- Admin can configure recruitment, review Applications, create/reuse canonical Assignments, place Workers, inspect Coverage, and monitor pre-shift/day-of state without duplicate data entry.
- Day-of shows confirmed/current/missing/late Wake, Departure, and Arrival states from canonical facts, with safe drill-down.
- Attention identifies the right operational problem, priority, source, and next Admin action; resolving the source fact removes the derived item.
- Incident acknowledge/resolve and Worker feedback remain functional and auditable.
- Reminder actions and automation are idempotent, attributable, and do not change the underlying operational fact.

### Platform/release acceptance

- Every Worker/Admin read and write has server-side role/scope enforcement and RLS coverage; IDOR and direct-write denial tests pass.
- Timeline output is deterministically derived from canonical facts, ordered in Asia/Tokyo for presentation, and does not accept client-authored actor/time/state.
- In-app and LINE notifications are projections. Delivery/read never substitutes for confirmation or journey events.
- LINE entry returns the authenticated Worker to the intended authorized Shift; invalid, expired, foreign, and already-completed links fail safely.
- Focused domain tests, security tests, TypeScript, scoped lint, production build, `git diff --check`, and real-browser pilot E2E pass against the release candidate.
- Production schema/version parity, environment configuration, pilot accounts, monitoring/alerts, backup/restore, retention, support ownership, and rollback/runbook evidence are documented.

## 8. Explicitly deferred until after pilot

The following are not required by the stated V1 pilot and should not delay it unless a named pilot customer makes one a launch condition:

- Payroll, billing, invoicing, formal attendance export, and STAFF EXPRESS synchronization beyond a separately defined integration boundary.
- Replacing external back-office systems of record.
- Advanced attendance confirmation/revision expansion; existing functions may remain but are not the OpsCue V1 differentiator.
- Completion workflow beyond the minimum needed to close the operational Timeline.
- AI ranking/recommendation, opaque scoring, automatic Assignment, or automatic Placement.
- Travel-time calculation, GPS/geofencing, continuous location tracking, or route optimization.
- Realtime presence, chat, generic inquiry/ticketing, voice/phone escalation, or SLA engine.
- Incident severity hierarchy and emergency-dispatch automation beyond the current Help Request lifecycle.
- Recurring Availability rules, Admin Availability override, or free-text preference hard matching.
- Multi-venue Placement redesign, advanced break optimization, or autonomous Coverage repair.
- Full omnichannel messaging, marketing campaigns, Push/email/SMS, and rich template management beyond the minimum LINE pilot path.
- Organization billing, tenant self-service, broad analytics/BI, data warehouse, and generalized audit export.

## 9. Evidence index and audit limits

### Primary repository evidence

- Routes and UI: `app/admin/*`, `app/worker/*`, `components/admin/*`, `components/worker/*`.
- Reads/actions/auth: `lib/admin/*`, `lib/worker/*`, `lib/auth/*`, `app/actions/*`.
- Canonical persistence/security: `supabase/migrations/*`, `supabase/tests/rls/*`.
- Focused verification: `scripts/integration/*`.
- Completed contract reports: `docs/staff-2*.md`, `docs/ops-1*.md`, Placement, Notification, Incident, pre-shift, day-of, and Admin canonical rebaseline reports.

### Limits

- This was a static repository and evidence audit. It did not mutate or query remote Supabase, run destructive local database setup, exercise credentials, or modify production services.
- Previously recorded PASS results establish repository evidence for completed slices, but they are not a substitute for rerunning the final OCV1-08 release suite against the exact pilot release candidate.
- Production/deployment items without repository evidence are classified as release gaps or unverified gates, not asserted outages.
- Existing modified `.tmp-notif-2c-local.err.log` and `.tmp-notif-2c-local.out.log` were left untouched.

---

**Audit conclusion:** The Admin operations spine and staffing foundations are reusable and comparatively mature. OpsCue V1 should not restart them. The evidence-supported next step is `OCV1-01`: freeze the additive Worker journey event and Timeline contract, then connect the missing Worker recruitment/application flow before implementing the action-first Timeline and its Admin/LINE consumers.
