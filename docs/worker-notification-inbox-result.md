# Phase UI-2.8D 実装結果

## Executive Summary

- Status: **COMPLETE**。
- Route: `/worker/notifications`。
- Worker shell: 既存headerへBell型のお知らせLinkを最小統合した。
- Unread badge: own recipientの`read_at is null`をserver-side exact countし、0件は非表示、100件以上は表示のみ`99+`。
- Inbox: Notification snapshotのみを`created_at desc, id desc`で表示し、20件単位のkeyset paginationを「もっと見る」で提供する。
- Detail: Mobileはfull-width/full-height、Desktopはright-side Drawerとなるnative dialog。
- Mark read: 一覧表示では実行せず、利用者がdetailを明示的に開いた時だけ既存RPCを呼ぶ。
- Source navigation: DB-2.8C.2 resolverが返した現在認可済みAssignmentだけへ遷移する。

## Architecture

- Server Component: `app/worker/notifications/page.tsx`が`requireWorker()`後に初期一覧を取得する。
- Worker layout: `requireWorker()`後にown unread exact countを取得する。
- Read helper: `lib/worker/notifications/get-worker-notifications.ts`。RLSに加えてrecipient profile IDで明示的に絞り込む。
- Client boundary: Drawer open/close、explicit open、既読表示更新、keyset追加読込、focus handlingのみ。
- Server Action: client入力はNotification UUIDまたはvalidated cursorのみ。Action内でも`requireWorker()`を実行する。
- Existing DB contracts: own Notification SELECT、`mark_in_app_notification_read(uuid)`、`resolve_in_app_notification_source_context(uuid)`のみを使用した。

## Source Navigation

```text
notification_id
→ resolve_in_app_notification_source_context
→ source_available
→ assignment_id
→ /worker/assignments/{assignment_id}
```

`source_available=false`は正常なsafe stateとして扱い、URLを生成せず「関連する勤務情報は現在表示できません」と表示する。foreign / nonexistent / stale / ownership lost / unsupported / broken relationは区別せず、Incident/Event内部理由も表示しない。resolver自体の失敗はretry可能なgeneric errorとしてsafe-unavailableと区別する。

## Figma Audit

- File: `Pmb52CO7UgsQDA5tvoqUjF`、Worker page `3:5`を実際に確認した。
- `338:85`: Mobile support entryの「お知らせ」「未読 n件」という簡潔な導線を、既存Worker headerのBell + badgeへadaptした。
- `229:37`: 390×844 detailの大きな見出し、snapshot本文、勤務関連CTA、full-screen surfaceをadaptした。
- `339:251`: Desktop support contentの広いsurface intentを確認し、既存最大幅とright-side Drawerへadaptした。確認時点のnode内容は「確認先」へ更新されていたため、文言はNotification DB domainを正本とした。
- Implemented: mobile-first entry、未読/既読text、詳細、勤務CTA、desktop adaptation。
- Intentionally omitted: Announcement、broadcast、管理部発信、通知設定、Push、LINE、email、一般連絡。現在のIncident Notification MVP domain外のため。

## Responsive

- Mobile 390×844: header入口、badge、一覧、full-screen detail、内部scroll、CTA、disabled safe state、closeを実ブラウザ確認。
- Desktop 1440×900: content width、一覧、scrim、right-side Drawer、CTA、overflowを実ブラウザ確認。

## Accessibility

- 一覧button、Bell、close、CTAは44px以上。
- 未読/既読はdot/colorだけでなくtextとaccessible labelを持つ。
- Native dialog semantics、heading association、focus trap、Escape close、close後trigger focus restoreを確認。
- NavigationはLink、detail open/closeとpaginationはButton。
- disabled source stateはLinkを生成せず、説明textのみ。
- Keyboardだけで一覧選択、detail、Escape close、CTA遷移を確認した。

## Browser QA

- ChromeでローカルSupabaseにのみ接続したdev serverを使用。
- 未読2件のshell badgeとInboxを確認。
- 一覧renderだけでは未読数が変化しないことを確認。
- Explicit open後に未読2→1→0、list labelも未読→既読へ更新することを確認。
- Safe-unavailable detailは内部理由やinvalid URLを出さないことを確認。
- Authorized detailはcanonical Assignment routeへ遷移することを確認。
- Empty stateをfixture cleanup後に確認。
- Console error 0、React/hydration warning 0、unexpected authorization error 0。
- QA fixtureは終了後に全削除した。

## Tests

- Worker Notification Inbox UI rules: 22/22 PASS。
- Worker In-app Notification: 40/40 PASS。
- Notification Source Context: 18/18 PASS。
- Worker Help Request UI: 18/18 PASS。
- Operational Incident: 47/47 PASS。
- Admin Incident UI: 19/19 PASS。
- Day-of rules: 17/17 PASS。
- Day-of fixture matrix: 12/12 PASS。
- Attendance UI rules: PASS。
- Pre-shift monitor rules: PASS。
- Placement rules: 39/39 PASS。
- Placement editor rules: 13/13 PASS。
- Placement read-only security: 28/28 PASS。

## Static Verification

- TypeScript `npx tsc --noEmit`: PASS。
- ESLint（変更範囲）: PASS。
- Production build: PASS。`/worker/notifications`をdynamic routeとして確認。
- `git diff --check`: PASS（既存line-ending warningのみ）。
- Local DB lint: schema error 0。

## Changes

- `app/worker/layout.tsx`
- `app/worker/notifications/page.tsx`
- `app/actions/worker-notifications.ts`
- `components/worker/notifications/worker-notification-inbox.tsx`
- `lib/worker/notifications/get-worker-notifications.ts`
- `lib/worker/notifications/worker-notification-types.ts`
- `scripts/integration/worker-notification-inbox-ui-test.mjs`
- `scripts/dev/setup-worker-notification-fixtures.mjs`
- `docs/worker-notification-inbox-result.md`

## Explicit Non-Changes

- Notification DB schema: unchanged。
- Incident/Event RLS: unchanged。
- Worker Incident Event SELECT: unchanged。
- service role: Product codeではunused。ローカルfixture準備の既存許可範囲のみ。
- Auth architecture: unchanged。
- packages: unchanged。
- remote: unchanged。remote DB operation 0。
- commit/push: 0。
- existing uncommitted work: preserved。

UI-2.8D: COMPLETE
