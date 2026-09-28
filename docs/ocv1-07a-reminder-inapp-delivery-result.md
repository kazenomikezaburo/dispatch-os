# OCV1-07A Reminder Scheduler & In-App Delivery Result

**OCV1-07A: COMPLETE**

## 1. Result

Canonical Worker factsから、勤務前確認・起床・出発・到着のReminderをboundedなserver-side evaluatorで判定し、既存`public.in_app_notifications`へ重複なく配信できるようにした。新しいNotification store、外部チャネル、Realtime、product UI polling、production scheduler infrastructureは追加していない。

実装migrationは`20260928081416_ocv1_reminder_scheduler_inapp_delivery.sql`で、local Supabaseへ適用して検証した。remote Supabaseには接続・変更していない。

## 2. Existing Notification audit and reuse

既存の正本は次のまま維持した。

- Notification store: `public.in_app_notifications`
- Worker read boundary: 既存recipient RLSとbounded Worker projection
- Read state: 既存のserver-time mark-read command
- Source navigation: type-specific safe resolver
- Pre-shift manual delivery: 既存`pre_confirmation_reminder` command / occurrence model
- Cooldown: 同一Assignment・同一Reminder typeの直近15分

既存typeを別の意味に流用せず、V1 journeyに必要な最小3 typeだけを追加した。

- `wake_reminder`
- `departure_reminder`
- `arrival_reminder`

`approaching` / `overdue`はNotification typeではなく、同一type内のlogical occurrence phaseである。`pre_confirmation_reminder`は既存typeを再利用する。

## 3. Canonical reminder semantics

`private.worker_journey_timing_policy()`がscheduler内で用いるjourney policyを一箇所に集約する。値はOCV1-04A/04B/06の既存contractと同一である。

| Reminder | approaching開始 | overdue開始 | canonical suppression |
|---|---:|---:|---|
| Pre-shift Confirmation | 東京日付でShift前日00:00 | phase分割なし | Confirmationあり、Shift開始後、terminal/cancelled |
| Wake | planned wakeの6時間前 | due + 15分 | Wake記録、Arrivalによるsupersede、terminal/cancelled |
| Departure | planned departureの2時間前 | due + 10分 | Departure記録、Arrivalによるsupersede、terminal/cancelled |
| Arrival | `meeting_at ?? starts_at`の3時間前 | due + 5分 | Arrival記録、Attendance `start_work`によるsupersede、Shift終了、terminal/cancelled |

Wake / Departureはauthorized planがない場合は`not_required`であり、Reminder対象にしない。AttendanceはArrivalのsupersede判定にのみ使い、Arrival factを生成・変更しない。時刻判定には呼出し側の時刻やbrowser timeを使わない。

## 4. Scheduler and occurrence contract

`private.evaluate_worker_reminders(p_now, p_limit)`をtrusted server-side evaluation boundaryとして追加した。

- default 100、最大500のbounded batch
- set-based evaluationでAssignmentごとのN+1なし
- Assignment、Shift、Worker/Profile、Confirmation、latest journey version、Attendanceをcanonical inputとして使用
- active recipient、active Assignment、non-cancelled Shiftのみ対象
- 同一`assignment + reminder_type + phase`を一つのlogical occurrenceとしてunique化
- 初回評価が既にoverdueならapproachingを遡及生成せず、現在phaseのみ生成
- 同一Assignment/typeの15分cooldownを適用
- 既存Admin pre-confirmation occurrenceもscheduler側cooldown判定へ含める
- retry / concurrent runはunique制約とatomic insertで同じ結果へ収束

`private.scheduled_worker_reminder_occurrences`はimmutable delivery occurrence ledgerであり、Notification本文や汎用JSON payloadの代替storeではない。runtime roleにはSELECT/INSERT/UPDATE/DELETEを付与せずRLSを有効化した。Notificationとoccurrenceはdeferred FKで相互に結び、片側だけのwriteをcommitできない。

production cronは構成していない。V1 production invocation cadenceと運用主体は別phaseで明示的に決める。

## 5. Notification safety and Worker delivery

通知本文はtypeごとの固定titleとserver-derived summaryだけで、source full bodyやauthorization情報を保存しない。Notification rowが保持するのは既存architectureに沿ったstable occurrence identityだけである。

Worker navigationには`resolve_worker_journey_reminder_source_context(notificationId)`を追加した。resolverは現在も本人が所有するAssignmentである場合に限り`assignment_id`を返す。返却値にWorker ID、他勤務、journey event/version ID、Attendance ID、Branch ID、actor、idempotency key、credential、correction reason、internal authorization detailは含まれない。sourceが削除・移管・unauthorizedになった場合は既存と同じsafe unavailableとなる。

既存pre-confirmation resolverは、Admin明示送信とscheduler送信の両sourceを同じsafe contractで解決する。Worker inboxには新typeの表示labelを追加し、既存Assignment detail CTAを再利用した。新しいWorker mutation capabilityはない。

## 6. Security boundary

- evaluator / timing policy / occurrence ledgerは`private` schema、runtime EXECUTE/DML grantなし
- public resolverは`SECURITY DEFINER`、`search_path = ''`、schema-qualified object、`authenticated`のみEXECUTE
- Workerは既存Notification RLSにより自分のrecipient snapshotだけ読める
- Manager/System AdminへWorker Notification contentのSELECT権限を追加していない
- `service_role`をproduct runtime pathへ追加していない
- foreign Assignment/Branch、inactive Worker、missing sourceは非開示でskipまたはsafe unavailable
- historical Notificationはcanonical state解消後も削除・更新しない

## 7. Verification evidence

### OCV1-07A focused DB/RLS

`scripts/integration/worker-reminder-scheduler-test.mjs`: **28/28 PASS**。

確認内容: pre-shift / Wake / Departure / Arrival、before-threshold、approaching、overdue、duplicate run、cooldown、completion suppression、downstream supersede、terminal/cancelled、multiple Assignments、cross-midnight、recipient isolation、foreign Worker、Manager privilege非拡張、safe resolver、anon denial、immutable history、専用fixture cleanup。

Dedicated fixture remainder: **0**。

### Regression

| Suite | Result |
|---|---:|
| Pre-confirmation reminder projection | 27/27 PASS |
| In-app Notification domain | 40/40 PASS |
| Notification source context | 18/18 PASS |
| Worker Notification inbox rules | 25/25 PASS |
| Worker journey facts | PASS |
| Worker journey projection | 23/23 PASS |
| Worker journey rules | 26/26 PASS |
| Worker journey experience | 13/13 PASS |
| Admin journey Attention DB | 13/13 PASS |
| Admin journey Attention rules | 19/19 PASS |
| Incident Notification integration | 16/16 PASS |
| Pre-shift rules | 20/20 PASS |
| Pre-shift RLS | 16/16 PASS |
| Attendance confirmation | 50/50 PASS |
| Worker Attendance | 40/40 PASS |

### Static, build, database advisor

| Check | Result |
|---|---|
| focused ESLint | PASS, 0 errors |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS, Next.js 16.3.1 production build |
| local DB lint (`public,private`, fail on warning) | PASS, no schema errors |
| local security advisor | PASS, 0 issues |
| `git diff --check` | PASS |

## 8. Explicit non-changes

- LINE、email、push、webhookなど外部deliveryなし
- production cron / hosting scheduler設定なし
- Realtime / pollingなし
- Notification storeの追加なし
- generic event store / generic JSON payloadなし
- Assignment、Placement、Attendance、Incident、Attentionのmutation/contract変更なし
- WorkerによるReminder生成、recipient/Branch/時刻指定なし
- historical Notificationの自動削除・解決済み化なし
- package変更なし
- remote Supabase変更なし

## 9. Next implementation implication

次phaseはこのprivate evaluatorをtrusted server contextから定期実行する運用境界とcadenceを選べる。外部チャネルを追加する場合も、eligibilityを再実装せず、このcanonical occurrence / Notification projectionをdelivery sourceとして扱う。LINE等のURLにはauthorization-sensitive payloadを埋めず、既存safe source resolutionをentry pointにする。
