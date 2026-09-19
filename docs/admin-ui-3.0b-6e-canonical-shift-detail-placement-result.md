# ADMIN-UI-3.0B-6E Canonical Shift Detail & Placement

## Status

- `ADMIN-UI-3.0B-6E: COMPLETE`
- `ADMIN-UI-3.0B-6F: READY`

## Canonical Shift Detail IA

`/admin/shifts/[shiftId]` を1 Shift専用Detailへ再構成し、main navigationを `概要 / 応募 / 配置 / 確認` の1段4項目へ固定した。旧Shift operation rowとHistory tabは表示しない。Cross-Shift workspace `/admin/shifts`, `/admin/shifts/pre-shift`, `/admin/shifts/day-of` は変更していない。

## Figma Audit

Figma `Pmb52CO7UgsQDA5tvoqUjF` をread-only監査した。現行non-archived framesはOverview `941:3388`、Applications `941:3484`、Placement `941:3580`、Confirmation `941:3676`、Placement Create Drawer `962:2`、Edit Drawer `962:238`。現行FigmaのHeader、単一tab row、Placement summary/board、right Drawerのvisual languageを参照した。FigmaにあるHistory frameは固定IAと矛盾するため採用せず、archive `496:3034` も正本として使用していない。Figma mutationは0。

## Header

既存authorized Shift DTOを拡張し、日付・曜日・勤務時間、Shift status、staffing status、exact Project link、Job、Workplace名・住所、既存Shift Edit linkを表示した。Workplace masterへの強い導線は追加していない。

## Main Navigation

共有`AdminDetailWorkflowNav`を使用し、semantic nav、real Link、URL-derived `aria-current`、44px target、focus-visible、non-color-only active state、contained mobile overflowを維持した。Overviewのみqueryなし、他は `applications / placement / confirmation`。

## Overview

必要人数、配置済み、応募、不足の既存Shift-level factsと、勤務情報・業務条件だけを表示する。応募者、配置board、確認row、Attendance、Incidentは複製していない。

## Applications

既存`ShiftApplicationList`と既存actionsをそのまま再利用した。応募者identity、status、承認・拒否・既存Assignment作成contractは変更していない。

## Placement Integration

Shift DetailのPlacement tabへ、既存Planの必要人数、対象Assignment、配置済み・未配置、Positions、Break、Coverage、スタッフ別配置を表示するsurfaceを追加した。編集は既存`PlacementEditor`と`savePlacementPlan`を再利用し、新しいwrite APIやclient-only domain formulaは追加していない。

## Exact Shift Loader

pathでauthorization済みの`detail.id`を既存`getPlacementPlan(detail.id)`へ直接渡す。date-wide `getPlacement(...)`を先にloadしてShiftを選ぶ処理、first/latest/nearest Shift推測はない。

## Placement Create Drawer

`?tab=placement&placement=create` でexact Shiftの既存plan editorを開く。close先は必ず同じShiftのcanonical Placement tab。新しいAssignmentは作成せず、既存Assignment限定pickerを維持する。

## Placement Edit Drawer

各Assignmentの `?tab=placement&assignmentId=<exact-id>` だけで開く。requested IDがexact PlanのAssignmentに含まれることをserverで再検証し、該当編集sectionをhighlight/scrollする。first Assignment fallbackはない。Close、Escape、Browser Back/ForwardでURL stateが復元され、trigger IDをsession-scopedに保持してfocusを戻す。

## Placement Version / Conflict

既存Plan version、expected version、idempotency key、`VERSION_CONFLICT` feedback、stale draft reloadを変更していない。Shift Detail保存後のcanonical detail revalidationだけをnarrowに追加し、standalone Placement revalidationも維持した。

## Breaks / Coverage

既存`assignment_break_intervals` payload、overlap validation、atomic RPC、break target warningをそのまま使用する。Coverageは既存`positionCoverage`からderiveし、永続化しない。

## Confirmation Transitional Surface

`?tab=confirmation`で既存Single-Shift `PreShiftConfirmationSection`だけを表示する。fake Day-of data、前日/当日sub-switch、開発予定文言は追加していない。

## Legacy Tab Compatibility

authorized Shift取得後に `assignments -> placement`、`confirmations -> confirmation` をserver redirectする。Shift IDは保持し、unknown queryは破棄する。`assignmentId`は同じShiftの実Assignmentと一致するときだけPlacement aliasで保持する。

## Standalone Placement Compatibility

`/admin/placement`、date-wide board、既存query/editorは到達可能なまま。Sidebarへentryを戻さず、canonical Shift Detailからlegacy routeへ戻るclose linkも追加していない。

## Breadcrumb

`案件・運用 / シフト運用 / Shift日時` とし、Cross-Shift operation tabsをDetailへ重複表示しない。exact Projectへの導線はHeaderに置いた。

## Responsive

- 1440x900: Overview、4 tabs、document overflow 0。
- 1280x900: Overview/Placement、document overflow 0。
- 390x844: Placement、Edit Drawer、4 tabs、document overflow 0。Drawer width 390px、body scroll lock、close target 44px。
- Placementの横方向情報はsurface内でresponsive stackし、document全体を横scrollさせない。

## Accessibility

Main tabsはsemantic nav、real Link、`aria-current`、44px、focus-visible。Placement actionsはkeyboard reachable。既存native dialog semantics、focus trap、Escape、body scroll lock、field labels、validation alertを維持し、close/Back後はexact triggerへfocus restoreした。Coverage不足は文言でも表現する。

## Local Browser QA

Local Managerでexact ShiftのOverview、Applications、Placement、Confirmation、Create/Edit Drawer、Escape、Back、Forward、reload、Shift Edit、exact Project link、両legacy aliasesを実操作した。Create close後は`placement-create-trigger`、Editはexact Assignment identityへ対応。application error、React warning、hydration warningは0。

## Network Browser QA

実行時に列挙したLAN IPv4 originでManager login後、exact Shift Placement、4 tabs、Sidebar active、Drawer、reload相当のserver navigationを確認した。LAN IPはcodeへ保存していない。document overflow 0、application/React/hydration warning 0。

## Test Rebaseline

- KEEP: Placement Core/Editor/Rules/Atomic、Shift Views、Unified Editor、Pre-shift、Day-of、Attendance、Incident、Project History、Admin Shell。
- UPDATE: Detail Workflow tab valuesとNavigation Family label。
- REPLACE: 5Aの「Shift DetailにOperation row」期待を「Detailではrowなし、既存cross-shift contextsでは保持」へrebaseline。
- RETIRE: suite廃止なし。

## Regression

- Focused Canonical Shift Detail: 37 assertions PASS
- Detail Workflow Tabs: 29 PASS
- Operation Screen Unification: 43 PASS
- Navigation Family: 31 PASS
- Canonical Shift Operations: 32 PASS
- Shift Views: 33/33 PASS
- Unified Shift Editors: 33 PASS
- Placement Core: 26/26 PASS
- Placement Editor Rules: 13/13 PASS
- Placement Rules: 39/39 PASS
- Placement Atomic: 20/20 PASS
- Placement Security: 28/28 PASS
- Canonical Project IA: 36 PASS
- Project History: 36 PASS
- Pre-shift Monitor PASS / Admin 20/20 / RLS 16/16
- Day-of Rules 17/17 / Fixture Matrix 12/12
- Attendance UI PASS / Admin 40/40 / Confirmation 50/50 / Revision 53/53
- Operational Incident: 47/47 PASS
- Admin Shell: 11 PASS

## Static Verification

- `npm run lint`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS; `/admin/shifts/[shiftId]`とstandalone `/admin/placement`を生成
- `git diff --check`: PASS（既存working-copyのLF/CRLF noticeのみ、whitespace error 0）
- React best-practices review: PASS。Server page主体、Placementのみ既存client editor、focus restoreだけnarrow client boundary。

## Files Changed

- `app/admin/shifts/[shiftId]/page.tsx`
- `app/actions/placement.ts`
- `components/admin/admin-detail-workflow-routes.ts`
- `components/admin/placement/placement-editor.tsx`
- `components/admin/placement/placement-focus-restore.tsx`
- `components/admin/placement/shift-placement-surface.tsx`
- `components/admin/shifts/shift-detail-header.tsx`
- `lib/admin/shifts/get-shift-detail.ts`
- `lib/admin/shifts/shift-detail-types.ts`
- `scripts/integration/admin-canonical-shift-detail-placement-test.mjs`
- `scripts/integration/admin-detail-workflow-tabs-test.mjs`
- `scripts/integration/admin-operation-screen-unification-test.mjs`
- `scripts/integration/admin-navigation-family-test.mjs`
- `docs/admin-ui-3.0b-6e-canonical-shift-detail-placement-result.md`

## Explicit Non-Changes

- DB schema/migrations、RLS/RPC/GRANT: 6E変更0
- Project History / Project IA / Cross-Shift Operations: unchanged
- Placement Domain/write/version/conflict/break semantics: unchanged
- Single-Shift Day-of Confirmation: not added
- Attendance / Incident / Workplace Master / Worker / Auth: unchanged
- packages/lockfile: unchanged
- Figma / remote: unchanged
- commit/push: 0
- existing staged/unstaged/untracked work: preserved

## Deferred To 6F

- Confirmationの前日確認 / 当日確認sub-switch
- Tokyo-date default phase
- Single-Shift Day-of integration

## Remaining Risks

なし。6Fでは今回のcanonical `confirmation` tab内に限って確認phaseを統合できる。
