# ADMIN-UI-3.0B-6G Project-scoped Workplace UX & Canonical Master Retirement

## Status

`ADMIN-UI-3.0B-6G: COMPLETE`

実装、DB integration、既存 Project History 回帰、実 Chrome のauthenticated System Admin QAは完了した。初回はbrowser evidence不足でBLOCKEDとなり、6G.1でCDPによるexact viewport、console、LAN evidenceを取得した。6G.1で発見した390x844 close target 24.27x44pxと`prefer-const` 1件は、ADMIN-FIX-3.0B-6G.2で最小修正・再検証済み。close targetは44x44px、repo-wide ESLintは0 errors / 0 warningsとなり、最終statusをCOMPLETEへ更新する。

## Existing Architecture Audit

- Domain は `Project -> Job -> Workplace`。Workplace は branch-scoped shared master であり、Project 埋込みへ変更していない。
- Project Create は既存／新規 Workplace を選択できる staged workflow を保持する。
- Job 更新は既存 `updateJob` contract と `JOB_WORKPLACE_CHANGED` を保持する。
- `/admin/workplaces` は legacy route として到達可能なまま保持し、redirect や Project 推測を追加していない。
- Project History 6B は Workplace 文脈イベントを 6G へ明示的に deferred していた。

## Canonical Navigation

- Sidebar の「勤務先」を削除した。
- Master workspace の canonical tab から Workplace を削除し、Client のみを canonical master とした。
- `/admin/workplaces` の route、CRUD、filter、pagination は compatibility surface として保持した。

## Project Create / Edit

- Project Create の existing/new Workplace と partial-failure retry semantics は維持した。
- `/admin/projects/[projectId]?edit=1` に「業務・勤務先・会場」を追加した。
- 全 Job を明示表示し、各 Job の現在 Workplace、既存 Workplace selector を含む Job editor、新規 Workplace 作成、shared Workplace edit を提供する。
- 新規 Job の Workplace default は空値とし、先頭 Workplace 推測を廃止した。
- 新規 Workplace 保存後は正式レコードを保持し、明示的な Job editor から関連付ける。関連付け失敗時も Workplace を削除せず retry できる。

## Shared Workplace Safety

- shared edit 前に「全業務へ反映」と利用 Job 件数を表示する。
- exact `projectId`、`jobId`、`workplaceId` を RPC 内で再検証する。
- Manager branch access、active profile、Job -> Project、Job -> Workplace、Project/Workplace branch 一致を DB 内で検証する。
- client から actor を受け取らず、`private.project_history_actor()` から導出する。

## Atomic History

incremental local migration `20260914183520_project_context_workplace_update.sql` を追加した。

- Event: `PROJECT_CONTEXT_WORKPLACE_UPDATED`
- Target: `workplace`
- Command: `update_project_context_workplace(...)`
- Workplace update と exact one Project history insert は同一 transaction。
- no-op は Workplace を更新せず history 0 件。
- optimistic conflict は既存 `updated_at` により拒否。
- payload は `changed_fields` と Job label snapshot のみ。raw OLD/NEW、本文、actor client input は保存しない。
- Workplace table triggerを追加せず、他 Project への history fan-out はない。

## Security

- `SECURITY DEFINER`, `search_path = ''`, schema qualification を使用。
- `PUBLIC` / `anon` EXECUTE を revoke、`authenticated` のみに grant。
- Worker、foreign Project context、anon は拒否。
- existing RLS、Auth architecture、direct master actionを変更していない。

## Tests

- 6G focused integration: 37 / 37 PASS
- Project History foundation: 36 / 36 PASS
- Canonical Project IA: 36 assertions PASS（6G canonical navigationへrebaseline）
- Unified Project Setup: 35 assertions PASS
- Master Workspace: 36 assertions PASS（6G canonical navigationへrebaseline）
- fixture cleanup: dedicated Project / Job / Workplace / history 0 remaining

## Browser QA

- Chrome local Auth: PASS（remote `.env.local` の誤接続を検出し、ファイルを変更せず process env のみ localhost へ固定）
- authenticated System Admin Project Edit: PASS
- exact Job / current Workplace / existing selector: PASS
- shared warning / usage count / exact Job context: PASS
- new Workplace editor: PASS（保存による fixture mutation は実施せず）
- Escape / focus restore: PASS
- Sidebar / Master canonical Workplace link 0: PASS
- `/admin/workplaces` legacy reachability: PASS
- accumulated Shift fixture による assignments `.in(...)` URI overflow を検出し、100 ID chunkへbounded化して PASS
- ADMIN-QA-3.0B-6G.1でChrome DevTools Protocolを使用し、1440x900 / 1280x900 / 390x844のlayout viewportを`window.innerWidth/innerHeight`で厳密に確認した。
- 全viewport・対象routeでdocument horizontal overflow 0。
- application error / React warning / hydration warning / uncaught exception / unhandled rejection: 0。
- runtime-resolved LAN origin `http://192.168.11.64:3000` でlogin、Project Overview/Edit、Sidebar、Client Master、reloadを確認した。
- 390x844 shared editor: warning、own scroll、body scroll lock、Escape、focus restoreはPASS。
- 390x844 shared editor close target: PASS（6G.2で`shrink-0`を追加し、実測44x44px）。

## Static Verification

- repository-wide ESLint: PASS（6G.2で`activeAssignmentShiftIds`を`const`へ変更。rule suppressionなし）
- TypeScript: PASS
- production build: PASS
- local DB lint: warning 0 / error 0
- `git diff --check`: PASS（既存 LF/CRLF notice のみ）

## Files Changed

- `app/actions/project-workplaces.ts`
- `app/admin/projects/[projectId]/page.tsx`
- `components/admin/admin-nav.ts`
- `components/admin/masters/master-editor.tsx`
- `components/admin/masters/master-workspace-header.tsx`
- `components/admin/projects/detail/project-history.tsx`
- `components/admin/projects/detail/project-workplace-workspace.tsx`
- `components/admin/projects/jobs/form/job-create-form.tsx`
- `components/admin/projects/jobs/job-edit-drawer.tsx`
- `lib/admin/projects/get-job-form-options.ts`
- `lib/admin/projects/get-project-detail.ts`
- `lib/admin/projects/job-form-types.ts`
- `lib/admin/projects/project-history-types.ts`
- `scripts/integration/admin-canonical-project-ia-test.mjs`
- `scripts/integration/admin-master-workspace-test.mjs`
- `scripts/integration/admin-project-workplace-canonical-ux-test.mjs`
- `supabase/migrations/20260914183520_project_context_workplace_update.sql`
- `docs/admin-ui-3.0b-6g-project-workplace-canonical-ux-result.md`

## Explicit Non-Changes

- Project / Job / Workplace relation: unchanged
- Job association event semantics: unchanged
- `/admin/workplaces`: retained as legacy compatibility route
- Workplace delete: not added
- Worker UI: unchanged
- Auth architecture: unchanged
- packages / lockfile: unchanged
- Figma: read-only; changed nodes 0
- remote Supabase / production / staging: unchanged
- commit / push: 0
- existing staged / unstaged / untracked work: preserved

## Remaining Blocker

none。初回browser evidence gapは6G.1で、mobile close targetとlint blockerは6G.2で解消済み。
