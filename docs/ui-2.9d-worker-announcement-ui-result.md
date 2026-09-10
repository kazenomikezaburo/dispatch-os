# Phase UI-2.9D Worker Announcement UI Result

## Executive Summary

`UI-2.9D: COMPLETE`  
`INT-2.9E: READY`

DB-2.9BのWorker read contractだけを使用し、Worker向けAnnouncement一覧とcanonical詳細routeを追加した。Announcement固有のread receipt、未読badge、Notification連携は追加していない。

## Routes

- `/worker/announcements`: 公開済みかつown recipientであるAnnouncementの一覧
- `/worker/announcements/[announcementId]`: authorizedな公開Announcementのplain-text詳細

## Architecture

- 両routeはServer Componentで、既存`requireWorker()`をserver-sideで実行
- `lib/worker/announcements/*`が`list_worker_announcements` / `get_worker_announcement`だけを呼ぶ
- direct table SELECT、recipient列挙、client-side authorization filteringなし
- paginationはURL queryを使うServer Component navigation。追加Client Componentなし
- list/detailのloading、network error、authorization unavailableを別表示

## Navigation

Worker headerへ44pxの「お知らせ」entryを追加した。既存Bellは「通知」と明示し、Incident Notificationの未読badgeはBellだけに保持する。

## List

- title、重要ラベル、semantic `time`によるpublished dateを表示
- DB contractの`published_at DESC, id DESC`を維持
- 20件表示、21件目で次cursorを生成するkeyset pagination
- 0件では「現在のお知らせはありません」を表示
- body、recipient、scope、actor等の内部情報は表示しない

## Detail

- title、body、importance、published dateだけを表示
- bodyはReact textとしてrenderし、`whitespace-pre-wrap`で改行を保持
- raw HTML、Markdown、URL自動link化なし
- long title/bodyは`break-words`とbounded widthでhorizontal overflowを防止
- canonical一覧へのback navigationを提供

## Authorization

- own published: list/detail表示
- foreign published: safe unavailable
- draft: safe unavailable
- archived: safe unavailable
- nonexistent / malformed UUID: safe unavailable
- 上記4種のdirect URL理由は全て「このお知らせは表示できません」に統一
- Announcement openによるDB mutation、read state、未読badgeなし

## Figma Audit

- `338:85` Quick / Announcements: Worker-facing entryをadapt。Figmaの未読件数はNotification責務のためAnnouncement entryには不採用
- `229:37` Worker detail mobile: title、body、important、published date、390px mobile reading intentをimplemented。deadline、target、sender、CTAはdomain外としてomit
- `339:251` guidance card: concise guidance toneのみadapt。募集/勤務への固定CTAはAnnouncement content modelではないためomit

## Responsive

- 390x844: compact header entry、card stack、title/body wrapping、44px targets、縦scroll、back navigationを確認
- 1280 / 1440x900: `max-w-3xl`で本文行長と一覧密度を制限し、unbounded widthなし
- list、detail、重要label、published date、複数改行、長文にhorizontal overflowなし

## Accessibility

- 44px以上のheader/list/back/pagination targets
- keyboard-focus-visible、semantic Link、h1/h2 hierarchy、semantic `time`
- importantはAlertTriangle iconと「重要なお知らせ」のtextを併用
- bodyは読みやすいline-height、plain text、改行保持
- route pageのためDialog focus管理は不要

## Browser QA

- Worker Aで実Chrome login後、Announcement entryとNotification Bellの分離を確認
- organization published important Announcementだけが一覧に表示
- foreign Tokyo branch、draft、archivedは一覧非表示
- own detailでtitle/body/importance/published date、改行、refresh/direct URL/back navigationを確認
- foreign/draft/archived/nonexistent direct URLは完全に同じsafe unavailable文言
- recipient ID/count、scope、actor等の内部情報はDOMに非表示
- application console error 0、React warning 0、hydration warning 0。React DevTools/HMR infoのみ

## Tests

- Worker Announcement UI: 22/22 PASS
- Announcement persistence/security: 50/50 PASS
- Admin Announcement UI: 28/28 PASS
- Operational Incident: 47/47 PASS
- Worker In-app Notification: 40/40 PASS
- Notification Source Context: 18/18 PASS
- Worker Notification Inbox UI: 22/22 PASS
- Day-of rules: 17/17 PASS
- Day-of fixture matrix: 12/12 PASS
- Attendance UI rules: PASS
- Placement editor rules: 13/13 PASS
- Placement rules: 39/39 PASS

## Static Verification

- TypeScript: PASS (`npm run build`)
- focused ESLint: PASS
- production build: PASS（Worker Announcement 2 routes included）
- `git diff --check`: PASS

## Fixture Cleanup

- Browser QA用own/foreign/draft/archived AnnouncementをUUID限定で削除
- roots / recipients / command receipts残存: `0 / 0 / 0`
- cleanup後、実Chromeでempty stateを再確認
- existing seed dataは変更していない

## Changes

- Worker header navigation
- Worker Announcement list/detail/loading routes
- Worker Announcement read helper/types/query parser
- Worker Announcement list/detail/importance components
- Worker Announcement UI専用test
- Notification Inbox UI testのBell名称期待値を「通知」へ更新
- 本result document

## Explicit Non-Changes

- DB schema/RLS/RPC: unchanged
- Admin Announcement UI: unchanged
- Notification schema/projection/resolver: unchanged
- Announcement Notification integration: not implemented
- Auth architecture: unchanged
- packages: unchanged
- remote: unchanged
- commit/push: 0
- existing uncommitted work: preserved

## Handoff to INT-2.9E

canonical source destinationは`/worker/announcements/[announcementId]`。INT-2.9EでAnnouncement publishからNotification projection、安全なsource resolver、Worker Inbox、canonical detail routeを接続できる。

## Remaining Blocker

none
