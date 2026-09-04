# Dispatch OS Admin
# Figma × Current Implementation Audit v1

## 1. Executive Summary

本監査は実装変更を行わず、現行コード、最新 Figma `03 Admin (3:4)`、UI/UX 文書、DB schema・RLS・Server Action を照合したものである。

- Admin route は 14 本。11 本は業務 UI があり、`workers`、`clients`、`settings` の 3 本は Placeholder。
- Figma の画面レベル Frame / State は 81。内部の `Main Content`、header、navigation component、Design System blueprint は数えていない。
- Chrome 実査は 0 / 14。Chrome 本体は検出したが、ChatGPT Chrome extension 用 profile と Native Host が未登録で、提供された Chrome 操作経路を開始できなかった。
- したがって pixel parity、実レンダー、390px overflow、console/network の判定は未確定であり、本監査の完了判定は BLOCKED とする。
- コードと Figma の構造比較で最大の差は、Shift Create の `Single + Bulk` 分離対 `Unified Dates`、Navigation IA、Project/Shift Hub、未実装の Staff/Master/Settings と Future Domain 群である。
- 既存 Domain を偽装して Figma を再現してはならない。配置タイムライン、SOS、連絡、ナレッジ、集計、system-wide audit などは Future Domain として分離する。

### Coverage snapshot

| Metric | Result | Definition |
|---|---:|---|
| Route implementation | 11 / 14 | Placeholder を除く page route |
| Figma screen coverage | 26 / 81 | 同じ責務がコードに full または partial で存在する Frame/State |
| Full structural alignment | 0 / 81 confirmed | Chrome 比較不能のため「完全一致」は認定しない |
| Domain-ready coverage | 32 / 81 | 現 DB / action で安全に構築可能と判断できる画面状態 |
| Chrome verified | 0 / 14 | 実 Chrome で 1440 / 1280 / 390 を完走した route |

`Figma screen coverage` と `Domain-ready coverage` は Route 数ではなく、画面レベル Frame/State 81 件を分母にした設計監査上の分類値である。

## 2. Audit Scope

- Repository: `C:\Users\user\dispatch-os`
- Figma: `Dispatch OS — Product Design` / `03 Admin` / node `3:4`
- Read-only scope: route、component、data access、Server Action、schema、RLS、Figma、local runtime readiness
- Viewports requested: 1440px、1280px、390 × 844
- Mutation excluded: create、edit、bulk create、assignment、attendance mutation、DB / Auth / remote Supabase operation
- Implementation、format、cleanup、commit、push は実施していない。

## 3. Sources

1. 最新 Figma `03 Admin (3:4)`。metadata と代表 Frame の design context / visual を直接確認。
2. `C:\Users\user\Documents\Dispatch_OS_画面構成台帳.xlsx`（2026-08-28）。最新版候補だが、この実行環境では spreadsheet skill が要求する workspace dependency loader が利用できず、セル内容は未読。
3. `C:\Users\user\Documents\Dispatch_OS_画面構成_完成版.md`（v2.1、2026-08-28）。
4. `docs/dispatch-os-design-foundation-v1.md`
5. `docs/dispatch-os-ui-patterns-v1.md`
6. `app/admin/**`、`components/admin/**`、`lib/admin/**`、`app/actions/**`
7. `supabase/migrations/**` と現行 DB domain 定義

台帳 xlsx 未読は IA 解釈の制約である。Markdown v2.1 は Single/Bulk 分離を定義する一方、最新 Figma は Unified Dates を示すため、後者への変更を確定事項にはせず Open Decision とした。

## 4. Git State

監査開始時:

- Branch: `small-ui-a11y-fix`
- Tracking: `origin/small-ui-a11y-fix`
- Worktree: clean
- Staged diff: none
- Unstaged diff: none
- Latest commit: `c62e7cb feat: complete admin project job shift UI phases and design foundation`
- 直近 10 commits は UI、DB helper、Supabase write 制限、login a11y、admin shell/auth/dashboard を含む。

本書以外の repository file は変更していない。最終 Git 状態は §30 に記録する。

## 5. Current Route Inventory

| Route | Page file | State | Boundary | Main component / data | Action / domain | Figma | Decision |
|---|---|---|---|---|---|---|---|
| `/admin` | `app/admin/page.tsx` | Implemented | Server | dashboard data + dashboard UI | read-only dashboard aggregate | `459:3284`, `464:2`, `574:91`, `574:180` | 修正 |
| `/admin/projects` | `app/admin/projects/page.tsx` | Implemented | Server | project list / filters | projects, jobs, shifts, staffing | `469:2`, `575:5`, `391:3235` | 修正 |
| `/admin/projects/new` | `app/admin/projects/new/page.tsx` | Implemented | Server + client form | ProjectForm / form options | createProject | `489:310` | 修正 |
| `/admin/projects/[projectId]` | `app/admin/projects/[projectId]/page.tsx` | Implemented | Server + client drawers | Project Hub, jobs, shifts | project/job/shift reads and edits | `383:3183`, `29:2`, `383:3413`, `576:5`, `420:2` | 修正 / Future Domain |
| `/admin/projects/[projectId]/jobs/new` | `.../jobs/new/page.tsx` | Implemented compatibility surface | Server + client form | JobForm | createJob | `599:5` | 統合すべき |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | `.../shifts/new/page.tsx` | Implemented compatibility surface | Server + client form | ShiftForm | createShift | `501:2821` | 統合すべき |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` | `.../shifts/bulk-new/page.tsx` | Implemented | Server + client form | BulkShiftCreateForm | bulkCreateShifts | `501:2821`, `504:2541` | 統合すべき / Open Decision |
| `/admin/shifts` | `app/admin/shifts/page.tsx` | Implemented | Server | shift list / filters | shift staffing reads | `496:2900`, `505:352`, `505:512`, `577:5` | 修正 / 増やす |
| `/admin/shifts/[shiftId]` | `app/admin/shifts/[shiftId]/page.tsx` | Implemented | Server + client actions/drawer | Shift detail, applications, assignments, pre-shift | accept/reject, assign/cancel, absence/no-show, edit | `496:3034`, `578:5` | 修正 |
| `/admin/attendance` | `app/admin/attendance/page.tsx` | Implemented | Server | attendance list / summary / filters | attendance and assignment reads | `530:2122` | 修正 |
| `/admin/attendance/[assignmentId]` | `.../[assignmentId]/page.tsx` | Implemented | Server + client actions | detail, records, revisions | confirm/revise, absence/no-show | `530:2369`, `533:2044`, `533:2197`, `533:2350`, `533:2503` | 修正 |
| `/admin/workers` | `app/admin/workers/page.tsx` | Placeholder | Server | PageHeader only | workers table exists; admin CRUD UI absent | Staff nodes | Placeholder |
| `/admin/clients` | `app/admin/clients/page.tsx` | Placeholder | Server | PageHeader only | clients/workplaces read domain exists; CRUD UI absent | `286:401`, `286:569`, `286:763`, `286:931` | Placeholder |
| `/admin/settings` | `app/admin/settings/page.tsx` | Placeholder | Server | PageHeader only | settings domain absent | Settings nodes | Placeholder / Future Domain |

`app/admin/layout.tsx` is not counted as a route. It is a Server Component, calls `requireAdmin`, and renders `AdminShell`.

## 6. Current Component Inventory

| Area | Status | Evidence / boundary |
|---|---|---|
| Admin Shell | Implemented | layout, global header, content container |
| Sidebar | Implemented, IA stale | expanded/collapsed, active state, persistence cookie |
| Mobile Navigation | Implemented, visual gap | focus trap, Escape, focus restore, body scroll lock; not current Figma full-screen width |
| Page Header / Breadcrumb | Implemented | shared admin components; detail/create surfaces use breadcrumb |
| Drawer | Implemented | focus/close/pending behavior centralized |
| Dashboard | Implemented, partial target | summary/alerts/today scope present; SOS domain absent |
| Project | Implemented | list, hub, create form, edit drawer |
| Job | Implemented | create/edit forms and drawers; compatibility create page remains |
| Shift | Implemented, target mismatch | single create/edit, bulk create, list/detail |
| Assignment | Implemented core | application accept/reject, assign/cancel, absence/no-show |
| Attendance | Implemented | list/detail/confirm/revise/revision history |
| Worker/Staff | Placeholder UI | DB workers exist, Figma hub/editor absent |
| Clients/Workplaces | Placeholder UI | DB entities exist; master UI absent |
| Settings | Placeholder UI | target tabs mostly require new domain |
| Aggregation / Communications / Knowledge | Unimplemented | no matching Admin components or routes |

UI-2.3C/D/E artifacts exist in current code, including optimistic concurrency tokens for Project/Job/Shift. Design Foundation tokens and documented patterns also exist. Past COMPLETE reports were not used as proof.

## 7. Current Domain Capability

### Ready or substantially ready

- Branch access and server-side Admin authorization
- Projects, clients, workplaces, jobs, shift slots
- Shift applications and assignments
- Pre-shift confirmations
- Attendance events, official attendance records, confirmation and revisions
- Worker profiles/basic worker records
- Optimistic concurrency for Project, Job and Shift edits using opaque `updated_at` tokens
- RLS / GRANT protection for current core entities; ordinary app code does not use `service_role`

### UI missing while core data exists

- Staff list/basic hub
- Client list/basic editor
- Workplace list/basic editor
- Cross-shift pre-shift monitoring using existing confirmations
- Some day-of views based on existing attendance/absence/no-show facts
- Week/calendar projection from shift slots, subject to query/performance design

### Domain missing or materially incomplete

- Multi-venue project model as shown by Figma
- Placement positions, assignment time segments, break schedules and coverage timeline
- wake/depart/arrival operational check-ins and SOS workflow
- monthly aggregation/export, transport settlement, closing/NEO integration
- inbox/messages, broadcasts, announcements, notification delivery
- FAQ/manual/rules content, revision and analytics
- settings persistence for permissions/notifications/LINE/NEO/security
- system-wide audit log (attendance revision history is not equivalent)

## 8. Latest Figma Inventory

The actual canvas hierarchy matches the expected ten areas. `Design System v2 (427:3235)` is a reference section and is excluded from the screen count.

| Area | Screen-level nodes | Count |
|---|---|---:|
| 01 Home | `459:3284`, `464:2`, `574:91`, `574:180` | 4 |
| 02A Project | `29:2`, `383:3183`, `383:3413`, `469:2`, `489:310`, `492:6` | 6 |
| 02B Shift Editor | `501:2821`, `501:2974`, `504:2541` | 3 |
| 02C Shift List/Hub | `496:2900`, `496:3034`, `505:352`, `505:512` | 4 |
| 02D Placement | `515:2`, `515:431`, `517:14` | 3 |
| 02E Pre-shift / Day-of | `523:2`, `523:257`, `525:2`, `525:229` | 4 |
| 02 Mobile / Drawer variants | `575:5`, `576:5`, `577:5`, `420:2`, `578:5`, `391:3235`, `599:5`, `599:198` | 8 |
| 03 Attendance | `530:2122`, `530:2369`, `533:2044`, `533:2197`, `533:2350`, `533:2503` | 6 |
| 04 Staff | `544:2`, `544:271`, `546:2`, `546:233`, `546:442`, `546:651`, `546:856` | 7 |
| 05 Aggregation | `553:1363`, `553:1621`, `553:1847`, `601:7` | 4 |
| 06 Communications | `109:2`, `110:2`, `116:2`, `117:2`, `117:233`, `118:2`, `119:2` | 7 |
| 07 Knowledge | `121:2`, `121:268`, `122:211`, `122:396` | 4 |
| 08 Master | `286:401`, `286:569`, `286:763`, `286:931` | 4 |
| 09 Settings | `123:2`, `123:364`, `123:540`, `123:696`, `123:868`, `123:1022` | 6 |
| 10 Common States & Navigation | `602:12`, `602:18`, `602:24`, `602:32`, `602:40`, `602:48`, `602:56`, `602:62`, `602:70`, `602:78`, `602:86` | 11 |
| **Total** |  | **81** |

Type coverage includes Page, Hub, Tab, View, Editor, Drawer and State. Latest navigation definition groups Home; Projects/Ops; Attendance/Staff; Aggregation; Communications; Knowledge; Master; Settings/Audit Log.

## 9. Chrome QA Environment

### Local runtime

- Docker Engine: available (`29.7.2`)
- Local Supabase API: `http://127.0.0.1:54321`
- Local Studio: `http://127.0.0.1:54323`
- Next.js: `16.3.1`, ready at `http://localhost:3000`
- The Next.js process was launched with local Supabase values resolved from local CLI status; remote URL was rejected before launch.
- No credentials or local keys are recorded in this document.

### Chrome blocker

- Google Chrome executable was detected.
- Chrome integration diagnostic could not find its expected user-data directory.
- The shared Native Messaging Host manifest and HKCU registration were absent.
- The browser client also referenced a missing bundled service module from an older plugin version.
- Per Chrome integration safety guidance, no shell automation, alternate browser, web fetch, plugin-cache modification, or self-repair was used.

Consequences:

- All routes at 1440 / 1280 / 390 × 844: NOT VERIFIED
- Login/session: NOT ATTEMPTED
- Drawers/forms in actual Chrome: NOT VERIFIED
- Screenshots: NOT CAPTURED
- React/hydration/runtime/network/404/500/CSS/a11y console: NOT VERIFIED

Required recovery is to reinstall or reconnect the Browser plugin from the ChatGPT plugin UI, then rerun this audit phase.

## 10. Route Coverage Matrix

| Route / Surface | Code | Chrome | Figma | Domain | 判定 | Severity | Next Action |
|---|---|---|---|---|---|---|---|
| AdminShell / nav | Implemented | BLOCKED | Home + `602:86` | Ready | 修正 | Critical | latest grouped IAへ再編。Chrome後にfocus/persistence再確認 |
| `/admin` | Implemented | BLOCKED | `459:3284` | Partial | 修正 | Major | SOSをFuture表示に分離し、既存指標でpriority hierarchyを整合 |
| `/admin/projects` | Implemented | BLOCKED | `469:2`, `575:5` | Ready | 修正 | Major | KPI/filter/table/pagination責務を既存queryに合わせる |
| `/admin/projects/new` | Implemented | BLOCKED | `489:310` | Ready | 修正 | Major | field責務とFigma editorを再照合 |
| Project Hub | Implemented | BLOCKED | `383:3183`, `29:2` | Partial | 修正 | Critical | tabs/ops links/summaryを再編。multi-venueはFuture |
| Project Edit Drawer | Implemented | BLOCKED | `492:6` | Ready | 修正 | Major | immutable branch、error/disabled/mobileをChrome確認 |
| Job create page | Implemented | BLOCKED | `599:5` | Ready | 統合すべき | Major | Hub drawerをcanonicalにしroute扱いを決定 |
| Job edit drawer | Implemented | BLOCKED | `599:198` | Ready | 修正 | Major | restriction helper/fields/mobile整合 |
| Single Shift create page/drawer | Implemented | BLOCKED | `501:2821` | Ready | 統合すべき | Critical | Unified Dates方針決定後に一本化 |
| Bulk Shift create page | Implemented | BLOCKED | `501:2821`, `504:2541` | Ready | 統合すべき | Critical | single/bulk共通editorへ統合可否を決定 |
| `/admin/shifts` List | Implemented | BLOCKED | `496:2900` | Ready | 修正 | Major | density/KPI/filterを整合 |
| `/admin/shifts` Week | Missing | BLOCKED | `505:352` | Likely ready | 増やす | Major | 同route viewとして追加候補 |
| `/admin/shifts` Calendar | Missing | BLOCKED | `505:512` | Likely ready | 増やす | Major | 同route viewとして追加候補 |
| Shift Detail Hub | Implemented | BLOCKED | `496:3034`, `578:5` | Ready core | 修正 | Major | overview/applicants/assignment/pre-shift/historyをhub化 |
| Shift Edit Drawer | Implemented | BLOCKED | `501:2974` | Ready | 修正 | Major | Single Shift Onlyを維持し制限表示を整合 |
| Placement / break rotation | Missing | BLOCKED | `515:2`, `515:431`, `517:14` | Missing | Future Domain | Critical | backend domainから別Phase設計 |
| Pre-shift cross-shift | Missing | BLOCKED | `523:2`, `525:2` | Partial | 増やす | Major | confirmationsを集約するread UIを設計 |
| Day-of operations | Missing | BLOCKED | `523:257`, `525:229` | Partial/missing | Future Domain | Critical |既存attendanceと新check-in/SOSを分離 |
| `/admin/attendance` | Implemented | BLOCKED | `530:2122` | Ready core | 修正 | Major | status vocabulary/filter/tableを整合 |
| Attendance Detail | Implemented | BLOCKED | five detail states | Ready core | 修正 | Major | state別hierarchyとrevision historyを整合 |
| `/admin/workers` | Placeholder | BLOCKED | seven Staff nodes | Partial | Placeholder | Critical | basic UIはP1、高度skill/feedbackはFuture |
| `/admin/clients` | Placeholder | BLOCKED | four Master nodes | Ready core | Placeholder | Major | client/workplace master UIをP1で構築 |
| `/admin/settings` | Placeholder | BLOCKED | six Settings nodes | Missing | Placeholder / Future | Critical | fake tabsを作らずdomain別Phaseへ |
| Aggregation | Missing route | BLOCKED | four nodes | Missing | Future Domain | Critical | domain first |
| Communications | Missing route | BLOCKED | seven nodes | Missing | Future Domain | Critical | domain first |
| Knowledge | Missing route | BLOCKED | four nodes | Missing | Future Domain | Critical | domain first |
| Audit Log | Missing route | BLOCKED | `123:1022` | Missing | Future Domain | Critical | attendance revisionsと分離 |

## 11. Figma Coverage Matrix

| Figma Node | Name | Type | Matching Route/Component | Implementation | Domain | Decision |
|---|---|---|---|---|---|---|
| `459:3284`, `464:2` | Home desktop collapsed/expanded | Page/State | `/admin`, AdminShell | Partial | Partial | 修正 |
| `574:91`, `574:180` | Home mobile nav closed/open | State | AdminMobileNavigation | Partial | Ready | 修正 |
| `469:2`, `575:5`, `391:3235` | Project List desktop/mobile/nav | Page/State | `/admin/projects` | Partial | Ready | 修正 |
| `383:3183`, `576:5` | Project Hub normal desktop/mobile | Hub | Project detail | Partial | Ready core | 修正 |
| `29:2`, `383:3413`, `420:2` | Multi-venue Project Hub/venue/mobile | Hub/View | Project detail | Missing | Missing | Future Domain |
| `489:310`, `492:6` | Project Editor create/edit | Editor | ProjectForm/EditDrawer | Implemented/partial | Ready | 修正 |
| `599:5`, `599:198` | Job/Workplace create/edit | Drawer | JobForm/EditDrawer | Implemented/partial | Ready | 修正 |
| `501:2821`, `504:2541` | Shift Create Unified Dates/day settings | Editor/Drawer | single + bulk forms | Partial, structurally different | Ready core | 統合すべき |
| `501:2974` | Shift Edit Single Shift | Editor | ShiftEditDrawer | Implemented/partial | Ready | 修正 |
| `496:2900`, `577:5` | Shift List desktop/mobile | Page | `/admin/shifts` | Partial | Ready | 修正 |
| `505:352`, `505:512` | Shift Week/Calendar | View | none | Missing | Likely ready | 増やす |
| `496:3034`, `578:5` | Shift Detail Hub desktop/mobile | Hub | shift detail | Partial | Ready core | 修正 |
| `515:2`, `515:431`, `517:14` | Placement/break editor/staff picker | Page/Drawer/State | assignment actions only | Missing | Missing | Future Domain |
| `523:2`, `525:2` | Pre-shift list/staff drawer | Page/Drawer | detail-level confirmation components | Partial | Partial | 増やす |
| `523:257`, `525:229` | Day-of list/staff drawer | Page/Drawer | attendance + absence actions only | Partial | Partial/missing | Future Domain |
| `530:2122` | Attendance List | Page | `/admin/attendance` | Partial | Ready core | 修正 |
| `530:2369`, `533:2044`, `533:2197`, `533:2350`, `533:2503` | Attendance detail states | Hub/State | attendance detail | Partial | Ready core | 修正 |
| seven Staff nodes | Staff list/hub/tabs/editors | Page/Hub/Tab/Editor | `/admin/workers` | Placeholder | Basic partial | Placeholder/Future split |
| four Aggregation nodes | Monthly/transport/closing | Page/View | none | Missing | Missing | Future Domain |
| seven Communications nodes | Inbox/detail/broadcast/announcement/history | Page/View | none | Missing | Missing | Future Domain |
| four Knowledge nodes | List/editor/analytics/revision | Page/Editor/View | none | Missing | Missing | Future Domain |
| four Master nodes | Client/workplace list/drawers | Page/Drawer | `/admin/clients` placeholder | Placeholder | Ready core | Placeholder |
| five Settings tab nodes | settings tab states | Page/Tab | `/admin/settings` placeholder | Placeholder | Missing | Future Domain |
| `123:1022` | Audit Log | Page | none | Missing | Missing | Future Domain |
| eleven `602:*` nodes | Common states/navigation | State | scattered inline states | Partial | N/A | 修正 / 増やす |

All 81 nodes are represented by the grouped rows above; grouping only combines variants with the same responsibility and decision.

## 12. Screen-by-Screen Comparison

### Home / Dashboard

- Current code: three main operational metrics, alerts and workplace-oriented data.
- Figma: four KPIs including SOS, a four-item priority queue and denser today-site table.
- Gap: current domain cannot supply SOS. Information priority and card/table composition differ.
- Recommended final: preserve current truthful metrics, adopt Figma hierarchy, label or omit Future Domain instead of fake SOS counts.
- Decision: 修正 / Major; SOS portion Future Domain / Critical.

### Admin Shell

- Current code: flat seven-item navigation; sidebar `w-60` expanded and `w-16` collapsed; top bar 64px; mobile sheet max 20rem.
- Figma: grouped IA, approximately 232px/72px sidebar, 68px header, 390px full-screen mobile navigation.
- Gap: IA and mobile navigation are structural, not spacing-only.
- Recommended final: decide grouped target IA first, then align dimensions and full-screen mobile behavior while preserving focus trap, Escape, restore, scroll lock and persistence.
- Decision: 修正 / Critical.

### Project List

- Current code: server-driven search/status/period list and primary links.
- Figma: KPI row, projects/shifts/confirmation context tabs, richer filters, dense table, fill-rate/staffing and pagination.
- Gap: comparison density and operational context differ; pagination should depend on actual query volume.
- Recommended final: retain server data boundary and primary object link, introduce only domain-supported KPIs/filters.
- Decision: 修正 / Major.

### Project Hub

- Current code: summary, overview, job list and shift section in a long page; project/job/shift drawers exist.
- Figma: overview/shifts/placement/confirmation/history tabs, five KPIs, job/workplace structure, operational links.
- Gap: hub IA and multi-venue model. Placement/history are not all domain-ready.
- Recommended final: hub first; map ready sections to tabs/views and keep missing-domain views explicitly deferred.
- Decision: 修正 / Critical; multi-venue Future Domain.

### Project Editor

- Current code: dedicated create form; edit drawer; branch/client/date/status/description; optimistic concurrency on edit.
- Figma: project-only create/edit editor with clearer responsibility split.
- Gap: exact field order/helpers/mobile could not be rendered in Chrome. Branch immutability semantics require final product decision.
- Recommended final: keep server validation and concurrency; do not move Job/Workplace fields into Project editor.
- Decision: 修正 / Major pending Chrome.

### Job Editor

- Current code: JobForm supports workplace, status, description, wage, transportation cap, dress/requirements/meal/recruitment/manual; edit restrictions and concurrency exist.
- Figma: project-context create/edit drawer.
- Gap: standalone create route duplicates drawer responsibility; exact responsive/helper presentation unverified.
- Recommended final: make Hub drawer canonical; retain compatibility route only if a real deep-link/accessibility need is demonstrated.
- Decision: 統合すべき / Major.

### Shift Create

- Current code: single ShiftForm plus separate BulkShiftCreateForm dedicated route.
- Figma: one `Create / Unified Dates` editor: begins with one date, adds dates, applies common settings, then allows day overrides.
- Gap: critical interaction and route responsibility mismatch. Markdown v2.1 still documents the split, so Figma versus written SOT is unresolved.
- Recommended final: one create experience backed by existing single/bulk actions or a shared orchestration layer; individual records remain independent after creation. Resolve SOT before code changes.
- Decision: 統合すべき / Critical.

### Shift Edit

- Current code: single-shift edit drawer with immutable/restricted field rules and optimistic conflict handling.
- Figma: Single Shift Only editor.
- Gap: responsibility aligns; layout, restriction copy, staffing/application/attendance implications need visual verification.
- Recommended final: retain single-only edit and current domain rules; visually align after Chrome recovery.
- Decision: 修正 / Major, potentially OK after QA.

### Shift List / Hub

- Current code: list route and detailed page with applications, assignments and pre-shift sections.
- Figma: list/week/calendar switch and tabbed detail hub.
- Gap: week/calendar absent; detail is linear rather than target hub; history is not system-wide audit.
- Recommended final: add views within `/admin/shifts`, not routes; reorganize existing detail data without changing state transitions.
- Decision: 修正 + 増やす / Major.

### Placement / Break Rotation

- Current code: assignment actions exist, but no position, time segment, break schedule or coverage timeline model.
- Figma: unified placement/break page, edit drawer and staff picker.
- Recommended final: do not simulate this with assignment status alone.
- Decision: Future Domain / Critical.

### Pre-shift / Day-of

- Current code: pre-shift confirmation is visible per Shift; day-of facts include start/end, absence and no-show.
- Figma: cross-shift lists and staff drawers; day-of adds wake/depart/arrival/SOS/coverage concepts.
- Recommended final: P1 cross-shift pre-shift read view from existing data. Split day-of into ready attendance facts and Future check-in/SOS domain.
- Decision: 増やす / Major and Future Domain / Critical.

### Attendance

- Current code: list, assignment-centric detail, events, official record, confirm/revise, absence/no-show and revision history.
- Figma: denser list plus unconfirmed/confirmed/revised/late/absent detail states.
- Gap: structure/status vocabulary/filter set. Existing attendance revisions are stronger factual history than a purely visual state mock.
- Recommended final: preserve existing auditability and domain transitions; adopt Figma hierarchy only where states map truthfully.
- Decision: 修正 / Major.

### Staff / Master / Settings and future areas

- Staff, Client/Master and Settings routes currently render headers only.
- Basic Staff and Client/Workplace screens can build on current entities; advanced staff evaluation, settings tabs, aggregation, communications, knowledge and audit log require additional domain.
- Decision: Placeholder for current routes; P1 for basic existing-domain UI; Future Domain for unsupported sections.

## 13. OK

- Server Component is the default page boundary; client scope is constrained to interactive forms/drawers/actions.
- Admin layout performs server-side role protection.
- Project/Job/Shift editing implements optimistic concurrency rather than last-write-wins.
- Core assignment and attendance mutations remain backed by server actions and database authorization.
- Primary object links, shared PageHeader/Breadcrumb, semantic tokens and common Drawer foundation exist.
- Shift Edit responsibility is correctly single-shift only.

No entire screen is marked fully aligned because actual Chrome comparison is blocked.

## 14. 修正

- AdminShell/navigation: replace flat IA with approved grouped IA; then align header/sidebar/mobile dimensions.
- Dashboard: align operational hierarchy while excluding unsupported SOS data.
- Project List/Hub: increase comparison density and hub structure without fabricating placement/history.
- Project/Job/Shift editors: align responsibility, field sequence, helpers and responsive presentation.
- Shift List/Detail: add view structure and hub organization around current domain.
- Attendance List/Detail: align state vocabulary and section hierarchy while retaining revision history.
- Common feedback/state treatment: centralize page and submit states.

## 15. 統合すべき

### Job Create

- Before routes: Hub drawer plus `/admin/projects/[projectId]/jobs/new`.
- Final: Project Hub Job editor drawer as canonical surface; compatibility route only if explicitly justified.
- Reason: same create responsibility and parent context.
- Reusable: `JobForm`, form options, create action, Drawer.

### Shift Create

- Before routes: single create page/drawer plus `bulk-new` dedicated page.
- Final: one Unified Dates create editor after the SOT decision.
- Reason: latest Figma models single and multiple dates as one task.
- Reusable: `ShiftForm` fields/validation, `BulkShiftCreateForm` date/common-setting logic, existing single/bulk server actions.

### Pre-shift / Day-of detail states

- Before: operations embedded primarily in Shift/Attendance details.
- Final: cross-shift list views link to the existing canonical details/drawers; do not duplicate mutation logic.
- Reusable: confirmation, assignment and attendance components.

## 16. 増やす

Only after route/IA approval:

- Shift Week view inside `/admin/shifts`
- Shift Calendar view inside `/admin/shifts`
- Cross-shift Pre-shift monitor using existing confirmation data
- Basic Staff list/detail using existing workers/profile data
- Client and Workplace master list/editor using secured existing entities
- Shared route-level Empty/Loading/Error/Forbidden/Not Found treatment

## 17. 消す

No route is approved for immediate deletion by this audit.

Candidates after replacement and usage checks:

- standalone Job create compatibility page
- separate single/bulk Shift create entry surfaces after Unified Dates becomes canonical

Deletion requires confirming bookmarks/deep links, accessibility fallback, test coverage and final IA. DB-backed functionality must remain.

## 18. Future Domain

| Area | Required backend additions |
|---|---|
| Multi-venue projects | venue grouping/ownership and venue-specific operational scope |
| Placement | positions, assignment segments, effective time ranges |
| Break rotation | break schedule, coverage requirements, conflict rules |
| Day-of operations | wake/depart/arrival events, escalation state, coverage status |
| SOS | incident/report entity, severity, ownership, lifecycle, notifications |
| Aggregation | month close, payable rules, transport settlement, export/integration state |
| Communications | threads/messages, recipients, delivery/read state, broadcasts/announcements |
| Knowledge | content model, revisions, publication, permissions, analytics |
| Settings | persisted policy/config models and authorization boundaries |
| Audit Log | system-wide append-only audit events, actor/action/object/before-after metadata |
| Advanced Staff | skills, evaluation, feedback/memo authorization and retention |

## 19. Placeholder

- `/admin/workers`: header only. Split basic staff P1 from advanced Future Domain.
- `/admin/clients`: header only. Existing clients/workplaces make basic master UI P1-ready.
- `/admin/settings`: header only. Most target tabs require Future Domain; do not create nonfunctional controls.

## 20. Common State Coverage

| State | Figma | Code | Where used | Decision |
|---|---|---|---|---|
| Empty | `602:12` | Partial | list components provide local empty messages | 修正: shared composition |
| Loading | `602:18` | No route-level boundary found | no Admin `loading.tsx` found | 増やす |
| Error | `602:24` | Partial | form/action inline errors | 増やす route-level + unify inline |
| Forbidden | `602:32` | Server guard behavior, no dedicated Admin state | layout/auth | 増やす visual state without weakening auth |
| Not Found | `602:40` | No Admin-specific boundary found | framework/default behavior | 増やす |
| Conflict | `602:48` | Implemented partially | Project/Job/Shift optimistic edit flows; Shift has reload action | 修正: consistent warning/reload behavior |
| Submit Pending | `602:56` | Implemented | forms/actions disable and show pending labels | 修正: consistent live feedback |
| Submit Success | `602:62` | Partial | close/refresh patterns, limited persistent feedback | 修正 |
| Submit Error | `602:70` | Implemented partially | form root and action errors | 修正 |
| Unsaved Changes | `602:78` | Not found | drawers/forms | 増やす after behavior decision |
| Navigation | `602:86` | Implemented, IA stale | sidebar/mobile nav | 修正 Critical |

No Offline Frame was counted because the latest inspected Common States screen-level list contains the eleven nodes above.

## 21. Responsive Gap

Code inspection findings:

- General content widths and responsive stacks exist.
- Sidebar switches at `lg`; collapsed/expanded persistence exists.
- Mobile navigation has strong interaction behavior but uses a max-width sheet instead of target 100vw × 100dvh.
- Drawer foundation is intended for mobile full height/width, but actual Project/Job/Shift render is unverified.
- Dense tables/filter wrapping and 390px horizontal overflow cannot be certified without Chrome.
- Figma has dedicated mobile frames for Home, Project List/Hub, Shift List/Hub and multi-venue. Other pages may derive mobile behavior from responsive rules and are not automatically “Missing Figma”.

Status: BLOCKED for 1440, 1280 and 390 × 844 visual QA.

## 22. Navigation Gap

Current flat items:

`Dashboard / Projects / Shifts / Staff / Clients & Workplaces / Attendance / Settings`

Figma target groups:

- Home
- Projects/Ops: projects, shifts, placement/break, pre-shift, day-of
- Attendance/Staff
- Aggregation: monthly, transportation, close/NEO
- Communications: inquiries/SOS, notices, notifications
- Knowledge: FAQ, manuals, work rules
- Master: clients, workplaces
- Settings and Audit Log

Recommendation: first distinguish available, placeholder and Future Domain destinations. A grouped navigation must not expose dead or fake operational links. Future entries need a deliberate visibility policy (hidden, disabled with explanation, or roadmap-only in Figma).

## 23. Design Foundation Gap

- Foundation values: near-black primary, subtle warm canvas, border-first surfaces, 4px scale, 8px controls, 12px cards, 1200px content, 68px header, 64–72/240–248px sidebar.
- Current shell is close in palette and component foundation but differs in exact width/header/mobile sheet.
- Current data screens remain less dense and less table-oriented than latest Figma.
- Semantic token adoption is present; exact raw utility drift and computed visual values require Chrome inspection.
- Accessibility structure is generally intentional, but keyboard order, focus clipping, target size and contrast remain runtime QA items.

## 24. Security / Domain Boundary

- UI visibility is not treated as authorization; server guard + RLS/GRANT remain authoritative.
- No remote Supabase operation was performed.
- No migration, RLS, GRANT, RPC, Auth, seed or package was changed.
- Figma states must map to existing enums/transitions; UI must not invent wake/depart/SOS/placement states.
- Client/workplace and staff UI may be added only through existing secured access or a separately reviewed backend phase.
- Attendance revision history is entity-specific evidence and must not be marketed as a system-wide audit log.
- Unified Shift Create is an interaction decision, not permission to weaken immutable Project/Workplace rules or concurrency.

## 25. Current Architecture

```text
AdminShell
├─ Dashboard
├─ Projects
│  ├─ List
│  ├─ Create (dedicated page)
│  └─ Project Hub
│     ├─ Project Edit Drawer
│     ├─ Job Create Drawer + standalone create page
│     ├─ Job Edit Drawer
│     ├─ Shift Create Drawer + standalone create page
│     └─ Bulk Shift Create dedicated page
├─ Shifts
│  ├─ List
│  └─ Detail
│     ├─ Edit Drawer
│     ├─ Applications
│     ├─ Assignments
│     └─ Pre-shift
├─ Attendance
│  ├─ List
│  └─ Detail
│     ├─ Events / official record
│     ├─ Confirm / revise
│     └─ Revision history
├─ Workers (Placeholder)
├─ Clients (Placeholder)
└─ Settings (Placeholder)
```

## 26. Target Architecture

```text
AdminShell + grouped navigation
├─ Home
├─ Projects / Operations
│  ├─ Project List
│  ├─ Project Hub
│  │  ├─ Overview / Shifts
│  │  ├─ Project Editor
│  │  └─ Job Editor
│  ├─ Shift List [List | Week | Calendar]
│  ├─ Shift Hub [Overview | Applicants | Assignment | Pre-shift | History]
│  ├─ Unified Dates Shift Create
│  ├─ Single Shift Edit
│  ├─ Pre-shift Monitor
│  └─ Placement / Day-of (Future-domain portions gated)
├─ Attendance
│  ├─ List
│  └─ State-aware Detail Hub
├─ Staff
├─ Aggregation (Future Domain)
├─ Communications (Future Domain)
├─ Knowledge (Future Domain)
├─ Master [Clients | Workplaces]
└─ Settings
   ├─ Settings tabs (Future Domain)
   └─ Audit Log (Future Domain)
```

Current → Target is principally a hub/view/navigation reorganization around existing truth, followed by basic missing UI, followed by explicitly authorized backend domains.

## 27. P0 Roadmap

1. Restore Chrome plugin connection and rerun all 14 routes at 1440, 1280 and 390 × 844, including console/network and non-mutating drawer states.
2. Resolve the SOT conflict: Markdown v2.1 Single/Bulk split versus latest Figma Unified Dates.
3. Approve navigation policy for unavailable Future Domain destinations.
4. Align AdminShell and mobile full-screen navigation while retaining accessibility behavior.
5. Recompose Project Hub and Shift Hub using only current domain data.
6. Align Project/Job/Shift editors; preserve server validation, immutable rules and optimistic concurrency.
7. Establish consistent Common States, especially route loading/error/forbidden/not-found and unsaved changes.

## 28. P1 Roadmap

1. Shift Week and Calendar views using current shift data.
2. Cross-shift Pre-shift monitor using current confirmation data.
3. Basic Staff List/Hub based on current worker/profile data and existing authorization.
4. Client/Workplace Master UI based on secured current entities.
5. Attendance and day-of read views limited to existing attendance/absence/no-show facts.
6. Responsive and visual polish after representative Chrome evidence is available.

Each P1 item still requires query shape, pagination/performance and authorization review; “table exists” alone is not implementation approval.

## 29. P2 Future Domain

Recommended domain-first sequence:

1. Placement/break coverage model
2. Day-of check-in and SOS lifecycle
3. Aggregation/transport/closing/NEO
4. Communications and notification delivery
5. Knowledge content/revision/analytics
6. Settings persistence and permission model
7. System-wide audit log
8. Advanced staff skills/evaluation/feedback

Each requires a separate schema/RLS/GRANT/action/security design phase before UI implementation.

## 30. Open Decisions

1. Is latest Figma Unified Dates authoritative over the v2.1 Markdown/ledger Single + Bulk rule?
2. Should compatibility create routes remain as accessible/deep-link fallbacks after drawers become canonical?
3. How should navigation represent Future Domain: hidden, disabled with explanation, or absent until release?
4. Are Project tabs URL-addressable query views, in-page tabs, or progressive sections on mobile?
5. What is the product boundary between Shift Hub “History”, Attendance revisions and the future system Audit Log?
6. Which Staff fields are already authorized for Manager visibility and editing?
7. Should Week/Calendar ship before pagination and query-volume evidence?
8. Which settings are organization-wide, branch-scoped or user-scoped?
9. Re-run requirement: Chrome plugin reconnected, xlsx cell content readable, then update all Chrome and final parity columns.

### Final repository check

Expected audit diff: only `docs/admin-figma-implementation-audit-v1.md`. No implementation file, migration, package or generated artifact should differ.

