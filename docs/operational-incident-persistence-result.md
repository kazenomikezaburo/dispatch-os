# DB-2.7C Operational Incident Persistence — 実装結果

## Executive Summary

- Migration: `20260909071755_operational_incident_persistence.sql`
- Root: `public.operational_incidents`
- Events: `public.operational_incident_events`
- Commands: create / acknowledge / resolve / retract の4 narrow RPC
- Lifecycle: `open -> acknowledged -> resolved` または `open -> retracted`
- Idempotency: 全command、actor + key scope、canonical request replay
- Concurrency: root/parent lock、expected version、partial unique、idempotency advisory lock
- Security: RLS + direct DML denial + authenticated-only hardened RPC
- Audit: 成功commandごとにappend-only event exactly one
- UI / Notification / Remote: 変更なし

## Sources

- Domain SOT: `docs/operational-incident-domain-design-v1.md`
- Discovery: `docs/future-operations-domain-discovery-v1.md`
- Assignment / Shift / Worker/Auth: actual `001_initial_schema.sql`
- RLS helpers: actual `002_rls_policies.sql`
- Hardening: `012_harden_database_helper_functions.sql`
- C2 pattern: `20260908064853_placement_break_atomic_command.sql`
- Supabase current guidance: RLSとDatabase Functionsの公式資料・changelogを確認。今回に影響するbreaking changeなし。

## Git State

- Branch: `small-ui-a11y-fix`
- Start HEAD: `d6c26ac feat: add day-of operations monitor`
- Existing dirty: 未追跡のDOMAIN-2.7A / DOMAIN-2.7B docsを保持
- Changed: migration、専用integration test、本結果文書
- Commit / Push: 未実施

## Environment

- Supabase CLI: local CLI v2.115.0（v2.117.0 update noticeあり、package/CLI更新は未実施）
- Local services: DB/API稼働。停止中の非対象serviceあり。
- `.env.local`: 変更なし
- Process override: 不要。local CLI statusから得たlocal endpointを使用し、secretを保存・文書化していない。
- Remote / `db push` / `db reset`: 未実施

## Migration

- File: `supabase/migrations/20260909071755_operational_incident_persistence.sql`
- Apply: `npx supabase migration up --local` で当該pending migrationのみ適用
- Existing migrations: 変更なし
- Extension: 追加なし
- Existing data impact: 新規table/function/policy/index/triggerのみ。既存row更新なし。

## Root: `operational_incidents`

- `id`: UUID PK、`gen_random_uuid()`
- `assignment_id`: NOT NULL、`assignments(id)` FK、`ON DELETE RESTRICT`
- `category`: text + 固定5種CHECK
- `message`: nullable、trim済み非空、最大500文字CHECK
- `state`: `open | acknowledged | resolved | retracted`
- `version`: bigint、初期1、1以上
- timestamps: created / acknowledged / resolved / retracted / updated
- integrity: state別timestamp nullabilityとtimestamp順序をCHECK
- update timestamp: 既存 `public.set_updated_at()` triggerを再利用
- indexes: unresolved Assignment partial unique、Assignment history、state/created Admin read
- duplicated SOT / actor columns: 追加なし

## Audit: `operational_incident_events`

- `id`: UUID PK
- `incident_id`: root FK、`ON DELETE RESTRICT`
- `actor_profile_id`: profiles FK、`ON DELETE RESTRICT`
- event types: created / acknowledged / resolved / retracted
- versions: adjacent `version_to = version_from + 1`、createdは`0 -> 1`
- idempotency: trimmed 1..128文字、`(actor_profile_id, idempotency_key)` unique
- snapshot: server生成canonical objectのみ
- uniqueness: `(incident_id, version_to)`
- immutability: authenticated/anonへのINSERT/UPDATE/DELETE grantなし、mutation policyなし

## One Unresolved

- Definition: `state IN ('open','acknowledged')`
- DB guarantee: partial unique index on `assignment_id`
- Concurrent behavior: Assignment lockで直列化し、indexを最終race guardとする。専用testで同時createは1 success / 1 `ACTIVE_INCIDENT_EXISTS`。

## RLS

### Root

- Worker: `private.worker_owns_assignment(assignment_id)` によるown全履歴read
- Manager: `private.has_assignment_branch_access(assignment_id)` によるbranch read
- System Admin: cross-branch read
- anon: readなし

### Events

- Worker: readなし
- Manager: event -> root -> Assignmentのbranch scope
- System Admin: cross-branch read
- anon: readなし

## GRANT

- Root/Event SELECT: authenticatedのみ。RLSでrow制限。
- Root/Event DML: authenticated/anonともなし。
- RPC EXECUTE: authenticatedのみ。
- PUBLIC/anon RPC EXECUTE: 明示revoke。

## Commands

### `create_operational_incident(uuid, text, text, text)`

- Actor: active Workerを`auth.uid() -> profiles -> workers.auth_profile_id`で解決
- Eligibility: own Assignment、`assigned | confirmed`、Shift非cancelled、unresolvedなし
- Normalization: message `btrim`、empty -> NULL、最大500
- Lock: own Assignment、親Shift、actor/key advisory lock
- Write: root version 1 + created eventを同一transaction
- Errors: INVALID_INPUT / INVALID_CATEGORY / FORBIDDEN / NOT_FOUND / ASSIGNMENT_NOT_ELIGIBLE / SHIFT_CANCELLED / ACTIVE_INCIDENT_EXISTS / IDEMPOTENCY_CONFLICT

### `acknowledge_operational_incident(uuid, bigint, text)`

- Actor: branch Manager / System Admin
- State: openのみ
- Version: exact expected version
- Write: state acknowledged、version +1、server acknowledged_at、event exactly one

### `resolve_operational_incident(uuid, bigint, text)`

- Actor: branch Manager / System Admin。ack actorと同一である必要なし。
- State: acknowledgedのみ。openから直接resolve不可。
- Write: state resolved、version +1、server resolved_at、event exactly one

### `retract_operational_incident(uuid, bigint, text)`

- Actor: Incident Assignmentのcurrent owner Worker
- State: openのみ
- Historical eligibility: Assignment inactive / Shift cancelled後も許可
- Write: state retracted、version +1、server retracted_at、event exactly one

## SECURITY DEFINER Hardening

- 4 RPC: `SECURITY DEFINER`, owner postgres, `search_path = ''`
- table/function/`now`/hash関数: schema-qualified
- actor: runtime `auth.uid()`のみ
- active profile、Worker mapping、ownership、Manager branch、System Adminを関数内で再検証
- payloadにactor/worker/branch/roleなし
- PUBLIC/anon revoke、authenticated executeのみ
- Product runtime/test actor pathにservice_roleなし

## Error Contract

| Code | Implemented | Notes |
| --- | --- | --- |
| `INVALID_INPUT` | Yes | null/length/version/key |
| `NOT_FOUND` | Yes | foreign ownership/scopeの非開示を含む |
| `FORBIDDEN` | Yes | actor role/profile不適格 |
| `ASSIGNMENT_NOT_ELIGIBLE` | Yes | create status不適格 |
| `SHIFT_CANCELLED` | Yes | new createのみ拒否 |
| `ACTIVE_INCIDENT_EXISTS` | Yes | safe existing root fieldsを返却 |
| `INVALID_CATEGORY` | Yes | 固定5種外 |
| `VERSION_CONFLICT` | Yes | safe current version |
| `STATE_CONFLICT` | Yes | safe current state/version |
| `IDEMPOTENCY_CONFLICT` | Yes | same actor/key, different canonical request |

Domain failureは`{ok:false, code}`で返し、constraint名やraw SQLSTATEをpublic contractにしていない。

## Idempotency / Concurrency

- Key: opaque trimmed text、1..128
- Scope: actor profile + key、4 commands横断
- Snapshot: commandとaccepted canonical fieldsのみ
- Replay: original incident/state/version/event result、追加writeなし
- Replay-before-stale: scope/root lock後、version/state判定前
- Different request: `IDEMPOTENCY_CONFLICT`
- Failed request: receipt/eventを保存しない
- Same-key race: transaction advisory lockで1 original + 1 replay
- Create race: Assignment lock + partial unique
- Transition race: root row lock + expected version
- Dedicated results: concurrent create、ack、resolve、retract-vs-ackすべて1 successのみ

## Historical / Atomicity

- Assignment completed/cancelled/absent/no_showおよびShift cancelledで自動closureなし。
- 既存openはAdmin ack、acknowledgedはAdmin resolve、own openはWorker retractを継続できる。
- 各成功commandはrootとeventを同一PostgreSQL transactionで更新する。event failure時はrootもrollbackする。
- Assignment、Attendance、Pre-shift、Placement、NotificationをIncident commandから変更しない。

## Read Contract

- Worker history: own Assignmentのroot全stateを取得可能。events不可。
- Day-of: Assignment ID集合へ `state IN ('open','acknowledged')` のbatch readが可能。partial uniqueにより0|1。
- Admin list: state/category/message/timestampsをrootから取得可能。
- Audit: Manager branch/System Adminがeventsをbatch/lazy read可能。

## Validation

- Operational Incident integration/security/race/audit: **47/47 PASS**
- Security Advisor: **No issues found**
- Day-of rules: **17/17 PASS**
- Attendance UI rules: **PASS**
- Pre-shift monitor: **PASS**
- Pre-shift rules: **20/20 PASS**
- Placement rules: **39/39 PASS**
- Placement editor rules: **13/13 PASS**
- Placement read-only security: **28/28 PASS**
- Placement atomic command: **20/20 PASS**
- Admin UI/navigation alignment: **24/24 PASS**
- TypeScript `npx tsc --noEmit`: **PASS**
- Build `npm run build`: **PASS**
- Scoped ESLint: **PASS**
- `git diff --check`: **PASS**

## Cleanup

- Incident roots: 0
- Incident events: 0
- Dedicated Assignment fixtures: 0
- Dedicated Shift fixtures: 0
- Shared fixtures: 削除・resetなし

## Design Deviations

- Domain designからBusiness/authorization/lifecycle deviationなし。
- Same actor/key同時送信を確実にreplayへ収束させるため、event unique制約に加えてtransaction advisory lockを採用した。

## Limitations

- `placement-core-schema-test.mjs` は既存共有ShiftにすでにPlanがあるため、precondition違反のduplicate keyで停止した。Incident ID/fixtureとは無関係で、resetや共有Plan削除は行っていない。Placementのread-only security、rules、atomic command suitesはPASS。
- Product UI、Server Action、Notification、Realtimeは意図的に未実装。
- exact retention periodはproduction前の非blocking decision。

## DB / Product Changes

- Migration / tables / indexes / trigger / RLS / GRANT / 4 RPC: 追加
- Existing schema objects: 書換えなし
- Auth / Product UI / package / notification / realtime / remote: 変更なし

## Next Phase Recommendation

UI-2.7DでWorkerのHelp Request create/status/retractとAdmin Day-of attention/auditを、このDB contractだけを使用して実装する。Notificationは別Domain Phaseまでside effectを追加しない。
