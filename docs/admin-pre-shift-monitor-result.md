# Phase UI-2.4B 実装結果

## Sources
- Figma `523:2`（一覧）/ `525:2`（Drawer）を参照。
- `Dispatch OS UI/UX v1`、UI Pattern、現行Assignment / Shift / Pre-shift domainを正本とした。
- Figma中の未実装ドメイン（連絡、再送、管理者確認、欠員対応）は採用していない。

## Git State
- 開始時点の既存変更をハッシュ記録し、UI-2.4B対象外は編集していない。
- commit / pushなし。

## Route
- Canonical: `/admin/pre-shift?date=YYYY-MM-DD`
- 詳細は `assignment=<id>` のURL状態。動的詳細Routeは追加していない。
- 不正・欠落日付は東京の翌日に安全にフォールバックする。

## Navigation
- 共通Admin Navigationの「前日確認」を実装済みリンクへ変更。
- Desktop / Mobile共通定義、route上でactive。

## Existing Domain Inventory
- Assignment: active statusのみ（assigned / confirmed / completed）。
- Pre-shift: can_work / health_status / planned times / comment / submitted_at / updated_at。
- Project / Job / Workplace / Shift / Worker profileを既存FKから参照。

## Figma Fields
- 採用: 日付移動、集計、フィルタ、高密度一覧、詳細Drawer。
- 除外: 未実装の連絡状態、再送、管理者確認、電話、欠員対応。

## Data Access
- Server Component → `lib/admin/pre-shift` → Supabase Data API。
- 500件単位の全ページ取得でrow capを回避。単一join queryでN+1なし。
- 東京日付の `[00:00, next 00:00)` とShift開始時刻で限定。

## Summary
- 対象シフト / 対象スタッフ / 確認済み / 未確認を実データ集計。

## Filters
- GET URL: staff/project検索、案件、確認状態。日付を保持。
- 対象日の案件だけを選択肢に表示。

## Sorting
- 未確認 → 開始時刻 → スタッフ名 → Assignment ID。

## Desktop List
- スタッフ、案件・業務、勤務先・時間、確認状態、詳細を表形式で表示。
- Project / Shiftへの既存詳細リンクあり。

## Mobile List
- 同一情報を縦積みカード行として表示。
- 操作領域は最小44px。

## Staff Detail Drawer
- Header: スタッフ名と閉じる操作。
- Work info: 案件、業務、勤務先、勤務時間。
- Confirmation: 勤務可否、体調、起床/出発予定、コメント。
- Metadata: 提出日時、更新日時。
- Actions: 読み取り専用。
- Future omitted: 再送、管理者確認、電話、連絡履歴。

## Drawer Behavior
### Desktop
- Width: 共通Drawerの最大幅3xl。
- Open/Close/Escape: Chromeで確認。
- Focus restore: 詳細リンクへ復帰を確認。

### Mobile
- Full-screen: 390x844で幅全体。
- Focus trap / Shift+Tab: 共通native dialog focus guardを継続使用。
- Escape / Scroll lock: close、body overflow hidden→解除を確認。

## URL / History
- Date direct / Prev / Next / Tomorrow: 実表示確認。
- Back: Drawerが閉じる。
- Forward: Drawerが再表示。
- Drawer history: assignment queryを採用。

## Project / Shift Integration
- Project Hub / Shift Hub: 既存詳細routeへリンク。
- Entry links: 一覧各行から両方へ遷移可能。

## Empty / Loading / Error
- 日付空、filter空、全員確認済みを区別。
- Admin Loading / Error / Not Found patternを使用。
- branch外・存在しないassignmentは詳細を出さずNot Found。

## Responsive
### 1440
- Desktop table、overflowなし。
### 1280
- Desktop table、overflowなし。
### 390×844
- 縦積み一覧、full-screen Drawer、共通Mobile Navigation、overflowなし。

## Chrome QA
- Default: 2026-09-05の空状態。
- Fixture: 2099-01-15、1 shift / 1 staff / 0 confirmed / 1 pending。
- Filter: confirmedでfilter empty。
- Drawer: open/close/Escape/focus/lockを確認。
- Links: Project / Shift hrefを確認。
- History: back / forwardを確認。

## Data Verification
- Assignment: `40000000-...0002`、active confirmed。
- Worker: TEST Worker B。
- Shift: `20000000-...0001`、09:00-18:00。
- Confirmation: Data APIで該当なし、UIは未確認。
- DB: manager sessionのRLS適用Data API結果を読み取り専用で確認。
- UI: Shift一覧の同一Shift/配置1名とmonitor表示を照合。

## Security
- Manager: server-side auth + RLSを維持。
- Branch: RLS後の取得集合からのみDrawerを解決。
- System Admin / Worker: policy変更なし。
- RLS / GRANT: 変更なし。

## DB
- Migration / RLS / GRANT / RPC / Function / Trigger / Seed / Remote: すべて変更・実行なし。

## Regression
- Shift List / Week / Calendar / Shift Hub / Unified Create / Worker Pre-shift: 実装変更なし。

## Console
- React / Hydration / Runtime / Network / CSS / A11y: Chrome error・warningなし。

## Tests
- Date: default / invalid / Tokyo tomorrow / exclusive range。
- Filtering: search / project / confirmation state。
- Status: active status query、pending/confirmed。
- Sorting: pending-first、time/name/stable ID。
- Security: RLS後集合から安全に詳細解決。
- Other: query preservation、pagination helper再利用。

## Validation
- TypeScript: PASS
- Build: PASS
- scoped ESLint: PASS
- git diff --check: PASS（既存LF/CRLF warningのみ）

## Existing Diff
- UI-2.4A以前の未コミット差分を保持。UI-2.4Bは新route/components/lib/test/reportと共通navの1項目のみ。

## Limitations
- fixtureには確認済み回答がなく、回答済みDrawerはコード/型/表示分岐で検証。データ作成は禁止条件のため実施していない。

## Next Phase

UI-2.4C Staff Basic

UI-2.4B: COMPLETE
