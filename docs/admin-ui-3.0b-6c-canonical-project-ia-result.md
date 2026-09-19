# ADMIN-UI-3.0B-6C Canonical Project IA

## Status

- `ADMIN-UI-3.0B-6C: COMPLETE`
- `ADMIN-UI-3.0B-6D: READY`

## Canonical Project IA

Project UIを「案件一覧 → 案件作成 / 案件詳細」に集約し、案件詳細の主タブを `概要 / シフト / 履歴` の3つへ固定した。DB上の `Project → Job → Shift` と共有Workplaceは変更していない。

## Figma Reference

最新Figmaをread-onlyで確認した。Project List `469:2` とProject Detail `383:3183` の情報階層、KPI、詳細3タブ、業務・勤務先、基本情報の構成を参照し、既存DomainとSecurity contractを優先して実装した。Figmaは変更していない。

## Sidebar

- `案件` は `/admin/projects` を維持。
- `シフト` を `シフト運用` へ改名し、`/admin/shifts` を維持。
- `配置・休憩回し`、`前日確認`、`当日運用` の独立entryを削除。
- `勤務先` は6Gまで維持。
- 旧route自体は削除していない。

## Project List

Collection Workflow Tabsを削除した。Page Header、新規案件CTA、KPI、検索、状態・期間filter、一覧、pagination、empty stateは維持した。既存fixtureに213 Shiftを持つ案件があり、assignment IDの単一 `.in(...)` がURL長上限を超えたため、同じRLS付きData API queryを100 Shift ID単位で並列分割した。集計意味・権限・Domain contractは不変。

## Project Detail Header

既存authorized DTOから案件名、状態、取引先、期間、編集actionを表示する構成を維持した。ProjectだけからJobを推測できないため、unsafeなProject-level Shift create CTAは追加していない。

## Project Detail Navigation

real LinkとURL-derived stateで `概要 / シフト / 履歴` を実装した。`aria-current`、44px以上のtarget、focus-visible、mobile overflowを既存detail navigation vocabularyで維持した。

## Overview

既存Project KPI、基本情報に加え、旧standalone `業務・勤務先` 内容をOverviewへ統合した。Applications、Assignment detail、Placement、Confirmation、Attendance、Incidentは含めていない。

## Jobs / Workplace Composition

Jobは「業務」として残し、業務名、状態、共有Workplace名・住所、既存の安全なJob情報を表示する。WorkplaceのcopyやMaster/RLS変更はない。

## Project Shifts

既存Project配下Shift listを再利用した。行は正確な `/admin/shifts/[shiftId]` へ遷移し、Project contextから任意のfirst Job/Shiftを選ばない。Project Shifts内へ運用編集は追加していない。

## Project History

6Bの `getProjectHistory` と `list_project_history_events(...)` をそのまま再利用した。Project Detailがauthorized Projectを取得した後、同じcanonical Project IDだけをserver helperへ渡す。read errorはHistory領域のgeneric errorとして扱い、Project全体のauthorization/not-found contractは既存のまま。

## History Event Rendering

semantic ordered listのTimelineを追加した。6B safe DTOのevent type、actor display name、target label、allowlisted `changed_fields` だけを日本語表示へ変換する。raw payload、unknown field、actor user ID、internal DB IDは表示しない。

## History Pagination

初期20件の6B keyset paginationを使用した。次cursorは `{ createdAt, id }` をbase64url JSONへencodeしたopaque URL cursorで、boundaryにて長さ、canonical ISO timestamp、positive safe integer、両field存在を検証する。malformed cursorは安全に無効化し、500やuntrusted JSONのRPC引き渡しを防ぐ。「さらに読み込む」はreal Link。

## Legacy Jobs Tab Compatibility

authorized Projectを先に読み込んだ後、`?tab=jobs` を同一Projectのcanonical Overview URLへserver redirectする。別Projectやfirst Projectを推測しない。

## Project Create Regression

`/admin/projects/new` の5C unified setupを変更していない。Client select/inline Client、initial Job、Workplace select/inline Workplace、確認、success redirect contractをfocused suiteとbrowserで確認した。

## Project Edit Regression

`/admin/projects/[projectId]?edit=1` のProject editorを維持した。Job/Workplace editorの統合は行っていない。

## Responsive

- 1440x900: Project Overview PASS、document overflow 0。
- 1280x900: Project History PASS、document overflow 0。
- 390x844: Project List、Overview、Shifts、History、Edit、Create PASS、document overflow 0。

## Accessibility

semantic headings、real Links、URL-derived `aria-current`、44px target、focus-visible、status text、semantic Timeline list、accessibleな「さらに読み込む」を維持・確認した。stateを色だけで表現していない。

## Local Browser QA

Local ManagerでProject List、Overview、Shifts、exact Shift link、History、reload、legacy jobs redirect、Project Edit、Project Createを実操作した。大量Shift案件を含むdefault Project Listも正常表示。Historyは既存fixtureが0件のためno-backfill empty stateを確認し、non-empty renderingはfocused suiteで確認した。application error、React warning、hydration warningは0。

## Network Browser QA

LAN originでProject List、Overview、Shifts、History、Sidebar、reloadと認証維持を確認した。LAN IPはcodeへ保存していない。application error、React warning、hydration warningは0。

## Test Rebaseline

- KEEP: Admin Shell、Project Setup。
- UPDATE: Project Management Hub、Detail Workflow Tabs、Navigation Family。
- REPLACE: 旧Project 3-tab期待をCanonical `概要 / シフト / 履歴` とlegacy redirect、shortcut absence、History contract、exact Shift linkのassertionへ置換。
- RETIRE: test suite自体の廃止なし。
- Focused `admin-canonical-project-ia-test.mjs`: 36/36 PASS。

## Regression

- Project History Foundation 36/36
- Project Setup 35/35
- Unified Editors 33/33
- Shift Views 33/33
- Placement Core 26/26
- Placement Editor Rules 13/13
- Placement Rules 39/39
- Placement Atomic Command 20/20
- Pre-shift Monitor PASS / Rules 20/20 / Admin 20/20
- Day-of Rules 17/17 / Fixture Matrix 12/12
- Admin Attendance 40/40
- Attendance Confirmation 50/50
- Attendance Revision 53/53
- Operational Incident 47/47
- Admin Shell 11/11
- Project Management Hub 28/28
- Detail Workflow Tabs 29/29
- Navigation Family 31/31

## Static Verification

- `npm run lint`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS（既存working-copy line-ending warningのみ）

## Files Changed

- `app/admin/projects/page.tsx`
- `app/admin/projects/[projectId]/page.tsx`
- `components/admin/admin-nav.ts`
- `components/admin/admin-detail-workflow-routes.ts`
- `components/admin/projects/detail/project-history.tsx`
- `lib/admin/projects/project-history-cursor.ts`
- `lib/admin/projects/get-projects.ts`
- `scripts/integration/admin-canonical-project-ia-test.mjs`
- `scripts/integration/admin-project-management-hub-test.mjs`
- `scripts/integration/admin-detail-workflow-tabs-test.mjs`
- `docs/admin-ui-3.0b-6c-canonical-project-ia-result.md`

## Explicit Non-Changes

- DB schema / migration: 変更0
- Project History RLS / RPC / GRANT: 変更0
- Project / Job / Workplace / Shift relation: unchanged
- Shift Operations / Shift Detail implementation: unchanged
- Placement / Confirmation / Attendance / Incident Domain: unchanged
- Worker UI / Auth architecture / packages: unchanged
- Figma / remote: unchanged
- commit / push: 0
- existing staged / unstaged / untracked work: preserved

## Remaining Risks

なし。Project Historyは6B以前のeventをbackfillしない仕様のため、既存Projectでは履歴0件が正常にあり得る。
