# DB-2.9B Announcement Persistence, Commands & Security Result

## Executive Summary

**DB-2.9B: COMPLETE**

**UI-2.9C: READY**

**UI-2.9D: READY**

**INT-2.9E: READY**

DOMAIN-2.9AでFreezeしたAnnouncement source persistenceを、新規incremental migrationとしてLocal Supabaseへ実装した。Announcement root、公開時recipient snapshot、5 canonical mutation RPC、Admin/Worker read RPC、RLS、explicit GRANT/REVOKE、optimistic concurrency、idempotencyを含む。Notification連携は実装していない。

Local Announcement integration/security suiteは50/50 PASS。既存Incident/Notification無回帰suiteは105/105 PASS、Next.js build PASS、Local DB lintはwarning 0 / error 0。remote操作、commit、pushは0。

## Existing Architecture Audit

- role正本は`profiles.account_type`、active accountは`profiles.is_active=true`。
- Worker identityは`workers.auth_profile_id`、active predicateは`workers.status='active'`。
- Manager scopeは`manager_branch_access`、branch availabilityは`branches.is_active=true`。
- organization tableはなく、current deploymentをsingle organization boundaryとして扱う。
- Incident/Placementの`version + expected_version`、actor/key advisory lock、request/result snapshot、JSON stable result、`SECURITY DEFINER SET search_path=''`を継承した。
- Data APIはGRANTとRLSを別layerとして扱い、runtime mutationをRPCだけに限定した。
- UUIDは既存同様`gen_random_uuid()`をserver-sideで使用する。

## Schema

### `public.announcements`

- `id uuid`、`state draft|published|archived`、`version bigint >= 1`。
- `scope_type organization|branch`と`branch_id`のshapeをcheck constraintで保証。
- `title`はtrimmed、最大120文字。`body`はtrimmed、改行保持、最大5000文字。draftでは空を許容。
- `importance normal|important`。
- `created/updated/published/archived` timestampとactor audit fields。
- actor FKは`ON DELETE SET NULL`、Announcementはactor個人所有ではない。
- lifecycle/timestamp shape constraintsと必要最小限のlist/pagination indexesを持つ。

### `public.announcement_recipients`

- `announcement_id`、`worker_id`、`recipient_profile_id`、`created_at`。
- unique `(announcement_id, worker_id)`。
- unique `(announcement_id, recipient_profile_id)`。
- `(recipient_profile_id, announcement_id)` read index。
- update/delete triggerでimmutable。insertもdraft publication window以外を拒否。

### `private.announcement_command_receipts`

- actor、command、idempotency key、normalized request、result snapshotを保持。
- unique `(actor_profile_id, command_name, idempotency_key)`。
- Data API/runtime table grantなし。recipient listやprivileged query resultは保存しない。

## Lifecycle Enforcement

- `draft`: incomplete title/bodyを保存可能。canonical updateだけがversionを+1。
- `published`: draftから一度だけ遷移。content、importance、scope、publication metadata、recipient snapshotはimmutable。
- `archived`: publishedから一度だけ遷移しterminal。content/publication facts/snapshotを保持。
- `delete`: never-publishedかつrecipient-free draftだけphysical delete可能。
- lifecycle triggerがadjacent versionと許可transitionをDB-levelで検証する。

## Publish Transaction

`publish_announcement`は単一DB transaction内で次を実行する。

1. active Manager/System Adminを検証。
2. root rowを`FOR UPDATE` lockし、scope authorizationを再検証。
3. `expected_version`、draft state、publish時non-empty contentを検証。
4. canonical Worker/profile relationsからaudienceを解決。
5. recipient rowsを一括insert。
6. zero件なら`EMPTY_AUDIENCE`としてinsertを含めrollback。
7. server timestamp/actor、published state、version+1を確定。
8. command receiptとstable resultを保存。

Notification生成はtransactionに含めない。

## Audience Resolution

- `organization`: active Worker、linked profile、worker account type、active profileを全branchから解決。System Adminのみ。
- `branch`:上記predicateに`workers.branch_id = target branch`を追加。Managerは`manager_branch_access`があるactive branchのみ、System Adminは任意active branch。
- `snapshot`: publish時の`worker_id`と`recipient_profile_id`を固定。branch移動後も変化しない。
- `profile relink`: frozen Worker/profile pairの両方をruntimeで再検証するため、新accountへ自動移管されない。
- `empty audience`: rootはdraft/version unchanged、published metadata null、recipient 0のまま。

## Authorization

- Manager: accessible active branchのcreate/update/publish/archive/delete/list/detailのみ。organization/foreign branchは不可。
- System Admin: organizationおよびactive branch scopeを操作・参照可能。
- Worker: mutation不可。active Worker/profile + published + own frozen recipientの場合だけlist/detail可能。
- inactive/suspended Workerまたはinactive profile: snapshotを保持したままruntime read不可。
- foreign/nonexistent/draft/archived direct UUID: Workerには同じ`NOT_FOUND`。
- creator identityはauthorizationに使用しない。

## RLS

両public tableでRLSを有効化した。

- Announcements Admin SELECT: active admin + scope authorization。
- Announcements Worker SELECT: published + own frozen recipient + current active/relinked identity validation。
- Recipients Admin SELECT: source scope authorization。
- Recipients Worker SELECT: own recipient + source/read runtime predicates。
- INSERT/UPDATE/DELETE policyは作らず、runtime direct DMLは許可しない。
- private receiptもRLS enabledで、runtime policy/grantなし。

UIへaudit actor IDsやrecipient internalsを露出しないため、通常read contractはnarrow RPCを採用した。

## GRANT / REVOKE

- `PUBLIC`、`anon`、`authenticated`: public tablesへの直接SELECT/INSERT/UPDATE/DELETEなし。
- `authenticated`: hardened public RPCだけEXECUTE可。
- `PUBLIC`、`anon`: public/private Announcement functionsをEXECUTE不可。
- private receipt: `PUBLIC`、`anon`、`authenticated`、`service_role` table grantなし。
- `service_role`:既存Supabase server-side conventionに合わせpublic source tablesのprivilegeを保持するが、Product runtimeは使用しない。recipient/lifecycle triggersは防御を維持する。
- public RPC ownerは`postgres`、`SECURITY DEFINER=true`、fixed empty `search_path`、schema-qualified relationを使用。

## Commands

1. `create_announcement_draft`: Manager branch / System Admin organization・branch draftを作成。version 1。
2. `update_announcement_draft`: authorized draftだけ更新。target branch変更先も再認可。
3. `publish_announcement`: canonical audience snapshotとpublicationをatomic確定。
4. `archive_announcement`: authorized published rootをterminal archiveへ遷移。
5. `delete_announcement_draft`: authorized never-published recipient-free draftだけ削除。

全commandはserver-side actor/time、normalized request、stable JSON resultを使用する。stable errorsは`INVALID_INPUT`、`NOT_FOUND`、`FORBIDDEN`、`VERSION_CONFLICT`、`STATE_CONFLICT`、`EMPTY_AUDIENCE`、`IDEMPOTENCY_CONFLICT`。

## Reads

### Admin

- `list_admin_announcements`: scope-authorized list。state filter、最大100、`coalesce(published_at,created_at) DESC,id DESC` cursor。
- `get_admin_announcement`: scope-authorized detail。content、lifecycle、scope、version、recipient count。

### Worker

- `list_worker_announcements`: own targeted published list。最大100、`published_at DESC,id DESC` cursor。body/audit/scope/recipient metadataを返さない。
- `get_worker_announcement`: own targeted published detail。ID、title、body、importance、published_atだけを返す。

## Idempotency

- actor + command + keyをadvisory transaction lockで直列化。
- same normalized requestはoriginal resultを`replayed=true`で返す。
- different requestは`IDEMPOTENCY_CONFLICT`。
- replay判定はversion/state判定より先に行う。
- draft physical delete後もprivate receiptからoriginal resultを再生できる。

## Concurrency

- root `FOR UPDATE` + exact `expected_version`。
- publish race:一方だけ成功。他方は`VERSION_CONFLICT`または`STATE_CONFLICT`。recipient duplicateなし。
- edit/publish race:同じdraft versionから一方だけ成功。
- archive race:同じpublished versionから一方だけ成功。
- same-key raceはadvisory lock + receipt uniqueでsuccess/replayへ収束。

## Security Tests

次を含む50 assertionsがPASSした。

- Manager own/foreign/organization scope boundary。
- System Admin organization scope。
- Worker foreign UUID/recipient IDOR。
- draft/archived leakage rejection。
- inactive Worker/profile runtime rejectionとsnapshot retention。
- profile relink non-transfer。
- branch move snapshot preservation。
- PUBLIC/anon/authenticated direct table privilege rejection。
- System Admin direct DML rejection。
- RLS policy probeによるown root/foreign recipient分離。
- RPC owner/security mode/search path/function grants。
- private receipt非公開。
- Notification schemaがIncident-specificのまま不変。

## Integration Tests

Command flow:

```text
Manager branch create
→ incomplete draft update
→ publish
→ recipient snapshot
→ Worker list/detail + isolation
→ inactive/relink/branch-move checks
→ archive
→ Worker unavailable
→ Admin history retained
```

System Admin organization publish、empty audience atomic rollback、draft physical delete/replay、publish/edit/archive raceも検証した。

Result: `Announcement persistence: 50/50 passed`。

Test fixturesはfinally cleanupされ、Announcement test roots/recipients/receipts残数0。既存Worker/profile fixture状態も復元した。

Existing regression suites:

- Operational Incident: 47/47 PASS
- Worker In-app Notification: 40/40 PASS
- Notification Source Context: 18/18 PASS
- Total: 105/105 PASS

Application verification: `npm run build` PASS（Next.js compile、TypeScript、21 static pages）。

## DB Lint

Command: `npx supabase db lint --local --level warning`

- warnings: 0
- errors: 0
- result: `No schema errors found`

## Changes

- `supabase/migrations/20260910131129_announcement_persistence_commands_security.sql`
- `scripts/integration/announcement-persistence-test.mjs`
- `docs/db-2.9b-announcement-persistence-result.md`

## Explicit Non-Changes

- Notification schema: unchanged
- Notification projection: unchanged
- Notification resolver: unchanged
- Announcement Notification integration: not implemented
- Admin Announcement UI: unchanged
- Worker Announcement UI: unchanged
- Auth architecture: unchanged
- packages: unchanged
- Realtime/polling: unchanged
- remote: unchanged
- commit/push: 0
- existing uncommitted work: preserved

## Handoff Assessment

- UI-2.9C: 5 mutation RPC + safe Admin list/detailが揃ったためREADY。
- UI-2.9D: targeted published Worker list/detailが揃ったためREADY。
- INT-2.9E: stable published source、immutable recipient snapshot、`published_at,id` ordering keyが揃ったためREADY。

Remaining blocker: none。

**DB-2.9B: COMPLETE**

**UI-2.9C: READY**

**UI-2.9D: READY**

**INT-2.9E: READY**
