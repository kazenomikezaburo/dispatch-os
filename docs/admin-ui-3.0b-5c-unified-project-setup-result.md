# Phase ADMIN-UI-3.0B-5C — Unified Project Setup Result

## Status

```text
ADMIN-UI-3.0B-5C: COMPLETE
ADMIN-UI-3.0B-5D: READY
```

`/admin/projects/new` を、案件、取引先、初期業務、勤務先、確認を同じページで扱うセットアップフローへ統合した。既存の分離された Domain model と保存契約は維持し、DB、RLS、RPC、Auth architecture は変更していない。

## Existing Create Flow

従来の案件作成画面は Project のみを作成し、作成後に案件詳細へ遷移する構成だった。Client と Workplace は各 Master 画面、Job は案件配下の個別作成フローで管理されていた。

既存の `saveClient`、`saveWorkplace`、`createJobInline` を再利用し、Project 作成処理は redirect を含まない共通 core と既存 redirect action、新しい inline action に分離した。既存 action の runtime semantics は維持している。

## Domain Relationship Audit

- Project は Client を参照するが、初期 Job がなくても作成可能。
- Job は Project と、同一 branch に属する active Workplace を必要とする。
- Client と Workplace は独立した branch-scoped Master であり、Client から Workplace への直接 relation はない。
- Shift は Job より後段の Domain であり、このセットアップでは作成しない。

## Creation Ordering

保存順序は次の staged workflow とした。

1. 新規 Client または新規 Workplace を選択した場合、各 Master を明示的に先行保存する。
2. 選択済みの正式な Master ID を使って Project を作成する。
3. 初期 Job を有効にした場合のみ、作成済み Project と選択済み Workplace から Job を作成する。
4. 成功後、作成した Project の詳細画面へ遷移する。

Client、Workplace、Project、Job はそれぞれ既存 action と validation contract を通る。client から任意の branch や権限情報を追加注入する設計にはしていない。

## Atomicity / Partial Failure Strategy

既存 architecture には Project、Client、Workplace、Job を一括保存する安全な DB transaction/RPC がない。DB scope を広げず、明示的な staged workflow を採用した。

- 新規 Client / Workplace は保存時点で正式な Master となる。セットアップのキャンセルでは削除・rollback しない。
- Project 成功後に Job が失敗した場合、画面は作成済み `projectId` を保持し、Project 入力を固定する。
- 再送時は Project を重複作成せず、失敗した Job のみを再試行する。
- submit 中は操作を無効化し、UI-level の二重送信を防ぐ。
- DB atomicity を装った補償 DELETE や hidden cleanup は実装していない。

## Project Setup Architecture

Server Component の page が branch、Client、active Workplace の選択肢を取得し、Client Component の setup form に渡す。複雑な Data API query は UI component に置かず、既存 Data Access 層を拡張した。

画面は以下の5セクションで構成する。

1. 案件情報
2. 取引先
3. 業務
4. 勤務先
5. 作成内容の確認

下部の sticky action area から内容を確認し、セットアップを完了できる。

## Project Section

Project 名、branch、期間、説明など既存 Project schema の入力を維持した。必須値と期間整合性は client-side schema と canonical Server Action の双方で検証する。

## Client Selection / Creation

既存 Client の選択と、新規 Client の inline 作成を radio mode で切り替えられる。新規作成は既存 `saveClient` を利用し、成功した正式 Master をその場で選択状態にする。

inline Client 作成は一時 draft ではない。作成後にセットアップをキャンセルしても Client は保持されることを UI 上で明示した。

## Job Section

初期 Job は optional とした。無効時は Project のみを作成でき、有効時だけ Job 名などの既存必須条件を適用する。Project 作成後の Job failure は Project を維持したまま Job retry に収束する。

## Workplace Selection / Creation

初期 Job が有効な場合、既存 active Workplace の選択または新規 Workplace の inline 作成を行える。新規作成には既存 `saveWorkplace` を使い、名称と住所を含む正式 Master として保存する。

Client と同様、inline Workplace はセットアップキャンセル時に自動削除しない。branch と active 条件は既存 action / query contract を維持する。

## Validation

- Project と optional Job の入力は既存 Zod schema を再利用。
- Client / Workplace は既存 Server Action の validation と field error を表示。
- error summary と field-level error を提供。
- validation failure 時は最初の invalid field へ focus を移動。
- critical fields に `aria-invalid` を付与し、label 内の field error と関連づけた。
- Project 作成後の Job failure は重複 Project を作らない retry state として表示。

## Success Flow

Project のみ、または Project と初期 Job の保存完了後に canonical Project detail route `/admin/projects/[projectId]` へ遷移する。新しい成功専用 route は追加していない。

## Project Detail Verification

Local Manager で既存 Client / Workplace を選び、Project と初期 Job を実際に作成した。遷移先の Project detail で Project 名、Job、Workplace の関連表示を確認した。Shift は作成されていない。

## Fallback Job Create

既存の案件詳細・Job 作成導線は削除していない。初期 Job を省略した場合や後から業務を追加する場合の fallback として引き続き利用可能である。

## Responsive

実ブラウザで以下を確認した。

- 390x844: 5セクション、sticky footer、長い住所、mobile navigation、横 overflow なし。
- 1280x900: desktop layout、sidebar collapse / restore、フォーム操作。
- 1440x900: desktop layout、全セクション、確認領域、横 overflow なし。

## Accessibility

- semantic heading と `fieldset` / `legend` を使用。
- existing/new mode は keyboard 操作可能な radio input。
- 操作 target は既存 44px baseline を維持。
- validation error は色だけに依存せず text と `aria-invalid` で表現。
- validation failure の focus movement を確認。
- submit 中の disabled state と status feedback を提供。

## Local Browser QA

- `/admin/projects/new` の表示と5セクション: PASS
- 空 submit の Project / Job validation と最初の invalid input focus: PASS
- inline Client progressive disclosure / validation / save: PASS
- inline Workplace progressive disclosure / validation / save: PASS
- 既存 Client / Workplace から Project + initial Job を作成: PASS
- Project detail への遷移と Job / Workplace 表示: PASS
- 390x844 / 1280x900 / 1440x900: PASS
- console errors: 0
- React warnings: 0
- hydration warnings: 0

Local Manager fixture は既存 fixture の認証情報 drift のみ canonical local test data に再同期した。user 作成、profile、branch、business data、Auth architecture の変更は行っていない。

## Network Browser QA

LAN origin の `/admin/projects/new` を既存 authenticated Manager session で検証した。

- 全入力と5セクション: PASS
- inline Client progressive disclosure: PASS
- 390x844 mobile navigation / sticky footer / overflow: PASS
- 1280x900 sidebar collapse、reload 後の保持、再展開: PASS
- console errors: 0
- React warnings: 0
- hydration warnings: 0

## Tests

- Unified Project Setup focused test: 35 / 35 PASS
- Project Management Hub regression: 31 / 31 PASS
- Unified Editors regression: 33 / 33 PASS
- Detail Workflow Tabs regression: 29 / 29 PASS
- Unified Operation Screens regression: 43 / 43 PASS
- Admin Shell / Workflow Tabs regression: 11 / 11 PASS

## Static Verification

- repository-wide ESLint (`npm run lint`): PASS
- TypeScript (`npx tsc --noEmit`): PASS
- production build (`npm run build`): PASS
- `git diff --check`: PASS（既存 line-ending warning のみ）

## Files Changed

- `app/actions/projects.ts`
- `app/admin/projects/new/page.tsx`
- `components/admin/projects/setup/project-setup-form.tsx`
- `lib/admin/projects/get-project-form-options.ts`
- `lib/admin/projects/project-form-types.ts`
- `scripts/integration/admin-project-setup-test.mjs`
- `docs/admin-ui-3.0b-5c-unified-project-setup-result.md`

既存 staged / unstaged / untracked work は保持した。

## Explicit Non-Changes

- Project / Client / Job / Workplace Domain relationship: unchanged
- Shift creation: not added
- DB schema / migration: unchanged
- RLS / GRANT / RPC: unchanged
- Auth architecture: unchanged
- Packages / lockfile: unchanged
- Figma: read-only audit only; changed nodes 0
- Remote Supabase / production / staging: unchanged
- Realtime / polling: unchanged
- Commit / push: 0
- Existing uncommitted work: preserved

Browser QA で作成した専用 Project、Job、Client、Workplace fixture は残っている。既存 seed を誤削除しない安全な cleanup convention が存在せず、削除は本 Phase の許可 scope 外であるため cleanup は実施していない。

```text
ADMIN-UI-3.0B-5C: COMPLETE
ADMIN-UI-3.0B-5D: READY
```
