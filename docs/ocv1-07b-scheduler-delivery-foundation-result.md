# OCV1-07B Trusted Scheduler Invocation & Delivery Foundation Result

**OCV1-07B: COMPLETE**

## 1. Result

OCV1-07Aの`private.evaluate_worker_reminders(...)`を、Supabase Postgres内のtrusted `pg_cron` jobから毎分実行するproduction-style boundaryへ接続した。HTTP endpoint、browser invocation、service-role key、Edge Function、Vercel Cronは追加していない。

実装migrationは`20260928095623_ocv1_trusted_reminder_scheduler.sql`で、local Supabaseへ適用して検証した。remote Supabaseは変更していない。

## 2. Deployment / runtime audit

実装前のrepositoryには次が存在しなかった。

- `vercel.json`またはhosting cron設定
- Supabase Edge Function
- scheduler用Route Handler / Server Action
- `CRON_SECRET`等のscheduler secret
- `pg_cron` migration / job

Next.js applicationはDockerfileと通常のApp Router構成で、product runtimeはcookie-based Supabase clientを使う。schedulerのためだけにHTTP surfaceやprivileged clientを増やす根拠はなかった。

Supabase hosted platformがPostgres functionを直接実行でき、job/run statusをDB内で記録する`pg_cron`を提供するため、database-local invocationを採用した。これによりnetwork、HTTP auth、service-role secret、client bundleとの接点を作らずに済む。

## 3. Trusted invocation boundary

追加した`private.run_worker_reminder_scheduler(p_limit default 100)`だけがcron entry pointである。

- owner: `postgres`
- `SECURITY DEFINER`
- `search_path = ''`
- statement timeout: 45秒
- batch: default 100、許容範囲1..500
- `PUBLIC` / `anon` / `authenticated` / `service_role`: EXECUTE不可
- browser向けRoute、Action、RPCなし
- fixed advisory transaction lockにより同時runは`skipped_concurrent`
- eligibility、threshold、cooldown、lifecycle判定は実装せず、07A evaluatorを1回呼ぶだけ

07A evaluatorのunique logical occurrence、cooldown、atomic Notification insertが引き続きdelivery idempotencyの正本である。wrapper retryや複数schedulerの競合で新しい意味は生じない。

## 4. Cadence

V1 cadenceは単一jobの**毎分1回**とした。

```text
job: opscue-worker-reminders-v1
schedule: * * * * *
command: select private.run_worker_reminder_scheduler(100);
```

Pre-shift Confirmation、Wake、Departure、Arrivalごとのcronは作らない。毎分jobはbusiness timingを持たず、「現在のcanonical evaluatorを呼ぶ」だけである。exact threshold、approaching / overdue、15分cooldownは07Aが所有する。

1分cadenceはV1 day-of actionの遅延を最大約1分に抑えつつ、45秒timeoutとadvisory lockでoverlapを制御できる。batchが常時上限へ達する場合は、eligibilityを複製せずbatch/capacity運用を見直す。

## 5. Run evidence and failure handling

`private.worker_reminder_scheduler_runs`をscheduler専用の最小run ledgerとして追加した。保存するのは次だけである。

- run ID
- invoked/completed server timestamp
- outcome: `succeeded` / `failed` / `skipped_concurrent`
- evaluated count
- projected Notification count
- failure時のSQLSTATEのみ

Worker、Assignment、Branch、Notification body、payload、SQL error messageは保存しない。tableはRLS enabledで、runtime roleにtable privilegeはない。

正常runは07A evaluatorの`evaluated` / `projected`を記録する。evaluator exceptionはsubtransactionをrollbackし、partial Notificationを残さず、sanitized `EVALUATION_FAILED` responseとSQLSTATEを記録する。次回cronは通常どおりretryする。wrapper自体やDB接続が失敗した場合は`cron.job_run_details`がplatform-level failure evidenceとなる。

## 6. External delivery foundation for OCV1-07C

07Cのexternal delivery consumerは、**既に作成済みのcanonical `in_app_notifications` row / scheduled occurrenceだけ**を入力とする。

Delivery consumerが行ってよいこと:

1. trusted server contextで未配信Notificationをclaimする
2. Notification recipientからserver-sideでprovider destinationを解決する
3. controlled title/summaryとsafe entry URLを送る
4. provider resultをdelivery state / attemptとして記録する
5. retryable failureだけをbounded backoffで再試行する

Delivery consumerが行ってはいけないこと:

- Reminder due判定
- approaching / overdue phase判定
- cooldown判定
- Assignment、Worker eligibility、terminal/supersede判定
- Notification本文の再構成
- Notification read stateの変更
- external failureを理由とするNotification削除

このphaseではprovider callもdelivery attemptも存在しないため、未使用のoutbox/status schemaは追加しなかった。07Cで実送信を導入するときに初めて、最低限以下を追加する。

- Notificationごとの一つのV1 external delivery state: `pending` / `delivered` / `retryable_failure` / `terminal_failure`
- Notification + channelのunique identityによる二重送信防止
- immutable delivery attempt rows（attempt timestamp、controlled provider result code、次回retry可否）
- bounded claim / leaseとserver-time retry schedule

これは汎用multi-provider frameworkにはせず、07Cで選択された実チャネルに必要な範囲だけ実装する。

## 7. Safe deep-link pattern

現在利用可能な安全なentryは認証必須の`/worker/notifications`である。07Cでdirect entryが必要なら、想定patternは次である。

```text
/worker/notifications/[opaqueNotificationId]
  -> login/session check
  -> own-recipient Notification read
  -> existing type-specific safe source resolver
  -> authorized Assignment detail or safe unavailable
```

URLに使用できるのはopaque Notification identityまでとし、Worker ID、Branch ID、Assignment metadata、journey event/version ID、authorization scopeを含めない。このrouteは07Bでは実装していない。

## 8. Security result

- scheduler endpointなし、anonymous HTTP surfaceなし
- cronはDB内でprivate wrapperを直接実行
- browser / Worker / Manager / System Admin / anon / service_roleからwrapper実行不可
- scheduler secretなし、client bundleへのsecret露出なし
- private run ledgerはRLS enabled、runtime DML/SELECTなし
- 07A Notification RLS / source resolverを変更していない
- reminder semantics、Assignment、Journey、Attendance、Attentionを変更していない

## 9. Verification

### OCV1-07B focused

`scripts/integration/worker-reminder-scheduler-invocation-test.mjs`: **22/22 PASS**。

確認内容:

- every-minute production job registration
- QA専用short cadenceによる実pg_cron invocation
- empty / repeated invocation
- maximum batch 500と501 fail-closed
- advisory-lock concurrent skip
- canonical Notification creation / duplicate suppression
- forced evaluator failure、partial rollback、sanitized failure evidence、retry success
- runtime/anon/authenticated denial
- run ledger RLS/grant
- browser/product bundleにscheduler call・secretなし
- cron commandにeligibility duplicationなし
- dedicated fixture / manual run evidence cleanup 0
- QA後のproduction-style cron active

### Regression

| Suite | Result |
|---|---:|
| OCV1-07A scheduler | 28/28 PASS |
| In-app Notification | 40/40 PASS |
| Pre-confirmation reminder | 27/27 PASS |
| Worker Notification inbox | 25/25 PASS |
| Worker journey facts | PASS |
| Worker journey projection | 23/23 PASS |
| Worker journey rules | 26/26 PASS |
| Worker journey experience | 13/13 PASS |
| Admin journey Attention DB | 13/13 PASS |
| Admin journey Attention rules | 19/19 PASS |
| Incident Notification | 16/16 PASS |
| Pre-shift rules | 20/20 PASS |
| Pre-shift RLS | 16/16 PASS |
| Attendance confirmation | 50/50 PASS |
| Worker Attendance | 40/40 PASS |

### Static / database

| Check | Result |
|---|---|
| focused ESLint | PASS, 0 errors |
| `npx tsc --noEmit` | PASS |
| Next.js production build | PASS |
| local DB lint (`public,private`, fail on warning) | PASS, no schema errors |
| local security advisor | PASS, 0 issues |
| `git diff --check` | PASS |

## 10. Explicit non-changes

- LINE API / webhook / provider credentialsなし
- Edge Function / HTTP scheduler endpointなし
- service-role product runtimeなし
- external delivery outbox / attempt schemaなし
- Worker-facing route/UI変更なし
- reminder eligibility / timing / cooldown変更なし
- Notification read state変更なし
- Realtime / browser pollingなし
- package変更なし
- remote Supabase変更なし
- commit / pushなし
