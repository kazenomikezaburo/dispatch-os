# ADMIN-UI-3.0B-5E — Unified Communication Workspace Result

## Status

`ADMIN-UI-3.0B-5E: COMPLETE`

`ADMIN-UI-3.0B-5F: READY`

## Existing Communication Architecture

- `/admin/incidents` は Operational Incident / Help Request の一覧、検索、状態集計、query-state Drawer、対応開始・解決操作を提供していた。
- `/admin/announcements` は Announcement の draft / published / archived 一覧、作成、詳細、draft 編集、公開、archive を提供していた。
- Sidebar では両 route が既に `連絡` group に並んでいた。
- Incident、Announcement、Worker Notification は独立した既存 domain と persistence contract を持つ。今回の変更前から統合 Inbox domain は存在しない。

## Frozen Product Boundary

- Incident と Announcement を同一テーブル、同一一覧、同一 query、同一 action へ統合していない。
- Notification domain、Incident state transition、Announcement lifecycle、published immutability を変更していない。
- canonical route は `/admin/incidents` と `/admin/announcements` のまま維持した。
- Figma の Communication Inbox / Detail は情報階層と視覚参照に限定し、未実装の統合 Inbox は導入していない。

## Unified Workspace

- 両 canonical route の先頭に共通の `連絡` workspace header を配置した。
- description は `現場からの問い合わせと管理者からのお知らせを管理します。` とした。
- workspace 内に `ヘルプリクエスト` と `お知らせ` の二つの実 Link tab を配置した。
- 各 page は domain 固有の一覧見出し、filter、action、empty/error state を workspace header の下へ保持した。

## Shared Tabs

- Master workspace と Communication workspace が共用する `AdminSectionTabs` を抽出した。
- active 判定は `usePathname()` と canonical href の完全一致で行い、query string、履歴移動、reload に依存しない。
- active tab は `aria-current="page"`、文字 weight、下線で非色覚依存に表現した。
- tab は `min-h-11` の実 Link で、横幅が狭い場合は workspace 内だけ横スクロールできる。

## Incident / Help Request

- page title を workspace の `連絡`、domain heading を `ヘルプリクエスト一覧` として整理した。
- 状態集計、検索、状態・カテゴリ filter、pagination、query-state 選択を維持した。
- Incident は Worker 起点のため、管理者向けの偽の新規作成 action は追加していない。
- filter なしの空状態を `ヘルプリクエストがありません。` / `現在対応が必要な問い合わせはありません。` に明確化した。

## Incident Drawer

- `incident` query parameter、selected record、event timeline、close href、acknowledge / resolve action の既存実装を変更していない。
- Local の現在データは `state=all` でも 0 件だったため、新しい fixture は作成せず、Drawer contract は既存 Incident integration test とソース確認で回帰確認した。

## Announcement

- page title を workspace の `連絡`、domain heading を `お知らせ一覧` として整理した。
- `お知らせを作成` は Announcement domain 固有 action として保持した。
- state filter、keyset pagination、list/detail route を変更していない。
- 新規作成と詳細の breadcrumb を `連絡 / お知らせ / ...` に統一した。

## Announcement Lifecycle

- draft のみ編集可能、published は immutable、published のみ archive 可能、archived は read-only という既存 UI / action contractを変更していない。
- Local の現在データは全 lifecycle で 0 件だったため、新しい Announcement を作成・公開・archive せず、専用 integration test と既存実装で状態境界を回帰確認した。

## Sidebar

- 既存 `連絡` group と `/admin/incidents`、`/admin/announcements` entry をそのまま使用した。
- Workspace tab と Sidebar は同じ canonical route を指し、別 route や dead control を追加していない。

## Breadcrumb

- `/admin/incidents`: `連絡 / ヘルプリクエスト`
- `/admin/announcements`: `連絡 / お知らせ`
- `/admin/announcements/new`: `連絡 / お知らせ / 新規作成`
- `/admin/announcements/[announcementId]`: `連絡 / お知らせ / {title}`

## Responsive

- Local browser で 1440x900、1280x900、390x844 を確認した。
- 1280px と 390px で document-level horizontal overflow はなかった。
- 390px では mobile admin menu を開閉でき、`連絡` group と両 entry を操作可能だった。
- 検索 form、action、tabs は既存 responsive layout を維持した。

## Accessibility

- workspace tabs は `nav` と `aria-label="連絡の種類"` を持つ。
- active tab は `aria-current="page"` と下線を併用する。
- Link / button は 44px 相当の `min-h-11` target を維持する。
- 既存 mobile dialog、focus-visible style、semantic heading / region を維持した。

## Local Browser QA

- `/admin/incidents` と `/admin/incidents?state=all` の workspace、breadcrumb、summary、filters、空状態を確認した。
- workspace tab から `/admin/announcements` へ遷移し、active state、filters、empty state、作成 action を確認した。
- `/admin/announcements/new` へ実 Link で遷移し、`連絡 / お知らせ / 新規作成` を確認した。保存・公開は実行していない。
- back、forward、reload 後も canonical route と tab state が一致した。
- 1440x900、1280x900、390x844 と mobile menu を確認した。

## Network Browser QA

- 実行時に `ipconfig` から LAN IPv4 を取得し、`0.0.0.0` bind の dev server へ LAN origin から接続した。
- LAN origin の `/admin/incidents`、workspace tab による `/admin/announcements`、reload、Sidebar による `/admin/incidents` 復帰を確認した。
- Local / LAN を通じて browser console error 0、warning 0、React warning 0、hydration warning 0 だった。

## Tests

- Admin Communication Workspace: 40 / 40 PASS
- Admin Incident UI: 19 / 19 PASS
- Admin Announcement UI: 28 / 28 PASS
- Admin Master Workspace: 36 / 36 PASS
- Admin Visual Consistency: 35 / 35 PASS
- Admin Shell Workflow Tabs: 11 / 11 PASS
- 合計: 169 / 169 PASS

## Static Verification

- `npm run lint`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS (Next.js 16.3.1, 24 / 24 static pages generated)
- `git diff --check`: PASS (既存 working tree の LF/CRLF notice のみ、whitespace error 0)
- React best-practices review: PASS。追加 client component は pathname-based tabs に限定し、inline component、effect、余分な client data fetch を追加していない。

## Files Changed

- `components/admin/admin-section-tabs.tsx` (new)
- `components/admin/communication/communication-workspace-header.tsx` (new)
- `components/admin/masters/master-workspace-header.tsx`
- `components/admin/admin-breadcrumb.tsx`
- `app/admin/incidents/page.tsx`
- `app/admin/announcements/page.tsx`
- `app/admin/announcements/new/page.tsx`
- `app/admin/announcements/[announcementId]/page.tsx`
- `scripts/integration/admin-communication-workspace-test.mjs` (new)
- `scripts/integration/admin-master-workspace-test.mjs`
- `scripts/integration/admin-visual-consistency-test.mjs`
- `docs/admin-ui-3.0b-5e-communication-workspace-result.md` (new)

## Explicit Non-Changes

- Incident / Help Request domain: unchanged
- Announcement domain and lifecycle: unchanged
- Notification domain: unchanged
- DB schema / migration / RLS / GRANT / RPC: unchanged
- Worker UI: unchanged
- Auth architecture: unchanged
- Packages and lockfile: unchanged
- Figma: read-only reference; change 0
- Remote Supabase / production / staging: unchanged
- Commit / push: 0
- Existing staged, unstaged, and untracked work: preserved

