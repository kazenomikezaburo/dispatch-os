# Phase DB-2.8C.2 実装結果

## Executive Summary

- Status: COMPLETE。
- Resolver: `public.resolve_in_app_notification_source_context(uuid)`。
- Migration: `20260910060802_safe_notification_source_context_resolver.sql` をLocal Supabaseへincremental apply。
- Source navigation contract: own Notification IDから、現在も所有するAssignment IDだけを安全に返せる。
- UI-2.8D: READY TO RESUME。

## Security Contract

- Caller: authenticated active Workerのみ。
- Input: `p_notification_id uuid`のみ。Assignment、Incident、event、recipient、Worker、routeはclient入力にしない。
- Recipient authorization: resolver内部でNotificationの `recipient_profile_id = auth.uid()` を必須にする。
- Internal source resolution: Notification → Incident Event → Incident → AssignmentをDB内部でのみjoinする。
- Assignment authorization: recipient一致とは別に、既存 `private.worker_owns_assignment(assignment_id)` で現在のactive Worker ownershipを再評価する。
- Supported source: Notification typeとevent typeの両方がIncident acknowledged/resolved contractに一致する場合だけ解決する。
- Safe failure: foreign、nonexistent、stale、ownership喪失、type/event不整合、欠損relationは共通の `{ok:true, source_available:false, assignment_id:null}`。
- Non-Worker authenticated caller: non-disclosing `NOT_FOUND`。
- Null/unauthenticated input: `INVALID_INPUT`。anon/PUBLICは実行権限境界で拒否される。
- Resolverはread-onlyで、Notification `read_at`、Incident、Assignmentを変更しない。

## Privilege Model

- Mode: `SECURITY DEFINER`、STABLE。
- Reason: WorkerへIncident Event SELECTを与えず、内部relationをresolver内だけで解決するため。
- Privileged boundary: internal joinだけに使用し、recipient ownershipとAssignment ownershipを関数内で明示的に再検証する。
- Owner: `postgres`。
- `search_path`: `''`。
- Object references: schema-qualified。
- PUBLIC EXECUTE: revoke。
- anon EXECUTE: revoke。
- service_role EXECUTE: explicit revoke。
- authenticated EXECUTE: grant。ただしactive Worker判定が関数内部で必須。
- Worker向けIncident Event SELECT policy: 追加なし。

## Data Exposure

Returned:

- `ok`
- `source_available`
- `assignment_id`（authorized success時のみ）
- stable error `code`（invalid/non-Workerの場合のみ）

Intentionally hidden:

- `source_incident_event_id`
- Incident ID、message、category、state
- event type/version/request snapshot
- actor profile/role
- recipient/Worker ID
- internal metadata、route/path
- Project/Job/Workplace等の追加context

UIは返されたAssignment IDから既存Worker Assignment read contractを使い、canonical `/worker/assignments/[assignmentId]` を生成できる。

## Tests

### Resolver security: 18/18 PASS

- canonical Incident lifecycleとprojectionでfixtureを作成
- own Notification → own Assignment解決
- exact minimal result fields
- Incident internal ID/payload非露出
- foreign Worker拒否
- foreign/nonexistent同一結果
- Manager拒否
- System Admin拒否
- null input contract
- Notification所有済みでもAssignment ownership喪失時はunavailable
- type/event不整合はsafe unavailable
- resolver read-only、mark-read副作用なし
- PUBLIC/anon EXECUTE拒否、authenticatedのみ
- anon direct execution拒否
- exact UUID signature、JSON return、STABLE、owner、security definer、empty search path
- WorkerのIncident Event direct SELECTは引き続き0 rows
- Worker Incident Event policy追加なし
- dedicated fixture cleanup 0件

### Existing regression

- Worker In-app Notification: 40/40 PASS。
- Operational Incident: 47/47 PASS。
- Worker Help Request UI: 18/18 PASS。
- Admin Incident UI: 19/19 PASS。
- Day-of: 17/17 PASS。
- Attendance UI: PASS。
- Pre-shift monitor: PASS。
- Placement: 39/39 PASS。
- Placement editor: 13/13 PASS。
- Placement security: 28/28 PASS。

## DB Lint

- warning: 0。
- error: 0。
- `No schema errors found`。

## Changes

- `supabase/migrations/20260910060802_safe_notification_source_context_resolver.sql`
- `scripts/integration/notification-source-context-test.mjs`
- `docs/db-2.8c.2-safe-notification-source-context-resolver-result.md`

## Explicit Non-Changes

- Worker UI: 0。
- React route/component/Server Action/read helper: 0。
- Notification/Incident tables・columns・FK・RLS: unchanged。
- Worker Incident Event SELECT policy: unchanged。
- Existing Notification projection/mark-read/reconciliation: unchanged。
- service role usage: 0。
- Auth changes: 0。
- package changes: 0。
- Realtime/polling/external delivery: 0。
- remote changes / `db push` / `db reset`: 0。
- commit/push: 0。
- 既存未commit作業は保持。

## UI-2.8D Readiness

UI側は次の安全なflowを利用可能になった。

```text
own Notification ID
  -> recipient ownership check
  -> internal source resolution
  -> current Assignment ownership check
  -> assignment_id or safe unavailable
```

Source CTAは `source_available=true` のときだけ `/worker/assignments/{assignment_id}` を生成し、falseならdisabled safe stateにできる。Notification list/detailとmark-readのDB契約は既存のまま利用する。

DB-2.8C.2: COMPLETE

UI-2.8D: READY TO RESUME
