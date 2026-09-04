# Phase UI-2.4C-R Staff Basic Recovery Result

## Executive Summary

- `/admin/workers` のplaceholderを実データ一覧へ置換した。
- `/admin/workers/[workerId]` に概要・勤務履歴・基本情報を同一RouteのGET tab stateで実装した。
- Staff List / Hub / History / Basic / Create / Editの6 Figma frameを直接確認した。Feedback / NotesはFuture Domainとして非表示。
- Create / Editは既存RLSに合わせSystem Admin限定。Auth Admin APIは使わず、Createは`auth_profile_id = null`のstaffing entityを作成する。
- Managerは自支店の閲覧のみ。支店変更、Auth/Profile更新、hard deleteは提供しない。

## Sources

- Figma: `544:2`, `544:271`, `546:2`, `546:442`, `546:651`, `546:856`
- `docs/admin-final-alignment-audit-v1.md`
- `docs/dispatch-os-design-foundation-v1.md`
- `docs/dispatch-os-ui-patterns-v1.md`
- `docs/ui-1.6-edit-security-plan.md`
- `supabase/migrations/001_initial_schema.sql`, `002_rls_policies.sql`, `003_api_grants.sql`

## Domain Inventory

### Worker

- Table: `public.workers`
- Fields used: `id`, `staff_code`, `branch_id`, `auth_profile_id`, `display_name`, `status`, `created_at`, `updated_at`
- Branch: `branch_id`; Manager visibility is existing `private.has_branch_access` RLS.
- Status: `active | inactive | suspended`
- Staff ID: `staff_code`; Auth UUIDを代用しない。
- Editable: System Adminのみ`display_name`, `status`。
- Immutable in UI: `id`, `staff_code`, `branch_id`, `auth_profile_id`, `created_at`。

### Profile

- Table: `public.profiles`
- Auth relation: `profiles.id = auth.users.id`; `workers.auth_profile_id`はnullable unique FK。
- Responsibility: authentication identity, account role, login active state。

### Worker / Profile SOT

- Staff operation SOT: `workers`。
- Auth identity / role SOT: `profiles`。
- Worker作成時にAuth accountをfake作成しない。未連携Staffは明示表示する。

## Route Architecture

- List: `/admin/workers`
- Detail: `/admin/workers/[workerId]`
- Create: List上Drawer（System Adminのみ）
- Edit: Detail Hub上Drawer（System Adminのみ）
- Tabs: `overview` default, `?tab=history`, `?tab=profile`; invalid valueはoverview。
- Subrouteは追加していない。

## Staff List

- Header / real summary / server-side name・staff_code search / status filter / 20件pagination。
- Columns: name, official staff ID, branch, status, recent past work。
- Recent work: 過去の`completed | absent | no_show` Assignmentのうち最新のshift start。
- Mobileはtable縮小ではなくcard表示。
- 1ページ分のworkers取得後、対象worker IDsを一括Assignment queryしてN+1を回避。

## Staff Detail Hub

- Overview: next work, recent work, completed count, absent/no_show count, status, branch, Auth link state。
- History: Assignment + Shift + Project + Job + Workplace + optional Attendance。新しい勤務日順、stable ID tie-break、最大200件読取・20件表示。
- Basic: staff_code, name, branch, status, created date, Auth link state。
- Omitted: phone, email, kana, address, birth date, bank, emergency contact, skill, evaluation, rich notes。

## Staff Create / Edit

- Create: System Adminのみ。`staff_code`, `branch_id`, `display_name`, `status`をZod/server action/RLSで保存。Auth userは作らない。
- Edit: System Adminのみ。`display_name`, `status`だけを更新。
- Branchはimmutable。`updated_at`をopaque tokenとしてoptimistic concurrencyに利用。
- Manager UIにはCreate/Edit controlを表示しない。
- Delete UIなし。

## Integration

- Attendance Detail → Staff Hub
- Pre-shift Drawer → Staff Hub
- Shift Hub assigned worker → Staff Hub
- History → Project Hub / Shift Hub / Attendance Detail

## Responsive / Chrome QA

- 1440: List load、desktop table、Hub、overflowなし。
- 1280: List / overflowなし。
- 390×844: card list、Hub tabs、History、mobile menu、overflowなし。
- Search: `TEST Worker B`でGET URL stateと1件結果を確認。
- Hub: overview/history/profile、invalid tab、direct URL、Back/Forwardを確認。
- Data: Manager Aで自支店Worker 2名を確認。Worker AのAssignment 5件とAttendance有無をUIで確認。
- Integration: Attendance / Pre-shift / Shift Hubから各Staff linkを確認。
- New clean Chrome tab console: warn/error 0。
- Create/Edit mutation QAはManager sessionのため未実施。権限外controlが非表示であることを確認。

## Security / DB

- Manager: own branch select only。System Admin: existing insert/update RLSのみ。
- Worker accountは`require-admin`でAdmin routeからredirectされる既存境界を維持。
- RLS enabled、anon business readなし、authenticated deleteなしをlocal read-only testで確認。
- Migration / RLS / GRANT / RPC / Function / Trigger / Seed / Auth / package変更なし。
- Remote接続・remote mutationなし。.env.local変更なし。

## Tests / Validation

- Worker UI rules: 8/8 PASS。
- Local Admin security read-only: 7/7 PASS。
- `npx tsc --noEmit`: PASS。
- scoped ESLint: PASS。
- `npm run build`: PASS。新Routeを含む全route生成。
- `git diff --check`: PASS（既存line-ending warningのみ）。

## Limitations

- 現行schemaに連絡先、カナ、スキル、経験、評価、rich notes、availability、rank、tags、certification、documentsはないため未実装。
- Createはlogin account invitationではなく、schemaが許容するAuth未連携Staff作成。Auth invitationは別Domain Phaseが必要。
- History summaryはquery bound 200件。集計専用Domainを追加していない。

## Next Phase

UI-2.5A Assignment / Placement Foundation。ただしposition、time segment、break rotationの保存Domain境界を先に確定する。

UI-2.4C-R: COMPLETE
