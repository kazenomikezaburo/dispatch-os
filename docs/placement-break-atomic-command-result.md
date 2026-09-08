# DB-2.5C2: Break / Atomic Placement Plan Command — 実装結果

## スコープ

配置計画の通常書込みを、休憩を含む単一の原子的な RPC に集約した。UI、配置エディタ、Coverage の永続化、Assignment / Attendance の状態遷移、既存の認可ルールは変更していない。

- Migration: `supabase/migrations/20260908064853_placement_break_atomic_command.sql`
- Integration test: `scripts/integration/placement-break-atomic-command-test.mjs`
- RPC: `public.save_shift_placement_plan(uuid, bigint, text, text, jsonb, jsonb, jsonb)`

## 永続化モデル

`assignment_break_intervals` は `plan_id` / `shift_slot_id` / `assignment_id` と半開区間 `[start_at, end_at)` を保存する。`end_at > start_at`、Plan と Assignment の Shift 一致を複合外部キーで保証し、同一 Assignment の休憩重複は GiST exclusion constraint で拒否する。隣接する休憩は許可される。

`shift_placement_plan_revisions` は、version の `from -> to`、認証済み actor、理由、idempotency key、canonical request、変更前後の配置グラフ、warning を追記保存する。`version_to = version_from + 1`、actor ごとの idempotency key 一意制約、更新・削除権限を付与しない RLS により append-only とした。

## RPC 契約

入力は `shiftSlotId`、`expectedVersion`、`idempotencyKey`、`reason`、および Positions / Segments / Breaks の JSON 配列である。各配列要素は client-generated UUID を必須とし、未知フィールド・型外・重複 ID・上限超過を拒否する。配列はその時点で編集可能な子要素の完全グラフであり、欠落した active Position は退役、編集可能な Segment / Break は削除対象となる。

作成時は `expectedVersion = 0` で Plan version を `1` にし、以降は完全一致した version だけが `+1` で保存される。古い version は `VERSION_CONFLICT` を返し、書込みしない。同一 actor / idempotency key で canonical request が同一なら元の結果を replay し、異なれば `IDEMPOTENCY_CONFLICT` を返す。

RPC は Shift、Plan、対象 Assignment を順序固定でロックして検証・差分書込み・version 更新・Revision 追記を一トランザクションで行う。`SECURITY DEFINER` と空の `search_path` を設定し、実行権限は `authenticated` のみ。Placement 5 テーブルへの authenticated の INSERT / UPDATE / DELETE は付与していない。

## 検証ルール

- Segment / Break は Shift の時間範囲内かつ正の半開区間。
- 同一 Assignment の Segment と Break の重なりは最終グラフで `OVERLAP`。
- Segment は active Position と同一 Plan に属する Assignment を参照する。
- active Position の required workers 合計は Shift の required workers 以下。
- Assignment は通常時 `assigned` / `confirmed` のみ。`cancelled`、`absent`、`no_show` は変更不可。
- Shift 開始後は correction として理由を必須化し、`completed` Assignment はこの correction の場合だけ変更可能。Shift 自体が `cancelled` の場合は拒否する。

休憩時間の合計と Shift の `break_minutes` は warning として返却・Revision 保存する。under / over は非ブロッキングで、Shift の break target が未設定なら該当 warning は返さない。coverage shortage も warning のみであり、Coverage を保存していない。時間スライス Coverage の読取モデル・UI は後続 Phase の対象である。

## ローカル検証結果

- `node scripts/integration/placement-break-atomic-command-test.mjs`: 20/20 PASS
- `node scripts/integration/placement-core-schema-test.mjs`: 26/26 PASS
- `node scripts/integration/placement-rules-test.mjs`: 39/39 PASS
- `node scripts/integration/placement-security-readonly-test.mjs`: 28/28 PASS
- `npx supabase db advisors --local --type security --fail-on error`: No issues found
- `npx tsc --noEmit`: PASS
- `npx eslint scripts/integration/placement-break-atomic-command-test.mjs`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

統合テストは事前に対象 Shift の Plan が存在しないことを確認し、最後にテストで作成した Plan と子要素・Revision を削除する。既存 fixture を変更せず、remote Supabase への接続、`db push`、`db reset`、seed、Auth 変更は実行していない。

## ブラウザ QA

DB-2.5C2 は画面を追加・変更しない。ローカル認証済み Chrome は以前の supplied manager credential で `invalid_credentials` となっており、本 Phase の範囲では Auth のリセットやユーザー変更をしないため、認証済み UI 実操作は限定扱いとする。DB の認可・原子性は上記のロールコンテキスト統合テストを正本として確認した。
