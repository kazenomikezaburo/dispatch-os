# ADMIN-UI-3.0B-6D Canonical Shift Operations Workspace

## Status

- `ADMIN-UI-3.0B-6D: COMPLETE`
- `ADMIN-UI-3.0B-6E: READY`

## Canonical IA

Cross-Shift Operations を `シフト運用` の単一workspaceとして整理した。

```text
シフト運用
├─ シフト
│  ├─ 一覧
│  ├─ 週
│  └─ カレンダー
├─ 前日確認
└─ 当日確認
```

Placementはoperation tabへ追加していない。Shift Detail内の既存単一シフト導線は6E対象として維持した。

## Figma Reference

read-onlyで以下を確認した。

- Shift Operations List: `496:2900`
- Week: `505:352`
- Calendar: `505:512`
- Pre-shift: `523:2`
- Day-of: `523:257`

最新Figmaの階層、見出し、compact operation tabs、view switch、KPI、filter、content density、CTA hierarchyを参照した。Legacy Shift Detail `496:3034` は正本にしていない。Figma mutationは0件。

## Routes

- `/admin/shifts`: canonical Shift Operations
- `/admin/shifts/pre-shift`: canonical cross-shift Pre-shift
- `/admin/shifts/day-of`: canonical cross-shift Day-of
- `/admin/shifts/new`: canonical Shift Create
- `/admin/shifts/[shiftId]`: exact Shift Detailを維持
- `/admin/pre-shift`, `/admin/day-of`: compatibility routeを維持

production buildでstatic segmentの`new`、`pre-shift`、`day-of`とdynamic `[shiftId]`が別routeとして安全に共存することを確認した。

## Workspace Header

`/admin/shifts`を「シフト運用」とし、複数案件を横断するworkspaceであることを説明した。Primary actionは`/admin/shifts/new`への「シフトを作成」。

## Operation Navigation

`ShiftOperationsNav`を追加し、3 canonical hrefを共有した。

- シフト
- 前日確認
- 当日確認

pathname由来の`aria-current="page"`、real Link、44px target、focus ring、surface・font weight・shadowを併用したnon-color-only active stateを持つ。legacy Pre/Day routeでも対応するphaseをactive表示する。

## Shift List

既存`ShiftList`、検索、filter、KPI、pagination、status、staffing semanticsを再利用した。row/cardは保持されたexact authorized Shift IDで`/admin/shifts/[shiftId]`へ遷移し、first/nearest/latest Shift推測は追加していない。

## Week View

既存`ShiftScheduleViews`とURL-backed `view=week` contractを再利用した。週移動、日付、shortage/status、exact Shift linkを維持した。

## Calendar View

既存calendarとURL-backed `view=calendar` contractを再利用した。月移動、今日、日付filter、exact Shift linkを維持した。

## Shift Create

`/admin/shifts/new`を追加し、既存`ShiftCreateEditor`と既存Server Actionを再利用した。no-contextではProjectを選択し、そのProjectのauthorized Job / Workplaceを明示選択してからeditorを表示する。ブラウザQAでは既存business Shiftを増やさず、選択・prefill・safe fallbackまで確認した。

## Shift Create Context Rules

- no-context: Project selectorのみ。Jobを推測しない。
- `projectId`: authorized Projectの場合だけprefillし、そのProjectのJob候補だけを取得する。
- `projectId + jobId`: 両方がauthorizedで、Jobが選択Projectに属する場合だけeditorへ渡す。
- mismatched/unknown Job: silent採用せず未選択safe stateへ戻す。
- recipientのようなclient-supplied trustはなく、RLS下で取得したProject/Job relationをserverで再検証する。
- nested create / bulk-new compatibility routeと既存action semanticsは維持した。

## Pre-shift Canonical Route

`/admin/shifts/pre-shift`を追加した。date/project/status/shift/assignmentをallowlist parserで扱い、詳細URLとclose URLをcanonical base pathで生成する。

## Pre-shift Reuse

旧pageをcopyせず、named shared server screenと既存loader、monitor、drawerを旧/new routeで共有した。cross-shift summary、filter、exact Assignment、safe missing stateを維持した。Drawer close後はRSC navigation完了をbounded pollingし、元のexact Assignment triggerへfocusを復帰する。

## Day-of Canonical Route

`/admin/shifts/day-of`を追加し、canonical表示名を「当日確認」に統一した。

## Day-of Reuse

旧pageをcopyせず、named shared server screenと既存loader、monitor、drawerを共有した。date/project/state/shift/assignmentの既存contract、cross-shift summary、exact identityを維持した。関連する前日確認リンクのみcanonical routeへ接続した。

## Attendance Boundary

Day-ofは既存attendance factsのread/integrationをそのまま使用する。Attendance edit/revision、fact semantics、DB contractは変更していない。

## Incident Boundary

既存Incident/SOS attentionのread/integrationとexact Incident linkを維持した。Incident lifecycle、authorization、DB contractは変更していない。

## Legacy Route Compatibility

`/admin/pre-shift`と`/admin/day-of`は到達可能で、旧base pathを使うfilter/detail URLを保持する。新旧は同じserver screen、loader、monitorを共有し、logic driftや二重writeを追加していない。redirect/retirementは行っていない。

## Sidebar

6Cの`案件 / シフト運用`だけの構造を維持した。prefix-based active判定によりmain、create、canonical Pre/Day、Shift Detailでシフト運用がactiveとなる。Placement entryは復活させていない。

## Breadcrumb

- Shift: `案件・運用 / シフト運用`
- Pre: `案件・運用 / シフト運用 / 前日確認`
- Day: `案件・運用 / シフト運用 / 当日確認`
- Create: `案件・運用 / シフト運用 / シフト作成`

page-owned canonical breadcrumbがあるrouteではshell fallback breadcrumbを抑止し、重複表示を避けた。

## Responsive

- `1440x900`: List/Calendar hierarchyとoperation tabs、document overflow 0
- `1280x900`: Pre-shift rows/detail、document overflow 0
- `390x844`: Calendar、Day-of list/drawer、3 tabsを確認。document overflow 0
- mobile tabs: 3項目が341px内に収まり、各target 44px
- Day-of mobile drawer: viewport幅390px、body scroll lock、close target 44px

## Accessibility

semantic nav、real Link、`aria-current`、visible focus、44px target、non-color-only active state、既存list/table semantics、label付きfilterを確認した。Pre/Day drawerはEscapeで閉じ、exact Assignment triggerへfocusを復帰。canonical breadcrumbは1つだけ表示される。

## Local Browser QA

Local Managerで以下を実操作した。

- Shift List / Week / Calendar
- Shift → Pre → Dayのcanonical route
- canonical Shift Createのno-context、Project-only、exact Project+Job、不一致Job
- exact Shift Detail
- Pre/Day drawer open、Escape、focus restore
- old Pre/Day deep links
- reload、Back/Forward後のroute表示

application error 0、React warning 0、hydration warning 0。開発サーバーはloopback/LAN dev resourcesをnarrow allowlistし、Client Component hydrationも確認した。

## Network Browser QA

実行時に列挙したLAN IPv4 originからSystem Adminで`/admin/shifts`を表示し、Sidebar、operation tabs、List、Shift Create entryを確認した。LAN IPはcodeへhardcodeしていない。application/React/hydration error 0。

## Test Rebaseline

- KEEP: Shift Views、Pre-shift rules/admin/RLS、Day-of rules/matrix、Placement、Attendance、Incident
- UPDATE: canonical Shift workspace navigationとroute-aware query href
- REPLACE: 旧cross-shift top-level navigation expectationをfocused canonical testで置換
- RETIRE: なし。legacy routes/testsは6Hまで維持

## Regression

- Canonical Project IA: 36/36
- Project History: 36/36
- Shift Views: 33/33
- Unified Editors: 33 assertions
- Placement Core: 26/26
- Placement Editor: 13/13
- Placement Rules: 39/39
- Placement Atomic: 20/20
- Pre-shift Monitor: PASS
- Pre-shift Rules: 20/20
- Pre-shift Admin: 20/20
- Pre-shift RLS: 16/16
- Day-of Rules: 17/17
- Day-of Matrix: 12/12
- Attendance Admin: 40/40
- Attendance Confirmation: 50/50
- Attendance Revision: 53/53
- Operational Incident: 47/47
- Admin Shell: 11 assertions

## Static Verification

- focused canonical Shift Operations: PASS, 32 assertions
- `npm run lint`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS; all four canonical routes and `[shiftId]` emitted separately
- `git diff --check`: PASS (line-ending notices only, whitespace errors 0)

## Files Changed

6D implementation scope:

- `app/admin/shifts/page.tsx`
- `app/admin/shifts/new/page.tsx`
- `app/admin/shifts/pre-shift/page.tsx`
- `app/admin/shifts/day-of/page.tsx`
- `app/admin/pre-shift/page.tsx`
- `app/admin/day-of/page.tsx`
- `components/admin/shifts/shift-operations-nav.tsx`
- `components/admin/shifts/shift-page-header.tsx`
- `components/admin/pre-shift/pre-shift-monitor.tsx`
- `components/admin/pre-shift/pre-shift-drawer.tsx`
- `components/admin/day-of/day-of-monitor.tsx`
- `components/admin/day-of/day-of-drawer.tsx`
- `components/admin/admin-breadcrumb.tsx`
- `lib/admin/projects/get-shift-create-choices.ts`
- `lib/admin/pre-shift/pre-shift-rules.ts`
- `lib/admin/day-of/day-of-rules.ts`
- `next.config.ts`
- `scripts/integration/admin-canonical-shift-operations-test.mjs`
- `docs/admin-ui-3.0b-6d-canonical-shift-operations-result.md`

## Explicit Non-Changes

- DB schema/migrations: 6D追加・変更0（作業ツリー内の既存6B migrationはそのまま保持）
- RLS/RPC/GRANT: 変更0
- Project History / Project IA: 変更0
- Shift Detail IA: 変更0
- Placement Domain/write semantics: 変更0
- Single-Shift Confirmation: 未追加
- Attendance Domain: 変更0
- Incident Domain: 変更0
- Workplace Master: retirementなし
- Worker / Auth / Packages: 変更0
- Figma / Remote: 変更0
- commit/push: 0
- existing staged/unstaged/untracked work: 保持

## Remaining Risks

なし。Shift Detailの4タブ化、Placement統合、Single-Shift Confirmation、legacy route retirementは計画どおり6E以降に残す。
