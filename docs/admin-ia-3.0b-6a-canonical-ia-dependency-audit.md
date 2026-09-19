# ADMIN-IA-3.0B-6A Canonical IA & Dependency Audit

## Status

`ADMIN-IA-3.0B-6A: COMPLETE`

`ADMIN-DATA-3.0B-6B: READY`

This phase is a read-only implementation audit. No product, database, fixture, package, or Figma content was changed.

## Executive Summary

The fixed canonical IA can be implemented without removing `Job` or `Workplace` and without changing the existing Project, Job, Workplace, Shift, Placement, Confirmation, Attendance, or Incident domain contracts. The principal UI change is to make Projects and Shift Operations the only primary entries for this area, move Placement into a single Shift detail, and separate cross-shift confirmation monitoring from single-shift confirmation.

The sole confirmed persistence gap is Project History. Existing revision/event tables are domain-specific and cannot provide durable Project configuration history. The decision is **C. Relevant persistenceなし**. Phase 6B should therefore add a narrow, business-facing Project History foundation before the History tab is exposed.

The prescribed implementation order is dependency-safe. Compatibility routes must remain until their canonical destinations and context-preserving conversions exist. No legacy route may guess a Project, Job, Shift, or Assignment.

## Canonical IA

```text
案件・運用
├─ 案件
│  ├─ 案件一覧
│  ├─ 新規案件
│  └─ 案件詳細
│     ├─ 概要（業務・勤務先を含む）
│     ├─ シフト
│     └─ 履歴
└─ シフト運用
   ├─ シフト（一覧 / 週 / カレンダー）
   ├─ 前日確認（複数Shift横断）
   └─ 当日確認（複数Shift横断）
      └─ シフト詳細
         ├─ 概要
         ├─ 応募
         ├─ 配置
         └─ 確認（前日 / 当日）
```

UI hierarchy is `Project → Shift → Applications / Placement / Confirmation`; the database remains `Project → Job → Shift`, with `Job → Workplace`. Attendance remains a separate canonical domain.

## Latest Figma Evidence

The following nodes were read successfully from file `Pmb52CO7UgsQDA5tvoqUjF`:

| Area | Node | Evidence | Decision |
|---|---:|---|---|
| Project list | `469:2` | `01 [Page] 案件一覧` | Canonical |
| Project detail | `383:3183` | `02 [Detail] 案件詳細｜通常 / Tab=概要`; tabs are 概要・シフト・履歴 | Canonical |
| Shift Operations list | `496:2900` | Operations: シフト・前日確認・当日確認; views: 一覧・週・カレンダー | Canonical |
| Shift Operations week | `505:352` | Week view | Canonical |
| Shift Operations calendar | `505:512` | Calendar view | Canonical |
| Pre-shift | `523:2` | Cross-shift Pre-shift state | Canonical |
| Day-of | `523:257` | Cross-shift Day-of state | Canonical |
| Old Shift detail | `496:3034` | `99 [Archive] シフト詳細｜Legacy` | Explicitly non-canonical |

No current canonical Shift Detail frame was established by the supplied current-node set. The archived node must not be used as a visual source of truth; the fixed four-tab IA in this phase is authoritative until a current Shift Detail frame is designated.

## Current Route Tree

```text
/admin/projects
/admin/projects/new
/admin/projects/[projectId]
/admin/projects/[projectId]/jobs/new
/admin/projects/[projectId]/jobs/[jobId]/shifts/new
/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new  (redirect alias)
/admin/shifts
/admin/shifts/[shiftId]
/admin/placement
/admin/pre-shift
/admin/day-of
/admin/attendance
/admin/attendance/[assignmentId]
/admin/workplaces
```

Current Project detail tabs are `overview / jobs / shifts`. Current Shift detail has two navigation rows: an operation-context row and a detail-workflow row. Placement, Pre-shift, Day-of, and Workplace each have a standalone page and Sidebar entry.

## Target Route Tree

```text
/admin/projects
/admin/projects/new
/admin/projects/[projectId]
/admin/projects/[projectId]?tab=shifts
/admin/projects/[projectId]?tab=history
/admin/projects/[projectId]?edit=1
/admin/shifts
/admin/shifts/new[?projectId=...][&jobId=...]
/admin/shifts/pre-shift
/admin/shifts/day-of
/admin/shifts/[shiftId]
/admin/shifts/[shiftId]?tab=applications
/admin/shifts/[shiftId]?tab=placement
/admin/shifts/[shiftId]?tab=confirmation&phase=pre|day
/admin/shifts/[shiftId]?edit=1
/admin/attendance
/admin/attendance/[assignmentId]
```

## Route Migration Matrix

| Current | Target | Class | Safe conversion rule |
|---|---|---|---|
| `/admin/projects` | same | KEEP | No semantic change |
| `/admin/projects/new` | same | KEEP / REUSE | Retain unified setup |
| `/admin/projects/[projectId]` | same | REFACTOR | Three tabs only |
| `?tab=jobs` | Project Overview | COMPATIBILITY | Canonicalize to Overview; never drop `projectId` |
| `?tab=shifts` | same | KEEP | Remains canonical |
| `?tab=history` | same | NEW | Expose only after 6B persistence exists |
| `/admin/projects/[projectId]/jobs/new` | Project editor/Overview | COMPATIBILITY, then RETIRE | Preserve exact Project; keep fallback until equivalent create UX exists |
| nested Shift create | `/admin/shifts/new?projectId=...&jobId=...` | MOVE | Preserve and authorize both IDs; do not infer a Job |
| nested bulk-new alias | new Shift-create route | REDIRECT | Forward valid authorized IDs only |
| `/admin/shifts` | same | KEEP / REFACTOR | Becomes Shift Operations workspace; current List/Week/Calendar reused |
| `/admin/shifts/[shiftId]` | same | KEEP / REFACTOR | One four-tab navigation row |
| `?tab=assignments` | `?tab=placement` | COMPATIBILITY | Preserve exact Shift |
| `?tab=confirmations` | `?tab=confirmation` | COMPATIBILITY | Preserve exact Shift; phase follows explicit/default rule |
| `/admin/placement?shift=X` | `/admin/shifts/X?tab=placement` | COMPATIBILITY | Only if X exists and is authorized |
| `/admin/placement` without Shift | `/admin/shifts` | COMPATIBILITY | Inform/route to workspace; never choose first Shift |
| `/admin/pre-shift` | `/admin/shifts/pre-shift` | MOVE / REDIRECT | Preserve supported date/project/shift/state/assignment parameters |
| `/admin/day-of` | `/admin/shifts/day-of` | MOVE / REDIRECT | Preserve supported filters and exact Assignment context |
| `/admin/workplaces` | Projects compatibility page | COMPATIBILITY, then RETIRE | Explain new management location and link to Projects; never infer Project |
| `/admin/attendance*` | same | KEEP | Formal attendance boundary unchanged |

## Current Domain Model

| Relation | Current contract | Consequence |
|---|---|---|
| Project → Job | `jobs.project_id`, many Jobs per Project, restrictive deletion | Job remains required domain layer |
| Job → Workplace | `jobs.workplace_id`, shared branch-scoped Workplace, restrictive deletion | Workplace can be reused by multiple Jobs/Projects |
| Job → Shift | `shift_slots.job_id`, mandatory, restrictive deletion | Shift create must resolve an authorized Job before submit |
| Shift → Application / Assignment | Shift-scoped lifecycle tables | Applications and assigned staff stay Shift detail concerns |
| Assignment → confirmation / attendance / incidents | Assignment-scoped operational state | Never infer first Assignment for drawers/actions |
| Shift → Placement plan | One plan per Shift with positions, segments, breaks and revisions | Existing version/conflict contract must be preserved |

Authenticated write grants are scoped to existing insert/update operations; no general Project/Job/Workplace/Shift delete workflow was found. Lifecycle/state transitions and restrictive foreign keys must be respected. Existing Manager access is branch-scoped and System Admin access is broader under existing RLS.

## UI IA vs Domain Model

The shorter UI hierarchy is presentation only. A Shift remains owned by a Job, not directly by a Project. Project Overview can present Jobs as “業務・勤務先,” and Project Shifts can aggregate through Jobs, but actions and authorization must retain `job_id`. Workplace is not embedded Project data and must not be duplicated or deleted when the standalone master UI retires.

## Sidebar Impact

Current source is `components/admin/admin-nav.ts`; `components/admin/admin-nav-links.tsx` renders the groups. Active state is exact for `/admin` and otherwise exact-or-descendant via `pathname.startsWith(href + "/")`.

| Current group / entry | Current href | Target |
|---|---|---|
| 案件・運用 / 案件 | `/admin/projects` | KEEP |
| 案件・運用 / シフト | `/admin/shifts` | Rename to シフト運用 |
| 案件・運用 / 配置・休憩回し | `/admin/placement` | RETIRE from Sidebar |
| 案件・運用 / 前日確認 | `/admin/pre-shift` | RETIRE from Sidebar; internal Shift Operations tab |
| 案件・運用 / 当日運用 | `/admin/day-of` | RETIRE from Sidebar; internal Shift Operations tab |
| 勤怠・スタッフ / 勤怠 | `/admin/attendance` | KEEP |
| 勤怠・スタッフ / スタッフ | `/admin/workers` | KEEP |
| マスタ / 取引先 | `/admin/clients` | KEEP |
| マスタ / 勤務先 | `/admin/workplaces` | RETIRE from Sidebar |
| 連絡 / ヘルプリクエスト・お知らせ | existing routes | Unchanged |

The active helper naturally covers the proposed `/admin/shifts/pre-shift`, `/admin/shifts/day-of`, and Shift detail routes under Shift Operations.

## Project List

Keep the current list, filters, Project-name detail link, creation entry, status/KPI primitives, and responsive behavior. Update only navigation naming/context as part of 6C. Project-level rows must not absorb Shift operational controls.

## Project Detail

Refactor from `overview / jobs / shifts` to `overview / shifts / history`. Remove the current Project operation shortcuts after their destinations are represented canonically. Keep exact Project authorization, header/edit entry, not-found behavior, and Project-level data boundary.

## Project Overview

Reuse the Project summary and existing Jobs/Workplace presentation. Move the useful contents of the Jobs tab into an “業務・勤務先” section. Do not expose Application, Assignment, Placement, Confirmation, Attendance detail, or Incident detail here.

## Project Shifts

Reuse the existing Project Shift section/list and its joins through Job. It remains navigation and status context only; Placement and confirmation actions open the selected Shift detail. Display may include date/time, Job, Workplace, required/assigned/applied counts, and status.

## Project History

History belongs only to Project detail. It covers Project configuration and lifecycle plus Job, Workplace association, and Shift configuration/lifecycle events. It excludes Application, fine-grained Placement/Break changes, confirmations, punches, SOS, and Incident lifecycle.

The UI must not ship until 6B provides durable, authorized history. `updated_at`, current-row comparisons, browser state, fabricated activity, and raw application logs are prohibited substitutes.

## Project Create / Edit

The 5C setup already supports Project, existing/inline Client, optional initial Job, existing/inline Workplace, confirmation, and redirect to Project detail. Its existing partial-failure contract is reusable: created master data remains; a created Project remains if initial Job creation fails; retries converge without compensation deletes.

Create can remain staged because a new Project has no pre-existing Job collection. Edit can use one page but must orchestrate separate Project, Job, and Workplace actions rather than pretend they are one database row/transaction. Current Project edit covers Project fields only; Job and shared Workplace management must be composed into the page. A shared Workplace edit can affect multiple Jobs/Projects and therefore needs explicit UI warning/context and history attribution policy.

## Job Domain Audit

- A Project can own multiple Jobs.
- Job is the required owner of a Shift and must not be deleted from the model.
- Job references one Workplace; the same Workplace can be referenced by multiple Jobs.
- Restrictive foreign keys prevent casual Job deletion when Shifts exist.
- Job owns business-specific fields such as name/work type, description, clothing/belongings, access/meeting/lodging notes, transport settings, wage/recruitment/manual fields and status.
- Project Overview should present Job name/type/status and its linked Workplace, while detailed creation/edit continues to use Job actions and validation.

## Workplace Domain Audit

Workplace is branch-scoped, reusable, active/inactive master data. It owns master identity/location fields: name, postal code, address, latitude, longitude, map URL, default transport note, access note, meeting note, activity state, and timestamps. The current schema has no Workplace phone column; the new IA must not imply otherwise without a separately approved data phase.

Project/Job-specific data remains on Project or Job, including business name/type, description, clothing/belongings, lodging, transport/recruitment notes and association context. The 5C setup's select-or-inline-create contract and the existing `saveWorkplace` validation/action are reusable. There is no general delete operation; retirement must preserve active/inactive semantics and all references.

The master page can retire only after Project Create/Edit provides discovery, selection, inline creation, safe shared editing, and inactive handling. UI retirement does not require table, action, RLS, validation, or relationship changes.

## Shift Operations Workspace

`/admin/shifts`, `/admin/shifts/pre-shift`, and `/admin/shifts/day-of` fit the App Router and current access model. One operation-tab family should own these routes. It replaces standalone Sidebar entries but not their loaders/actions. Route helpers must distinguish collection operations from Shift detail tabs.

## Shift List / Week / Calendar

List, Week, and Calendar are already implemented on `/admin/shifts` through the current view query and components (`ShiftList`, `ShiftScheduleViews`, `ShiftViewControls`). Week is **REUSE**, not new implementation. Preserve existing date/filter/cursor contracts and use view state below the operation tabs.

## Shift Detail

Keep the route and authorized Shift read; refactor the page/header and collapse the two navigation rows to Overview, Applications, Placement, Confirmation. Header can link to the Project because Shift → Job → Project is exact. Workplace may be linked only while a canonical management/detail destination exists; after master retirement it should be presented as context or linked to the containing Project edit experience, never to an inferred Project.

The Overview must remain Shift-level. Existing Shift edit remains `?edit=1`; Application rows/actions remain in Applications. Do not recreate a History tab.

## Applications

Reuse the existing Shift Application data and actions under `?tab=applications`. Project pages may show aggregate counts but not the applicant detail/action surface.

## Placement

Reuse the board/editor, active Assignment inputs, positions, segments, break intervals, coverage calculations, validation, plan revision/version, optimistic conflict, and `save_shift_placement_plan` RPC. Current standalone page uses date/project/shift query state; selected `shift` opens the editor. The Shift-detail version has exact `shiftId` and should use a narrow Shift loader rather than loading a date-wide board first.

Route-sensitive close links, filter links, drawer/editor URL state, breadcrumb, and `revalidatePath` targets must be refactored. Merely moving JSX would break those assumptions. Existing write semantics and conflict handling must not change.

## Confirmation

Use one Shift-detail tab with `phase=pre|day`. Explicit URL phase always wins. When absent, derive the initial phase on the server using the existing Tokyo calendar-date helpers and Shift start: before Shift date → pre; on/after Shift date → day. Never use browser-local dates or raw UTC string comparison. Manual phase switching remains available.

## Pre-shift

The current screen is date-bounded, filterable, and Assignment-centered across Shifts. Reuse monitor rows, filters, drawer, confirmation data/actions and safe missing-context handling for `/admin/shifts/pre-shift`. For a single Shift, filter by an exact authorized `shiftId` or add a narrow Shift loader; retain Assignment IDs for row actions/drawers and never select the first Assignment.

## Day-of

The current screen is also date-bounded and Assignment-centered. Its loader combines Shift/Project/Job/Workplace context, attendance events/records, Placement plan/positions/segments/breaks, and operational Incident state. This can be split into cross-shift aggregation and exact Shift-local presentation without changing those domains. Attendance edit and revision stay in Attendance. SOS remains represented through the current Operational Incident context; no new SOS persistence is implied.

## Attendance Boundary

`/admin/attendance` and `/admin/attendance/[assignmentId]` remain canonical for formal records, corrections, and revision history. Day-of and Shift Confirmation may display operational attendance status and link to the exact Assignment record, but must not duplicate formal edit/revision behavior or change Attendance architecture.

## Project History Persistence Audit

Searches for audit/activity/history/revision/domain-event/change-log facilities found only domain-specific persistence, including `attendance_record_revisions`, `shift_placement_plan_revisions`, `operational_incident_events`, and private announcement/notification projection receipts. None provides complete Project scope, actor, timestamp, event type, target, and user-facing payload for Project/Job/Workplace/Shift configuration changes.

**Classification: C. Relevant persistenceなし.**

Project/Job/Workplace/Shift `created_at` and `updated_at` values describe current rows and cannot reconstruct prior events. DB/API work is required in 6B. The narrow foundation should durably record an event ID, Project ID, timestamp, safe actor reference or display snapshot, event type, target type/ID, and the minimum payload needed to render a business summary. It must be distinct in purpose and exposure from security audit logging. Detailed schema/security design belongs to 6B.

## Server Actions / RPC / Query Matrix

| Area | Current contracts | Decision | DB impact |
|---|---|---|---|
| Project | authorized Project queries; create/update and inline create actions | REUSE; add history emission after 6B | History only |
| Job | create/update/inline create; Project/Job authorization | REUSE; compose into Overview/Edit | History only |
| Workplace | options query and `saveWorkplace`; branch scope | REUSE; compose into Project UX | No entity change; history attribution required |
| Shift | list/detail/form option queries; create/inline/bulk/update actions | REUSE; route wrapper changes | History only |
| Applications | Shift-scoped query/actions | REUSE in Applications | None |
| Assignments | Shift staffing queries/actions | REUSE; Placement/Confirmation consumers | None |
| Placement | board/plan loaders; `save_shift_placement_plan` RPC | REUSE unchanged | None |
| Pre-shift | date/filter loader and confirmation actions | REUSE/split cross vs single | None |
| Day-of | aggregate loader; attendance/incident consumers/actions | REUSE/split cross vs single | None |
| Attendance | record/event/revision queries/actions/RPCs | KEEP | None |
| Project History | no relevant contract | NEW in 6B | Required |

Existing RLS and authorization remain the final boundary. A new route must not widen query or action grants.

## Component Migration Matrix

| Area | Components/responsibility | Class |
|---|---|---|
| Project | list, header, KPI/status primitives | KEEP |
| Project | detail page/data composition and tabs | REFACTOR |
| Project | Overview plus Job/Workplace presentation | REUSE / REFACTOR |
| Project | current Shift section/list | REUSE |
| Project | operation shortcuts | RETIRE after canonical links exist |
| Project | setup/form/editor primitives | REUSE |
| Project | one-page edit orchestrator | REFACTOR |
| Shift | list, schedule views, view controls | REUSE |
| Shift | workspace shell/operation tabs | REFACTOR |
| Shift | detail page/header/two navigation rows | REFACTOR; retire old rows |
| Shift | Application list/actions | REUSE |
| Placement | board/editor/domain/version/conflict | MOVE / REUSE |
| Placement | standalone route wrapper/filter/close links | COMPATIBILITY, then RETIRE |
| Pre-shift | monitor/filters/drawer/loaders/actions | REUSE; split cross/single |
| Day-of | monitor/filters/drawer/loaders/actions | REUSE; split cross/single |
| Workplace | master fields/editor/action | REUSE in Project UX |
| Workplace | standalone list/page | COMPATIBILITY, then RETIRE |
| Attendance | list/detail/edit/revision | KEEP |

No audited component dependency remains `UNKNOWN`.

## Internal Link Audit

Repository search found these approximate literal route footprints at audit time: Projects 168 references/63 files; Shifts 114/57; Placement 23/11; Pre-shift 15/8; Day-of 14/9; Workplaces 7/5. Generated tab URLs are primarily hidden behind helpers, so zero literal hits for a tab value is not evidence of no dependency.

References are distributed across:

- Sidebar and workflow tab configuration.
- `projectWorkflowHrefs`, Shift detail workflow helpers, and operation-context helpers.
- Project operation shortcuts and Project/Shift list/detail CTAs.
- Placement, Pre-shift, and Day-of filters, drawer open/close links, cross-domain CTAs, and breadcrumbs.
- Server Action `redirect` and `revalidatePath` targets.
- Integration tests, route inventory, screenshot mapping, and human-review evidence.

Migration must update helper families first and direct links second. `revalidatePath` should temporarily cover both canonical and compatibility destinations where stale rendering is otherwise possible. Query conversion must allowlist supported parameters and preserve only validated entity IDs.

## Legacy / Compatibility Routes

- Keep old URLs reachable during staged migration; do not silently 404 saved links.
- Exact Shift context may redirect Placement to its Shift tab. Missing/invalid context goes to a compatibility explanation or Shift workspace, never a selected first result.
- Pre-shift/Day-of redirects preserve compatible filters and exact Assignment drawer context after authorization.
- Workplace becomes an informational compatibility page until Project Create/Edit offers complete replacement operations.
- Nested Job/Shift create routes remain fallbacks until equivalent canonical editors are live.
- Old tab aliases canonicalize to the new tab only with the same authorized Project/Shift.
- Remove compatibility only in 6H after targets, tests, screenshots, and external-link assumptions are verified.

## Human Review Impact

| Existing review family | Classification | Reason |
|---|---|---|
| Project list | NEEDS RE-REVIEW | Sidebar/workspace context changes |
| Project detail / edit | NEEDS RE-REVIEW | Tabs and Job/Workplace composition change |
| Job create fallback | LEGACY AFTER MIGRATION | Standalone fallback retires after integrated UX |
| Shift create | NEEDS RE-REVIEW | Canonical route/context selection changes |
| Shift List/Calendar/Week | NEEDS RE-REVIEW | New operation-tab hierarchy; Week becomes implemented evidence |
| Current Shift detail | LEGACY AFTER MIGRATION | Mapped Figma node is archived; new four-tab review required |
| Placement board/editor/conflict | NEEDS RE-REVIEW | Domain UI reused inside Shift detail, standalone shell becomes legacy |
| Pre-shift / Day-of | NEEDS RE-REVIEW | New workspace route plus single-Shift variants |
| Workplace list/editor | LEGACY AFTER MIGRATION | Master page retires; Project-integrated UX needs new review |
| Attendance | UNCHANGED | Formal domain and routes retained |

New review items are required for Project History, canonical Shift Detail in all four tabs, Confirmation phases, Placement within Shift, Project-integrated shared Workplace editing, compatibility pages/redirects, and responsive/keyboard behavior of both operation-tab levels.

## Screenshot / Mapping Impact

Existing screenshots remain historical evidence and must not be deleted during implementation. Rebaseline is needed for Project detail/edit, Shift Operations List/Week/Calendar, Shift detail four tabs, Placement-in-Shift, cross/single Pre-shift and Day-of, Project History, canonical Shift create, and Project-integrated Workplace editing. Standalone Placement and Workplace screenshots should be labelled legacy after migration. `figma-admin-shift-detail.png` currently maps to archived node `496:3034` and must not validate the new Shift detail. Route inventory, mapping, screenshot inventory, and human-review ledger must be updated together in 6I.

## Test Impact

- Navigation: Sidebar grouping/active states and operation/detail tab helpers.
- Project: list, three-tab detail, Overview Job/Workplace composition, Shift links, History authorization/pagination, setup/edit partial failures.
- Shift: List/Week/Calendar, create context, edit, Applications, four-tab routing.
- Placement: loader narrowing, editor open/close, save, validation, revision/version conflict, concurrent writes.
- Confirmation: explicit phase precedence, Tokyo default, manual switch, exact Assignment actions.
- Cross-shift monitors: filters, drawers, safe invalid IDs, query-preserving redirects.
- Workplace: selection/inline create/shared edit/inactive behavior plus compatibility page.
- Attendance/Incident: existing regression suites and exact Assignment links.
- Security: Manager branch isolation, System Admin scope, IDOR/not-found behavior, no grant/RLS broadening.
- Compatibility: all legacy routes and old tab aliases, including browser history and deep links.
- Visual/a11y: desktop/mobile, keyboard/focus, non-color state, console/React/hydration warnings.

## Risk Matrix

| Risk | Level | Reason / control |
|---|---|---|
| Project History foundation | HIGH | New durable persistence, actor exposure, RLS and atomic emission required; implement 6B first |
| Placement move | HIGH | Route state, exact Shift context, revisions, conflicts, revalidation and drawer links are coupled |
| Confirmation consolidation | HIGH | Cross/single split, Assignment identity, attendance/incident context, Tokyo phase selection |
| Workplace master retirement | MEDIUM-HIGH | Shared entity edits affect multiple Projects; replacement UX must be complete |
| Shift detail restructuring | MEDIUM-HIGH | Two existing tab families and archived visual evidence must be replaced without action regression |
| Compatibility redirects | MEDIUM | Query/ID loss could create wrong-context or IDOR bugs; allowlist and authorize |
| Sidebar simplification | LOW-MEDIUM | Broad link/test impact but limited domain risk |

## Recommended Implementation Order

1. **ADMIN-DATA-3.0B-6B — Project History Foundation:** durable model, authorization, write integration and read contract.
2. **ADMIN-UI-3.0B-6C — Project IA:** Sidebar simplification, three Project tabs, Overview Job/Workplace composition, History UI.
3. **ADMIN-UI-3.0B-6D — Shift Operations Workspace:** `/admin/shifts` operation shell and cross-shift routes; reuse List/Week/Calendar.
4. **ADMIN-UI-3.0B-6E — Shift Detail & Placement:** one-row four-tab detail and exact-Shift Placement reuse.
5. **ADMIN-UI-3.0B-6F — Confirmation Consolidation:** cross/single Pre-shift and Day-of split, Tokyo phase rule.
6. **ADMIN-UI-3.0B-6G — Workplace UX Migration:** complete Project-integrated selection/create/shared edit before master retirement.
7. **ADMIN-UI-3.0B-6H — Compatibility & Retirement:** guarded redirects/pages, remove obsolete navigation/components only after targets pass.
8. **ADMIN-QA-3.0B-6I — E2E / Visual Rebaseline:** link, security, browser, responsive, accessibility, mapping and screenshot freeze.

This order is valid. 6C depends on 6B for a real History tab; 6H must not precede 6G or the canonical operation destinations.

## Blockers

None for beginning 6B. The absent Project History persistence is a planned dependency, not an unresolved audit blocker. A current canonical Shift Detail Figma node should be designated before final visual freeze, but the fixed four-tab contract is sufficient for implementation planning and is not a 6B blocker.

## Explicit Non-Changes

- Product routes, pages, components, actions, loaders, helpers: unchanged by this phase.
- Database schema, migrations, RLS, RPC, GRANT: unchanged.
- Project, Job, Workplace, Shift, Placement, Confirmation, Attendance, Incident domain semantics: unchanged.
- Auth architecture and fixtures/seeds: unchanged.
- Packages and lockfile: unchanged.
- Figma: read-only; changed 0 nodes.
- Local/remote databases: unchanged; no reset, push, seed, or mutation.
- Git: no commit, push, stash, reset, checkout, or clean.
- Existing staged, unstaged, and untracked work was preserved.

