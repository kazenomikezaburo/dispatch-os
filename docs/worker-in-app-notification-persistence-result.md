# Phase DB-2.8C 実装結果

## Executive Summary

- Migration: `20260910051738_worker_in_app_notification.sql` を Local Supabase に incremental apply。既存 migration の変更、`db reset`、`db push`、remote 操作は 0。
- Notification table: `public.in_app_notifications` を追加。
- Projection receipt: `private.incident_notification_projection_receipts` を追加し、生成・terminal skip を event 単位で確定。
- Projection command: `public.project_incident_in_app_notification(uuid)`。入力は Incident event ID のみ。
- Mark-read: `public.mark_in_app_notification_read(uuid)`。所有 Worker の first-read のみを server timestamp で確定。
- Reconciliation: activation watermark 以後の未処理 `acknowledged` / `resolved` event を最大 100 件、keyset 順で発見する private primitive を追加。
- Security: RLS、最小 GRANT、hardened `SECURITY DEFINER`、branch/role/ownership の再判定を実装。
- Idempotency: receipt PK、notification unique、source event row lock により sequential/concurrent replay を一件へ収束。
- UI / Incident integration: 変更 0。trigger、scheduler、Realtime、external delivery も追加していない。

## Sources / Git / Environment

- SOT: `docs/worker-in-app-notification-domain-design-v1.md`、`docs/notification-announcement-boundary-discovery-v1.md`。
- Incident DB: `docs/operational-incident-persistence-result.md` と `20260909071755_operational_incident_persistence.sql`。
- Actual schema: `profiles.id/account_type/is_active`、`workers.auth_profile_id/status`、Assignment branch helper、Incident event/RPC の `event_id` contract を実装前に確認。
- Branch: `small-ui-a11y-fix`。
- 開始時 dirty: 上記 DOMAIN-2.8A / DOMAIN-2.8B doc 2件のみ。内容を変更せず保持。
- `.env.local`: 変更 0。Auth mutation、package change、commit、push は 0。
- Supabase CLI: local v2.115.0。Local DB のみを使用。

## Migration / Notification Table

- `id`: UUID、`gen_random_uuid()`。
- `recipient_profile_id`: `profiles(id)`、NOT NULL、`ON DELETE CASCADE`。
- `source_incident_event_id`: `operational_incident_events(id)`、NOT NULL、`ON DELETE RESTRICT`。
- `notification_type`: `incident_acknowledged` / `incident_resolved` の exact check。
- `title`: trim 済み 1..120、`summary`: trim 済み 1..240。
- `read_at`: NULL または `created_at` 以後。`created_at` は server default。
- Unique: `(source_incident_event_id, recipient_profile_id)`。
- Index: recipient history `(recipient_profile_id, created_at DESC, id DESC)` と同じ順序の unread partial index。
- `state`、`updated_at`、JSON payload、delivery、priority/severity、archive/delete、worker/assignment/incident/branch/manager の重複列はない。
- Incident message/category/actor/contact/location/health detail はコピーしない。保存 content は event type ごとの固定文のみ。

## Projection Receipt / FK Graph

- Receipt: source event PK、exact outcome、nullable notification/recipient、processed timestamp。
- Outcomes: `projected`、`skipped_no_recipient`、`skipped_inactive_recipient`。
- Shape check: projected は notification/recipient 必須、no-recipient は両方 NULL、inactive は notification NULL・recipient 必須。
- Runtime privileges: private table/function は PUBLIC、anon、authenticated から到達不可。reconciliation は service_role からも直接 EXECUTE 不可。
- Receipt は Product command から UPDATE/DELETE されない terminal record。
- FK graph verification: rollback 専用の実 PostgreSQL transaction で Profile hard-delete を実行し、Profile → Notification CASCADE → Receipt CASCADE が block せず完結することを確認した。
- Design deviation: Domain 候補の Receipt → Notification `ON DELETE RESTRICT` は Profile → Notification `ON DELETE CASCADE` と組み合わせると Profile delete を阻害する。そのためこの physical FK のみ `ON DELETE CASCADE` とした。recipient projection、terminal receipt、source event retention という business semantics は不変。Receipt recipient FK は候補どおり `ON DELETE SET NULL`、source event FK は `ON DELETE RESTRICT`。

## Projection Activation / Reconciliation

- `private.incident_notification_projection_state`: singleton activation cursor (`activation_created_at`, `activation_event_id`) を migration apply 時に確定。
- pre-feature event は activation tuple より前なので自動 discovery しない。
- `private.list_unprojected_incident_notification_events(timestamptz, uuid, integer)`: eligible event、activation 後、receipt missing のみ。
- Sort/cursor: `(created_at, id)` の昇順 keyset。batch は 1..100、それ以外も 100 に強制。
- scheduler、claim、source update、historical backfill modeはない。再実行時も receipt 済み event を除外する。

## Projection Command

- Caller: active Manager（Assignment branch access 必須）または active System Admin。Worker は `FORBIDDEN`。
- Input: `p_source_incident_event_id` のみ。recipient/type/content/actor/branch は受け取らない。
- Recipient: event → incident → assignment → worker → profile を server-side で導出。
- Eligibility: Worker active、linked Profile active、Profile role worker。
- Event: `acknowledged` / `resolved` のみ。`created` / `retracted` は `NOT_APPLICABLE` で書込み 0。
- Lock: source event row を `FOR UPDATE`。source row自体は変更しない。
- Writes: eligible 時は Notification + projected receipt を同一 transaction。account なし/inactive は terminal skip receipt のみ。
- Replay: receipt を recipient 再評価より先に返すため、later link/reactivation で過去通知を生成しない。
- Error surface: `INVALID_INPUT`、`FORBIDDEN`、`NOT_FOUND`、`NOT_APPLICABLE`、`PROJECTION_CONFLICT`。foreign scope や raw SQL detail を返さない。

| Scenario | Result | Notification | Receipt |
| --- | --- | ---: | ---: |
| acknowledged + active | projected | 1 | 1 |
| resolved + active | projected | 1 | 1 |
| replay | original terminal result | 0 additional | 0 additional |
| no account | skipped_no_recipient | 0 | 1 |
| inactive | skipped_inactive_recipient | 0 | 1 |
| created / retracted | NOT_APPLICABLE | 0 | 0 |
| foreign/unknown Manager scope | NOT_FOUND | 0 | 0 |

## Mark-read / RLS / GRANT

- Mark-read actor: active Worker only。row recipient は `auth.uid()` と一致必須。
- First read: conditional UPDATE で `now()` を一度だけ保存。既読 replay は同じ timestamp を返す。
- Concurrent calls: 一方が first write、他方が replay となり同じ `read_at` へ収束。
- Notification SELECT policy: active Worker の own recipient row のみ。
- Foreign Worker、Manager、System Admin、anon: notification content read 不可。
- authenticated: SELECT のみ grant。INSERT/UPDATE/DELETE は revoke。mark-read は table UPDATE grant を与えず RPC 経由のみ。
- Public RPC: PUBLIC/anon EXECUTE revoke、authenticated のみ grant。
- Both RPCs: `SECURITY DEFINER`、owner postgres、`search_path=''`、relation/function は schema-qualified、actor は `auth.uid()` から取得。

## Test Results

- Worker In-app Notification persistence/security/concurrency/reconciliation: **40/40 PASS**。
- Operational Incident: **47/47 PASS**。
- Worker Help Request UI rules: **18/18 PASS**。
- Admin Incident UI rules: **19/19 PASS**。
- Day-of rules: **17/17 PASS**。
- Attendance UI rules: **PASS**。
- Pre-shift monitor rules: **PASS**。
- Placement rules: **39/39 PASS**。
- Placement editor: **13/13 PASS**。
- Placement read-only security: **28/28 PASS**。
- TypeScript `npx tsc --noEmit`: PASS。
- Scoped ESLint: PASS。
- `npm run build`: PASS。sandbox 内の Google Fonts network failure 後、許可された network 実行で再確認。
- Local DB lint/security advisor: security issue 0。適用済み function の未使用変数 warning 1 は migration source から除去済み。権限・RLS warning は 0。
- FK delete graph: rollback transaction PASS。

## Test Coverage Notes

- Projection: acknowledged/resolved fixed copy、created/retracted non-applicable、sequential replay、concurrent one-item convergence。
- Account history: missing account terminal skip + later-link replay、inactive Worker terminal skip + reactivation replay。
- Security/privacy: own/foreign/admin/anon reads、direct DML privileges、RPC grants、private receipt/reconciliation denial、source fact unchanged、payload列なし。
- Reconciliation: receipt missing only、projected/skip exclusion、activation cursor、max100。
- Atomicity: linked receipt+notification、unique/shape constraints、same-transaction command writes。
- Fixture cleanup: notification、receipt、incident/event、assignment、shift の dedicated `980...` fixtures は 0 件。共有 Worker の link/status変更は同一 transaction 内で復元して commit。

## DB / Product Changes

- Added: 1 migration、2 tables + 1 activation table、2 public RPCs、1 private discovery function、RLS/policy/grants/indexes/constraints。
- Unchanged: Incident RPC、trigger、Product UI、Server Action integration、Auth、package/lockfile、Realtime publication、Announcement、external provider、remote DB。

## Limitations / Next Phase

- Exact Notification/Receipt retention period は production rollout 前の非 blocking decision。
- Worker Inbox/Bell は UI-2.8D、Incident acknowledge/resolve 後の best-effort projection integration は INT-2.8E で実施する。
- scheduler は未実装。現時点の reconciliation primitive は信頼された local/backend operator 用であり、runtime roleへ公開していない。

DB-2.8C: COMPLETE WITH NON-BLOCKING RETENTION DECISION
