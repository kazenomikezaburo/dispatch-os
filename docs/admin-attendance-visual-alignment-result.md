# Phase UI-2.4E 実装結果

## Sources
- Figma List: `530:2122` をFigma MCPで直接確認。
- Figma Detail: `530:2369` をFigma MCPで直接確認。
- Figma States: 未確定・確定・訂正済み・遅刻・欠勤 / No Showの表現を確認し、既存Domainに対応するものだけ採用。
- Design Foundation: `docs/dispatch-os-design-foundation-v1.md` と `docs/dispatch-os-ui-patterns-v1.md`。
- Existing Attendance Domain: 現行code、migration、Server Action / RPC、RLS / GRANTを確認。

## Git State
- Branch: `small-ui-a11y-fix`
- Existing staged: なし。
- Existing unstaged: UI-2.3F〜UI-2.4Dを含む既存変更あり。保持した。
- Existing untracked: 前Phase成果物あり。保持した。

## Attendance Domain Inventory

### attendance_events
- Purpose: Workerから受信したimmutable raw log。
- Fields: `id`, `assignment_id`, `event_type`, client/server timestamp, location情報, `source`, idempotency情報。
- Mutability: Admin訂正では更新・削除しない。
- Relation: `assignment_id` でAssignmentに属する。

### attendance_records
- Purpose: 1 Assignmentのofficial current state。
- Fields: planned/actual start/end、break、status、approved_at/by、adjustment_reason、updated_at。
- State: recordなしを未確定、recordありを確定として表示。
- Concurrency: 既存RPCはrow lockで直列化するが、UIのstale token拒否は存在しない。

### attendance_record_revisions
- Purpose: 正式勤怠の訂正監査履歴。
- Fields: before/after start/end/break、reason、changed_by、changed_at。
- Relation: Attendance Record配下。存在時のみ「訂正済み」。

## Route Architecture
- List: `/admin/attendance` を維持。
- Detail: `/admin/attendance/[assignmentId]` を維持。
- Tabs: 新設せず、同一Routeに必要Sectionを配置。
- History: Detail Hub内。別Routeなし。

## Navigation
- Desktop: 既存「勤怠・スタッフ > 勤怠」を維持。
- Mobile: 既存Admin Drawer navigationを維持。
- Active: `/admin/attendance` 配下で既存active判定を維持。

## Attendance List
- Header: 「勤怠」と運用目的を明示。fake primary actionなし。
- Summary: 勤務予定、未確定、確定、訂正済み、欠勤・無断欠勤。
- Date: 前日・今日・翌日と日付入力。
- Search: Worker、Project、Job、WorkplaceをGET queryで検索。
- Filters: 勤務状態、確認状態、要確認。refresh/back/forward可能。
- Pagination: 20件単位。infinite scrollなし。
- Columns: Worker、予定、案件/業務/勤務先、状態、打刻、確認事項、操作。
- Mobile: 390pxではtableを隠し構造化Cardを表示。

## Status Mapping
| Domain | UI | Semantic |
| --- | --- | --- |
| recordなし | 未確定 | warning |
| recordあり、revisionなし | 確定 | success |
| revisionあり | 訂正済み | info |
| assignment `absent` | 欠勤 | danger |
| assignment `no_show` | 無断欠勤 | danger |
| existing late helper | 遅刻 | warning |
| scheduled / start_missing / working / finished | 勤務前 / 開始未報告 / 勤務中 / 勤務終了 | neutral / warning / success |

## Figma-only / Omitted
- Wake、Depart、Arrival、realtime location、GPS、SOS、escalation、notification resendは未実装。
- 「未到着」はArrival Domainがないため追加していない。
- Figmaの数値や状態はhardcodeしていない。

## Attendance Detail Hub
- Header: Worker、Project / Job / Workplace、確認状態。
- Summary: 勤務予定、Worker打刻、正式実働。
- Official Record: actual start/end、break、確定者、確定日時をcurrentとして分離。
- Raw Events: type、受信時刻、sourceをimmutable logとして表示。最大100件。
- Revision History: author、changed_at、reason、before/afterを人間可読表示。最新50件。
- Links: Project Hub、Shift Detail、勤怠一覧。Staff Hub未実装のためdead linkなし。

## Correction
- Existing: 既存`revise_attendance_record` flowのみ。
- Surface: 共通Drawer。390pxではfull-screen。
- Fields: actual start/end、break、reason。
- Reason: 既存Validationどおり必須。
- Validation: Zod + Server Actionを維持。
- Authorization: 既存Server-side authとRLS/RPCを維持。
- Concurrency: RPC row lockは維持。楽観的stale rejectionは現行Domainにないため追加なし。
- Revision: 既存RPCによる作成。UIで履歴を捏造しない。

## State Handling
- Missing record: 未確定として安全に表示。
- Pending: recordなし。
- Confirmed: recordあり、revisionなし。
- Corrected: revisionあり。
- Absent: existing Assignment statusのみ。
- No Show: existing Assignment `no_show`のみ。
- Late: 既存attendance helperの判定のみ。
- Future arrival/wake/depart: 表示・状態とも追加なし。

## Data Access
- List query: dateでAssignmentをbounded取得し、events/records/revisionsをID batch取得。
- Detail query: Assignment、最大100 Raw Events、Official Record、最新50 Revisions。
- Pagination: filter後20件。日付範囲はDBで限定。
- N+1: なし。
- Branch: 既存RLSを正本とし、UIで迂回しない。
- History: 全履歴一括取得を廃止し最新50件に限定。

## Responsive
### 1440
- List: dense table。
- Detail: 読みやすい複数column summaryとsection。
- Overflow: なし（`scrollWidth === innerWidth`）。

### 1280
- List: desktop tableを維持。
- Detail: content container内に収まる。
- Overflow: なし。

### 390×844
- List: Attendance Card。
- Detail: single column。
- History: stacked readable list。
- Correction: full-screen Drawer、Escape、focus restore、scroll lock確認。
- Navigation: 既存mobile navigation維持。
- Overflow: なし。

## Chrome QA
- List: empty日、未確定fixture、確定fixture、訂正済みfixtureを表示確認。
- Date: 日付入力と前後リンクを確認。
- Filters: confirmation filterとURL反映を確認。
- Detail: official/current、raw、revision、関連linkを確認。
- Tabs: 新設なし。
- Back: filter URLへ復帰確認。
- Forward: 次のfilter URLへ再遷移確認。
- Correction: Drawer操作、Validation、confirm表示まで確認。confirm応答時にChrome制御が中断し、保存は発生していないことを別タブで確認。
- Concurrency: stale token機構が存在しないため2-tab更新試験対象外。
- Mobile: 390×844のCard、Detail、History、Drawer、focus、overflowを確認。

## Data Verification
- Assignment: `40000000-0000-0000-0000-000000000004` を安全なlocal fixtureとして照合。
- Worker: TEST Worker A。
- Shift: 09:00–18:00。
- Record: 09:00–17:30、break 45分。
- Events: start_work 09:00、end_work 18:00の2件。
- Revisions: 既存1件、60→45分およびend 18:00→17:30。
- DB: local Supabase `127.0.0.1:54321`のみ。
- UI: 上記をDetail表示と一致確認。QA追加mutationなし。

## Security
- Manager: existing server auth + RLS。
- Branch: RLS predicateを変更せず維持。Chrome cross-branch mutationなし。
- System Admin: existing policyを維持。
- Worker: Admin route guardを変更せず維持。今回Chrome worker loginは未実施。
- RLS: 変更なし。
- GRANT: 変更なし。

## DB
- Migration: なし。
- RLS: 変更なし。
- GRANT: 変更なし。
- RPC: 追加・変更なし。
- Function: 追加・変更なし。
- Trigger: 追加・変更なし。
- Seed: 変更なし。
- Remote: 接続・変更なし。

## Regression
- Shift List: build/type integrationで確認。
- Week: build/type integrationで確認。
- Calendar: build/type integrationで確認。
- Shift Hub: Chrome関連link表示とbuildで確認。
- Pre-shift: buildで確認。
- Staff: 未実装。dead linkなし。
- Client: buildで確認。
- Workplace: buildで確認。
- Worker Attendance: shared Worker code変更なし。

## Console
- React: error 0。
- Hydration: error 0。
- Runtime: error 0。
- Network: 変更由来error 0。
- CSS: error 0。
- A11y: Chrome操作でlabel、Escape、focus restoreを確認。

## Tests
- Query: query parser/date/confirmation/searchをpure testで確認。
- Status: missing/confirmed/corrected/absence/no_show/late mappingを確認。
- Pagination: 20件sliceとpage normalizationを確認。
- Revision: human-readable formatterとbounded queryを確認。
- Security: schema/RLS/Server Actionをread-only audit。変更なし。
- Correction: Action自体は未変更。mutationを伴う既存integration suiteは未実行。
- Other: overnight display、stable sort、raw event labelを確認。

## Validation
- TypeScript: PASS。
- Build: PASS。
- scoped ESLint: PASS。
- git diff --check: PASS（既存のLF/CRLF warningのみ）。

## Existing Diff
UI-2.3F〜UI-2.4Dの既存staged/unstaged/untracked変更は保持し、本Phase対象外を巻き戻していない。UI-2.4EはAttendance route/components/lib、関連test、本報告書に限定した。

## Limitations
- existing fixtureで実画面確認できた状態は未確定・確定・訂正済み。欠勤・No Show・勤務中はpure rule testのみ。
- Chrome制御のconfirm応答中断によりCorrection保存完走は未確認。正式値45分、Raw Events 2件、Revision 1件のままを再確認済み。
- existing RPCにはrow lockがあるが、updated_at/versionを使うUI楽観的競合拒否はない。追加には別Domain/RPC Phaseが必要。
- Listは日付でDB bounded、派生state filter後にserver memory pagination。巨大日次件数向けDB paginationは将来最適化候補。

## Remaining Future Attendance Domain
- Wake
- Depart
- Arrival
- Realtime location
- SOS
- Escalation
- Notification resend
- Payroll automation

## Next Phase

UI-2.5A Assignment / Placement Foundation

※次Phase開始前に、現在のAdmin実装全体とFigmaの残差分を再監査してもよい。

UI-2.4E: COMPLETE WITH LIMITED STATE QA
