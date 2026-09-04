# Phase UI-2.4A — Shift Week / Calendar View

検証日: 2026-09-03（Asia/Tokyo）

実装と自動検証は完了。Chromeの履歴 Back / Forward の実操作確認のみ保留。
この項目をPASSと推測せず、最終判定は確認待ちとする。

## Sources

- Figma List: [496:2900](https://www.figma.com/design/Pmb52CO7UgsQDA5tvoqUjF/Dispatch-OS?node-id=496-2900)
- Figma Week: [505:352](https://www.figma.com/design/Pmb52CO7UgsQDA5tvoqUjF/Dispatch-OS?node-id=505-352)
- Figma Calendar: [505:512](https://www.figma.com/design/Pmb52CO7UgsQDA5tvoqUjF/Dispatch-OS?node-id=505-512)
- 上記3ノードのデザイン情報・画像を直接確認。Figmaの例示日付や未実装Domainの指標を実データとしてコピーしていない。
- Design Foundation: `docs/dispatch-os-design-foundation-v1.md`、`app/globals.css`。
- IA / Interaction: `docs/dispatch-os-ui-ux-v1.md`、`docs/dispatch-os-ui-patterns-v1.md`。
- 台帳: `C:/Users/user/Documents/Dispatch_OS_画面構成台帳.xlsx`、`Dispatch_OS_画面構成_完成版.md`。既存の案件・業務文脈に属する作成導線を保持。台帳自体は変更なし。
- Existing Shift code: `app/admin/shifts/page.tsx`、`lib/admin/shifts/get-shifts.ts`、`shift-query-schema.ts`、`shift-list-rules.ts`、既存List・Hub。
- 実装API確認: インストール済みNext.jsの`page.md`、[Supabase range](https://supabase.com/docs/reference/javascript/using-modifiers-range)。

## Git State

- Branch: `small-ui-a11y-fix`。
- Existing staged: 0。
- Existing unstaged: 36 tracked files。
- Existing untracked: 14 files。
- UI-2.3Fの既存差分を保持。開始時の50ファイルのハッシュと照合し、今回重なる`app/admin/shifts/page.tsx`以外の49ファイルは変更なし。
- Commit / push / branch変更 / cleanup: 未実施。

## Route Architecture

Before: `/admin/shifts`で一覧のみ。

After: 同一Server Component Page内でList / Week / Calendarを分岐。
新Route・Route Handler・API・Client Pageは追加していない。
`/admin/shifts/[shiftId]`と既存の作成Routeは維持。

## URL State

- List: `/admin/shifts?view=list`。省略時も一覧。
- Week: `/admin/shifts?view=week&date=2099-01-27`。
- Calendar: `/admin/shifts?view=calendar&month=2099-01`。
- 日別List: `/admin/shifts?view=list&date=2099-01-27`。
- 共有条件: `q` / `period` / `status` / `staffing`。切り替え・期間移動でも維持。
- Week / Calendar / 日別Listでは明示日付を`period`より優先。画面でも説明し、一覧へ戻す際は元の期間条件を再利用。
- Week→Calendarは表示中のアンカーの月、Calendar→Weekは当月なら今日、それ以外はその月の1日をアンカーにする。
- 通常のView切り替えでListへ戻す場合、暗黙の日別絞り込みを追加しない。日付セルからの遷移だけ明示的に`date`を指定。
- Invalid fallback: 未知のViewはList、不正・欠落Week日付は東京の今日、不正・欠落Calendar月は東京の今月。不正日付付きListは東京の今日、日付指定なしListは従来期間条件。
- 実在日付を検証。UI入力は0100〜9998年に限定し、4桁ISO年の前後演算余地を確保。Domainの保存ルールは変更していない。
- 直接アクセス・同じURLへの再アクセス: 同じ週を確認。
- Back / Forward: 自動キーボード操作がブラウザー履歴に反映されず、実操作未確認。URL生成・条件保持の自動テストはPASSだが、これを履歴操作の証明には代用しない。

## Shared Page Structure

- Header: 共通`ShiftPageHeader`、タイトル「シフト一覧」、指定の説明文。
- Summary: `ShiftSummary`。対象シフト / 必要 / 配置 / 不足を既存数値から集計。集計対象を明記。
- Filters: 既存`ShiftFilters`を拡張。日付・ViewはGETフォームで保持。semantic token・44px controlに統一。
- View Switcher: `ShiftViewControls`。通常のLink、`aria-current`、明示focus ring。
- Main Content: 既存`ShiftList`、新しい`ShiftScheduleViews`、共通`ShiftPreviewCard`。
- Loading / Error / Empty: UI-2.3Fの共通Stateを再利用。Errorには同じURLを再読込する導線を追加。

## List View

- Regression: 既存List / ListItem / Hub実装は変更していない。
- Filters: 既存の4条件を保持。Chromeで検索→0件→リセット→1件への復帰を確認。
- Summary: 同じ検索結果に基づく4指標。既存の不足・active assignmentの定義は変更なし。
- Mobile: 既存の縦型カード。390×844で日付・時刻・案件・勤務先・人数・状態を確認。
- Calendarの日付から1件の日別Listへ移動し、他の検索条件も保持することを確認。

## Week View

- Range: 7日間。東京の開始日を含み、翌週開始日を含まない。
- Week Start: 月曜〜日曜。
- Navigation: 前後7日・今日。年/月境界を越えて移動可能。
- Day Columns: Desktopは7列、1024px未満は7日分の縦並び。
- Shift Card: 時間、案件、業務、勤務先、既存状態、配置/必要、不足。Shift HubへLink。
- Empty Day: 0件と静かな「シフトなし」。全体0件時も7日を表示。
- Shortage: `max(required - active assigned, 0)`の既存結果を使用。warning token＋人数テキスト。色だけに依存しない。
- モバイルの本文は14px、Desktopのcompact cardは12px。長い勤務先は補助情報として省略表示し、詳細画面で確認可能。

## Calendar View

- Month: 選択月の1日を含む月曜から35または42日。
- Alignment: 月曜始まり。2028年2月29日を含む正しい曜日配置をChromeとテストで確認。
- Spill-over days: 月外セルをmuted表示。日付を押すとその月へ移動する。2099-01の2/1→2099-02をChromeで確認。
- Shift Preview: Desktopは日付ごとに最大2件。開始時刻順、同時刻はIDで安定化。
- Overflow: 残りを`+N件`で日別Listへ。10件→2件＋8件をテストで確認。
- Shortage: Weekと共通のプレビュー部品。既存状態と不足人数だけを表示。
- Day Action: 当月の日付→日別List。プレビュー→Shift Hub。セル全体のクリックや編集操作なし。
- Summary: 当月内のシフトだけを集計。月外セルの補助表示とは明確に区別。
- Mobile: 縮小7列グリッドではなく、当月31日等を日付順に縦並びにする月間予定。各日からList、各カードからHubへ進める。

## Data Access

- Query: 既存Supabase SSRクライアントとData APIを利用。Server Componentから`getShifts`を呼ぶ。
- Date Range: Week7日 / Calendar35–42日 / 日別List1日をDBの`gte(starts_at)`・`lt(starts_at)`で限定。
- Assignment count: 既存active status `assigned / confirmed / completed`を使用。Applicationsも既存`applied / accepted`を保持。
- N+1: 日ごと・シフトごとの問い合わせなし。関連IDを100件単位にまとめ、応募・配置を並列取得。
- 大きい結果: シフトと関連行を500行単位で分割取得。exact countと安定orderを使用し、サーバー側の返却上限が500未満でも続きから取得する。取得エラー・不完全な結果はError Stateへ。
- Branch scope: 認証ユーザーの既存RLSに委譲。service_role、追加RPC、Client直接Queryなし。
- Listも同じ読取処理を使い、従来の1回の返却上限で不足計算が欠落する問題を避ける。件数・不足の業務定義は変更していない。

## Date Helpers

- Week: civil date演算で月曜開始・7日。
- Calendar: 月初、月末、spilloverを算出。35–42日。
- Timezone: 今日・日別グループ・時刻はAsia/Tokyo。DBの範囲境界は東京の午前0時。
- 夜勤: 開始日のグループに1回だけ表示。終了日が異なる場合は終了側の日付を明記。
- Invalid input: フォーマット＋実在日付＋演算範囲を検証。
- Leap year: 2028-02-29有効、2027-02-29無効。

## Responsive

### 1440

- List: 既存の横型一覧を確認。
- Week: 7列で既存3シフト、空の日、人数を確認。
- Calendar: 7列、View・月・共有条件を確認。
- Overflow: `scrollWidth === clientWidth`。横はみ出しなし。

### 1280

- List: 当日1件の一覧・数値を確認。
- Week: 7列・長い勤務先の省略・カードを確認。
- Calendar: 月境界・プレビュー・日付リンクのfocus・うるう月を確認。
- Overflow: `scrollWidth === clientWidth`（scrollbarありでは1265px）。

### 390×844

- List: 既存カード、検索・リセット・日別絞り込みを確認。
- Week: 日付別縦並び、3シフト、縦スクロール、focus ringを確認。
- Calendar: 月間予定形式で日付・件数・シフトカードを確認。日付→当日一覧も実操作。
- Navigation: 全面ナビ、Active、Shift+Tabでの循環、Escape、トリガーへのfocus復帰を確認。
- Touch: 月間予定の表示中main内input/select/button/linkは44px以上。
- Overflow: `scrollWidth === clientWidth`（scrollbarを除き375px）。ページ横スクロールなし。
- 表示検証時のブラウザーサイズ適用に一時的な画像縮尺の問題があったが、viewportをreset→再設定して正しいモバイル画像で再確認した。

## Chrome Week QA

- URL: `http://127.0.0.1:3000/admin/shifts?view=week&date=2099-01-27`。
- Fixture: 既存の2099-01-27 / 28 / 29。
- Date grouping: 1/26(月)〜2/1(日)内の火・水・木へ各1件。
- Prev: 1/19(月)〜1/25(日)。
- Next: 1/26へ戻ること、さらに2/2(月)〜2/8(日)も確認。
- Today: 2026年8/31(月)〜9/6(日)、9/3に「今日」。
- Empty: 今日の週0件でも7日間と共通Empty Stateを表示。
- Shift navigation: 1/27のカード→同日のShift Hubを確認。
- URL direct/reload: 同じ週を確認。Back/Forwardだけ別途確認待ち。

## Chrome Calendar QA

- URL: `http://127.0.0.1:3000/admin/shifts?view=calendar&month=2099-01`。
- Month: 2099年1月。月外2/1→2099年2月を確認。
- Fixture: 同じ3シフトを月末の火・水・木で確認。
- Alignment: 2028-02は1/31(月)開始、2/29(火)、3/5(日)まで35セル。
- Prev: 2099年1月→2098年12月（空）。
- Next: 2098年12月→2099年1月。
- Today: 2026年9月、3日に「今日」。
- Overflow count: 同日3件以上の既存fixtureがなく、Chromeでは未検証。10件のpure helper testはPASS。QA用Shiftを追加していない。
- Shift navigation: 1/27プレビュー→Shift Hub、1/27日付→Listを確認。
- Filters: 条件送信後も`view=calendar&month=2028-02`を保持することを実URLで確認。
- Invalid: `month=2026-13`→今月、`date=2026-02-30`→今週、`view=invalid`→List、いずれもHTTP200。

## Data Verification

ローカルDBで`BEGIN READ ONLY`、Manager AのJWT claimsをトランザクション内だけに設定して照合。データ・認証ユーザーは変更していない。

| Shift ID | DB / UI Tokyo date | Time | required | assigned | shortage |
| --- | --- | --- | ---: | ---: | ---: |
| `69200903-191c-4db2-be3b-c0cc917387c0` | 2099-01-27 | 09:00–18:00 | 2 | 0 | 2 |
| `e692968d-f6a7-49a5-a4ec-16bac3a28a1c` | 2099-01-28 | 09:00–18:00 | 2 | 0 | 2 |
| `2ecf63b3-d5d9-4aae-b42c-fd55eea58299` | 2099-01-29 | 09:00–18:00 | 3 | 0 | 3 |

週集計: 対象3件、必要7名、配置0名、不足7名。3件の日付と不足数をWeek / Calendarで確認し、1/27の必要2・配置0・不足2を日別List / Hubでも照合。

## Navigation Regression

- Expanded: Week / Listの表示と操作を確認。
- Collapsed: 折りたたみ操作、tooltip、カレンダー表示を確認。
- Active: `/admin/shifts?view=...`でシフトがActiveのまま。
- Mobile Nav: 全面表示、背景との分離、キーボード循環、Escape、focus復帰を確認。
- Sidebar / Shellコードは今回変更なし。

## Unified Shift Create Regression

- Entry: シフト一覧の「シフトを作成」→案件一覧→Project N1→Job N1の作成Link。
- Create: 既存の統一エディターで固定されたProject / Job / Workplace、日程・共通設定・プレビューを確認。入力変更・プレビュー確定・保存は実行していない。
- Compatibility: `/shifts/new`の既存エディターを使用。`bulk-new`を含む作成コードは開始時ハッシュと一致。

## Shift Hub Regression

- Navigation: Week / Calendar両方から1/27のHubへ到達。
- Display: 日付・時刻・案件・業務・勤務先、必要2/配置0/不足2、既存の応募・配置・前日確認Sectionを確認。
- Hub / Shift Editのコードは今回変更なし。

## Security

- Manager: 既存ログイン済みセッションを使用。自Branchデータを確認。
- Branch scope: read-only testで自BranchのProject可視、他BranchのProject / Job / Shift不可視を確認。
- System Admin: guardとRLSを変更していない。今回、別アカウントでのChromeログインは未実施。
- Worker: UI変更なし。既存`requireAdmin`のWorker→`/worker`をコードで確認。Workerによる新規ブラウザー試験は未実施。
- RLS: 読み取り専用チェックPASS。既存148件全体のsuiteはsetup mutation回避のため未実行。
- GRANT: anon業務SELECTなし、authenticated DELETEなしを読み取りで確認。追加なし。

## DB

- Migration / RLS / GRANT / RPC / Function / Trigger / Seed / Auth: すべて変更なし。
- Remote: 接続・書き込み・db pushなし。
- Docker: `supabase_db_dispatch-os` healthy。
- Local API: `http://127.0.0.1:54321`。
- `.env.local`はremote設定を保持しているため、dev/buildプロセスにローカルURLとローカル公開キーを明示上書き。ファイル自体は変更していない。
- このタスクのdevを上記設定で再起動後、主要画面を再検証。最終devは`127.0.0.1:3000`。
- Fixture作成・更新・削除なし。SQLの引用符エラーが1回あったが、実行前構文エラーであり書き込みなし。その後、同じread-only照合に成功。

## Console

- React / Hydration / Runtime: 確認時のChrome warn/errorログは0件。
- Network: 確認した画面・遷移・不正URLはNextログでHTTP200。網羅的HAR採取はしていない。
- CSS: 3幅で横はみ出しなし。モバイルのフォント調整後も目視確認。
- A11y: 44px対象、focus、ラベル、状態テキスト、ナビ循環を手動確認。自動a11y監査ツールは未使用。

## Tests

- `node scripts/integration/shift-views-test.mjs`: **33/33 PASS**。
  - View parser / invalid fallback / 配列パラメーター。
  - Monday / Sunday / 年月境界 / prev-next / Tokyo境界。
  - Calendar35–42日 / うるう年 / 12か月の曜日整合。
  - 条件保持 / 日別リンク / Viewアンカー。
  - Tokyo日付grouping / 空日 / 同日複数Shift保持 / 安定sort。
  - 10件→2件＋8件 / 夜勤終了日。
  - 既存不足Rule / 低いサーバー返却上限 / Query error / 不完全結果。
- `node scripts/integration/admin-ui-alignment-test.mjs`: **24/24 PASS**。
- `node scripts/integration/admin-ui-security-readonly-test.mjs`: **7/7 PASS**。
- 初回の夜勤テストはIntl出力の表記期待（日本語年月日とスラッシュの違い）で失敗。終了日そのものを共通labelで比較するよう新規テストを修正し、全PASS。既存Securityの期待値変更なし。

## Validation

- TypeScript: `npx tsc --noEmit` PASS。
- Build: ローカル接続設定で`npm run build` PASS（最終UI調整後も再実行）。
- scoped ESLint: 今回のPage・Component・Data helper・TestでPASS。
- `git diff --check`: PASS。環境のLF→CRLF通知のみで、whitespace違反なし。
- Package追加: なし。

## Existing Diff

今回の既存ファイル変更（4）:

- `app/admin/shifts/page.tsx`（UI-2.3F差分に重なる唯一の既存差分ファイル）
- `components/admin/shifts/shift-filters.tsx`
- `components/admin/shifts/shift-page-header.tsx`
- `lib/admin/shifts/get-shifts.ts`

今回の追加（8、報告書を含む）:

- `components/admin/shifts/shift-summary.tsx`
- `components/admin/shifts/shift-view-controls.tsx`
- `components/admin/shifts/shift-preview-card.tsx`
- `components/admin/shifts/shift-schedule-views.tsx`
- `lib/admin/shifts/shift-view-rules.ts`
- `lib/admin/shifts/read-all-pages.ts`
- `scripts/integration/shift-views-test.mjs`
- `docs/admin-shift-views-result.md`

DB / Auth / Actions / Worker / packageファイルのgit差分なし。前Phaseのその他差分はそのまま残している。

## Limitations

1. **最終確認待ち:** Chrome自身のBack / Forward。自動操作では履歴ショートカットが反映されず、ユーザーに週・URLの復元確認を依頼した。実装不具合を観測したわけではないが、PASS扱いにはしない。
2. 同日3件以上の既存データがなく、`+N件`のChrome実データ確認は未実施。pure testとComponent実装を確認済み。
3. 意図的なネットワーク切断・DB障害・権限変更によるErrorのブラウザー再現はしていない。共通Error/Loading部品を再利用し、取得失敗のpure testを実施。
4. System Admin / Workerでの新たなログインQA、網羅的a11y自動監査、大量データ性能測定は今回未実施。

## Next Phase

UI-2.4B Pre-shift Monitor。今回、新規Domainや後続Phaseの機能は追加していない。

## 判定

**UI-2.4A: COMPLETE** — 実装・自動検証・主要Chrome QAは完了。Back / Forwardの最終実操作確認待ち。
