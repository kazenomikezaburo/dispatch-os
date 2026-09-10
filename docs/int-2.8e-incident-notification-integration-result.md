# INT-2.8E Incident → Notification Integration Result

## Executive Summary

- Status: **INT-2.8E COMPLETE**.
- acknowledged / resolved の実運用 Server Action を、各 canonical Incident command 成功後に既存 `public.project_incident_in_app_notification(uuid)` へ接続した。
- source command retry と projection rerun は同じ Event / Notification を返し、同一 source event から一件へ収束する。
- missing acknowledged / resolved projection は既存 private reconciliation discovery と既存 projection commandで復旧でき、再走査は0件、既読itemは変更しない。
- Local Brave（Chromium）で Worker作成 → Manager acknowledge → Worker Inbox/read/Assignment → Manager resolve → Worker Inbox/read/Assignment を実操作した。

## Existing Architecture Audit

実装開始時点で、Incident root mutation と append-only Event creation は `acknowledge_operational_incident` / `resolve_operational_incident` の各DB transaction内で原子的に成立していた。各commandは actor、version、idempotency keyを検証し、replay時に同じ `event_id` を返していた。

Notification側には、acknowledged / resolved Eventのみを受け付け、Incident → Assignment → Worker → `auth_profile_id` からrecipientを導出する `project_incident_in_app_notification`、source/recipient unique constraint、private receipt、activation cursor以降のreceipt missing Eventを列挙する bounded reconciliation primitiveが存在していた。Worker Inbox、mark-read、safe source resolverも接続済みだった。

不足していたのは、実際のAdmin Server Actionがcommand成功後の `event_id` を受け取ってprojection commandを呼ぶ接続だけだった。UI/ServerからNotification tableへのdirect INSERTは存在しない。

## Canonical Flow

```text
Admin Server Action
  → canonical Incident transition RPC
    → Incident root mutation + immutable Incident Event (one DB transaction)
  → returned event_id
  → existing Notification projection RPC (separate DB transaction)
  → Worker-owned Notification
  → existing Worker Inbox/detail
  → safe resolver
  → currently authorized Assignment
```

## Transaction Boundary

Incident mutationとIncident Event insertは同じsource transaction。Notification projectionはsource commit後の別transactionである。projection error/exceptionは内部consoleへ記録するが、成立済みIncident commandの成功応答をfailureへ書き換えない。

したがって source成功後にprojectionだけ失敗する状態は技術的に起こり得る。その場合、activation cursor以降・acknowledged/resolved・receiptなしのEventを `private.list_unprojected_incident_notification_events` が検出し、trusted backend/operatorが既存projection commandを再実行して復旧できる。runtime roleへprivate discovery権限は追加していない。

## Idempotency

- Source event: Incident commandのidempotency key replayは同じevent IDを返し、二度目のstate mutation/Event insertを行わない。
- Projection: receipt PKとNotification unique `(source_incident_event_id, recipient_profile_id)` によりsequential/concurrent rerunが一件へ収束する。
- Server Action retry: replayされたevent IDへ同じprojectionを行うため、Notificationは既存itemのreplayになる。
- Application-side `SELECT before INSERT` は追加していない。

## Reconciliation

- Missing detection: activation cursor以降のacknowledged/resolved Eventかつprojection receiptなしのみ。
- Recovery: acknowledged / resolved のNotification rowをderived dataとして削除し、cascadeされたreceipt欠落を検出後、両方を復旧した。
- Rerun: 復旧後はdiscovery 0件、duplicate 0件。
- Read preservation: 既存itemをreadにした後のreconciliation rerunで同じ `read_at` を保持した。
- Source preservation: Incidentはresolved version 3、Eventはcreated/acknowledged/resolvedの3件のままで、recoveryによるsource mutationなし。

## Security

- Recipientはclient inputではなくIncident → Assignment → Worker relationから導出する。
- foreign WorkerはNotification SELECT 0件、resolverは `source_available=false` / `assignment_id=null`。
- Workerの `operational_incident_events` direct SELECTは0件のまま。policy/GRANT変更なし。
- resolver successは `ok` / `source_available` / `assignment_id` のみで、Incident/Event/actor/request snapshotを返さない。
- projection / resolverは既存のSECURITY DEFINER、owner postgres、empty search path、schema qualification、PUBLIC/anon revokeを維持した。
- product pathはservice roleを使用しない。service roleは既存local Auth fixture準備だけで使用した。

## Browser E2E

Local-only Chromium実操作結果:

1. WorkerがAssignment `40000000-0000-0000-0000-000000000001` からHelp Requestを作成。
2. Managerが実Admin drawerから対応開始。canonical historyはv1→v2。
3. Worker headerは未読1件。Inboxにacknowledged item一件、明示open後に既読、safe CTAで同じAssignmentへ遷移。
4. Managerが同じIncidentを解決。canonical historyはv2→v3。
5. Worker Inboxはresolvedを先頭の未読itemとして追加し、acknowledged既読itemを保持。明示openで既読化し、safe CTAで同じAssignmentへ遷移。

duplicate、順序、badge、Drawer、既読化、両CTAを確認した。アプリURL由来のconsole error、React warning、hydration warning、unexpected auth/network errorは0件。ブラウザ拡張自身のmessage-port error 1件はapp由来ではないため分離した。

E2E中、既存fixture UUIDのversion nibbleがRFC UUID制約外で、Incident actionだけが共通DB UUID validatorを使っていない不具合を発見した。Worker/Admin Incident schemaを既存 `uuidSchema` に揃える最小修正後、実flowを完走した。

## Tests

- INT-2.8E dedicated integration: **16/16 PASS**.
- Worker In-app Notification: **40/40 PASS**.
- Notification Source Context: **18/18 PASS**.
- Worker Notification Inbox UI rules: **22/22 PASS**.
- Operational Incident: **47/47 PASS**.
- Worker Help Request UI rules: **18/18 PASS**.
- Admin Incident UI rules: **19/19 PASS**.
- Day-of fixture/rules: **12/12 + 17/17 PASS**.
- Attendance UI rules: **PASS**.
- Pre-shift monitor/rules: **PASS + 20/20 PASS**.
- Placement Break atomic/editor/rules/security: **20/20 + 13/13 + 39/39 + 28/28 PASS**.
- Placement core schema test: incremental Local DBに既存placement planがあるため、fresh/reset前提の「planなし」assertionとfixture INSERTが既存unique rowに衝突。今回の変更由来ではなく、reset禁止に従い既存dataを削除せずbaseline incompatibilityとして分離した。

## Static Verification

- TypeScript: `npx tsc --noEmit` PASS.
- ESLint: 変更4file PASS、warning/error 0。
- Production build: `npm run build` PASS、21 static pages生成。
- DB lint: `npx supabase db lint --local --level warning`、results empty、warning/error 0。
- `git diff --check`: PASS。Windows checkoutのLF→CRLF informational warningのみ。

## Changes

- `app/actions/operational-incidents.ts`: source成功後のbest-effort projection接続、Worker Inbox revalidation。
- `lib/admin/incidents/incident-action-schema.ts`: project共通UUID validatorへ統一。
- `lib/worker/incidents/operational-incident-schema.ts`: project共通UUID validatorへ統一。
- `scripts/integration/incident-notification-integration-test.mjs`: retry / duplicate / recovery / read preservation / resolver / isolation / cleanupの専用suite。
- `docs/int-2.8e-incident-notification-integration-result.md`: 本結果。

DB migration、Notification schema、Inbox UIの変更はない。

## Fixture Cleanup

- Dedicated integration fixture: finally cleanup後のShift/Assignment/Incident残存合計 **0**。
- Browser fixture: 削除前にIncident 1 / Event 3 / Notification 2を限定確認。対象Incident IDに限定して削除後の残存合計 **0**。
- Auth identities、seed Assignment、既存placement dataは削除していない。

## Explicit Non-Changes

- Notification domain model: unchanged
- Announcement: unchanged
- Worker Incident Event SELECT: unchanged
- Auth architecture: unchanged
- packages: unchanged
- Realtime/polling: unchanged
- remote: unchanged
- commit/push: 0
- existing uncommitted work: preserved

## Remaining Blocker

None for INT-2.8E. The placement-core fresh-state test requires a clean/reset database and remains a separately identified local baseline prerequisite; no reset or existing-data deletion was performed.

**INT-2.8E: COMPLETE**
