# AUDIT-3.0A-1 Route & Screen Inventory

## Executive Summary

`app/**/page.tsx`、App Router special files、Admin/Worker shell、server guard、navigation definition、主要画面component、既存`.next/server/app-paths-manifest.json`をread-onlyで照合した。product page fileは31件、canonical screenは29件、redirect-only pageは2件である。API `route.ts`は存在せず、build manifest上の`/favicon.ico/route`はfile-based metadataでありpage countから除外した。

この文書のScreen IDをAUDIT-3.0A-2以降のstable IDとする。スクリーンショット取得、Figma比較、product code/DB変更は実施していない。

## Route Counts

| Metric | Count |
| --- | ---: |
| Total `page.tsx` routes | 31 |
| Canonical screens (redirect-only除外) | 29 |
| Admin | 23 |
| Worker | 5 |
| Public / Auth | 3 |
| Dynamic | 10 |
| Redirect-only | 2 |
| API `route.ts` | 0 |
| Required screenshot candidates | 28 |
| Conditional screenshot candidates | 23 |
| Skip screenshot candidates | 2 redirect + 1 placeholder |

## Public / Auth

| ID | Role | Route | Route Type | Screen Name | Source File | Guard | Dynamic Params | Status | Reachability | Key States | Viewport | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCR-PUB-001 | Public | `/` | redirect | Login redirect | `app/page.tsx` | unconditional `redirect('/login')` | none | implemented | direct URL | redirect | n/a | Skip |
| SCR-AUTH-001 | Public/Auth | `/login` | static | ログイン | `app/login/page.tsx` | `getCurrentProfile()`; authenticated role redirect | none | implemented | root redirect / direct | default, invalid credentials, authenticated redirect, inactive/misconfigured redirect | Desktop + responsive spot-check | Required |
| SCR-AUTH-002 | Public/Auth | `/auth/error` | static | アカウントエラー | `app/auth/error/page.tsx` | public; reason query controls generic message | none | implemented | login/auth guard redirect, deep link | inactive, misconfigured, logout | Desktop + responsive spot-check | Conditional |

## Admin Screens

All `/admin/**` pages inherit `app/admin/layout.tsx`, which calls `requireAdmin()`. The effective role is active Manager or System Admin; Worker is redirected to `/worker`. Page data access may apply narrower branch/role authorization.

| ID | Role | Route | Route Type | Screen Name | Source File | Guard | Dynamic Params | Status | Reachability | Key States | Viewport | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCR-A-001 | Manager + System Admin | `/admin` | static | 管理ホーム / Dashboard | `app/admin/page.tsx` | Admin layout `requireAdmin()` | none | implemented | sidebar Home / login redirect | with data, no alerts, error | Desktop + responsive spot-check | Required |
| SCR-A-002 | Manager + System Admin | `/admin/projects` | static | 案件一覧 | `app/admin/projects/page.tsx` | Admin layout | none | implemented | sidebar 案件 | default, filters, empty, filtered-empty, error | Both | Required |
| SCR-A-003 | Manager + System Admin | `/admin/projects/new` | static | 新規案件作成 | `app/admin/projects/new/page.tsx` | Admin layout + server option authorization | none | implemented | 案件一覧 create CTA | default, validation, pending, error | Desktop + responsive spot-check | Required |
| SCR-A-004 | Manager + System Admin | `/admin/projects/[projectId]` | dynamic | 案件詳細 / Management Hub | `app/admin/projects/[projectId]/page.tsx` | Admin layout + authorized project read; `notFound()` | `projectId` | implemented | 案件名 link / deep link | with jobs/shifts, empty sections, project/job edit drawers, error, not-found | Both | Required |
| SCR-A-005 | Manager + System Admin | `/admin/projects/[projectId]/jobs/new` | dynamic | 業務・勤務先追加 | `app/admin/projects/[projectId]/jobs/new/page.tsx` | Admin layout + project/form option authorization; `notFound()` | `projectId` | implemented fallback | Project detail CTA when drawer data unavailable / deep link | default, validation, pending, error, not-found | Desktop + responsive spot-check | Conditional |
| SCR-A-006 | Manager + System Admin | `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | dynamic | シフト作成 | `app/admin/projects/[projectId]/jobs/[jobId]/shifts/new/page.tsx` | Admin layout + project/job authorization; `notFound()` | `projectId`, `jobId` | implemented | Project detail job CTA / Shift create drawer fallback | default, one/multiple dates, preview, validation, partial failure, error | Both | Required |
| SCR-A-007 | Manager + System Admin | `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` | redirect | 旧一括シフト作成alias | `app/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new/page.tsx` | Admin layout + UUID validation | `projectId`, `jobId` | legacy redirect | deep-link only; no navigation found | redirect to canonical `/shifts/new` | n/a | Skip |
| SCR-A-008 | Manager + System Admin | `/admin/shifts` | static | シフト一覧 | `app/admin/shifts/page.tsx` | Admin layout | none | implemented | sidebar シフト / dashboard/project links | list, week, calendar, date/filter, empty, error | Both | Required |
| SCR-A-009 | Manager + System Admin | `/admin/shifts/[shiftId]` | dynamic | シフト詳細 | `app/admin/shifts/[shiftId]/page.tsx` | Admin layout + authorized Shift read; `notFound()` | `shiftId` | implemented | Shift list/calendar/project Shift link | staffing states, applications, assignments, edit drawer, confirmation/absence dialogs, error, not-found | Both | Required |
| SCR-A-010 | Manager + System Admin | `/admin/placement` | static + query-selected editor | 配置・休憩回し | `app/admin/placement/page.tsx` | Admin layout + branch-scoped reads/RPC | none (`shift` query selects editor) | implemented | sidebar 配置・休憩回し | board, filtered/empty, selected editor, unsaved/validation/conflict, error, safe not-found | Both | Required |
| SCR-A-011 | Manager + System Admin | `/admin/pre-shift` | static + query drawer | 前日確認 | `app/admin/pre-shift/page.tsx` | Admin layout + scoped read | none (`assignment` query selects drawer) | implemented | sidebar 前日確認 | pending/confirmed/not-open, all complete, filters, empty, drawer, safe not-found, error | Both | Required |
| SCR-A-012 | Manager + System Admin | `/admin/day-of` | static + query drawer | 当日運用 | `app/admin/day-of/page.tsx` | Admin layout + scoped read | none (`assignment` query selects drawer) | implemented | sidebar 当日運用 | scheduled/working/finished/attention, filters, empty, drawer, Incident state, safe not-found, error | Both | Required |
| SCR-A-013 | Manager + System Admin | `/admin/attendance` | static | 勤怠一覧 | `app/admin/attendance/page.tsx` | Admin layout + scoped read | none | implemented | sidebar 勤怠 | summary, filters, multiple attendance states, empty, error | Both | Required |
| SCR-A-014 | Manager + System Admin | `/admin/attendance/[assignmentId]` | dynamic | 勤怠詳細・確定・訂正 | `app/admin/attendance/[assignmentId]/page.tsx` | Admin layout + authorized Assignment read; `notFound()` | `assignmentId` | implemented | 勤怠一覧 Worker primary link | unconfirmed/confirmed/revised, absence dialog, validation/conflict, audit history, error, not-found | Both | Required |
| SCR-A-015 | Manager + System Admin | `/admin/workers` | static | スタッフ一覧 | `app/admin/workers/page.tsx` | Admin layout; create action System Admin-controlled | none | implemented | sidebar スタッフ | summary, filters, active/unavailable, empty, create editor, error | Both | Required |
| SCR-A-016 | Manager + System Admin | `/admin/workers/[workerId]` | dynamic | スタッフ詳細 | `app/admin/workers/[workerId]/page.tsx` | Admin layout + authorized Worker read; `notFound()` | `workerId` | implemented | スタッフ名 link | overview/history tabs, pagination, edit editor, inactive, error, not-found | Both | Required |
| SCR-A-017 | Manager + System Admin | `/admin/incidents` | static + query drawer | ヘルプリクエスト一覧・対応 | `app/admin/incidents/page.tsx` | Admin layout + scoped Incident read | none (`incident` query selects drawer) | implemented | sidebar ヘルプリクエスト / Day-of | unresolved/open/acknowledged/resolved/retracted, filters, drawer, conflict, safe not-found, empty/error | Both | Required |
| SCR-A-018 | Manager + System Admin | `/admin/announcements` | static | お知らせ一覧 | `app/admin/announcements/page.tsx` | Admin layout + Announcement scope authorization | none | implemented | sidebar お知らせ | all/draft/published/archived filters, pagination, empty, error | Both | Required |
| SCR-A-019 | Manager + System Admin | `/admin/announcements/new` | static | お知らせ下書き作成 | `app/admin/announcements/new/page.tsx` | Admin layout + actor/scope authorization | none | implemented | お知らせ一覧 create CTA | blank draft, preview, Manager branch/System Admin organization, validation, pending, error | Desktop + responsive spot-check | Required |
| SCR-A-020 | Manager + System Admin | `/admin/announcements/[announcementId]` | dynamic | お知らせ詳細・下書き編集 | `app/admin/announcements/[announcementId]/page.tsx` | Admin layout + Announcement scope authorization; safe not-found | `announcementId` | implemented | お知らせtitle link / post-create redirect | draft, edit query, publish dialog, published read-only, archive dialog, archived read-only, delete dialog, conflict, empty-audience, safe unavailable, error | Both | Required |
| SCR-A-021 | Manager + System Admin | `/admin/clients` | static | 取引先一覧・編集 | `app/admin/clients/page.tsx` | Admin layout + master scope authorization | none | implemented | sidebar 取引先 | summary, filters, pagination, empty, create/edit editor, error | Both | Required |
| SCR-A-022 | Manager + System Admin | `/admin/workplaces` | static | 勤務先一覧・編集 | `app/admin/workplaces/page.tsx` | Admin layout + master scope authorization | none | implemented | sidebar 勤務先 | summary, filters, pagination, empty, create/edit editor, error | Both | Required |
| SCR-A-023 | Manager + System Admin | `/admin/settings` | static | 設定（準備中） | `app/admin/settings/page.tsx` | Admin layout | none | placeholder | sidebar disabled/placeholder presentation | placeholder only | Desktop only | Skip |

## Worker Screens

All `/worker/**` pages inherit `app/worker/layout.tsx`, which calls `requireWorker()`. Non-Worker authenticated users are redirected to `/admin`. The layout also reads the recipient-owned Notification unread count.

| ID | Role | Route | Route Type | Screen Name | Source File | Guard | Dynamic Params | Status | Reachability | Key States | Viewport | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCR-W-001 | Worker only | `/worker` | static | ワーカーホーム / 次の勤務 | `app/worker/page.tsx` | Worker layout + page `requireWorker()` | none | implemented | login redirect / header Home | with assignments, empty, attendance/pre-shift badges, error | Both; Mobile primary | Required |
| SCR-W-002 | Worker only | `/worker/assignments/[assignmentId]` | dynamic | 勤務詳細・前日確認・勤怠・Help Request | `app/worker/assignments/[assignmentId]/page.tsx` | Worker layout + page guard + ownership; `notFound()` | `assignmentId` | implemented | Worker home card / Incident Notification CTA | pre-shift states, attendance actions, Help Request create/retract/status, terminal states, validation/conflict, error/not-found | Both; Mobile primary | Required |
| SCR-W-003 | Worker only | `/worker/notifications` | static + client detail drawer | 通知一覧・詳細 | `app/worker/notifications/page.tsx` | Worker layout + page guard + recipient RLS/resolvers | none | implemented | Worker Bell | mixed Incident/Announcement, unread/read, detail open, source available/unavailable, pagination, empty/error | Both; Mobile primary | Required |
| SCR-W-004 | Worker only | `/worker/announcements` | static | お知らせ一覧 | `app/worker/announcements/page.tsx` | Worker layout + page guard + frozen recipient read | none | implemented | Worker header Megaphone | with data, important, pagination, empty, permission unavailable, error | Both; Mobile primary | Required |
| SCR-W-005 | Worker only | `/worker/announcements/[announcementId]` | dynamic | お知らせ詳細 | `app/worker/announcements/[announcementId]/page.tsx` | Worker layout + page guard + recipient/source authorization | `announcementId` | implemented | Announcement list / Notification CTA / deep link | normal/important, multiline body, safe unavailable for foreign/draft/archived/nonexistent, error | Both; Mobile primary | Required |

## Shared / Redirect Screens

- `/` is a pure redirect to `/login`; it is not a screenshot target.
- `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` validates both UUIDs and redirects to the canonical `/shifts/new` screen. No current navigation points to it; treat as a legacy alias and capture only the canonical route.
- No route groups, parallel routes, intercepting routes, catch-all segments, or application `route.ts` handlers were found.
- `app/favicon.ico` produces `/favicon.ico/route` in the build manifest. It is metadata, not a screen or API route.

## Layouts / Shells

| Shell / Special File | Applies To | Responsibility | Screenshot Implication |
| --- | --- | --- | --- |
| `app/layout.tsx` | all routes | root HTML, Geist fonts, global metadata/styles | global typography/background issue should be recorded once, then referenced |
| `app/admin/layout.tsx` | `/admin/**` | `requireAdmin`, sidebar cookie, AdminShell user | common Admin shell must be separated from page-specific findings |
| `components/admin/admin-shell-frame.tsx` | `/admin/**` | desktop collapsed sidebar, mobile header/sidebar, content frame | capture one expanded and one conditional collapsed/mobile shell state |
| `components/admin/admin-sidebar.tsx` / `admin-mobile-sidebar.tsx` | `/admin/**` | navigation groups, active state, mobile drawer | common navigation audit target |
| `components/admin/admin-header.tsx` / `admin-user-menu.tsx` | `/admin/**` | breadcrumb context, account menu/logout | conditional menu-open state only once |
| `app/worker/layout.tsx` | `/worker/**` | `requireWorker`, greeting, Announcement/Notification navigation, unread badge, logout | Worker screenshots should retain header; badge states captured on Notification workflow |
| `app/admin/loading.tsx` | all Admin segments without nearer loading | common Admin loading state | no standalone screenshot unless transition defect appears |
| `app/admin/error.tsx` | `/admin/**` | common resettable error boundary | conditional representative capture only |
| `app/admin/not-found.tsx` | `/admin/**` | common Admin not-found | conditional representative capture only |
| `app/admin/announcements/loading.tsx` | Announcement routes | Announcement loading | Skip unless visual defect found |
| `app/admin/day-of/loading.tsx`, `error.tsx` | Day-of | local loading/error | error conditional; loading normally Skip |
| `app/admin/placement/loading.tsx`, `error.tsx` | Placement | local loading/error | error conditional; loading normally Skip |
| `app/worker/announcements/loading.tsx` | Worker Announcement routes | Worker loading message | Skip unless visual defect found |

## Screen State Inventory

| Screen / Group | Representative Required State | Conditional States Worth Capturing | Skip / Notes |
| --- | --- | --- | --- |
| Login | unauthenticated default | invalid credentials, account error | authenticated redirects are verified without screenshot |
| Admin Dashboard | populated operational summary | no-alert empty, error | one desktop shell baseline |
| Project workflow | list, create, populated detail | empty/filtered, edit drawer, empty Job/Shift sections | legacy bulk alias skipped |
| Shift workflow | list, detail, create | week/calendar, shortage, applications/assignments, edit/cancel/absence dialogs | loading skipped |
| Placement | populated board and selected editor | shortage/filter empty, unsaved/validation, VERSION_CONFLICT, safe not-found | editor shares same route via query |
| Pre-shift | mixed status monitor | drawer, all-complete, empty, safe not-found | query state, not separate route |
| Day-of | mixed operational monitor | drawer, attention/Incident, empty, safe not-found | query state, not separate route |
| Attendance | mixed status list and populated detail | confirm/revision/absence dialogs, audit history, error | fixture must preserve canonical facts |
| Workers | populated list/detail | filters, create/edit, history tab, inactive | System Admin-only editor requires matching actor fixture |
| Incident | unresolved list | detail drawer, acknowledged/resolved, safe unavailable, conflict | drawer is explicit query state |
| Admin Announcement | list, create, published detail | empty, draft edit, publish/archive/delete dialogs, archived read-only, EMPTY_AUDIENCE/VERSION_CONFLICT | published immutable |
| Master data | Client and Workplace lists | create/edit editor, empty/error | same shared master patterns; avoid duplicating every editor state |
| Worker Home | next assignments | empty/error, badge combinations | mobile primary |
| Worker Assignment | actionable detail | pre-shift pending/confirmed, working/finished, Help Request open/acknowledged/resolved/retracted, errors | choose one rich fixture plus focused conditional states |
| Worker Notification | mixed unread Inbox | Incident detail, Announcement detail, archived source unavailable, empty, pagination | list does not mark read; explicit open does |
| Worker Announcement | list and important detail | empty/error, archived/foreign safe unavailable | no Announcement read state |

## Dynamic Fixture Requirements

| Screen ID | Fixture Required | Fixture Type / Preconditions |
| --- | --- | --- |
| SCR-A-004 | yes | authorized active Project with Client, Job, Workplace, and Shifts; optional empty Project |
| SCR-A-005 | yes | authorized Project plus selectable active master data |
| SCR-A-006 | yes | authorized Project and Job with valid Workplace/options |
| SCR-A-007 | yes, redirect verification only | valid Project/Job UUID pair |
| SCR-A-009 | yes | authorized Shift with applications, active Assignment, staffing and pre-shift states |
| SCR-A-014 | yes | authorized Assignment with attendance facts; confirmed/revised history for conditional state |
| SCR-A-016 | yes | branch-visible Worker; history rows for history tab; System Admin for edit state |
| SCR-A-020 | yes | separate draft, published, archived Announcement roots; eligible audience for publish dialog |
| SCR-W-002 | yes | own active Assignment with current Shift, pre-shift/attendance state; Incident variants as needed |
| SCR-W-005 | yes | own frozen recipient + published Announcement; archived/foreign IDs for safe unavailable |

Non-dynamic fixture prerequisites: mixed Day-of assignments, pre-shift status matrix, placement plan/breaks, mixed attendance states, one unread Incident Notification plus one unread Announcement Notification, and active Manager/Worker/System Admin local accounts. This phase creates none of them.

## Workflow Groups

| Workflow | Entry Screen | Related Screens | Main Role | Screenshot Priority |
| --- | --- | --- | --- | --- |
| Authentication | SCR-AUTH-001 Login | SCR-AUTH-002 Account Error, role redirects | Public/Auth | Required |
| Admin Dashboard | SCR-A-001 | links to operational lists/details | Admin | Required |
| Admin Project | SCR-A-002 | SCR-A-003/004/005/006, SCR-A-007 alias | Admin | Required |
| Admin Shift / Assignment | SCR-A-008 | SCR-A-009, create via SCR-A-006 | Admin | Required |
| Admin Placement | SCR-A-010 | selected editor query state | Admin | Required |
| Admin Pre-shift | SCR-A-011 | selected Assignment drawer | Admin | Required |
| Admin Day-of | SCR-A-012 | selected Assignment drawer, Incident context | Admin | Required |
| Attendance | SCR-A-013 | SCR-A-014 | Admin | Required |
| Staff Management | SCR-A-015 | SCR-A-016 | Admin | Required |
| Admin Incident | SCR-A-017 | Incident drawer/state transitions | Admin | Required |
| Admin Announcement | SCR-A-018 | SCR-A-019/020 | Admin | Required |
| Master Data | SCR-A-021 | SCR-A-022, shared editor | Admin | Required |
| Worker Assignment | SCR-W-001 | SCR-W-002 | Worker | Required |
| Worker Help Request | SCR-W-002 | SCR-A-017 Admin response, Notification CTA | Worker/Admin | Conditional focused state |
| Worker Notification | SCR-W-003 | Incident Assignment CTA, Announcement CTA | Worker | Required |
| Worker Announcement | SCR-W-004 | SCR-W-005 | Worker | Required |

## Shared UI Components

- Admin shell: `AdminShellFrame`, `AdminSidebar`, `AdminMobileSidebar`, `AdminNavLinks`, `AdminHeader`, `AdminUserMenu`.
- Page structure: `AdminPage`, `AdminContentContainer`, `AdminPageHeader`, `AdminBreadcrumb`, `AdminSectionNav`.
- Shared states: `AdminLoadingState`, `AdminErrorState`, `AdminEmptyState`, `AdminNotFoundState`.
- Overlay/focus: shared `Drawer`, `DialogFocusGuard`, confirmation dialogs; feature drawers for Project/Job/Shift, Placement, Pre-shift, Day-of, Incident, Notification.
- Data presentation: status badges, summary/KPI cards, structured lists, filters, pagers, description sections, audit history.
- Forms/actions: Project/Job/Shift forms, master/Worker editors, attendance confirmation/revision, absence/cancel dialogs, pre-shift/attendance/Help Request Worker actions.
- Worker shell/content: Worker header navigation, assignment detail sections, Notification Inbox drawer, Announcement list/detail/importance treatment.

## Orphan / Legacy / Redirect Findings

1. `SCR-A-007` bulk-new is a confirmed legacy alias: route exists, only redirects to canonical new Shift route, and no current navigation reference was found.
2. `SCR-A-023` Settings is reachable from the sidebar but intentionally marked `placeholder`; it is not an implemented settings workflow.
3. `SCR-A-005` Job create dedicated page remains implemented as a fallback/deep-link route while the normal Project detail flow prefers `JobCreateDrawer` when form options are available. It is not classified orphan, but AUDIT-3.0A-3/4 should review route consolidation separately.
4. Several Admin detail/create routes intentionally have no sidebar entry and are reached from their parent list/detail CTA. This is expected, not orphaning.
5. Auth error and safe unavailable states are redirect/deep-link reachable rather than primary navigation entries.
6. No guard that makes an implemented canonical route unconditionally unreachable was found.

## Screenshot Plan Handoff

Standard viewports: Admin desktop `1440x900`; Worker mobile `390x844`. `Both` screens receive the primary viewport shown below plus one deliberately selected responsive spot-check, rather than a full route/state Cartesian product.

| Screen ID | Route | State | Priority | Viewport | Fixture Needed | Screenshot Filename |
| --- | --- | --- | --- | --- | --- | --- |
| SCR-AUTH-001 | `/login` | default | Required | 1440x900 | no | `login-desktop.png` |
| SCR-AUTH-002 | `/auth/error?reason=inactive` | inactive | Conditional | 1440x900 | inactive auth context | `auth-error-inactive-desktop.png` |
| SCR-A-001 | `/admin` | populated | Required | 1440x900 | dashboard operations | `admin-dashboard-desktop.png` |
| SCR-A-002 | `/admin/projects` | default | Required | 1440x900 | projects | `admin-projects-list-desktop.png` |
| SCR-A-002 | `/admin/projects` | empty/filtered | Conditional | 1440x900 | empty or unmatched filter | `admin-projects-empty-desktop.png` |
| SCR-A-003 | `/admin/projects/new` | default | Required | 1440x900 | active Client/branch/options | `admin-project-new-desktop.png` |
| SCR-A-004 | `/admin/projects/[projectId]` | populated hub | Required | 1440x900 | rich Project | `admin-project-detail-desktop.png` |
| SCR-A-004 | `/admin/projects/[projectId]` | edit drawer | Conditional | 1440x900 | editable Project | `admin-project-edit-drawer-desktop.png` |
| SCR-A-005 | `/admin/projects/[projectId]/jobs/new` | default fallback | Conditional | 1440x900 | Project + options | `admin-job-new-desktop.png` |
| SCR-A-006 | `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | preview | Required | 1440x900 | Project/Job/options | `admin-shift-new-preview-desktop.png` |
| SCR-A-008 | `/admin/shifts` | list | Required | 1440x900 | mixed Shifts | `admin-shifts-list-desktop.png` |
| SCR-A-008 | `/admin/shifts?view=calendar` | calendar | Conditional | 1440x900 | month Shifts | `admin-shifts-calendar-desktop.png` |
| SCR-A-009 | `/admin/shifts/[shiftId]` | staffing detail | Required | 1440x900 | rich Shift | `admin-shift-detail-desktop.png` |
| SCR-A-009 | `/admin/shifts/[shiftId]` | edit drawer | Conditional | 1440x900 | editable Shift | `admin-shift-edit-drawer-desktop.png` |
| SCR-A-010 | `/admin/placement` | board | Required | 1440x900 | placement matrix | `admin-placement-board-desktop.png` |
| SCR-A-010 | `/admin/placement?shift=[shiftId]` | editor open | Required | 1440x900 | Shift plan + staff/breaks | `admin-placement-editor-desktop.png` |
| SCR-A-010 | `/admin/placement?shift=[shiftId]` | conflict/error | Conditional | 1440x900 | stale revision | `admin-placement-conflict-desktop.png` |
| SCR-A-011 | `/admin/pre-shift` | mixed statuses | Required | 1440x900 | pre-shift matrix | `admin-pre-shift-desktop.png` |
| SCR-A-011 | `/admin/pre-shift?assignment=[assignmentId]` | drawer open | Conditional | 1440x900 | selected Assignment | `admin-pre-shift-drawer-desktop.png` |
| SCR-A-012 | `/admin/day-of` | mixed operations | Required | 1440x900 | day-of matrix | `admin-day-of-desktop.png` |
| SCR-A-012 | `/admin/day-of?assignment=[assignmentId]` | drawer/Incident | Conditional | 1440x900 | attention Assignment | `admin-day-of-drawer-desktop.png` |
| SCR-A-013 | `/admin/attendance` | mixed states | Required | 1440x900 | attendance matrix | `admin-attendance-list-desktop.png` |
| SCR-A-014 | `/admin/attendance/[assignmentId]` | confirmed + history | Required | 1440x900 | attendance facts/revision | `admin-attendance-detail-desktop.png` |
| SCR-A-014 | `/admin/attendance/[assignmentId]` | revision dialog | Conditional | 1440x900 | confirmed attendance | `admin-attendance-revision-dialog-desktop.png` |
| SCR-A-015 | `/admin/workers` | default | Required | 1440x900 | active/inactive Workers | `admin-workers-list-desktop.png` |
| SCR-A-016 | `/admin/workers/[workerId]` | overview | Required | 1440x900 | visible Worker | `admin-worker-detail-desktop.png` |
| SCR-A-016 | `/admin/workers/[workerId]?tab=history` | history | Conditional | 1440x900 | Worker history | `admin-worker-history-desktop.png` |
| SCR-A-017 | `/admin/incidents` | unresolved list | Required | 1440x900 | mixed Incidents | `admin-incidents-list-desktop.png` |
| SCR-A-017 | `/admin/incidents?incident=[incidentId]` | drawer open | Required | 1440x900 | selected Incident/events | `admin-incident-drawer-desktop.png` |
| SCR-A-018 | `/admin/announcements` | mixed lifecycle | Required | 1440x900 | draft/published/archived | `admin-announcements-list-desktop.png` |
| SCR-A-018 | `/admin/announcements` | empty | Conditional | 1440x900 | no visible Announcement | `admin-announcements-empty-desktop.png` |
| SCR-A-019 | `/admin/announcements/new` | completed preview | Required | 1440x900 | Manager scope | `admin-announcement-new-desktop.png` |
| SCR-A-020 | `/admin/announcements/[announcementId]` | published read-only | Required | 1440x900 | published Announcement | `admin-announcement-published-desktop.png` |
| SCR-A-020 | `/admin/announcements/[announcementId]?edit=1` | draft edit | Conditional | 1440x900 | draft Announcement | `admin-announcement-draft-edit-desktop.png` |
| SCR-A-020 | `/admin/announcements/[announcementId]` | archived read-only | Conditional | 1440x900 | archived Announcement | `admin-announcement-archived-desktop.png` |
| SCR-A-021 | `/admin/clients` | default | Required | 1440x900 | Client records | `admin-clients-list-desktop.png` |
| SCR-A-021 | `/admin/clients` | editor open | Conditional | 1440x900 | branches / editable Client | `admin-client-editor-desktop.png` |
| SCR-A-022 | `/admin/workplaces` | default | Required | 1440x900 | Workplace records | `admin-workplaces-list-desktop.png` |
| SCR-A-022 | `/admin/workplaces` | editor open | Conditional | 1440x900 | branches / editable Workplace | `admin-workplace-editor-desktop.png` |
| SCR-W-001 | `/worker` | assignments | Required | 390x844 | own upcoming Assignments | `worker-home-mobile.png` |
| SCR-W-001 | `/worker` | desktop spot-check | Conditional | 1440x900 | same | `worker-home-desktop.png` |
| SCR-W-002 | `/worker/assignments/[assignmentId]` | actionable detail | Required | 390x844 | own active Assignment | `worker-assignment-detail-mobile.png` |
| SCR-W-002 | `/worker/assignments/[assignmentId]` | Help Request open | Conditional | 390x844 | own open Incident | `worker-help-request-open-mobile.png` |
| SCR-W-003 | `/worker/notifications` | mixed unread/read | Required | 390x844 | Incident + Announcement Notifications | `worker-notifications-mobile.png` |
| SCR-W-003 | `/worker/notifications` | Incident detail open | Conditional | 390x844 | own Incident Notification | `worker-notification-incident-detail-mobile.png` |
| SCR-W-003 | `/worker/notifications` | Announcement detail open | Conditional | 390x844 | own Announcement Notification | `worker-notification-announcement-detail-mobile.png` |
| SCR-W-003 | `/worker/notifications` | source unavailable | Conditional | 390x844 | archived Announcement Notification | `worker-notification-source-unavailable-mobile.png` |
| SCR-W-004 | `/worker/announcements` | published list | Required | 390x844 | targeted Announcements | `worker-announcements-list-mobile.png` |
| SCR-W-004 | `/worker/announcements` | empty | Conditional | 390x844 | no published targeted source | `worker-announcements-empty-mobile.png` |
| SCR-W-005 | `/worker/announcements/[announcementId]` | important detail | Required | 390x844 | targeted important Announcement | `worker-announcement-detail-mobile.png` |
| SCR-W-005 | `/worker/announcements/[announcementId]` | safe unavailable | Conditional | 390x844 | archived/foreign UUID | `worker-announcement-unavailable-mobile.png` |

Handoff totals: Required 28, Conditional 23. Primary Admin captures use desktop; primary Worker captures use mobile. Responsive duplicates are limited to screens where shell/layout behavior materially warrants them.

## Completeness Cross-check

- Filesystem: 31 `app/**/page.tsx` entries are represented exactly once by the 31 stable Screen IDs above.
- Category arithmetic: Admin 23 + Worker 5 + Public/Auth 3 = 31.
- Dynamic arithmetic: Admin 8 + Worker 2 = 10.
- Redirect arithmetic: root redirect 1 + bulk-new alias 1 = 2; therefore 29 canonical visual screens.
- Navigation: every implemented Admin sidebar href maps to SCR-A-001/002/008/010/011/012/013/015/017/018/021/022; Settings maps to placeholder SCR-A-023. Every Worker header href maps to SCR-W-001/003/004. Child screens are accounted for through list/detail/form CTA or documented deep-link/redirect reachability.
- Build manifest: all 31 filesystem pages are present in `.next/server/app-paths-manifest.json`. The manifest additionally contains framework `_not-found`, `_global-error`, and favicon metadata route; these are not product `page.tsx` routes.
- Special files: 3 layouts, 5 loading files, 3 error boundaries, and 1 Admin not-found file are inventoried under Layouts / Shells.
- No screenshots were captured and no browser mutations were performed.

## Explicit Non-Changes

- Product code (`app/**`, `components/**`, `lib/**`, `scripts/**`): unchanged
- UI behavior/styles: unchanged
- Supabase schema, migrations, RLS, GRANT, RPC, data: unchanged
- Auth architecture/data: unchanged
- packages/lockfile: unchanged
- Figma: not opened or compared
- screenshots/images: not created
- local/remote runtime state: unchanged
- commit/push/reset/clean/stash: 0
- existing staged, unstaged, and untracked work: preserved

`AUDIT-3.0A-1: COMPLETE`

`AUDIT-3.0A-2: READY`
