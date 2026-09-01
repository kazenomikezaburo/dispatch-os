# Dispatch OS UI-2.0 Figma / Code Gap Analysis

Status: Design complete for implementation planning

Date: 2026-08-26

Scope: Investigation and design only. No Route, React, DB, Security, Migration, Seed, Auth, or package change is authorized by this document.

## 1. Executive Summary

The Figma Admin canvas contains 53 current frames: 50 Admin and 3 Worker. The completed frame ledger classifies them as 35 KEEP, 11 MERGE, 4 STATE, 3 REDESIGN, and 0 DELETE. These classifications remain unchanged.

The current codebase has 16 Admin/Worker routes: 14 Admin and 2 Worker. It has production-shaped foundations for the Admin shell, dashboard, projects, shift list/detail, assignment actions, pre-shift confirmation, worker attendance, and attendance confirmation/revision. Workers, clients, and settings are placeholder routes. Payroll/transportation, communications, knowledge, most settings, assignment calendar views, and dedicated pre-shift/day-of monitors are not implemented.

The target is not 53 routes. The recommended canonical target has 36 routes. Figma frames become Pages, five Detail Hubs, Drawers, Sections/Tabs, three views of one assignment page, and state variants. Three current create/list routes become compatibility redirects after their replacement flows stabilize. No existing route is removed in the first migration step.

The first implementation phase must be UI-2.1 App Shell / Sidebar / Content Container. It establishes the Section and responsive navigation contract used by every later screen. The first domain-heavy phase should then be the Project Management Hub because its current code, reusable forms, RLS, and inline Job/Shift create drawers already provide the strongest base.

Security conclusion: this plan requires no immediate DB, RLS, GRANT, RPC, Auth, Seed, or Migration change. New UI must continue to use cookie-backed Server Components/Actions and RLS. Domain additions proposed by Figma are recorded as `FIGMA_DOMAIN_GAP`; they are not implementation instructions.

## 2. Source of Truth

### 2.1 UI / IA precedence

1. `Dispatch_OS_フレーム管理台帳.xlsx`, especially `01_フレーム一覧`, `04_不足フレーム一覧`, and `05_最終構成案`
2. Figma `Dispatch OS — Product Design`, canvas `03 Admin`, node `3:4`
3. `docs/dispatch-os-ui-patterns-v1.md`
4. `docs/ui-1-admin-ia-route-plan.md`
5. `docs/ui-1.6-edit-security-plan.md`
6. Current code

### 2.2 Security / domain precedence

1. `supabase/migrations/001_initial_schema.sql` through `012_harden_database_helper_functions.sql`
2. Existing RLS, GRANT, constraints, and database functions
3. `lib/domain/*`, `lib/admin/*-rules.ts`, and Server Action validation
4. `docs/ui-1.6-edit-security-plan.md`
5. Figma only as a desired presentation, never as authorization or a domain definition

### 2.3 Evidence inspected

- Figma node `3:4`, including all 53 top-level frames and their node IDs
- Completed workbook with 5 worksheets and the 53-row frame table
- All `app/**/page.tsx` and Admin/Worker layouts
- `components/admin`, `components/worker`, `lib/admin`, `lib/worker`, `lib/domain`
- All Server Actions
- All integration test files
- All 12 migrations, `supabase/seed.sql`, and `package.json`

## 3. Current Route Inventory

Count definition: canonical routes under `/admin` and `/worker`; `/`, `/login`, and `/auth/error` are Auth/bootstrap routes and are documented separately, not included in the count of 16.

| # | Current route | Page / layout | Boundary and main components | Data / actions / rules | Figma / ledger target | Decision |
|---:|---|---|---|---|---|---|
| 1 | `/admin` | `app/admin/page.tsx`; Admin layout | Server; Dashboard summary, alerts, workplaces | `getDashboardData`, dashboard rules | `24:24` 管理ダッシュボード | KEEP |
| 2 | `/admin/projects` | `app/admin/projects/page.tsx` | Server page; filters/list/header; client filters | `getProjects`, project query/rules | `27:2` 案件一覧 | KEEP |
| 3 | `/admin/projects/new` | `app/admin/projects/new/page.tsx` | Server page + client form | `getProjectFormOptions`, `createProject`, Zod | M-01 案件作成 | KEEP |
| 4 | `/admin/projects/[projectId]` | project detail page | Server Hub; header/summary/overview/jobs; Job Drawer | `getProjectDetail`, form options, project detail rules | `29:2` 案件詳細 Hub | MODIFY |
| 5 | `/admin/projects/[projectId]/jobs/new` | legacy Job create page | Server page + shared `JobForm` | `getJobFormOptions`, `createJob` | M-03/M-04 Job Drawer | REDIRECT |
| 6 | `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | legacy Shift create page | Server page + shared `ShiftForm` | `getShiftFormOptions`, `createShift` | M-05/M-06 Shift Drawer | REDIRECT |
| 7 | `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` | Bulk create page | Server page + client bulk form/preview | bulk schema/rules, `createBulkShifts` | M-07 複数日シフト作成 | KEEP |
| 8 | `/admin/shifts` | shift list page | Server list; client filters | `getShifts`, shift list/query rules | `48:2`, `54:2`, `54:368` 配置管理 views | REDIRECT |
| 9 | `/admin/shifts/[shiftId]` | shift detail page | Server Hub; applications, assignments, pre-shift | `getShiftDetail`; application/assignment actions and rules | `58:2`, `60:2`, `61:2` | MODIFY |
| 10 | `/admin/attendance` | attendance page | Server list/summary; client filters/actions | `getAttendance`, attendance rules | `73:2` 勤怠一覧 | MODIFY |
| 11 | `/admin/attendance/[assignmentId]` | attendance detail page | Server Hub + client confirm/revise/absence actions | `getAttendanceDetail`, confirm/revise RPCs | `102:2`, `105:2`, `106:2` | MODIFY |
| 12 | `/admin/clients` | placeholder page | Server placeholder only | None | CODE_ONLY; supports Project master data | MODIFY |
| 13 | `/admin/workers` | placeholder page | Server placeholder only | None | `76:2` スタッフ一覧 | MODIFY |
| 14 | `/admin/settings` | placeholder page | Server placeholder only | None | `123:*` Settings family | MODIFY |
| 15 | `/worker` | worker page / Worker layout | Server Mobile list; links | `getWorkerAssignments`, pre-shift/attendance derivation | M-08 Worker勤務一覧 | MODIFY |
| 16 | `/worker/assignments/[assignmentId]` | worker assignment detail | Server Hub + client forms/actions | `getWorkerAssignment`, pre-shift and start/end Actions | `68:124`, `68:146`, `68:164`, M-09–M-11 | MODIFY |

Current decisions: KEEP 4, MODIFY 9, MERGE 0, REDIRECT 3, REMOVE 0. Target adds 23 canonical routes.

### Auth/bootstrap routes outside the 16-route count

| Route | Purpose | Decision |
|---|---|---|
| `/` | Redirect to login | KEEP |
| `/login` | Cookie-session login and role redirect | KEEP |
| `/auth/error` | Inactive/misconfigured auth state | KEEP |

## 4. Figma 53 Frame Inventory

The ledger classification is authoritative and is reproduced without changing any decision.

| # | Node | Current Figma name | Unified name / Section | Ledger decision | Target form |
|---:|---|---|---|---|---|
| 1 | `24:24` | Admin / Dashboard | 管理ダッシュボード / 01 | 維持 | Page |
| 2 | `27:2` | Admin / Projects | 案件一覧 / 02 | 維持 | Page |
| 3 | `29:2` | Admin / Large Project Detail | 案件詳細｜大型案件 / 02 | 統合 | Hub variation |
| 4 | `42:127` | Admin / Vacancies | 欠員一覧 / 02 | 維持 | Page |
| 5 | `54:2` | Admin / Assignments - Week | 配置管理｜週表示 / 02 | 状態化 | View |
| 6 | `54:368` | Admin / Assignments - Month | 配置管理｜月表示 / 02 | 状態化 | View |
| 7 | `58:2` | Admin / Shift Detail | シフト詳細｜概要 / 02 | 維持 | Hub section |
| 8 | `48:2` | Admin / Assignments - Time-centric | 配置管理｜日表示 / 02 | 維持 | View |
| 9 | `60:2` | Admin / Shift Detail / Applicants | シフト詳細｜応募者 / 02 | 統合 | Hub section |
| 10 | `61:2` | Admin / Shift Detail / Assignment | シフト詳細｜配置 / 02 | 統合 | Hub section |
| 11 | `68:2` | Admin / 前日確認状況 | 前日確認状況 / 03 | 維持 | Page |
| 12 | `68:63` | Admin / 当日出勤モニター | 当日出勤モニター / 03 | 維持 | Page |
| 13 | `68:124` | Worker / 前日確認 | Worker｜前日確認 / 04 | 維持 | Mobile state/form |
| 14 | `68:146` | Worker / 当日 起床確認 | Worker｜起床確認 / 04 | 状態化 | Hub action state |
| 15 | `68:164` | Worker / 当日 出発確認 | Worker｜出発確認 / 04 | 状態化 | Hub action state |
| 16 | `73:2` | Admin / Attendance Management v2 | 勤怠一覧 / 05 | 維持 | Page |
| 17 | `102:2` | Admin / Attendance Detail | 勤怠詳細 / 05 | 維持 | Hub |
| 18 | `105:2` | Admin / Attendance / Absence & No Show | 欠勤・無断欠勤対応 / 05 | 統合 | Hub section/dialog |
| 19 | `106:2` | Admin / Attendance / Audit History | 勤怠訂正履歴 / 05 | 統合 | Hub section |
| 20 | `107:2` | Admin / Attendance / Monthly | 月次勤怠集計 / 05 | 維持 | Page |
| 21 | `76:2` | Admin / Staff List | スタッフ一覧 / 06 | 維持 | Page |
| 22 | `77:2` | Admin / Staff Detail | スタッフ詳細｜概要 / 06 | 維持 | Hub |
| 23 | `78:2` | Admin / Staff Detail / Work History | スタッフ詳細｜勤務履歴 / 06 | 統合 | Hub section |
| 24 | `79:2` | Admin / Staff Detail / Feedback & Notes | スタッフ詳細｜評価・管理メモ / 06 | 統合 | Hub section |
| 25 | `87:2` | Admin / Staff Detail / Basic Info | スタッフ詳細｜基本情報 / 06 | 統合 | Hub section |
| 26 | `91:2` | Admin / Payroll & Transportation | 勤怠集計・交通費 / 07 | 再設計 | Page |
| 27 | `93:2` | ... / Transportation Review | 交通費確認 / 07 | 維持 | Page |
| 28 | `93:252` | ... / Closing & Export | 月次締め・NEO出力 / 07 | 維持 | Page |
| 29 | `94:2` | ... / Staff Detail | スタッフ別勤怠・交通費明細 / 07 | 再設計 | Detail/section |
| 30 | `99:2` | ... / Transportation Detail | 交通費詳細 / 07 | 維持 | Detail |
| 31 | `101:2` | ... / Payroll Adjustment | 支給調整 / 07 | 再設計 | Pending domain decision |
| 32 | `109:2` | Communications / SOS & Inquiries | SOS・問い合わせ一覧 / 08 | 維持 | Page |
| 33 | `110:2` | Communications / SOS Detail | SOS詳細 / 08 | 維持 | Detail |
| 34 | `113:2` | Communications / Direct Contact | 個別連絡 / 08 | 統合 | Drawer |
| 35 | `116:2` | Communications / Broadcast Create | 一斉通知作成 / 08 | 維持 | Page |
| 36 | `117:2` | Communications / Announcement Create | お知らせ作成 / 08 | 統合 | Shared editor |
| 37 | `117:233` | Communications / Announcement Edit | お知らせ編集 / 08 | 統合 | Shared editor |
| 38 | `118:2` | Communications / Notification History | 通知履歴 / 08 | 維持 | Page |
| 39 | `119:2` | Communications / Announcements | お知らせ一覧 / 08 | 維持 | Page |
| 40 | `121:2` | Knowledge / FAQ List | FAQ一覧 / 09 | 維持 | Page |
| 41 | `121:268` | Knowledge / FAQ Editor | FAQ作成・編集 / 09 | 維持 | Shared editor |
| 42 | `121:491` | Knowledge / Manual List | マニュアル一覧 / 09 | 維持 | Page |
| 43 | `121:757` | Knowledge / Manual Editor | マニュアル作成・編集 / 09 | 維持 | Shared editor |
| 44 | `122:2` | Knowledge / Rules & Company | 規則・会社情報 / 09 | 維持 | Page |
| 45 | `122:211` | Knowledge / Analytics | ナレッジ分析 / 09 | 維持 | Page, P2 |
| 46 | `122:396` | Knowledge / Revision History | ナレッジ更新履歴 / 09 | 維持 | Page, P2 |
| 47 | `123:2` | Settings / Admin & Roles | 管理者・権限設定 / 10 | 維持 | Settings section |
| 48 | `123:192` | Settings / Branch & Workplace | 支店・勤務先設定 / 10 | 維持 | Settings section |
| 49 | `123:364` | Settings / Notification & Attendance Rules | 通知・勤怠ルール設定 / 10 | 維持 | Settings section |
| 50 | `123:540` | Settings / LINE | LINE連携設定 / 10 | 維持 | Settings section |
| 51 | `123:696` | Settings / NEO Integration | NEO連携設定 / 10 | 維持 | Settings section |
| 52 | `123:868` | Settings / Security | セキュリティ設定 / 10 | 維持 | Settings section |
| 53 | `123:1022` | Settings / Audit Log | 監査ログ / 10 | 維持 | Page within Settings layout |

## 5. Figma / Ledger / Code Mapping

Implementation states are factual, not estimates of visual fidelity.

| Nodes | Target UI | Current route/component | Implementation state | Final form / merge target | Missing capability | Priority |
|---|---|---|---|---|---|---|
| `24:24` | Dashboard | `/admin`; dashboard components | PARTIAL | Page | SOS/inquiry source, final density | P0 |
| `27:2` | Project list | `/admin/projects` | IMPLEMENTED | Page | Pagination/advanced states only | P0 |
| `29:2` | Project Hub / large variation | `/admin/projects/[projectId]` | PARTIAL, MERGE_PLANNED | Management Hub | Project edit; richer staffing/actions | P0 |
| `42:127` | Vacancies | none | FIGMA_ONLY | Page | Cross-project vacancy query/actions | P0 |
| `48:2`,`54:2`,`54:368` | Assignment Day/Week/Month | `/admin/shifts` only list | REDESIGN_PLANNED | One Page + `view` query | Calendar/board data model and query | P0 |
| `58:2`,`60:2`,`61:2` | Shift Detail Hub | `/admin/shifts/[shiftId]` | PARTIAL, MERGE_PLANNED | One Hub with sections | Shift edit, rotation/position model | P0 |
| `68:2` | Pre-shift monitor | Shift detail has per-shift summary | PARTIAL | Page | Cross-shift monitor query | P0 |
| `68:63` | Day-of monitor | Dashboard/attendance are adjacent | PARTIAL | Page | Wake/depart/arrival events | P0 |
| `68:124`,`68:146`,`68:164` | Worker pre/day actions | Worker detail | PARTIAL, STATE_PLANNED | Worker Hub states | Wake/depart/arrival storage/actions | P0 |
| `73:2` | Attendance list | `/admin/attendance` | IMPLEMENTED | Page | Final responsive/density pass | P0 |
| `102:2`,`105:2`,`106:2` | Attendance Hub | attendance detail | PARTIAL, MERGE_PLANNED | One Hub + state/sections | Early leave/missing punch presentation | P0 |
| `107:2` | Monthly attendance | none | FIGMA_ONLY | Page | Aggregate/closing query | P1 |
| `76:2` | Staff list | placeholder `/admin/workers` | NOT_IMPLEMENTED | Page | Query, filters, links | P0 |
| `77:2`,`78:2`,`79:2`,`87:2` | Staff Hub | none | MERGE_PLANNED | One Hub + sections | All staff detail queries/actions | P0/P1 |
| `91:2`,`94:2`,`101:2` | Attendance/transport/pay scope | none | REDESIGN_PLANNED | Remove payroll-calculation responsibility | Domain boundary confirmation | P1 |
| `93:2`,`93:252`,`99:2` | Transport/closing/export | none | FIGMA_ONLY | Pages/detail | Claims, closing, NEO export | P1 |
| `109:2`,`110:2`,`113:2` | SOS/inquiry/contact | none | MERGE_PLANNED | Inbox + detail + contact drawer | Complete communications domain | P0 |
| `116:2`,`117:2`,`117:233`,`118:2`,`119:2` | Broadcast/announcement/history | none | FIGMA_ONLY/MERGE_PLANNED | Pages + shared editor | Notification content/delivery domain | P1 |
| `121:2`,`121:268`,`121:491`,`121:757`,`122:2`,`122:211`,`122:396` | Knowledge | none | FIGMA_ONLY | Lists/editors/pages | Complete knowledge domain | P1/P2 |
| `123:2`–`123:1022` | Settings family | placeholder `/admin/settings` | FIGMA_ONLY | Shared Settings layout; audit route | Queries/actions and several domains | P0/P1 |

## 6. Current vs Target Gap Analysis

### 6.1 IA and navigation

- Current Sidebar has seven flat items and no collapsed state. Mobile Drawer already exists and reuses the same navigation array.
- Target Sidebar must represent the Admin IA only. Worker routes retain a separate Worker layout.
- Desktop needs Expanded/Collapsed behavior, active state, tooltip while collapsed, and persisted preference. Persistence is UI preference only and must not store role/authorization.
- Current `/admin/shifts` conflates a chronological shift list with the target assignment board. Canonical target becomes `/admin/assignments`; `/admin/shifts/[shiftId]` remains a Shift Hub.

### 6.2 Page/route reduction

- Existing Job and single Shift create pages already share forms with Hub Drawers. They can become compatibility redirects after Drawer success/error behavior and deep links are proven.
- Project create and Bulk Shift create remain dedicated pages.
- Shift, Attendance, and Staff detail variations become one Hub each.
- Settings frames use a shared layout and section navigation; only Audit Log needs a separate canonical page initially.

### 6.3 Content density

- Current application uses broad `space-y-6/8` and full-width content; Figma uses denser structured lists and predictable 1440px Admin compositions.
- Target should introduce a reusable content container instead of per-page arbitrary maximum widths.
- Lists that compare multiple fields (Attendance, Workers, Audit) should be tables/structured lists; independent operational records can remain cards on Mobile.
- Navigation buttons such as `勤務詳細を見る` on Worker Home should become a Primary Object Link/card title link; the primary action belongs on the detail screen.
- Avoid translating every Figma card into a component. Use sections and light row dividers where information belongs to one record.

### 6.4 Server/client boundary

- Keep Pages and layouts as Server Components.
- Limit Client Components to Sidebar interaction, Drawer/Dialog, filters, forms, Tabs/View Switcher state, and optimistic/pending feedback.
- Data access remains in `lib/*`; mutation remains in Server Actions or narrowly-scoped RPCs.

## 7. Final Information Architecture

1. `01｜ホーム`: operational overview and urgent actions
2. `02｜案件・シフト・配置`: Projects, Management Hub, Assignment views, Shift Hub, vacancies
3. `03｜前日・当日確認`: cross-shift monitoring
4. `04｜Worker`: separate Worker application, Mobile First
5. `05｜勤怠`: attendance list, detail states, monthly summary
6. `06｜スタッフ`: worker/staff list and Detail Hub
7. `07｜勤怠集計・交通費`: attendance aggregation, transportation review, closing/export; no payroll engine
8. `08｜連絡・お知らせ`: SOS/inquiry, direct contact, broadcast, announcements, delivery history
9. `09｜ナレッジ`: FAQ, manuals, rules, analytics, revision history
10. `10｜設定`: administrators/access, branches/workplaces, rules, LINE, NEO, security, audit

`/admin/clients` is CODE_ONLY and remains `KEEP_FOR_NOW` because projects reference clients and the DB has a secured client master. Its final IA placement should be decided with the master-data Settings work; it must not be deleted merely because node `3:4` lacks a client frame.

## 8. Final Admin Route Tree

Canonical count: 34 Admin routes. Query keys shown below are state, not routes.

```text
/admin
├─ /projects
│  ├─ /new
│  └─ /[projectId]
│     └─ /jobs/[jobId]/shifts/bulk-new
├─ /assignments?view=day|week|month&date=...
├─ /vacancies
├─ /shifts/[shiftId]?section=overview|applicants|assignment
├─ /pre-shift
├─ /day-of
├─ /attendance
│  ├─ /[assignmentId]
│  └─ /monthly
├─ /workers
│  ├─ /new
│  └─ /[workerId]
├─ /clients
├─ /transportation
│  └─ /[transportationId]
├─ /closing
├─ /communications
│  ├─ /sos/[inquiryId]
│  └─ /broadcast/new
├─ /announcements
│  ├─ /new
│  └─ /[announcementId]/edit
├─ /notifications
├─ /knowledge
│  ├─ /faq
│  ├─ /manuals
│  ├─ /rules
│  ├─ /analytics
│  └─ /revisions
└─ /settings?section=admins|branches|rules|line|neo|security
   └─ /audit-log
```

Compatibility routes retained temporarily:

- `/admin/projects/[projectId]/jobs/new` -> Project Hub Job Drawer intent
- `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` -> Project Hub Shift Drawer intent
- `/admin/shifts` -> `/admin/assignments?view=day`

## 9. Final Worker Route Tree

Canonical count: 2 Worker routes.

```text
/worker
└─ /assignments/[assignmentId]
   ├─ pre-shift confirmation state
   ├─ wake state (domain gap)
   ├─ depart state (domain gap)
   ├─ arrival state (domain gap)
   ├─ start-work action
   └─ end-work action
```

Worker actions do not create routes. The server derives the currently available action. At most one critical Mobile Work Action is primary at a time.

## 10. Page / Hub / Tab / Drawer / State Classification

Counts are architectural units and may overlap; a Hub is also rendered by a route page.

| Unit | Count | Definition |
|---|---:|---|
| Canonical Route | 36 | 34 Admin + 2 Worker |
| Page surface | 31 | List, monitor, editor, settings, and dedicated workflow pages |
| Detail Hub | 5 | Project, Shift, Worker Assignment, Attendance, Staff |
| Drawer / Compose unit | 5 | Project edit, Job create/edit, Shift create/edit, Staff edit, Direct Contact |
| Tab / Section groups | 18 | Hub sections and Settings sections; not routes |
| View | 3 | Assignment Day/Week/Month on one route |
| State / Component State | 13 | Worker actions, Attendance states, Sidebar states, common Empty/Loading/Error set |
| Ledger MERGE frames | 11 | Unchanged from completed ledger |
| Ledger STATE frames | 4 | Unchanged from completed ledger |
| Ledger REDESIGN frames | 3 | Unchanged from completed ledger |
| Missing UI candidates | 20 | M-01 through M-20 |

## 11. Component Architecture

### 11.1 Reuse/extend before creating

| Target | Current base | Recommendation |
|---|---|---|
| `AdminAppShell` | `AdminShell`, Header, Sidebar | Extend; do not replace with page-specific shells |
| Sidebar states | `AdminSidebar`, `admin-nav` | Add collapsed model, icons/tooltips, and Section grouping |
| Mobile Navigation | `AdminMobileSidebar` | Keep shared nav source; improve focus trap/restore |
| Drawer | `components/admin/drawer.tsx` | Reuse for Project/Job/Shift/Contact where appropriate |
| Project Hub | existing detail components | Compose sections; avoid one giant page component |
| Job/Shift forms | shared `JobForm`, `ShiftForm` | Preserve shared form/action contracts |
| Status badges | domain-specific badge components | Keep domain-specific semantics; share primitives only |
| Empty/error | Dashboard/Project/Shift variants | Extract a small common presentation primitive after patterns converge |
| Audit history | Attendance revision presentation | Create reusable layout, not a universal audit domain |
| Mobile Work Action | worker attendance button | Extend derived-action composition |

### 11.2 Proposed boundaries

```text
Server Page
├─ lib/<area>/get-*.ts
├─ PageHeader / Breadcrumb
├─ Summary / StructuredList / DescriptionList
├─ Hub sections (Server where possible)
└─ narrow Client islands
   ├─ filters / view switcher
   ├─ drawer / dialog
   ├─ form interaction
   └─ pending / feedback state
```

Do not create a universal `EntityHub`, universal `StatusBadge`, or universal mutation action. Domain semantics differ and are protected by separate rules.

## 12. Data Requirement Matrix

Legend: A current query sufficient; B query change/addition; C Server Action; D domain rule; E schema candidate; F migration candidate. E/F are investigation outcomes only, not authorization.

| Final UI | Class | Evidence / requirement |
|---|---|---|
| Dashboard | B | Current dashboard exists; add only source-backed alerts |
| Project list | A | Existing query/rules sufficient for current design |
| Project Hub | B,C,D | Current read + create drawers; edit uses UI-1.6 concurrency design |
| Project create | A,C | Existing options/query/action |
| Job/Shift drawers | A,C | Create works; Edit requires entity update cores |
| Bulk Shift | A,C | Existing page/schema/action |
| Assignment views | B | Existing shift/assignment tables; add bounded day/week/month query, avoid N+1 |
| Vacancies | B,D | Derive shortages from shifts/active assignments; replacement recommendation is separate gap |
| Shift Hub | B,C,D | Current overview/applications/assignments; edit capability missing |
| Pre-shift monitor | B | Aggregate existing confirmations across visible branches |
| Day-of monitor | B,D,E,F | Start/end exist; wake/depart/arrival do not |
| Worker list/detail | B,C,D | Secured worker/profile tables exist; UI queries/actions absent |
| Worker Assignment Hub | A/B,C,D | Current query/actions support pre-shift/start/end; other steps are gaps |
| Attendance list/detail | A/B,C,D | Existing RLS/RPC/rules; layout/query expansion only |
| Monthly attendance | B,D | Records exist; close/check definitions absent |
| Transportation | D,E,F | Only job cap exists; claim/route/review domain absent |
| Closing/NEO export | D,E,F | No closing state, mapping, or export implementation |
| Communications | D,E,F | No SOS/message/announcement/delivery tables or actions |
| Knowledge | D,E,F | No content, analytics, or revision domain |
| Admin/branch settings | B,C,D | profiles, branch access, branches/workplaces exist; safe management actions absent |
| Rule/LINE/NEO/security settings | D,E,F | Mostly presentation-only Figma today |
| Audit log | D,E,F | Attendance revision history is specific; no system-wide immutable audit log |

## 13. Security Impact Matrix

| Area | Manager | System Admin | Worker | Required boundary |
|---|---|---|---|---|
| Projects/Jobs/Shifts | Accessible branches only | All branches | Only worker-visible records | Existing RLS + immutable parent/branch + concurrency token |
| Assignment board/vacancies | Accessible branches | All | No Admin view | RLS; RPC for state transitions; no client-derived branch |
| Attendance | Accessible assignments | All | Own assignment/events only | Existing confirm/revise RPCs and revision RLS |
| Staff/Clients/Workplaces | Accessible branches where policy permits | All / elevated create/update | Own worker/profile only | Do not infer rights from hidden controls |
| Worker actions | No Worker action impersonation | No default impersonation | Own active assignment only | Server resolves worker ID; RPC/state rule rechecks current state |
| Settings/admin roles | Narrow read or explicitly delegated actions | System Admin for role/access mutation | None | Separate Actions, immutable/audited changes, IDOR tests |
| Communications/knowledge | Branch/target rules TBD | Cross-branch only when explicitly designed | Own/targeted content | Domain design and RLS required before implementation |
| Closing/NEO | Branch-scoped operator rules TBD | All where designed | None | Export authorization, audit, immutable close state |

Global rules:

- UI visibility is never a security boundary.
- Current row and parent relations must be re-read through RLS before mutation.
- Manager branch access comes from `manager_branch_access`/existing helpers.
- `expectedUpdatedAt` is an opaque optimistic-concurrency token, not authorization.
- Do not return SQLSTATE, policy names, constraints, table names, or internal errors to clients.
- State transition functions remain the only mutation path where current migrations require an RPC.

## 14. FIGMA_DOMAIN_GAP

| # | Figma nodes / UI | Display or action without current domain basis | Missing domain | Recommended handling | Priority |
|---:|---|---|---|---|---|
| 1 | `24:24` Dashboard | SOS/inquiry counts and alert source | Communications | Keep placeholder out until source exists | P0 |
| 2 | `48:2`,`54:*` Assignment | Position/rotation/coverage timeline | Shift-position model | Separate domain proposal; basic staffing first | P1 |
| 3 | `42:127` Vacancies | Recommended replacement candidates | Matching/ranking rule | Start with shortage list only | P1 |
| 4 | `68:63`,`68:146`,`68:164` | Wake/depart/arrival events | Event types, windows, transition rules | Design domain before UI action | P0 |
| 5 | `107:2` Monthly | Closing/check state | Monthly close rule | Define after attendance accuracy phase | P1 |
| 6 | `93:2`,`99:2` | Transportation claim, route, requested/regulation values | Claim/route tables and rules | New domain design | P1 |
| 7 | `91:2`,`94:2` | Payroll amount/allowance calculation | Payroll engine | Keep out; NEO owns payroll | P1 |
| 8 | `101:2` | Payroll adjustment | Adjustment responsibility/rules | Decide NEO boundary; likely omit | P1 |
| 9 | `93:252`,`123:696` | NEO mapping/export/error history | Integration contract | Define export-only contract | P1 |
| 10 | `109:2`,`110:2` | SOS/inquiry lifecycle | Inquiry/message domain | New secured domain | P0 |
| 11 | `113:2` | LINE/phone/direct contact history | Contact/delivery provider contract | Drawer only after domain exists | P0 |
| 12 | `116:2` | Broadcast targeting/scheduling | Broadcast domain | New domain with branch/target RLS | P1 |
| 13 | `117:*`,`119:2` | Announcements/drafts/publication | Announcement domain | New content workflow | P1 |
| 14 | `118:2` | Delivery/read/failure metrics | Delivery receipt domain | Provider-backed data only | P1 |
| 15 | `121:2`,`121:268` | FAQ content/keywords/feedback | FAQ domain | New content domain | P1 |
| 16 | `121:491`,`121:757`,`122:2` | Manuals/rules/files/read receipts | Knowledge/document domain | New domain; storage review | P1 |
| 17 | `122:211`,`122:396` | Knowledge analytics/revisions | Events/version history | Defer until data exists | P2 |
| 18 | `123:364`,`123:540`,`123:868`,`123:1022` | Configurable rules, LINE status, 2FA/IP/device policy, global audit | Multiple settings/security domains | Separate security/domain phases; never fake settings | P0/P1 |

FIGMA_DOMAIN_GAP count: 18 grouped gaps. One row may cover multiple closely-related frames.

## 15. Merge Candidates

| Frames | Merge target | Method |
|---|---|---|
| Large Project Detail | Project Management Hub | Variation/conditional sections |
| Shift Applicants + Assignment | Shift Detail Hub | Sections; optional URL `section` state |
| Attendance Absence + Audit History | Attendance Detail Hub | Exception dialog/section + revision section |
| Staff Basic/History/Feedback | Staff Detail Hub | Sections; tabs only if content size requires |
| Direct Contact | SOS/Staff detail | Compose Drawer |
| Announcement Create/Edit | Shared editor | Shared component, two canonical URLs |

## 16. Redirect Candidates

| Current route | Target | Classification | Preconditions |
|---|---|---|---|
| `/admin/projects/[projectId]/jobs/new` | Project Hub Job Drawer intent | SAFE_REDIRECT after migration | Drawer deep-link, validation, success refresh, browser tests |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | Project Hub Shift Drawer intent | SAFE_REDIRECT after migration | Same plus parent Job IDOR checks |
| `/admin/shifts` | `/admin/assignments?view=day` | SAFE_REDIRECT after migration | Assignment Page feature parity and updated internal links |

Redirect candidate route count: 3.

## 17. Remove Candidates

| Candidate | Classification | Reason |
|---|---|---|
| Legacy Job create page UI wrapper | SAFE_REMOVE_AFTER_MIGRATION | Shared `JobForm` remains in Drawer; route redirect retained |
| Legacy single Shift create page UI wrapper | SAFE_REMOVE_AFTER_MIGRATION | Shared `ShiftForm` remains in Drawer; route redirect retained |
| Duplicate Figma-only page compositions after Hub merge | KEEP_FOR_NOW | Design cleanup follows approved Figma reorganization |
| `/admin/clients` | KEEP_FOR_NOW | DB-backed Project dependency and secured master data |

Remove candidates: 2 code page wrappers after migration; no immediate removal.

## 18. Missing UI

The completed ledger defines 20 missing items and remains authoritative:

1. Project create
2. Project edit
3. Job/Workplace create
4. Job/Workplace edit
5. Shift create
6. Shift edit
7. Bulk Shift create
8. Worker assignment list
9. Worker assignment Hub
10. Worker start state
11. Worker end state
12. Attendance unconfirmed state
13. Attendance confirmed state
14. Attendance revised state
15. Staff create
16. Staff edit
17. Sidebar expanded
18. Sidebar collapsed
19. Mobile navigation
20. Common Empty/Error/Loading states

Some are partially implemented in code; `missing` here means missing from the completed Figma system or incomplete against the target composition.

## 19. UI-2.x Implementation Roadmap

Every phase preserves Server Components by default and ends with scoped lint/type/build, `git diff --check`, browser verification, Mobile verification where relevant, and security regression tests proportional to changed behavior.

| Phase | Purpose / Figma | Routes | Component/file candidates | DB / Security / Domain | Verification / completion | Depends on |
|---|---|---|---|---|---|---|
| UI-2.1A | Admin shell, content container; all Admin nodes | Admin layout | shell/header/container | None; retain `requireAdmin` | Desktop widths and landmarks | none |
| UI-2.1B | Sidebar expanded/collapsed, M-17/18 | all Admin | sidebar/nav | UI preference only; no role storage | Keyboard, tooltip, active state | 2.1A |
| UI-2.1C | Mobile nav M-19 | all Admin | mobile sidebar/header | None | Focus trap/restore, responsive browser test | 2.1B |
| UI-2.2 | Dashboard `24:24` | `/admin` | dashboard components/query | B only; no fake SOS | dashboard integration + responsive | 2.1 |
| UI-2.3A | Project list `27:2` | `/admin/projects` | list/filter/header | Existing RLS | Primary Object Link, filters | 2.1 |
| UI-2.3B | Management Hub `29:2` | project detail | detail sections/query | Existing branch RLS | Manager/system admin IDOR | 2.3A |
| UI-2.3C | Project edit M-02 | project detail | edit drawer/form/action | UI-1.6 concurrency; C/D | conflict/no-change/forbidden tests | 2.3B |
| UI-2.3D | Job create/edit M-03/04 | Hub + legacy redirect | Job Drawer/Form | create existing; edit C/D | Data API/RLS + Drawer browser | 2.3B |
| UI-2.3E | Shift create/edit/bulk M-05–07 | Hub + bulk page | Shift Drawer/Form/Bulk | existing create; edit C/D | state/parent IDOR + preview | 2.3D |
| UI-2.4A | Assignment Day `48:2` | `/admin/assignments` | view switcher/day board/query | B; existing data | date/view query, no N+1 | 2.3 |
| UI-2.4B | Week/Month `54:*` | same route | week/month views | B | bookmark/back/forward | 2.4A |
| UI-2.4C | Vacancies `42:127` | `/admin/vacancies` | shortage list | B/D; no ranking yet | branch/shortage correctness | 2.4A |
| UI-2.5A | Shift Hub `58:2`,`60:2`,`61:2` | shift detail | existing sections | B | application/assignment regressions | 2.3E |
| UI-2.5B | Shift edit M-06 | shift detail | edit drawer/action | UI-1.6 + transition rules | concurrency/state tests | 2.5A |
| UI-2.6A | Pre-shift monitor `68:2` | `/admin/pre-shift` | aggregate query/list | B, existing RLS | pre-shift test runners | 2.4 |
| UI-2.6B | Day-of monitor `68:63` | `/admin/day-of` | monitor query | domain gap for wake/depart/arrival | scope basic existing events first | 2.6A |
| UI-2.7A | Worker Home M-08 | `/worker` | assignment card/list | Existing worker RLS | Mobile, own-record IDOR | 2.1 patterns |
| UI-2.7B | Worker Assignment Hub M-09–11 | worker detail | detail/action composition | existing pre/start/end rules | worker attendance/pre-shift tests | 2.7A |
| UI-2.7C | Wake/depart/arrival | same route | action states | E/F only after domain approval | transition/RLS/offline UX | domain phase |
| UI-2.8A | Attendance list `73:2` | attendance list | current components | A/B | admin attendance tests | 2.1 |
| UI-2.8B | Attendance Hub `102:2`,`105:2`,`106:2` | attendance detail | current detail/actions | existing RPC/RLS/audit | confirmation/revision/absence suites | 2.8A |
| UI-2.8C | Monthly `107:2` | attendance monthly | summary query | B/D close definitions | aggregate reconciliation | 2.8B |
| UI-2.9A | Staff list `76:2` | `/admin/workers` | query/list/filter | B, branch RLS | Primary link, branch visibility | 2.1 |
| UI-2.9B | Staff Hub `77:2`–`87:2` | worker detail | four sections | B | PII/branch/IDOR tests | 2.9A |
| UI-2.9C | Staff create/edit M-15/16 | new/detail | form/page/drawer | C/D; immutable fields | system admin/manager capability tests | 2.9B |
| UI-2.10A | Attendance/transport responsibility `91:2` | transport/closing | design + query boundary | domain decision first | no payroll calculation shipped | 2.8C |
| UI-2.10B | Transport review/detail `93:2`,`99:2` | transport routes | list/detail | E/F after approval | claim/branch/amount tests | 2.10A |
| UI-2.10C | Closing/NEO `93:252` | `/admin/closing` | export UI | external contract/audit | export authorization/reconciliation | 2.10B |
| UI-2.11A | SOS/inquiry `109:2`,`110:2` | communications routes | inbox/detail | E/F secured domain | branch/target/audit tests | domain phase |
| UI-2.11B | Contact/Broadcast `113:2`,`116:2` | detail drawer/broadcast | compose components | provider + target rules | delivery/permission browser tests | 2.11A |
| UI-2.11C | Announcements/history `117:*`–`119:2` | announcement/notification routes | shared editor/list | content/delivery domain | publish/schedule/audit tests | 2.11B |
| UI-2.12A | FAQ/manual/rules | knowledge routes | list/editor components | E/F content domain | author/reader/branch tests | domain phase |
| UI-2.12B | Analytics/revisions | analytics/revisions | reports/history | events/versions needed | reconciliation/audit | 2.12A + data |
| UI-2.13A | Admin/branch/workplace settings | `/admin/settings` | shared settings layout | existing tables; actions needed | system admin/branch tests | 2.1 |
| UI-2.13B | Rules/LINE/NEO/security | settings sections | section components | separate domain/security decisions | never show fake saved settings | 2.13A |
| UI-2.13C | Audit Log `123:1022` | audit-log route | table/filter/export | immutable global audit domain | append-only/authorization tests | security phase |
| UI-2.14 | Common states M-20 | major Pages/Hubs | common empty/loading/error/feedback | No security weakening | forced-state browser tests | patterns stabilized |
| UI-2.15 | Responsive/accessibility/visual QA | all | targeted repairs | None | keyboard, focus, 390px/desktop, build | functional phases |
| UI-2.16 | Legacy cleanup | redirects/wrappers | remove wrappers only | No schema changes | redirect telemetry + full regression | all migrations stable |

## 20. Risks / Open Questions

1. **Figma scope versus product scope:** node `3:4` omits an explicit Client management frame although code/schema depend on Clients. Keep the route until master-data IA is approved.
2. **Settings routing:** query-based Settings sections minimize routes, but deep-linking, permission variance, and page weight may justify nested routes later. Decide in UI-2.13A without changing ledger decisions.
3. **Assignment semantics:** the Figma assignment board includes position/rotation detail not represented in current schema. Do not overload `assignments` without a separate model review.
4. **Worker wake/depart/arrival:** existing attendance events allow start/end only. Figma actions require explicit windows, event semantics, spoofing considerations, and transition rules.
5. **Payroll responsibility:** Figma contains payroll-like values. Target remains attendance/transport/NEO export until an approved NEO contract says otherwise.
6. **Communications and Knowledge:** large Figma areas are entirely domain-first work, not visual implementation phases.
7. **Audit log:** attendance revision history cannot be presented as a complete system audit log.
8. **Legacy redirects:** Drawer intent must be bookmarkable and recoverable before old pages redirect.
9. **Current dirty worktree:** pre-existing user changes must be kept separate; implementation phases need file-scoped diffs.

## 21. Final Totals

| Metric | Count |
|---|---:|
| Current Figma frames | 53 |
| Admin frames | 50 |
| Worker frames | 3 |
| Current Admin/Worker routes | 16 |
| Final canonical routes | 36 |
| Page surfaces | 31 |
| Detail Hubs | 5 |
| Drawers / Compose units | 5 |
| Tab / Section groups | 18 |
| Views | 3 |
| States / Component States | 13 |
| Ledger MERGE frames | 11 |
| Missing UI candidates | 20 |
| FIGMA_DOMAIN_GAP grouped rows | 18 |
| Redirect candidate routes | 3 |
| Remove candidate code wrappers | 2 |

Current Route decision totals: KEEP 4, MODIFY 9, MERGE 0, REDIRECT 3, REMOVE 0, ADD 23. The three compatibility redirect routes are excluded from the final canonical count: `16 - 3 + 23 = 36`.

## 22. Change and Safety Confirmation

This phase creates only this design document.

- React UI changed: no
- CSS/Tailwind changed: no
- Route/Component/Server Action changed: no
- Domain rule changed: no
- Migration/RLS/GRANT/RPC/DB function changed: no
- Seed/Auth/package changed: no
- npm package added: no
- remote Supabase used: no
- remote `db push` performed: no
