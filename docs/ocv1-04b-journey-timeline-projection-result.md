# OCV1-04B — Journey Scheduling & Shift Timeline Projection Result

Status: **OCV1-04B: COMPLETE**

実施日: 2026-09-27  
対象: local repository / local Supabase only

## 1. Result

既存の canonical facts を変更せず、次の read model を構成した。

```text
Assignment
+ immutable Pre-shift Confirmation (planned Wake / Departure)
+ latest Wake / Departure / Arrival version
+ Attendance start_work / end_work
+ Placement context
+ Incident
→ read-only Shift Timeline
→ deterministic journey nextAction
```

Timeline rowや汎用event storeは追加していない。Wake / Departure / ArrivalのfactはOCV1-04Aの`assignment_journey_event_versions`だけを使用する。

## 2. Planned Wake / Departure decision

既存の`pre_shift_confirmations`には`planned_wake_at`と`planned_departure_at`が既に存在し、Workerの通常フローは確認を一度だけINSERTするimmutable contractだった。このためcompanion tableは作らず、同じ確認INSERTへ任意の予定時刻を加えた。

- 値は予定入力であり、Wake / Departure発生、通知受信、勤怠確認を意味しない。
- defaultは作らない。未入力は`null`のまま保持し、それぞれ`not_required`とする。
- Worker identity、Assignment、Branch、現在時刻、到着targetはserver/DBで決定する。
- DB server timeより後、かつ`meeting_at ?? starts_at`以下であることを検証する。
- 両方がある場合は`planned_wake_at <= planned_departure_at`を要求する。
- 既存確認のUPDATEは許可せず、重複確認も拒否する。
- 既存のWorker直接INSERT contractは維持し、同じ予定時刻validation triggerを通す。通常product pathは狭いRPCを使用する。

## 3. Persistence and command boundary

追加migration:

- `20260927071949_ocv1_worker_journey_projection.sql`
  - `submit_own_pre_shift_confirmation(...)`
  - `get_own_assignment_journey_facts(uuid[])`
- `20260927072901_ocv1_preserve_pre_shift_insert_contract.sql`
  - 既存Worker INSERT policy/grantの維持
  - direct INSERTにも同一予定時刻規則を適用するprivate trigger

両RPCは`SECURITY DEFINER`、`search_path = ''`、schema-qualified object、`authenticated`限定EXECUTEである。`PUBLIC`、`anon`、`service_role`にはproduct command/read grantを与えていない。

## 4. Worker-safe current state reader

`get_own_assignment_journey_facts`は最大50 Assignment IDのbounded readで、active authenticated Worker自身のAssignmentだけを返す。各journey typeは `(assignment_id, journey_type)` の最大versionだけを読む。

- latest `recorded`: current factあり
- latest `voided`: current factなし
- operation、occurredAt、timeliness以外のjourney内部情報は返さない
- request snapshot、correction reason/actor、event/Assignment以外のinternal ID、他Worker/他Assignment情報は返さない
- `generated_at`はDB `statement_timestamp()`であり、browser timeを判断に使わない

server-side projectionは次を一元的に導出する。

- `not_required`
- `scheduled`
- `not_open`
- `actionable`
- `overdue`
- `completed`
- `completed_late`
- `missing_superseded`
- `closed`

固定window/grace値は`lib/worker/journey/worker-journey.ts`に集約し、UI componentへ重複hard-codeしていない。

## 5. Timeline projection

Worker勤務詳細にread-only Timelineを追加した。表示項目はsafeな`type`、`occurredAt`、`effectiveAt`、`state`、`sourceCategory`、`label`、`actionable`、認可済み画面内navigation targetへ正規化する。

構成source:

- Assignment lifecycle
- Placement label context
- Pre-shift Confirmation
- Wake / Departure / Arrival
- Attendance `start_work` / `end_work`
- Incident / Help Request
- completion / cancellation

Timeline参照からsourceへの追加権限は発生しない。Worker detail loaderが元から許可されたown Assignment sourceだけを読み、Timeline自体は永続化しない。

## 6. Deterministic nextAction

1 Assignmentにつきprimary journey actionは最大1件とし、次の順で決定する。

1. Pre-shift Confirmation
2. Wake（requiredの場合）
3. Departure（requiredの場合）
4. Arrival

`not_required`はskipする。Arrivalまたは`start_work`等のcanonical downstream evidenceがある場合、先行する未報告actionは`missing_superseded`となりprimary actionから除外する。cancelled/terminal Assignmentは`closed`でactionなしとする。

Worker Homeの複数Assignmentは、actionable/overdue、journey precedence、due time、Shift start、Assignment IDの順で安定比較する。Homeと詳細は同じprojectionを使用し、Home取得はAssignment ID配列を1回のRPCへ渡すためper-Assignment N+1を作らない。

### Attendance boundary

`start_work` / `end_work`はformal attendance factとしてTimelineに表示するが、journey `nextAction`へ統合しない。既存勤怠CTAは既存attendance contractのまま別表示とした。Arrivalを`start_work`へ読み替えず、どちらかを自動生成することもない。

## 7. UI

- 前日確認formに任意の起床予定・出発予定を追加
- 送信後はcanonical confirmationを再読込して表示
- 勤務詳細にcurrent journey state、Timeline、次に必要なActionを追加
- Worker Homeに同じdeterministic nextActionを表示し、優先順を反映
- 表示時刻はAsia/Tokyo

local authenticated Worker browserで専用fixtureを使用し、未確認detail、任意予定入力、confirmation送信、TimelineのWake actionへの更新、Home反映、keyboard操作、横overflow 0、console/React/hydration error 0を確認した。fixtureは確認・Assignment・Shiftの3行を削除し、journey eventは0件だった。

## 8. Verification

| Verification | Result |
|---|---|
| OCV1-04B DB/RLS projection | **23/23 PASS** |
| current state / Timeline / nextAction rules | **22/22 PASS** |
| OCV1-04A journey facts regression | **52/52 PASS** |
| Pre-shift RLS | **16/16 PASS** |
| Worker Attendance | **40/40 PASS** |
| Worker Pre-shift flow | **PASS** (including concurrency, foreign Worker, Manager/Admin denial, batched Home read) |
| Incident | **47/47 PASS** |
| Worker Application | **26/26 PASS** |
| Candidate Assignment | **31/31 PASS** |
| DB lint (`public,private`, warning fail) | **PASS — 0 issues** |
| local security advisor | **PASS — 0 issues** |
| focused ESLint | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| production `next build` | **PASS** |
| `git diff --check` | **PASS** |

OCV1-04A regression fixtureでは、`clock_timestamp()`を複数回評価して開始時刻と集合時刻を同値にしようとしたためマイクロ秒差で既存check constraintに抵触する不安定性を修正した。また過去時点のlate factを再現するfixture INSERTだけはvalidation triggerを一時的に抑止し、product runtimeの予定時刻validationは維持した。

## 9. Explicit non-changes

- OCV1-04A journey table、record/void command、version semanticsは変更していない。
- generic Timeline table/event storeは作成していない。
- Assignment journey statusは追加していない。
- ArrivalとAttendanceは統合していない。
- Placement、Incident、Notification、Attentionのcontract/mutationは変更していない。
- Admin-created Worker occurrenceは追加していない。
- Manager/System Admin向けの新画面・新readerは追加していない。今回のconsumerはWorker own projectionだけであり、既存Admin readerを変更する必要がなかった。
- LINE、Notification、Attention連携は実装していない。
- package変更、remote Supabase操作、commit、pushは行っていない。
- `.tmp-notif-2c-local.*`は編集対象にしていない。

## 10. Completion statement

Canonical OpsCue factsを第二のsource of truthなしでread-only Timelineとdeterministic journey nextActionへ投影できる。planned Wake / Departureはimmutable Pre-shift Confirmationに安全に入力され、Wake / Departure / Arrivalのactual fact、formal Attendance、Incidentはそれぞれ独立した正本のまま維持されている。
