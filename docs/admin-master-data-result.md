# Phase UI-2.4D 実装結果

## Sources
- Figma Client: node `286:401`
- Figma Client Editor: node `286:569`
- Figma Workplace: node `286:763`
- Figma Workplace Editor: node `286:931`
- Design Foundation: `docs/dispatch-os-design-foundation-v1.md`、`docs/dispatch-os-ui-patterns-v1.md`

## Git State
- Branch: `small-ui-a11y-fix`
- Existing staged: なし
- Existing unstaged: UI-2.3F〜UI-2.4B等の既存差分あり。保持
- Existing untracked: 既存Phaseの画面・文書・試験あり。保持

## Domain Boundary Audit

### Client
- Table: `public.clients`
- Branch: `branch_id` で支店スコープ
- Project relation: `projects.client_id -> clients.id`
- RLS: Managerはアクセス可能支店、System Adminは全件、WorkerはAdmin用途不可
- Write support: authenticatedにINSERT/UPDATE、RLSで最終制御
- Final SOT: Client名・メモ・有効状態は `clients`

### Workplace
- Table: `public.workplaces`
- Fields: name、postal_code、address、交通・アクセス・集合案内、is_active、timestamps
- Branch: `branch_id` で支店スコープ
- Client relation: Client FKなし。UI上も捏造しない
- RLS: Managerはアクセス可能支店、System Adminは全件。WorkerのSELECTは既存Policyの範囲
- Write support: authenticatedにINSERT/UPDATE、RLSで最終制御

### Job / Workplace
- Job fields: `workplace_id` を保持
- Workplace FK: `jobs.workplace_id -> workplaces.id`、必須、DELETE RESTRICT
- Duplicate fields: Jobに勤務先名・住所の複製保存なし
- Existing restriction: Shift存在後のJob勤務先変更禁止を維持
- Final SOT: 勤務先名・住所等は `workplaces`、JobはFK参照

## Implementation Decision
- Client: 実装
- Workplace: 実装
- Reason: 判定C（両Masterが存在し、JobがWorkplace FKを保持）で既存Schema・RLS・GRANTだけで安全に成立

## Routes
- Client: `/admin/clients`
- Workplace: `/admin/workplaces`
- Create: 各一覧の右Drawer
- Edit: 各一覧の共通Drawer。新規Routeなし

## Navigation
- Client before: placeholder
- Client after: implemented
- Workplace before: routeなし
- Workplace after: implemented
- Desktop: 共通定義から「マスタ > 取引先 / 勤務先」
- Mobile: Desktopと同一定義

## Client List
- Header: Breadcrumb、説明、追加Action
- Summary: 一覧条件に一致する登録件数と全体の有効件数
- Search: name、server-side
- Filters: active / inactive、GET URL
- Pagination: 20件、bounded page
- Columns: 名称、メモ、案件数、状態、更新日、編集
- Mobile: table縮小ではなくカード状の縦配置

## Client Fields

### Used
- name、note、is_active、branch_id、created_at、updated_at

### Figma-only / omitted
- 担当部署、担当者、電話等の連絡先、案件種別、ロゴ。現Schemaにないため未実装

## Client Editor
- Create: local UI Server Action
- Edit: 同一Editor
- Fields: name、note、status。branchは作成時のみ選択
- Immutable: id、編集時branch_id、created_at
- Validation: Zod + Server
- Authorization: ServerでRLS可視branchを再検証
- Concurrency: `updated_at` の比較と条件付きUPDATE。Chrome 2タブで競合表示を確認
- Delete: なし。無効化のみ

## Client Data Access
- Query: Server ComponentからData Access Function
- Pagination: count exact + range、20件
- Project count: relation count
- N+1: なし
- Branch: RLS可視範囲

## Workplace List
- Implemented: はい
- Header: Breadcrumb、説明、追加Action
- Search: name / address、server-side
- Filters: active / inactive、GET URL
- Pagination: 20件
- Mobile: カード状縦配置

## Workplace Editor
- Implemented: はい
- Create: local UI Server Action
- Edit: 同一Editor
- Fields: name、postal code、address、交通・アクセス・集合案内、status
- Job relation: 新規Masterが既存Job selectorへ即時反映
- Restrictions: branch不変、hard deleteなし、Job/Shift側の既存制約は未変更

## Project Integration
- Client select: `clients` を既存取得
- Create: QA Clientが選択肢に反映
- Edit: 既存経路を変更せず維持
- Regression: なし

## Job Integration
- Workplace source: `workplaces`
- Create: QA Workplaceが選択肢に反映
- Edit: 既存Master選択を維持
- Existing Job values: 自動match・migrationなし
- Shift restriction: 維持
- Regression: なし

## Responsive

### 1440
- Client: PASS
- Workplace: PASS
- Overflow: なし

### 1280
- Client: PASS
- Workplace: PASS
- Overflow: なし

### 390×844
- Client: PASS
- Workplace: PASS
- Drawer: full-screen
- Navigation: 共通定義・操作可能
- Overflow: なし

## Chrome QA

### Client
- List: PASS
- Search: PASS
- Pagination: 実データは1ページ。rule testで境界確認
- Create: 1件作成
- Edit: PASS、2タブ競合PASS
- History: search URLのBack / Forward PASS
- Mobile: full-screen、Escape、focus restore、scroll lock PASS

### Workplace
- List: PASS
- Search: PASS
- Create: 1件作成
- Edit: アクセス補足を更新しPASS
- Job integration: Job Create selectorへの反映PASS
- Mobile: PASS

## Data Verification

### Client
- DB: RLS経由の作成・更新成功
- UI: 一覧へ反映
- Project relation: Project Create selectorへ反映

### Workplace
- DB: RLS経由の作成・更新成功
- UI: 一覧へ反映
- Job relation: Job Create selectorへ反映

## Security
- Manager: Server Action + RLS
- Branch: 送信値を信用せずRLS可視branchを再照合
- System Admin: 既存Policy
- Worker: Admin route guard・既存RLS
- RLS: 変更なし
- GRANT: 変更なし

## DB
- Migration: なし
- RLS: 変更なし
- GRANT: 変更なし
- RPC: なし
- Function: なし
- Trigger: なし
- Seed: なし
- Remote: 接続・変更なし。local `127.0.0.1:54321` のみ

## Regression
- Project Create: PASS
- Project Edit: 既存実装を変更なし
- Job Create: PASS
- Job Edit: 既存実装を変更なし
- Shift: 変更なし
- Navigation: Desktop / Mobile PASS

## Console
- React: 変更由来0
- Hydration: 0
- Runtime: 0
- Network: 0
- CSS: 0
- A11y: 重複Drawer title IDを検出・修正し、編集名とfocus動作を再確認

## Tests
- Client query: `master-rules-test.mjs` PASS
- Client action: Chrome create/edit/concurrency PASS
- Workplace: rule test + Chrome create/edit PASS
- Integration: Project / Job selector PASS
- Security: schema・RLS・GRANTをread-only監査

## Validation
- TypeScript: `npx tsc --noEmit` PASS
- Build: `npm run build` PASS
- scoped ESLint: PASS
- git diff --check: PASS（既存ファイルの改行警告のみ）

## Existing Diff
- 作業開始時から存在したUI-2.3F〜UI-2.4B等のstaged / unstaged / untracked差分を保持
- 今回はClient / Workplace Master、共通Master部品、Admin navigation、関連testと本報告のみ追加・変更

## Limitations
- Drawerは既存patternに合わせlocal state。存在しないedit IDをURLから指定する経路自体がない
- local QA fixture `UI24D QA Client` と `UI24D QA Workplace` は、安全なdelete UIがないため残置
- Clientの担当者・連絡先、WorkplaceのClient紐付けは現Domainにない

## Future Master Domain
- Client担当部署・担当者・連絡先、WorkplaceとClientの関係、利用案件種別は将来のDomain検討対象
- 今回は二重保存、同期、自動match、外部地図・住所APIを追加していない

## Next Phase

UI-2.4E Attendance Visual Alignment

UI-2.4D: COMPLETE
