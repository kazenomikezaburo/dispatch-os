# OpsCue Phase 2.5-A — Frontend Audit & Simplification

Status: `AUDIT COMPLETE / NO PRODUCT CHANGE`

Audit date: 2026-09-30

## 1. Scope and evidence

This phase audited the current Next.js App Router surface, shared UI, role guards, current OpsCue result documents, UI/UX guidelines, and the accessible Figma file. It did not change application code, routes, schema, packages, AWS, remote Supabase, or LINE delivery.

Evidence used:

- current `app`, `components`, `lib`, `proxy.ts`, and `app/actions` source;
- canonical OpsCue contracts/results through OCV1-07C2;
- `docs/dispatch-os-ui-ux-v1.md` and `docs/dispatch-os-ui-patterns-v1.md`;
- Figma file `Pmb52CO7UgsQDA5tvoqUjF`, inspected read-only on pages `03 Admin` and `04 Worker`, including the current Product Map, Route Contract, and Implementation Gate;
- current worktree inventory: 41 page routes, 2 API routes, 137 Admin component files, 16 Worker component files, and 24 Server Action modules.

Important limits:

- This is a source/design audit, not a new authenticated browser QA run. Responsive and accessibility conclusions distinguish code evidence from previously recorded browser evidence.
- The historical `docs/audit-3.0a/route-inventory.md` predates the OpsCue Worker recruitment/journey/LINE work and is not used as the current route count.
- Figma includes future, archived, compatibility, and Client Portal concepts. Their existence is not authorization to implement them.

## 2. Current frontend architecture

The application has three effective surfaces:

1. Public/auth: `/`, `/login`, `/auth/error`.
2. Worker: mobile-first, `max-w-3xl`, Server Component pages with narrow client components for actions.
3. Admin: desktop-first shared shell, sidebar/mobile drawer, cross-shift operational workspaces, and entity detail hubs.

Authentication and role boundaries are server-enforced:

- `profiles.account_type` accepts `worker`, `manager`, or `system_admin`.
- `/worker/**` calls `requireWorker`; non-Workers are redirected to Admin.
- `/admin/**` calls `requireAdmin`; Workers are redirected to Worker.
- Manager and System Admin share the Admin shell. Manager scope remains Branch/RLS-bound; System Admin has the wider organization scope where canonical commands allow it.
- UI visibility is not the authorization boundary. Existing RLS, RPC, and command checks remain authoritative.

The core information model visible in the UI is:

```text
Project
  └─ Job
      └─ Workplace association
          └─ Shift
              ├─ Application review
              ├─ Assignment / Placement / Coverage
              ├─ Pre-shift confirmation
              ├─ Wake / Departure / Arrival
              ├─ Attendance
              └─ Incident / recovery
```

The project and shift lists intentionally show overlapping facts for different questions:

- Project is design-centric: “この案件をどう組み立てるか”.
- Shift operations are time-centric: “この日・期間の現場はどうなっているか”.

That overlap is valid. Duplicate ownership or duplicate mutation paths are not.

## 3. Complete route and feature inventory

### 3.1 Public and API

| Route | Current responsibility | Decision | Dependencies / notes |
|---|---|---|---|
| `/` | Redirect to login | Maintain | Stable public entry. |
| `/login` | Password sign-in and safe Notification continuation completion | Improve | Preserve exact C1 continuation behavior. Add clearer session/error recovery only in a later UI phase. |
| `/auth/error` | Inactive/misconfigured account state | Maintain | Safe failure boundary. |
| `/api/line/callback` | Server-only LINE Login callback | Maintain | Not a screen; C1 identity boundary. |
| `/api/line/webhook` | Signed LINE follow/unfollow ingestion | Maintain | Not navigation; signature-before-parse and replay behavior are canonical. |

### 3.2 Worker

| Route | Current responsibility | Decision | Dependencies / notes |
|---|---|---|---|
| `/worker` | My Shifts grouped as current/upcoming/past/terminal; primary next action | Improve | Make “次にやること” the visual first-class object; unify Japanese copy and tokens. |
| `/worker/assignments/[assignmentId]` | One Shift timeline, preparation, pre-shift, Wake/Departure/Arrival, attendance, incident | Maintain + improve | Canonical One Shift, One Timeline hub. Do not split journey actions into routes. |
| `/worker/recruitment` | Published recruitment discovery and safe eligibility state | Maintain + improve | Add clearer search/filter hierarchy only without changing server-derived visibility. |
| `/worker/recruitment/[shiftId]` | Pre-assignment detail, apply/withdraw state | Maintain + improve | Application mutation and capacity semantics are canonical. |
| `/worker/availability` | Own Availability intervals and Work Conditions | Maintain | This is the current profile/work-condition surface; do not merge persistence into recruitment. |
| `/worker/notifications` | Recipient-owned in-app inbox and unread state | Maintain + improve | Treat as activity/inbox, not a second operational source. Expose LINE settings entry more clearly. |
| `/worker/notifications/[notificationId]` | Safe deep-link landing and source resolution | **Maintain exactly** | C1/C2 stable external entry. It cannot be removed or replaced by a client-only modal. |
| `/worker/announcements` | Durable published bulletin list | Maintain + improve | Clarify distinction from notifications: bulletin archive vs personal activity. |
| `/worker/announcements/[announcementId]` | Announcement detail | Maintain | Notification source resolver depends on it. |
| `/worker/settings/line` | LINE link/unlink/relink and explicit Reminder consent | Maintain + improve | Move into a discoverable settings/profile navigation model; never merge link and consent facts. |

### 3.3 Admin — home and operations

| Route | Current responsibility | Decision | Dependencies / notes |
|---|---|---|---|
| `/admin` | Summary, top Attention items, today’s operating picture | Maintain + improve | Summary → `/admin/attention` drill-down is intentional, not duplication. |
| `/admin/attention` | Exception-first canonical Attention queue | Maintain | OCV1-06; self-resolving projection over canonical facts. |
| `/admin/projects` | Project-centric list/search/status | Maintain + improve | Primary entry for structure and setup. |
| `/admin/projects/new` | Project setup including initial Job/Workplace | Maintain | Complex dedicated form remains justified. |
| `/admin/projects/[projectId]` | Project hub: overview, shifts, history, edit modes, Job/Workplace management | Maintain + improve | Canonical Project hub. Existing `?tab=jobs` already redirects to overview. |
| `/admin/projects/[projectId]/jobs/new` | Dedicated Job create page | Consolidate candidate | Current Project hub already has drawer-based Job work. Retain until links, validation focus, and deep-link use are audited. |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | Redirect to canonical shift editor | Delete candidate after compatibility window | Redirect-only; no new links should target it. |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` | Redirect to same canonical shift editor | Delete candidate after compatibility window | Name implies a separate bulk model that no longer exists. |
| `/admin/shifts` | Time-centric cross-shift operations, list/schedule views | Maintain + improve | Canonical cross-shift workspace. |
| `/admin/shifts/new` | Single and bounded multi-date Shift creation | Maintain | One editor avoids separate single/bulk workflows. |
| `/admin/shifts/[shiftId]` | Shift hub: overview, applications, placement, confirmation | **Maintain as canonical** | Existing Candidate, Assignment, Placement, Confirmation contracts converge here. |
| `/admin/placement` | Cross-shift placement board | Consolidate/compatibility candidate | Figma route contract says placement belongs in Shift Detail and cross-shift operations. Do not remove until unique board use cases and inbound links are measured. |
| `/admin/shifts/pre-shift` | Cross-shift pre-shift monitor | Maintain | Canonical route. |
| `/admin/pre-shift` | Redirect to canonical pre-shift route | Delete candidate after compatibility window | Keep only as legacy redirect until no inbound consumers remain. |
| `/admin/shifts/day-of` | Cross-shift day-of monitor | Maintain | Canonical route. |
| `/admin/day-of` | Redirect-compatible implementation entry | Consolidate, then delete legacy route | Current canonical wrapper imports this implementation; first move shared screen code out of the route module. |

### 3.4 Admin — people, attendance, communications, masters

| Route | Current responsibility | Decision | Dependencies / notes |
|---|---|---|---|
| `/admin/attendance` | Attendance list/filter/summary | Maintain, demote for V1 pilot | Formal attendance remains separate from Arrival and is not the primary day-of navigation. |
| `/admin/attendance/[assignmentId]` | Attendance confirmation, correction, absence, audit history | Maintain | Never merge with Arrival or journey fact commands. |
| `/admin/workers` | Worker list/filter/create/edit affordances | Maintain + improve | Manager/System Admin action differences need clearer read-only explanation. |
| `/admin/workers/[workerId]` | Profile, history, credentials, availability/work conditions | Maintain + improve | Strong hub; harmonize tabs and error/empty patterns. |
| `/admin/incidents` | Help request/incident inbox and drawer | Maintain | Operational exception domain, separate from Attention projection. |
| `/admin/announcements` | Announcement list/filter/management | Maintain | Published communication domain. |
| `/admin/announcements/new` | Announcement editor | Maintain | Longer authoring flow justifies page. |
| `/admin/announcements/[announcementId]` | Announcement detail/edit/transitions | Maintain | Worker notification source may resolve to announcement. |
| `/admin/clients` | Client master list and editor | Maintain | Project references the master; do not duplicate client persistence in Project. |
| `/admin/workplaces` | Workplace master compatibility surface | Consolidate candidate | Implemented but absent from visible sidebar; Figma says manage association from Project. Retain entity and safe compatibility route. |
| `/admin/staff-credentials` | Skill/Qualification masters | Maintain | System Admin mutation vs Manager read boundary must remain. |
| `/admin/settings` | Empty “準備中” placeholder | Delete from visible navigation; route compatibility candidate | It offers no current task. Do not replace with uncontracted settings. |

## 4. Role workflows

### 4.1 Worker

```text
Login
  ├─ Recruitment → Shift detail → Apply / Withdraw → Admin review
  ├─ My Shifts → Shift Timeline
  │    → Pre-shift confirmation → Wake → Departure → Arrival
  │    → Attendance start/end (separate) → Incident/SOS if needed
  ├─ Availability / Work Conditions
  ├─ Notifications → safe detail → Assignment or Announcement source
  └─ LINE settings → link state → explicit Reminder consent
```

Primary UX issue: the current header exposes four icon-only destinations plus logout in one row. On a 390px surface this is cognitively dense, and settings/LINE is hidden behind the Notification page rather than a stable profile/settings destination.

### 4.2 Manager

```text
Login → Home / Attention
  → Projects: Project → Job / Workplace → Shift creation
  → Shift operations: recruitment/application review → Assignment → Placement
  → Pre-shift monitor → Day-of monitor → exception handling
  → Attendance and incidents as separate operational records
  → Worker detail and Branch-scoped conditions/credentials
```

Manager is not a separate route tree. The same Admin pages are filtered and authorized by existing Branch scope, RLS, and command checks. Phase 2.5 must not create a client-derived Manager UI authorization model.

### 4.3 System Admin

System Admin uses the Manager workflow plus organization-wide access and privileged master/staff operations permitted by existing commands. The visual shell is shared; privileged controls should be explained where absent, not hidden as proof of security.

## 5. Information architecture assessment

### 5.1 Recommended canonical IA

Admin primary navigation:

```text
Home
  ├─ Home
  └─ Attention
Operations
  ├─ Projects
  └─ Shift operations
People & records
  ├─ Workers
  └─ Attendance
Communication
  ├─ Incidents / Help requests
  └─ Announcements
Masters
  ├─ Clients
  └─ Skills / Qualifications
```

Do not promote Placement, Pre-shift, Day-of, Workplace, or Project History to independent primary navigation. They are views within Shift operations, Shift detail, or Project management. The current workflow tabs may remain the secondary navigation for cross-shift operations.

Worker primary navigation:

```text
Home / Next action
Recruitment
My shifts
Support / Inbox
Profile & settings
```

“Support / Inbox” may visually group Notifications, Announcements, and incident entry, but the underlying domains and routes remain distinct. “Profile & settings” should expose Availability/Work Conditions and LINE link/consent without inventing a new profile persistence model.

### 5.2 Project → Shift → Application / Placement / Confirmation

The current four-tab Shift detail is the best canonical single-Shift workspace:

1. Overview — schedule, workplace, conditions, recruitment facts.
2. Applications — review existing `shift_applications`; acceptance is not Assignment capacity reservation.
3. Placement — canonical Assignment/Placement/Candidate/Coverage commands.
4. Confirmation — pre-shift and day-of phases, using existing facts and Attention links.

Recommended simplification:

- Keep Project detail responsible for composition and its own Shift list.
- Keep `/admin/shifts` responsible for time-based cross-Shift triage.
- Keep `/admin/shifts/[shiftId]` as the only single-Shift operational hub.
- Cross-shift Placement/Pre-shift/Day-of screens must link into the exact Shift detail tab/phase and clearly label themselves as cross-shift views.
- Never create a second Application, Assignment, Placement, journey, Attention, or Notification lifecycle to simplify presentation.

## 6. Duplicate, unused, and deep-path findings

### 6.1 Route duplication

High-confidence compatibility/duplication findings:

- `/admin/pre-shift` → `/admin/shifts/pre-shift`.
- `/admin/day-of` → `/admin/shifts/day-of`; implementation currently lives in the legacy route module and should be extracted before deletion.
- nested Project/Job Shift create routes → `/admin/shifts/new`.
- `/admin/placement` overlaps the canonical Shift detail Placement tab and needs usage evidence before removal.
- `/admin/workplaces` conflicts with the newer Project-centric Workplace association model, but the underlying Workplace entity remains canonical.

### 6.2 Static no-import component candidates

The following files have no current source import reference outside their own unused chain and are deletion candidates for Phase 2.5-B only after TypeScript/build and focused feature regression:

- `components/admin/shifts/shift-detail-summary.tsx`
- `components/admin/shifts/shift-assignment-list.tsx`
- `components/admin/shifts/pre-shift-confirmation-section.tsx`
- `components/admin/projects/shifts/form/bulk-shift-create-form.tsx`
- `components/admin/projects/shifts/form/bulk-shift-preview.tsx`
- `components/admin/projects/detail/project-shift-list.tsx`
- `components/admin/projects/detail/project-operation-shortcuts.tsx`

The first unused chain also contains `assignment-cancel-button.tsx`. It is not independently safe to delete until the parent chain is removed together. Static non-import status is evidence for a candidate, not proof that tests, Storybook-like tooling, or future documents do not refer to the concept.

### 6.3 Deep or hidden paths

- Worker LINE settings is functionally important but lacks a first-class navigation destination.
- Admin Workplace management exists but is absent from visible navigation; that is acceptable only if Project becomes the clearly documented owner of association/edit entry.
- Shift actions can be reached through Project → Shift, cross-shift tabs, and Attention destinations. Breadcrumb and context labels need to distinguish “all shifts” from “this shift”.
- Settings is visible despite being a placeholder, while implemented Workplace is hidden. This is a menu-task mismatch.

## 7. UI/UX audit

### 7.1 Cross-surface inconsistencies

| Finding | Evidence | Priority | Recommendation |
|---|---|---:|---|
| Mixed visual token generations | Newer screens use semantic tokens (`surface`, `foreground`, `rounded-card`); recruitment, journey, and some legacy forms still use direct `slate/blue/red` classes | P1 | Normalize through existing primitives; no domain change. |
| Mixed Japanese/English product copy | Worker Home shows `Worker`, `My Shifts`, and `Action` beside Japanese UI | P1 | Freeze Japanese labels: “勤務”, “次にやること”, “勤務履歴”. |
| Worker navigation density | Four icon buttons plus logout in the header; no Figma-style full-screen navigation/profile hub | P0 mobile | Introduce one consistent mobile navigation pattern before visual polish. Preserve all routes. |
| Cross-shift vs one-Shift context is subtle | Same concepts appear in workflow tabs and Shift detail tabs | P0 Admin | Use explicit headings/breadcrumbs: “シフト運用（横断）” vs Shift name/date. |
| Placeholder navigation | `/admin/settings` is visible but has no task | P0 simplification | Remove from visible menu in B; keep compatibility route until link audit. |
| Error/empty implementations vary | Shared `AdminState` exists, but several routes still inline legacy red/slate panels | P1 | Use common states and retain safe non-disclosure wording. |
| Touch target drift | Most new controls use `min-h-11`; some older links use `min-h-10` | P1 mobile/a11y | Standardize primary touch targets to at least 44px. |
| Dense editor/client footprint | Many small client components and drawers are valid, but stale editor chains remain | P2 | Remove proven dead chains first; do not merge business commands into UI. |

### 7.2 Forms

- Strengths: server-side validation, explicit pending states, duplicate-submit protection in Worker journey/application/LINE flows, labels in current editors, and controlled error messages.
- Gaps: form feedback and legacy error panels use multiple visual systems; long Project/Shift editors require a consistent section summary, focus-on-error, and unsaved-change policy.
- Do not move validation authority client-side. A Phase 2.5-C form system should standardize labels, required/optional text, summary + inline errors, pending, conflict, and focus restoration while retaining existing Server Actions/RPCs.

### 7.3 Tables and responsive lists

- Current Admin workspaces frequently use responsive structured lists/cards, which is safer than compressing every domain into a table on mobile.
- Dense comparison domains (attendance, candidates, coverage) should keep desktop tabular density but provide card/progressive disclosure on narrow widths.
- Do not use horizontal scrolling as the only mobile solution for primary operational actions.
- Pagination and bounded readers must remain; simplification must not replace them with unbounded client filtering.

### 7.4 Empty, loading, error, and conflict states

- Admin has reusable empty/error/not-found/forbidden/loading primitives.
- Worker pages repeat similar inline states with different spacing/colors/copy.
- Empty states should distinguish “no data”, “filters produced zero results”, and “not authorized/unavailable”. Foreign and missing Notification/Recruitment resources must remain intentionally indistinguishable.
- Conflict is a first-class state for Placement, edit revisions, application capacity, and journey versions; a generic “try again” must not hide a canonical conflict response.

### 7.5 Accessibility

Current positive evidence includes semantic headings/lists, many `aria-label` values, focus-visible styles, `role=alert/status`, and 44px controls in recent Worker work.

Phase 2.5-B/C must explicitly verify:

- mobile navigation focus trap, close, Escape, and focus return;
- tab semantics and arrow/Tab behavior for Project/Shift/Worker tabs;
- drawer/dialog initial focus, labelled title, and return focus;
- disabled pagination not remaining an actionable link;
- state not conveyed by color alone;
- error summary linked to fields with `aria-describedby`/`aria-invalid`;
- 1440x900, 1280x900, and 390x844 horizontal overflow and zoom/reflow.

## 8. Figma versus code

### 8.1 Aligned

- Figma and code agree on Project → Job → Shift, the four Shift detail tabs, cross-shift operations, Worker recruitment, My Shifts, and journey states.
- Figma’s canonical Route Contract matches the current `/admin/shifts/pre-shift`, `/admin/shifts/day-of`, and Shift confirmation phase query model.
- Figma marks `/admin/pre-shift`, `/admin/day-of`, `/admin/placement`, and `/admin/workplaces` as compatibility concepts rather than primary navigation; this matches the main simplification opportunity.
- Figma explicitly requires preservation of RLS, Placement concurrency, Attendance separation, Notification retry/dedup, and audit semantics.

### 8.2 Code ahead of or more concrete than Figma

- C1 LINE Login/link/consent, safe Notification detail continuation, and C2 delivery infrastructure are materially implemented in code/contracts but are not represented as a full current Worker settings flow in the inspected Figma sections.
- Recruitment safe eligibility, application withdrawal constraints, and Worker journey canonical refresh behavior are more precise in code/contracts than in visual frames.

### 8.3 Figma ahead of code or future-only

- Worker full-screen mobile navigation, Support hub, My Page, FAQ/manual/rules, and a cohesive desktop Worker shell are designed but not all implemented.
- Admin analytics, unified communications/reminder operations, knowledge, governance, and Client Portal are designed future domains. They are out of this simplification phase.
- Figma uses `/admin/staff` while code uses `/admin/workers`. Do not rename in Phase 2.5-B; resolve naming only with route compatibility and test evidence.

### 8.4 Visual/design-system gap

Figma has current common state, responsive, keyboard, accessibility, overflow, and connectivity specifications. Code implements much of the behavior but spans older direct Tailwind colors and newer semantic tokens. Phase 2.5-C should converge existing components on the current semantic token/primitives layer rather than copy frame-specific styling.

## 9. C1/C2 and security impact

These are non-negotiable regression boundaries for any simplification:

1. `/worker/notifications/[notificationId]` remains the stable absolute deep-link target.
2. Unauthenticated exact Notification paths may create only the signed, HttpOnly, ten-minute, single-use continuation; arbitrary return URLs remain rejected.
3. Notification detail remains recipient-owned and server/RLS-authorized. Foreign and missing IDs return the same safe unavailable state.
4. LINE link identity, destination availability, and Reminder consent remain separate server facts.
5. Unlink/unfollow/consent OFF does not mutate Notification read state, Journey, Attendance, or Attention.
6. LINE delivery continues to consume an existing canonical Notification. UI consolidation cannot enqueue, claim, send, retry, or mark delivery itself.
7. External delivery failure cannot delete or mark an in-app Notification read.
8. Callback and webhook routes are not navigation and must not be moved behind client UI routing.
9. Route/menu changes cannot weaken `requireWorker`, `requireAdmin`, Branch RLS, System Admin command checks, or private C2 role/table denial.

Required focused regression when B/C changes touch navigation or Worker communication:

- Worker/Admin auth and role redirects;
- Manager foreign-Branch denial and System Admin allowed scope;
- C1 identity/consent and boundary-source suites;
- own/foreign/missing/expired/replayed Notification continuation;
- Notification inbox/detail/read-state and source resolution;
- C2 enqueue/terminalization, claim/finalize, canary isolation, and dispatcher source tests if shared files are touched;
- journey, attendance, and Attention non-mutation assertions;
- no secret or LINE identity in browser bundles/responses/URLs.

Note: the C1 result document still says `PROVIDER VERIFICATION BLOCKED`, while the later C2-06A readiness document records subsequent operator evidence and remaining real follow/unfollow/relink evidence requirements. Simplification must not silently change that status.

## 10. Prioritized recommendations

### P0 — simplify structure before visual work

1. Freeze the route map above and add redirect/inbound-link evidence for every deletion candidate.
2. Remove placeholder Settings from visible navigation.
3. Make cross-shift vs one-Shift navigation explicit; keep Shift detail as the single operational hub.
4. Replace the Worker header control cluster with a single coherent mobile navigation model while retaining current URLs.
5. Add a first-class Profile/Settings entry containing Availability/Work Conditions and LINE settings links.

### P1 — consistency and usability

1. Standardize Worker terminology and semantic tokens.
2. Converge empty/error/loading/forbidden/conflict presentation.
3. Standardize 44px targets, focus styles, breadcrumbs, primary object links, and action placement.
4. Clarify Notifications vs Announcements and expose LINE consent status without mixing the domains.
5. Align Project/Shift staffing summaries and state labels.

### P2 — cleanup and polish

1. Remove proven unused component chains.
2. Consolidate compatible Job/Shift creation entry points after telemetry/link audit.
3. Reduce legacy direct color classes and one-off rounded/spacing variants.
4. Review client-component boundaries after dead-code removal; keep interactions client-side and data/business logic server-side.

## 11. Phase 2.5-B plan — IA and safe removal

Goal: reduce navigation and compatibility surface without changing canonical behavior.

1. Freeze canonical route/menu map and enumerate all internal links, tests, notification destinations, and external/deep-link dependencies.
2. Remove `/admin/settings` from the visible nav; retain the route temporarily as controlled compatibility.
3. Extract Pre-shift/Day-of screen implementations into neutral components so canonical routes no longer import legacy route modules.
4. Ensure all new links target canonical `/admin/shifts/*` and `/admin/shifts/[id]` routes.
5. Decide `/admin/placement` using observed unique workflows. If retained, label it a cross-shift board; if not, redirect to Shift operations without losing filters unexpectedly.
6. Add the Worker five-destination navigation shell (Home, Recruitment, Shifts, Support/Inbox, Profile/Settings) using existing routes only.
7. Remove only the static no-import chains after focused build/tests.
8. Keep compatibility redirects for one release/evidence window; delete them only after no inbound link/test/bookmark contract remains.

Phase 2.5-B completion criteria:

- every visible menu item performs a current task;
- every primary route has one clear responsibility;
- no new data/state machine/API/migration;
- auth/RLS and C1 deep links pass unchanged;
- 1440/1280/390 navigation, focus, and overflow checks pass;
- TypeScript, focused ESLint, production build, related integration tests, and `git diff --check` pass.

## 12. Phase 2.5-C plan — UI system convergence

Goal: make retained screens consistent after the IA is stable.

1. Normalize Worker and remaining legacy Admin screens onto semantic color, spacing, radius, typography, button, badge, and state primitives.
2. Standardize list/detail hierarchy and primary object links.
3. Implement common form section, field, inline error, error summary, pending, conflict, and success patterns without changing Server Actions.
4. Implement responsive table/card patterns for attendance, candidates, coverage, and worker history.
5. Normalize Empty/Loading/Error/Forbidden/Not Found/Conflict/Offline states.
6. Run keyboard, screen-reader naming, focus restoration, 200% zoom/reflow, and the three viewport matrix.
7. Reconcile retained screens against the Figma canonical map, not archived/future frames.

Phase 2.5-C completion criteria:

- visual primitives are consistent without domain reinterpretation;
- important Worker action is visible without scrolling through secondary detail;
- dense Admin comparisons remain usable on desktop and controlled on mobile;
- errors are safe, actionable, and focusable;
- C1/C2, Notification, Reminder, journey, Attendance, Attention, Application, Assignment, Placement, and role/RLS regressions pass as applicable.

## 13. Explicitly deferred

- Client Portal;
- analytics/reporting/export/NEO;
- FAQ/manual/required-reading platform;
- unified Admin Notification operations UI;
- new profile schema or My Page mutations;
- new LINE behavior, delivery types, or Scheduler changes;
- route renaming from `/admin/workers` to `/admin/staff`;
- any Application, Assignment, Placement, Journey, Attendance, Attention, Notification, or delivery contract change.

## 14. Decision gate for the next phase

Phase 2.5-B can begin without guessing if it treats the current canonical routes and security boundaries as fixed, uses compatibility evidence before deletion, and starts with navigation/route ownership rather than visual polish. The first implementation slice should be:

1. visible navigation cleanup;
2. legacy route implementation extraction;
3. Worker navigation/profile entry;
4. dead component chain removal;
5. focused auth/deep-link/responsive regression.

No product code or database object was changed in Phase 2.5-A.
