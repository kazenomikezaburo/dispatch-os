# Phase INT-2.9E Announcement to Notification Integration Result

## Executive Summary

`INT-2.9E: COMPLETE`

Announcement publicationをcanonical source、Notificationをderived attention projectionとして、Admin publishからWorker Inbox、Announcement専用safe resolver、canonical Worker detailまで接続した。Incident Notification v1のprojection、receipt、reconciliation、resolver、Assignment CTAは変更せず、既存contractのまま回帰確認した。

## Existing Architecture Audit

- Announcement: `announcements`、immutable `announcement_recipients`、atomic `publish_announcement`、Admin/Worker read UIは既存。
- Notification: recipient-owned common envelope、Incident event非null source、2つのIncident type、mark-read、Incident receipt/reconciliation/resolver、mixed-order keyset Inboxが既存。
- Missing: Announcement type/source identity、projection/receipt/reconciliation/resolver、Admin publish後のbest-effort call、Inbox presentation。
- Addition: Incident pathへ分岐を混ぜず、Announcement専用source、projection、private state、private receipt、private bounded scan、public safe resolverをnarrow extensionとして追加。

## Canonical Flow

```text
Admin publish Server Action
→ publish_announcement
→ immutable announcement_recipients
→ project_announcement_in_app_notifications
→ in_app_notifications
→ /worker/notifications explicit open
→ mark_in_app_notification_read
→ resolve_announcement_notification_source_context
→ /worker/announcements/[announcementId]
```

## Transaction Boundary

- Transaction A: `publish_announcement`がAnnouncement publish factとrecipient snapshotをatomic commit。
- Transaction B: publish成功後、Admin Server ActionがAnnouncement projection RPCをbest-effort実行。
- Transaction Bが失敗してもActionはcanonical publish成功をfailureへ戻さない。publish replayまたはbounded reconciliationで復旧可能。

## Notification Schema Extension

- controlled typeへ`announcement_published`を追加。
- `source_announcement_id` FKを一列だけ追加し、Incident source列をnullable化。
- DB checkで、Incident typeはIncident sourceだけ、Announcement typeはAnnouncement sourceだけを要求。both/neither/type mismatchは禁止。
- partial unique indexで`source_announcement_id + recipient_profile_id`をDB-level duplicate identityとして保証。
- Notification snapshotはtitleと、Announcement bodyの空白をserver-sideでplain textへ正規化した最大240文字summaryだけ。full body、importance metadata、route、generic JSONは保存しない。

## Projection

- inputはAnnouncement IDのみ。recipient IDは受け取らず、published rootのimmutable recipient rowsだけを列挙。
- authenticated Manager/System Adminを再認証し、既存Announcement scope authorizationを再利用。
- Announcement row lockとpartial unique indexにより並行実行を直列化・収束。
- rerunは既存NotificationのID、created_at、title、summary、read_atを変更せず、欠損receiptだけを補完可能。
- draft/archivedは`NOT_APPLICABLE`で新規projectionなし。

## Reconciliation

- `private.list_unprojected_announcement_notification_recipients`を追加。
- migration activation cursor以後のpublished Announcementとrecipient snapshotを`published_at, announcement_id, recipient_profile_id` cursorで最大100件scan。
- Notificationまたはmatching receiptが欠損したrecipientを検出。同じprojection RPC再実行で回復。
- 復旧後rerunは0 missing、既存read_atは維持。

## Resolver

- `resolve_announcement_notification_source_context(notification_id)`を追加。
- own Notification recipient、expected type/source、own immutable recipient、current Worker/profile linkとactive状態、Announcement published状態をDB内で再検証。
- successは`ok / source_available / announcement_id`だけ。
- foreign、nonexistent、wrong type、missing/corrupt mapping、archived、inactive、relink mismatchは同じsafe unavailable。内部recipient/worker/branch/scope/actor/receipt情報は返さない。
- Incidentは引き続き`resolve_in_app_notification_source_context`を使用。

## Inbox Integration

- `announcement_published`を「お知らせ」labelで通常のtitle/summary/time/read stateとして表示。
- explicit open後だけ既存mark-readを実行し、DB-owned notification typeから専用resolverを選択。
- available時だけcanonical Announcement URLを生成。unavailable時はlinkなしのgeneric disabled state。
- Bell countは既存全type unread countをそのまま使用。Announcement専用badge/read receiptは追加なし。
- orderingは`created_at DESC, id DESC`、pagination cursorは既存contractのまま。

## Archive Behavior

- archive後もNotification snapshotとread stateは保持。
- Worker Announcement list/detailは既存contractによりunavailable。
- Notification detailは残り、Announcement resolverはsafe unavailable、CTA URLは生成しない。

## Security

- direct UI Notification insertなし。recipient inputなし。
- public projection/resolverはowner postgres、SECURITY DEFINER、empty search_path、schema-qualified relations。
- PUBLIC/anon/service_role execute revoke。authenticatedのみexecuteし、projectionはactive Manager/System Admin + source scopeをDBで再認可。Worker実行不可。
- private receipt/state/reconciliationはPUBLIC/anon/authenticated/service_roleからtable/function access revoke、RLS enabled。
- Notification RLSのown active Worker isolationを変更なし。

## Browser E2E

- 実Chrome、local SupabaseのみでManager login → branch important draft → publishを実行。recipient 2名をUIで確認。
- Worker AでBell unread +1、mixed Inboxのtype/title/summary/unreadを確認。
- explicit openで既読化、Bell decrement、Announcement CTA、canonical detailのtitle/body/importance/published_atを確認。
- Manager archive後、Worker Announcement sourceはunavailable。Notification item/read stateは残り、detailはlinkなし「このお知らせは現在表示できません」を確認。
- Incident fixtureとのmixed Inboxでtotal unread badge、Incident explicit open、mark-read、既存Assignment CTAを確認。
- desktop実Chromeでhorizontal overflowなし。390x844の既存Inbox drawer/Worker Announcement layout contractと、追加CTAの`w-full` mobile/`sm:w-auto` desktop構成を維持。
- application console error 0、React warning 0、hydration warning 0。React DevTools/HMR infoのみ。

## Incident Regression

- Incident projection/retry/duplicate prevention/reconciliation/read preservation: 16/16 PASS。
- Notification persistence/security: 40/40 PASS。
- Incident resolver/security: 18/18 PASS。
- Operational Incident: 47/47 PASS。
- 実ChromeでIncident mark-readとAssignment CTAをPASS。

## Tests

- Announcement Notification Integration: 29/29 PASS。
- Announcement persistence/security: 50/50 PASS。
- Admin Announcement UI: 28/28 PASS。
- Worker Announcement UI: 22/22 PASS。
- Worker Notification Inbox UI: 23/23 PASS。
- Worker In-app Notification: 40/40 PASS。
- Notification Source Context: 18/18 PASS。
- Incident Notification Integration: 16/16 PASS。
- Operational Incident: 47/47 PASS。
- Worker Help Request UI: 18/18 PASS。
- Admin Incident UI: 19/19 PASS。
- Day-of rules: 17/17 PASS。
- Day-of fixture matrix: 12/12 PASS。
- Attendance UI rules: PASS。
- Pre-shift monitor rules: PASS。
- Placement editor rules: 13/13 PASS。
- Placement rules: 39/39 PASS。

## Static Verification

- TypeScript: PASS (`next build`)
- focused ESLint: PASS
- production build: PASS (Next.js 16.3.1, 24 routes)
- DB lint: warning 0 / error 0 (`No schema errors found`)
- `git diff --check`: PASS (pre-existing line-ending warnings only)

## Fixture Cleanup

- integration test fixtures: roots/recipients/command receipts/projection receipts/Notifications 0。
- Browser Announcement UUID: root/Notification/projection receipt `0 / 0 / 0`。
- Browser Incident Notification fixture: cleanup script完了。
- existing seed dataは削除していない。

## Files Changed

- `supabase/migrations/20260910163355_announcement_notification_integration.sql`
- `app/actions/announcements.ts`
- `app/actions/worker-notifications.ts`
- `app/worker/notifications/page.tsx`
- `components/worker/notifications/worker-notification-inbox.tsx`
- `lib/worker/notifications/worker-notification-types.ts`
- `scripts/integration/announcement-notification-integration-test.mjs`
- `scripts/integration/announcement-persistence-test.mjs`
- `scripts/integration/in-app-notification-test.mjs`
- `scripts/integration/worker-notification-inbox-ui-test.mjs`
- `docs/int-2.9e-announcement-notification-integration-result.md`

## Explicit Non-Changes

- Announcement lifecycle: unchanged
- published immutability: unchanged
- Announcement read receipt: not added
- Incident Notification semantics: unchanged
- Auth architecture: unchanged
- packages: unchanged
- Realtime/polling: unchanged
- remote: unchanged
- commit/push: 0
- existing uncommitted work: preserved

## Remaining Blocker

none

`INT-2.9E: COMPLETE`
