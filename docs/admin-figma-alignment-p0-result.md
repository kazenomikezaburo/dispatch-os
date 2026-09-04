# Phase UI-2.3F — Admin Figma Alignment P0

実施日: 2026-09-03 / 対象: 既存Admin Domainのみ。

## Sources Used

- 依頼文: UI-2.3F pasted-text。添付台帳・過去会話は参考資料として扱い、実行指示と区別した。
- 最新Figma: `Pmb52CO7UgsQDA5tvoqUjF` / `3:4`。MCPでデザイン情報と画像を取得し、Chromeの実表示と比較した。
- 参照Node: Dashboard `459:3284`、Project List `469:2`、Project Hub `383:3183`、Project Create/Edit `489:310` / `492:6`、Job Edit `599:198`、Shift List/Hub `496:2900` / `496:3034`、Unified Shift Create `501:2821`、Shift Edit `501:2974`、Mobile Nav `574:180`、Navigation Definition `602:86`。
- Common States: `602:12/18/24/32/40/48/56/62/70/78`。
- `C:\Users\user\Documents\Dispatch_OS_画面構成台帳.xlsx`: 13 sheetsを読み取り。v2.1のSingle/Bulk分離記述と最新FigmaのUnified Createの差は、依頼どおり最新Figmaを優先した。ファイルは変更していない。
- `C:\Users\user\Documents\Dispatch_OS_画面構成_完成版.md`、既存UI/UX・UI Patterns・Design Foundation・Edit Security Planを参照。
- `docs/admin-figma-implementation-audit-v1.md` は元の監査記録のまま保存。今回のChrome検証結果で上書きしない。

## Git

- Branch: `small-ui-a11y-fix`。開始時HEAD: `c62e7cb`。
- 開始時 tracked staged/unstaged差分なし。既存untrackedは元の監査文書1件。
- commit / push / revert / unrelated cleanupなし。
- 実装は既存Sidebar・Server Component・Data Access・Server Actionを再利用。新規packageなし。

## Navigation / Availability

- 1つのグループ定義をDesktop / Mobileで共用。
- `implemented`: ホーム、案件、シフト、勤怠。リンクとActive状態を持つ。
- `placeholder`: スタッフ、取引先、設定。「準備中」、`aria-disabled`、リンクなし。既存Placeholder Routeは維持。
- `future`: 配置・休憩、事前確認モニター、当日運用、集計、連絡、ナレッジ、勤務先マスタ、監査ログなど。定義は保持するが今回は非表示、hrefなし。
- 案件詳細・Job・Shift Createを含む深いRouteでも案件NavがActiveになる。

## Desktop Sidebar

- 既存Sidebarを更新。Expanded 240px / Collapsed 72px、Header 68px。
- グループ見出し、アイコン、Active、Keyboard focus、Collapsed tooltipを維持。
- 独立した別Sidebar実装は作っていない。
- Chromeで折りたたみ・展開を操作。開発用Next.jsインジケーターが左下に重なるため、折りたたみの確認にはEnterも使用した。

## Mobile Navigation

- 390×844で左上原点 `(0,0)`、幅390px、高さ844pxのfull-screen native modal。
- Tabletは既存breakpointのまま448px sheet。Tablet専用の実機確認は未実施。
- Native modalによる背景の非操作化、body/root scroll lock、Escape、閉じた後の起点へのfocus restore。
- 共通Tab handlerとfocus guardを追加。Chromeの実画面focus枠・アクセシビリティsnapshotで「閉じる → 逆Tab → 勤怠 → Tab → 閉じる」を確認。
- 項目選択後にメニューが閉じ、スクロールロックが解除されることを確認。

## Shift Create Architecture

- Canonical Routeは既存 `/admin/projects/[projectId]/jobs/[jobId]/shifts/new`。
- `ShiftCreateEditor`をDedicated Editorとして使用。Single / Bulkを入口・画面として分離しない。
- 日付集合と `date -> Partial<common config>` の差分を別管理。全項目の複製を日別状態として保存しない。
- 既存の単日Create Action / Drawerは削除していない。Project Hubの作成導線は統合Editorへ集約した。

## Unified Dates / Common / Overrides / Preview

- 初期表示は東京日付の1日。日付追加・除外、期間・曜日からの追加、重複排除。
- 期間追加は既存日付・個別設定を保持する。
- 共通設定: 開始/終了、翌日終了、必要人数、休憩、応募締切、状態。既存契約で保存できる項目だけを提供。
- 日別設定は右Drawer、Mobile full-screen。日付はread-onlyで入力欄なし。
- 差分のある日だけ「個別設定あり」。共通設定変更は差分のない項目に反映。
- 「共通設定に戻す」後、「日別設定を保存」で差分を解除する。説明文にも明記。
- Previewで件数・個別設定数・エラー数・日付/時間/人数/休憩を確認。設定変更後はPreviewを無効化し、再確認まで作成不可。
- 作成中は入力・二重送信・キャンセルを抑制。通信失敗は保存結果確認を促す。

## Existing Backend Reuse

- `createShift` / `createShiftInline`: 変更なし、互換維持。
- `createBulkShifts`: 既存のmin 1契約を単日にも使用。Action・DB書込形は変更していない。
- `generateDates` / `normalizeOverride` / `resolveShiftConfig` / bulk Zod / schedule生成を再利用。
- `isValidDateOnly`だけ、不正月でDate変換がthrowしない純粋ガードを追加。
- 既存認証・親子関係確認・RLS・制約を継続。追加のData AccessやN+1なし。
- 保存後は通常の独立したshift row。Bulk groupや一括更新APIは追加していない。

## Compatibility Routes

- `shifts/new`: Unified Create。
- `shifts/bulk-new`: UUID形式を確認しcanonical `new`へredirect。Route削除なし。
- Chromeで旧URLから新Editorへの到達を確認。

## Shift Edit

- Single only。日付追加・共通設定・Bulk編集機能はなし。
- 必要人数の下限、配置後の休憩制限、応募・配置・勤怠・開始済みの日時制限は既存ルールを維持。
- `expectedUpdatedAt`は既存のopaque tokenのまま。
- Conflict / Pending / Submit Error / Unsaved / Successを共通表示へ。
- Conflictの「最新の内容を読み込む」は古いフォームを閉じて再取得。再オープン時に最新値を使う。
- Chromeの2タブ実操作で先行更新成功、古いtokenの更新拒否、入力保持、最新値の再読込を確認。

## Project Hub

- Header: 案件名・取引先・期間・状態・案件編集・シフト作成。
- 1JobならそのJobのEditorへ。複数Jobなら業務セクションで選択する。Jobなしなら誤ったシフト作成リンクを出さない。
- Summary: 必要、配置済み、不足、シフト数、配置率。既存集計の表示のみ。
- 概要 / 業務・勤務先 / シフト / 運用のページ内Navigation。
- Shift Overviewと案件内の運用導線を整理。応募・配置・事前確認の操作は既存Shift Hubへ。
- Future tab / 架空の監査履歴 / 別Domain操作は追加なし。
- 案件一覧で確認した期間列の詰まりを小さく修正。1280pxで再確認済み。

## Project Editor

- 案件名、支店、取引先、期間、状態、説明のみを維持。
- 支店は編集不可。担当者・カテゴリ・勤務先・時給・服装などの架空Project保存項目は追加なし。
- Jobが持つ項目との責務を補足文で明示。
- Conflict判定は文言検索から既存Action result.typeに変更。Domain判定は変更なし。
- 必須エラー、該当入力へのfocus、未保存表示、Drawer open/closeをChromeで確認。

## Job Regression

- 作成・編集フォームと既存Actionを維持。共通Feedbackを採用。
- Chromeで作成フォームを開き、既存項目を確認。空の業務名で必須エラーを検証。
- 編集でProject固定、Shift作成後のWorkplace固定、配置後の時給/交通費固定を確認。
- 勤務先がないときの未実装Masterへのdead linkを削除し、管理者確認の説明に置換。
- 新しいJob rowの作成・既存Jobの値変更は今回のQAでは行っていない。

## Shift List

- 既存Listを継続。既存取得結果だけで検索結果の件数・必要・配置・不足を表示。
- Responsive列幅を調整。小さい幅はカード表示、Desktopは一覧。
- Week / Calendarは非操作の「準備中」説明のみ。形だけのタブや独自集計を追加しない。

## Shift Hub

- 日時 / Project link / Job / Workplace / 状態 / 編集をHeaderに集約。
- Summary4項目、勤務情報・業務条件、応募、配置、事前確認のページ内セクション。
- 応募者/配置の既存操作とサーバー側ルールは変更なし。
- 履歴・当日運用などFuture routeは追加なし。

## Common States

- `AdminState` / `AdminFeedback`: presentation専用。認可や業務判定を持たない。
- Empty: Project/Shift List、Unified Editorの0日状態。
- Loading: `app/admin/loading.tsx`。Chrome遷移時の表示を確認。
- Error: 共通取得失敗Panel / `app/admin/error.tsx` + retry。
- Forbidden: 既存Actionがforbiddenを返した場合だけ表示。認可判定は変更しない。
- Not Found: 共通表示。ChromeでManagerから他支店案件が表示されないことを確認。
- Conflict: Project/Job/Shiftの既存resultを表示。Shiftは実際の競合を検証。
- Pending: 操作中の説明、入力/送信のdisabled。
- Success: 保存完了後の表示、Preview確認済みは保存完了と混同しない文言。
- Submit Error: 既存Action失敗と通信失敗の安全な表示。
- Unsaved: 変更があることの表示のみ。新しいroute guardは追加しない。

## Dashboard

- `getDashboardData`と既存集計を変更しない。
- ホーム → 本日の集計 → 対応が必要 → 今日の現場という階層。
- 実データの3指標のみ。SOS / Transportation / Closingなどの偽の数値は追加なし。
- 今回のfixtureは今日の稼働0件。データのある全Dashboard状態の視覚比較は未実施。

## Responsive / Chrome Comparison

| 対象 | Chrome確認 | Figmaとの対応 |
| --- | --- | --- |
| Dashboard | 1440 screenshot / 390 screenshot | Header・Grouped Nav・3実指標の階層。Future指標は省略 |
| Project List/Hub | 1440 / 1280、390 Hub DOMと操作 | Header・Summary・Job・Shift・運用。Future tabsなし |
| Unified Shift | 1280 screenshot / 390操作 | 日程・共通設定・差分Drawer・Preview・sticky footer |
| Shift List | 1440 screenshot / 1280 / 390 | 既存List + result summary、Week/Calendarなし |
| Shift Hub | Desktop / 390 screenshot・編集 | Summary・Overview・応募・配置・編集 |
| Mobile Nav | 390×844 screenshot・実キー | 左起点full-screen、grouped nav、準備中、focus循環 |

- 上記の確認幅でdocumentの横overflowなし。全Device/全データ組合せのpixel-perfect保証ではない。
- Chrome extension / Native Host経由の操作が今回は利用可能。前回監査のBrowser blockerは解消。
- 利用中の接続Chromeで実操作。Profileのファイルやcookie/session storeは読んでいない。
- 入力支援ツールのfillだけではReact側変更が確定しないケースがあり、日付・数値はネイティブキー操作で確定した。
- Focusの最終判定は実画面とaccessibility snapshotのactive表示で行った。

## Browser QA Results

- Local Manager sign-in成功。資格情報はソース・結果ファイルへ保存していない。
- Nav open/close、expanded/collapsed、nested active、placeholder非リンク、mobile route change後close、Escape/focus restore: PASS。
- Unified initial1 / zero-day error / add / exclude / duplicate refusal / single preview / single create: PASS。
- Two dates / common propagation / override retention / reset / preview invalidation / required-workers error / multi create: PASS。
- Mobile Drawer full-screen / date immutable / Tab forward/reverse / Escape: PASS。
- Shift single edit / success / stale concurrency / retain attempted value / reload latest / restrictions: PASS。
- Bulk-new redirect / loading / cross-branch Not Found: PASS。
- 新規作成したローカルQA行:
  - 2099-01-27: `69200903-191c-4db2-be3b-c0cc917387c0`。作成1名、競合検証の先行保存で2名。
  - 2099-01-28: `e692968d-f6a7-49a5-a4ec-16bac3a28a1c`。共通2名。
  - 2099-01-29: `2ecf63b3-d5d9-4aae-b42c-fd55eea58299`。個別3名。
- 3件ともTEST Project N1 / TEST Job N1配下。削除UIがないため残置。SQL cleanupなし。

## Console

- QAタブのChrome warning/error logにReact/Hydration/Runtime errorは観測されなかった。
- 操作した通常遷移と保存で通信失敗は観測なし。全Network requestのHAR監査は未実施。
- CSSは実表示・overflow・Drawer boundsを確認。自動A11y全ルール監査は未実施。
- Next.js開発インジケーターは開発環境固有の重なりとして区別した。

## Security / DB

- Migration / RLS / GRANT / RPC / DB Function / Trigger / Auth実装 / Seed: 差分なし。
- Remote接続・remote mutationなし。Supabase CLIからローカルURLを確認し、開発/ビルドprocessにのみ上書きした。`.env.local`変更なし。
- app/actions / lib/auth / lib/supabase / Worker / package filesに差分なし。
- QAの更新は指定のLocal Manager UIからのみ。新規作成3行とそのうち1行の必要人数更新。

## Tests / Validation

- `node scripts/integration/admin-ui-alignment-test.mjs`: 24/24 PASS。UI日付状態、差分/リセット、既存bulk schema、Navigation availability/active。
- `node --experimental-strip-types scripts/integration/bulk-shift-helpers-test.ts`: PASS。Nodeの既存module-type warningのみ。package設定は変更しない。
- `node scripts/integration/admin-ui-security-readonly-test.mjs`: 7/7 PASS。READ ONLY transaction内でRLS有効、anon読取なし、authenticated削除なし、自支店可視・他支店Project/Job/Shift非表示。
- 既存 `edit-concurrency-test.ts` はSQL insert/deleteを伴うため今回は実行せず、Chromeの2タブ・既存Action経由で同じ拒否/再読込を検証。
- 既存Data API全件テストはAuth fixture更新、RLS全件テストはGRANT変更を前処理に含むため未実行。既存148/105等の件数を今回のPASSとして流用しない。
- TypeScript: PASS。
- Production build: PASS。
- 変更/追加TS・TSX・MJSのscoped ESLint: PASS。
- `git diff --check`: PASS。

## Existing Diff

- 元の監査文書は開始時からuntracked。内容変更なし。
- 今回の新規結果文書・UI helper/testは別ファイル。既存の未完了Phaseや将来Domainをcleanupしていない。

## Remaining P1

- Shift Week / Shift Calendar
- Pre-shift monitor
- Staff basic
- Client / Workplace Master
- Attendance visual alignment

## Remaining Future Domain

- Placement / Break、Day-of Future、Transportation
- Closing / NEO、Communications、Knowledge
- Settings persistence、Audit Log、Multi-venue

## Limitations

- Future Domain、Staff/Client/Settings永続化は今回の完了対象外。
- Job新規保存、全RoleのAuth E2E、全Security suite、強制的な通信断/500/Forbidden表示、全Dashboardデータ状態は未検証。
- 既存Backendを変更せず、画面構造と操作を整合させたP0。全Figma状態のpixel parityではない。
- QAの3行はローカルに残置し、remoteには一切反映していない。

UI-2.3F: COMPLETE
