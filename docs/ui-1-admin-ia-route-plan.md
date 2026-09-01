# Dispatch OS Phase UI-1 Admin IA / Route再編 調査・設計

調査日: 2026-08-23

## 1. Executive Summary

現行Admin Routeは14本。案件管理はすでにProject Detail内でProject概要、配置集計、Job、Workplace、Shiftを集約しており、Management Hubへ発展させやすい。一方、作成操作だけが4本の専用Routeへ分離されている。

推奨方針は次のとおり。

- `/admin/projects` はProject一覧として維持する。
- `/admin/projects/[projectId]` を案件設計・編集のManagement Hubにする。
- Project新規作成は入力項目と文脈切替の多さから専用Pageを維持する。
- Job追加・編集と単一Shift追加・編集はProject Detail内Drawerへ統合する。
- Bulk Shiftは31日選択、翌日終了、締切、Previewを含むため専用Pageを維持する。
- `/admin/shifts` は日付・期間軸の運用一覧として維持し、Project編集機能を置かない。
- `/admin/shifts/[shiftId]` は応募、配置、欠勤、前日確認を扱う運用Detailとして維持する。
- `/admin/attendance` とDetailはRouteを維持し、Worker名をAttendance Detailへの主要Linkへ変更する。
- 旧作成Routeは統合直後に削除せず、互換期間中は同じFormを表示し、その後Project Detailのpanel指定へ一時Redirectする。

## A. Current Route Map

| Path | Page Component | 分類 | 現在の目的・表示 | 主な操作 / Action / Form | 重複 |
|---|---|---|---|---|---|
| `/admin` | `app/admin/page.tsx` | Dashboard | 本日の集計、Alert、現場配置 | 表示のみ。`getDashboardData` | Shift/Attendanceの集計を要約するが、今日の例外検知という責務で妥当 |
| `/admin/projects` | `app/admin/projects/page.tsx` | List | 案件検索、状態・期間Filter、案件一覧 | Project Detail遷移、新規案件遷移 | Shift数・不足を表示するがProject軸 |
| `/admin/projects/new` | `app/admin/projects/new/page.tsx` | Create | Project基本情報入力 | `ProjectCreateForm` → `createProject` | 将来Project EditとForm共通化可能 |
| `/admin/projects/[projectId]` | `app/admin/projects/[projectId]/page.tsx` | Detail / Hub候補 | Header、配置Summary、案件概要、Job/Workplace、Job別Shift | Job追加、Shift追加、Bulk追加、Shift Detail遷移 | Project配下のShift表示は`/admin/shifts`と一部重複するが目的が異なる |
| `/admin/projects/[projectId]/jobs/new` | `app/admin/projects/[projectId]/jobs/new/page.tsx` | Create | Project配下のJob・Workplace・募集条件入力 | `JobCreateForm` → `createJob` | Project Detailから離脱する作成専用Page |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | `app/admin/projects/[projectId]/jobs/[jobId]/shifts/new/page.tsx` | Create | 単一Shift入力 | `ShiftCreateForm` → `createShift` | Project Detailから離脱する作成専用Page |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` | `app/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new/page.tsx` | Create | 最大31日のShift一括入力とPreview | `BulkShiftCreateForm` → `createBulkShifts` | 単一Shiftと項目は似るが操作量が大きい |
| `/admin/shifts` | `app/admin/shifts/page.tsx` | List | 全案件Shift、期間・状態・配置状況、必要/応募/配置/不足 | Shift Detail遷移 | Project DetailのShift一覧と情報が重なるがTime-centric |
| `/admin/shifts/[shiftId]` | `app/admin/shifts/[shiftId]/page.tsx` | Detail / Operation | Shift情報、Job条件、応募、配置、欠勤、前日確認 | `acceptShiftApplication`、`rejectShiftApplication`、`assignWorkerToShift`、`cancelAssignmentByCompany`、欠勤/無断欠勤Action | Project編集ではなくShift運用。維持必須 |
| `/admin/attendance` | `app/admin/attendance/page.tsx` | List | 日別の予定、打刻、異常、欠勤操作 | Attendance Detail、Shift Detail、欠勤/無断欠勤 | Shift Detailと欠勤操作が一部重複。日別勤怠監視として妥当 |
| `/admin/attendance/[assignmentId]` | `app/admin/attendance/[assignmentId]/page.tsx` | Detail / Operation | 予定、打刻、確定、訂正、訂正履歴 | `AttendanceConfirmationForm`、`AttendanceRevisionForm` → `confirmAttendanceRecord` / `reviseAttendanceRecord` | Shift DetailのAssignment情報を実勤務の観点で深掘り |
| `/admin/workers` | `app/admin/workers/page.tsx` | Placeholder | スタッフ管理見出しのみ | なし | 現時点で実機能なし |
| `/admin/clients` | `app/admin/clients/page.tsx` | Placeholder | 取引先・勤務先見出しのみ | なし | Project Form/Job Formで選択するMasterの管理先候補 |
| `/admin/settings` | `app/admin/settings/page.tsx` | Placeholder | 設定見出しのみ | なし | 現時点で実機能なし |

存在しないRoute:

- Project Edit
- Job Detail / Edit
- Shift Edit
- Worker Detail
- Client Detail / Edit
- Workplace Detail / Edit

## B. Responsibility Map

| Area | 現在 | 再編後の責務 |
|---|---|---|
| Dashboard | 本日集計、Alert、今日の現場 | 今日対応すべき例外の入口。編集を持たない |
| Projects | Project一覧、構造表示、Job/Shift作成 | Project設計のHub。Project、Job、Workplace選択、Shift設計を管理 |
| Shifts | 期間横断一覧、Shift運用Detail | 日付・期間・配置状況で運用。Project編集を持たない |
| Attendance | 日別打刻一覧、確定・訂正 | 実勤務の正本UI。欠勤、打刻、確定、訂正、履歴 |
| Workers | Placeholder | Worker Master。勤務運用はShift/Attendanceに残す |
| Clients / Workplaces | Placeholder | Master Data管理。Project内では参照・選択のみ |

## C. Overlap Report

### Projects vs Shifts

同じShiftの日時、状態、配置、不足を両方で表示しているが、重複自体は問題ではない。

- Projects: `Project → Job → Shift`の構造設計と案件内の充足確認。
- Shifts: `Date/Period → Shift → Staffing`の日常運用。

Project DetailからShift Detailへ移動する導線は維持するが、Project編集操作をShift List/Detailへ追加しない。

### Shifts vs Attendance

- Shift Detail: 応募、採否、配置、解除、欠勤、前日確認。
- Attendance Detail: 打刻、勤務実績、確定、訂正、履歴。

欠勤操作は両画面に存在する。運用上は許容できるが、最終責務を「勤務前後の配置状態はShift」「実勤務の監査はAttendance」と明記する。欠勤Action自体は共通Server Actionを維持する。

### Navigation上の誤り

Attendance ListのWorker名は現在Shift Detailへ遷移し、別に「勤怠詳細」Buttonがある。基準書の主対象Link方針に反する。Worker名をAttendance Detailへ変更し、Shiftへの導線は案件/日時側の補助Linkとするのが自然。

## D. Proposed IA

```text
Admin
├─ Dashboard                     今日の異常と対応入口
├─ 案件管理
│  ├─ Project List
│  ├─ Project Create             専用Page
│  └─ Project Management Hub
│     ├─ 基本情報 / Edit Drawer
│     ├─ 配置Summary
│     ├─ Jobs / Workplaces
│     │  └─ Job Create/Edit Drawer
│     └─ Shifts
│        ├─ Shift Create/Edit Drawer
│        ├─ Bulk Shift Dedicated Page
│        └─ Shift Operation Detail
├─ シフト管理                    日付・期間軸
│  ├─ Shift List / 将来Calendar
│  └─ Shift Operation Detail
├─ スタッフ管理                  Worker Master
├─ 取引先・勤務先                Master Data
├─ 勤怠管理
│  ├─ Attendance List
│  └─ Attendance Detail
└─ 設定
```

## E. Route Migration Table

| Current Route | Proposed Route / UI | Status | 理由 |
|---|---|---|---|
| `/admin` | 同じ | KEEP | Dashboard責務が明確 |
| `/admin/projects` | 同じ | KEEP | Project一覧 |
| `/admin/projects/new` | 同じ | KEEP | 6領域の入力、支店による取引先絞込があり、初回作成は集中できる専用Pageが安全 |
| `/admin/projects/[projectId]` | Management Hubへ拡張 | KEEP | 既にHubのデータ構造とSectionがある |
| `/admin/projects/[projectId]/jobs/new` | Project DetailのJob Drawer | MERGE → REDIRECT | 親Project文脈から離脱する必要がない |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | Project DetailのShift Drawer | MERGE → REDIRECT | 単一Shiftは中程度の入力でDrawerに収まる |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` | 同じ専用Page | KEEP | 最大31日、Preview、締切設定がありDrawer/Dialogには過密 |
| `/admin/shifts` | Time-centric Listへ強化 | KEEP | Project管理と異なる運用軸 |
| `/admin/shifts/[shiftId]` | 同じ | KEEP | 応募・配置・欠勤・前日確認の運用Hub |
| `/admin/attendance` | 同じ | KEEP | 日別実勤務管理 |
| `/admin/attendance/[assignmentId]` | 同じ | KEEP | 確定・訂正・監査履歴 |
| `/admin/workers` | 将来Master List | KEEP | Sidebar責務上必要 |
| `/admin/clients` | 将来Client/Workplace Master | KEEP | Project内選択とMaster管理を分離 |
| `/admin/settings` | 将来設定 | KEEP | 現時点ではPlaceholder |

REMOVE対象は現段階ではない。Job/Shift Create旧RouteはBookmark互換のためREDIRECT候補として残す。

## F. Form Reuse Map

| Entity | 現行入力 | 現行Schema / Action | Create/Edit共通化 | 推奨UI |
|---|---|---|---|---|
| Project | name, branch, client, start/end date, status, description | `projectFormSchema` / `createProject` | Schemaは共通化可能。ComponentはCreate専用なので`ProjectForm`へ分離が必要。Update Actionは未実装 | Create: Dedicated Page、Edit: Hub内Drawer |
| Job | name, workplace, status, description, wage, transport, dress, requirements, meal, recruitment notes, manual URL | `jobFormSchema` / `createJob` | Schema・全Fieldを共通利用可能。`JobForm`へ改名しmode/initialValues/submitを注入 | Project Detail内Large Drawer。狭いDialogは不適 |
| Shift | start/end, required workers, break, deadline, status | `shiftFormSchema` / `createShift` | 高い。`ShiftForm`へ改名しinitialValuesとsubmitを注入 | Project Detail内Drawer |
| Bulk Shift | dates(1〜31), start/end, next-day, workers, break, deadline relative days/time, status, Preview | `bulkShiftFormSchema` / `createBulkShifts` | 単一ShiftとField部品・時刻Ruleは共有可能だが、入力モデルは別のままが安全 | Dedicated Page維持 |

Update Action/RPCは現在存在しない。UI統合前に、既存RLS/GRANTで安全な更新が可能かを別Phaseで設計する必要がある。UI都合でDB Securityを変更しない。

## G. Project Detail Hub Design

推奨Section順:

1. Header
   - Project名、Client、期間、Status
   - Primary: `案件を編集`
   - Secondary: 必要に応じて一覧へのBreadcrumb（現在のBreadcrumbと「案件一覧へ戻る」の重複は整理）
2. Summary
   - 現行のJob数、Shift数、必要、配置、不足、配置率を維持
3. Project Information
   - 支店、Client、期間、Status、説明
   - Edit Drawer
4. Jobs / Workplaces
   - Job名を主対象として表示
   - Workplaceは選択済みMasterの概要
   - `業務・勤務先を追加` → Job Drawer
   - `編集` → 同じJob DrawerにinitialValuesを渡す
5. Shifts（Job内）
   - 日時をShift Detailへの主要Linkにする
   - `シフトを追加` → Shift Drawer
   - `複数日まとめて追加` → Dedicated Page
6. Staffing
   - 現行SummaryとShift行の必要/配置/不足を利用
   - 応募者の詳細操作はShift Detailへ委譲

Master DataのClient/Workplace作成・編集はProject Hubへ入れない。Hubでは選択と参照のみ行う。

## H. Shift Management Design

`/admin/shifts`は次を中心にする。

- Today / Tomorrow / This week / Next week / custom range
- 募集Status
- Staffing status
- 必要 / 応募 / 配置 / 不足
- Project / Job / Workplace検索
- 日時をShift DetailへのPrimary Link
- 将来List / Calendar切替

置かないもの:

- Project基本情報編集
- Job募集条件編集
- Client/Workplace Master編集
- Project構造の組立操作

`/admin/shifts/[shiftId]`は既存のShift情報、Job条件、Application採否、Assignment、解除、欠勤/無断欠勤、前日確認を維持する。

## I. Navigation Migration

| 画面 | Current | Proposed |
|---|---|---|
| Project List | 右端`詳細を見る` | Project名をProject Detail Link。右端は将来の編集/メニュー用 |
| Project Detail Shift | 右端`シフト詳細` | 日付・時刻またはShift labelをShift Detail Link。Status/不足は表示専用 |
| Shift List | 右端`詳細を見る` | 日付・時刻をShift Detail Link。右端は運用ActionまたはStatus |
| Attendance List | Worker名→Shift Detail、右端`勤怠詳細` | Worker名→Attendance Detail。Shift日時または案件情報→Shift Detail。`勤怠詳細`Buttonは削減 |
| Project Detail Header | Breadcrumb + `案件一覧へ戻る` | BreadcrumbをLink対応にした後、戻るLinkを削減 |

行全体Clickは採用しない。LinkとActionの競合を避ける。

## Sidebar調査

- Component: `AdminSidebar`、`AdminMobileSidebar`、`AdminShell`、`AdminHeader`
- Navigation定義: `components/admin/admin-nav.ts`
- Desktop幅: `w-60`（240px）、`lg`以上でfixed
- Main offset: `lg:pl-60`
- Mobile: HeaderのMenu ButtonからModal Drawer、Escape/Backdropで閉じる
- Active state: pathname完全一致または配下prefix、`aria-current="page"`
- Desktop collapse: 未実装（Phase UI-2対象）
- Navigation item icon: 未実装
- Content max-width: Shellでは未設定

## Redirect Strategy

1. MERGE実装中は旧RouteとDrawerで同一共通Formを使う。
2. DrawerのDeep LinkはProject DetailのSearch Paramを用いる候補:
   - `?panel=job-new`
   - `?panel=shift-new&jobId=...`
3. 安定後、旧Route Pageで`redirect()`を使い新UIへ一時Redirectする。
4. Bookmarkと外部運用が十分移行した後にのみ`permanentRedirect()`を検討する。

最初からPermanent RedirectにするとDrawer導入のrollbackが難しくなるため避ける。404化と即時REMOVEもしない。

## J. Implementation Sub Phases

### UI-1.1 Navigation semantics

- Project名、Shift日時、Attendance Worker名をPrimary Link化
- `詳細を見る` / `シフト詳細`Button削減
- Breadcrumbと戻るLinkの重複整理
- Route/Formは変更しない

### UI-1.2 Project Detail Hub foundation

- Header Action領域、Section構造、Project Informationを整理
- Job/Shift一覧の責務を明確化
- 既存Create Routeは維持

### UI-1.3 Reusable Form extraction

- `ProjectCreateForm` → field/bodyとsubmit wrapperを分離
- `JobCreateForm` → `JobForm`
- `ShiftCreateForm` → `ShiftForm`
- 既存Create動作を同一Actionで回帰確認

### UI-1.4 Job Create Drawer integration

- Project HubへJob Drawerを追加
- 旧Job Create Pageでも共通Formを使用
- Create成功後はHubをrevalidateしてDrawerを閉じる設計へ変更

### UI-1.5 Shift Create Drawer integration

- Project Hubへ単一Shift Drawerを追加
- Bulk Shiftは専用Pageのまま
- 旧Shift Create Pageでも共通Formを使用

### UI-1.6 Edit capability design / implementation

- Project/Job/Shift Updateの認可、RLS、GRANT、状態制約を別Phaseとして確認
- Security設計承認後のみEdit Actionと同一Form modeを追加

### UI-1.7 Legacy Route Redirect

- 内部LinkをHub Drawerへ切替
- Telemetry/運用確認後に旧Job/単一Shift Create Routeを一時Redirect

### UI-1.8 Shift Management differentiation

- 期間PresetとTime-centric見出し・Primary Linkを整備
- Project編集Actionを置かない
- Calendarは別Phase候補

## K. Risk

| Risk | 内容 | Mitigation |
|---|---|---|
| Server Action redirect | 現行Create Actionが成功時にProject Detailへ`redirect`するため、Drawer内では成功状態を受け取れない | 共通Action契約の変更を小Phase化し、Page/Drawer双方をテスト |
| Deep Link | DrawerだけではBookmark/refreshで状態を失う | Search ParamまたはIntercepting Routeを設計。初期はSearch Paramが単純 |
| RSC revalidation | Drawer submit後にHub集計が古い可能性 | 現行`revalidatePath`対象を維持し、成功後refreshを確認 |
| Edit Security | Update Actionが未実装。既存GRANT/RLSの適否が未確認 | UI-1.6を別Security Phaseとして扱う |
| Form regression | Create専用Formの共通化でdefaultValues/null変換が変わる | SchemaとAction契約を保持し、既存Integration Testを先に固定 |
| Mobile Drawer | 長いJob Formが小画面で過密 | Full-height、scrollable Large Drawer、sticky action footerを検討 |
| Bulk over-compression | 31日選択とPreviewをDrawerへ入れると操作性低下 | Dedicated Page維持 |
| Navigation regression | Primary Link先の取り違え | Projects/Shifts/AttendanceごとにRoute assertionsを追加 |
| Dirty worktree | 既存未Commit差分との衝突 | Sub Phaseごとに対象ファイルを限定し、revert/formatしない |

## L. Test Plan

全Sub Phase共通:

- `npx tsc --noEmit`
- `npm run build`
- 変更範囲ESLint
- `git diff --check`

追加確認:

| Sub Phase | Test |
|---|---|
| UI-1.1 | Link href静的検査、Manager/System Admin実HTTP、Keyboard focus |
| UI-1.2 | Project List/Detail、Project集計、RLS可視性 |
| UI-1.3 | Project/Job/Shift/Bulk Create既存統合テスト、Zod境界 |
| UI-1.4 | Job Create成功/Validation/Data API拒否/他支店IDOR、Drawer close/reopen |
| UI-1.5 | Shift Create、Bulk Shift、Project Detail再集計、他Project job IDOR |
| UI-1.6 | Data API Security 105、RLS 148、Update IDOR、状態遷移Regression |
| UI-1.7 | 旧URL Redirect、Search Param不正値fallback、Bookmark |
| UI-1.8 | Shift List/Detail、Application、Assignment、欠勤、Pre Shift、Dashboard |

重要既存Runner:

- RLS 148/148
- Data API Security 105/105
- Auth 18/18
- Dashboard 12/12
- Assignment state/integrity/absence
- Pre Shift Admin/Worker
- Worker/Admin Attendance
- Attendance Confirmation/Revision

## M. Files Expected to Change

### UI-1.1

- `components/admin/projects/project-list-item.tsx`
- `components/admin/projects/detail/project-shift-list.tsx`
- `components/admin/shifts/shift-list-item.tsx`
- `components/admin/attendance/attendance-list.tsx`
- `components/admin/admin-breadcrumb.tsx`
- `components/admin/projects/detail/project-detail-header.tsx`

### Hub / Drawer

- `app/admin/projects/[projectId]/page.tsx`
- `components/admin/projects/detail/project-detail-header.tsx`
- `components/admin/projects/detail/project-overview.tsx`
- `components/admin/projects/detail/project-job-list.tsx`
- `components/admin/projects/detail/project-job-item.tsx`
- 新規のProject/Job/Shift Drawer Client Component

### Form reuse

- `components/admin/projects/form/project-create-form.tsx`
- `components/admin/projects/jobs/form/job-create-form.tsx`
- `components/admin/projects/shifts/form/shift-create-form.tsx`
- `components/admin/projects/shifts/form/bulk-shift-create-form.tsx`（共通Field抽出時のみ）
- `app/actions/projects.ts`
- `app/actions/jobs.ts`
- `app/actions/shifts.ts`

### Legacy Route

- `app/admin/projects/[projectId]/jobs/new/page.tsx`
- `app/admin/projects/[projectId]/jobs/[jobId]/shifts/new/page.tsx`

Bulk Shift Pageは維持する。

## N. Files Changed in This Investigation

- `docs/ui-1-admin-ia-route-plan.md`（本調査書のみ）

Route、Component、Server Action、Schema、Migration、Seedには変更を加えていない。

## O. Confirmation

- Migration変更なし
- RLS変更なし
- GRANT変更なし
- DB Function変更なし
- RPC変更なし
- Auth変更なし
- Supabase Client変更なし
- Domain Rule変更なし
- Assignment Rule変更なし
- Attendance Rule変更なし
- Pre Shift Rule変更なし
- Seed変更なし（本調査による変更なし。既存worktree差分は保持）
- package.json変更なし
- npm package追加なし
- remote Supabase未使用
- remote db push未実施

