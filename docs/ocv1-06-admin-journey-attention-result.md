# OCV1-06 — Admin Day-of Journey Attention Result

Status: **OCV1-06: COMPLETE**

実施日: 2026-09-28  
対象: local repository / local Supabase only

## 1. Result

Workerのcanonical Wake / Departure / Arrival factsを、既存Attention CenterとDay-of Operationsへderived exceptionとして接続した。

- `wake_overdue`
- `departure_overdue`
- `arrival_overdue`

Attentionは保存しない。既存のjourney fact、Pre-shift plan、Assignment / Shift lifecycle、Attendance factからリクエスト時に再計算する。Worker報告、downstream evidence、terminal / cancelled状態により条件が消えると、明示的なresolve操作なしで一覧から消える。

## 2. Architecture

### Authorized read boundary

`get_admin_assignment_journey_facts(p_from, p_to, p_limit)`を追加した。既存Admin loaderからのみ使う、現在状態に限定したbounded readerである。

- Manager: `private.has_branch_access`による自Branchのみ
- System Admin: organization scope
- Worker: 結果0件
- anon / service_role: EXECUTE不可
- `SECURITY DEFINER`、`search_path = ''`、schema-qualified object、authenticated-only EXECUTE
- 最大500行、Shift開始時刻range必須

返すのはauthorized Worker表示名、staff code、Assignment / Shift、Project / Job / Workplace、計画時刻、各journeyのlatest operation、Attendance開始・終了だけである。raw history、event ID、correction reason、request snapshot、idempotency data、actor ID、Branch authorization IDは返さない。

初回migration適用後のQAで`branch_id`が返却projectionに不要と判明したため、適用済みmigrationは書き換えず、追補migrationでreturn contractから除去した。

### Single policy source

Admin readerはDBから安全なcanonical factsを取得し、OCV1-04Bの既存`deriveJourneyState`で状態を計算する。Wake 15分、Departure 10分、Arrival 5分のgrace、open window、not-required、supersede、terminal判定をAdmin UI / SQLへ複製していない。

## 3. Derivation and priority

- Wake: `planned_wake_at`が存在し、frozen threshold超過後だけ生成
- Departure: `planned_departure_at`が存在し、Wake欠落とは独立して判定
- Arrival: `meeting_at ?? starts_at`をtargetに使用
- recorded factは該当Attentionを解消
- Arrivalまたは`start_work`は既存canonical ruleに従い、未報告のWake / Departureをsupersede
- `start_work`はArrival factを作らないが、未報告Arrivalを`missing_superseded`として閉じる
- terminal Assignment、cancelled Shift、Shift終了後は生成しない

severityはArrivalをcritical、DepartureはArrival target到達後critical、それ以前のDepartureとWakeをhighとした。既存open Incident/SOSは引き続き最優先で、journey Attentionから独立する。IDは`${type}:${assignmentId}`で、同一Assignment/typeは一意かつ順序はdeterministicである。

## 4. Admin UX

### Attention Center / Dashboard

既存queueとDashboardへ起床・出発・到着を追加した。表示内容はWorker、Project、Workplace、予定時刻、超過分、severity、既存Shift day-of詳細への安全な導線である。summaryの「当日」はjourney 3種と既存勤務開始系Attentionを集計する。

### Day-of Operations

既存Day-of listの要確認理由へjourney cueを追加した。複数cueはArrival → Departure → Wake順で表示する。drawerには各予定時刻と超過分、およびcanonical Worker報告で自動解消する説明を表示する。Incident、Attendance、Pre-shift、Placement表示は維持した。

## 5. Security and isolation

- Adminにjourney occurrence作成commandを追加していない
- Worker impersonationなし
- Admin correction UIなし
- 既存`void_assignment_journey_event`だけがcorrection boundaryのまま
- direct journey history readなし
- Attendance / Assignment / Placement mutationなし
- Notification / LINE / reminder送信なし
- service-role product runtimeなし

## 6. Verification

### Focused and DB evidence

| Verification | Result |
|---|---|
| Admin journey derivation / ordering / coexistence | **PASS — 19 assertions** |
| Admin journey DB/RLS/read projection | **PASS — 13 assertions** |
| Existing Attention Center | **PASS — 17 assertions** |
| Existing Day-of rules | **PASS — 17/17** |
| OCV1-04A journey facts | **PASS — 52/52** |
| OCV1-04B journey projection | **PASS — 23/23** |
| OCV1-05 journey rules | **PASS — 26/26** |
| OCV1-05 journey UI/action contract | **PASS — 13/13** |
| Worker Attendance | **PASS — 40/40** |
| Pre-shift RLS / monitor | **PASS — 16/16 / PASS** |
| Operational Incident | **PASS — 47/47** |
| Candidate Assignment | **PASS — 31/31** |
| DB lint (`public,private`, warning fail) | **PASS — 0 issues** |
| local security advisor | **PASS — 0 issues** |
| focused ESLint | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| production `next build` | **PASS** |
| `git diff --check` | **PASS** |

Focused cases include threshold boundary、overdue、recorded removal、not_required、missing WakeとDeparture独立判定、Arrival / `start_work` supersede、terminal / cancelled、ArrivalとAttendance分離、Manager own/foreign Branch、System Admin、Worker/anon/service_role denial、Incident coexistence、複数Assignment、stable identity/orderを含む。

## 7. Authenticated Chrome QA

既存業務ユーザーのpasswordを変更せず、既存local-only service-role fixture規約で専用ManagerとWorker Auth userを作成した。専用Worker/profile、Manager profile/Branch access、Shift、Assignment、Pre-shift confirmationだけを作成した。service-roleはfixture setup/cleanupだけに使用し、browser/product runtimeへ渡していない。

確認結果:

- Attention CenterにWake / Departure / Arrivalの3項目が別々に表示
- Arrivalと、Arrival targetを越えたDepartureはcritical、Wakeはhigh
- 各項目にWorker、現場、予定時刻、超過分、既存day-of導線を表示
- Day-of listに`到着 / 出発 / 起床`の要確認理由を表示
- Day-of drawerに3種の予定・超過分・自動解消説明を表示
- drawer open時に閉じるbuttonへfocus
- keyboard TabでAdmin focus移動を確認
- Worker UIからWakeをcanonical commandで記録後、Admin Attention再読込でWakeだけが消え、Departure / Arrivalは残存
- DB evidence: journey `wake recorded` 1件、Attendance event 0件
- console error / warning、React error、hydration error: 0

| Viewport | Attention overflow | Day-of overflow | Result |
|---|---:|---:|---|
| 1440x900 | 0px | 0px | PASS |
| 1280x900 | 0px | 0px | PASS |
| 390x844 | 0px | 0px | PASS |

QA後はviewport overrideを解除した。専用fixture cleanupはdomain rows 5件、Auth users 2件を削除し、dedicated fixture remainderは**0**だった。既存business fixtureは変更・削除していない。

## 8. Explicit non-changes

- journey state machine / Assignment lifecycle追加なし
- generic alert/event tableなし
- persisted Attention / manual resolve commandなし
- Worker journey UI変更なし
- AdminによるWorker occurrence作成なし
- correction semantics変更なし
- Attendance `start_work`とArrivalの統合なし
- Placement、Pre-shift、Incident contract変更なし
- Reminder scheduler、Notification、LINEなし
- package変更なし
- remote Supabase操作、`db reset`、`db push`、`--linked`なし
- commit / pushなし
- `.tmp-notif-2c-local.*`は編集対象にしていない

## 9. Completion decision

Adminはauthorized scope内で、未報告Wake / Departure / Arrivalをexception-firstに確認できる。項目はcanonical Worker factだけを正本として自己解消し、既存Incident / Attendance / Assignment contractを再解釈しない。DB/RLS、browser、responsive、regression、static/build checksが通過したため、**OCV1-06: COMPLETE**と判定する。
