# STAFF-2G.3 Candidate Picker Read UI Result

## Status

`STAFF-2G.3: COMPLETE`

Shift Detail の Placement から開く read-only Candidate Picker を追加した。候補一覧・理由表示・検索・表示グループ・Worker 選択状態は、STAFF-2F / STAFF-2G.1 の canonical facts を再利用する。選択操作は Assignment / Placement を一切作成・更新しない。

## Canonical Boundary

- Candidate selection は Worker のローカル選択状態だけであり、Assignment 作成・authorization proof ではない。
- `ensure_candidate_assignment` は本 Phase の UI から呼び出していない。
- Placement save contract は変更しておらず、Worker ID を Assignment ID として渡さない。
- `targetShiftAssignment` は `none` / `active_existing` として、other-Shift conflict から分離して表示する。

## Read Model

`public.list_shift_candidate_eligibility(shift_id, limit)` を追加した。

- Manager は対象 Shift と同一 Branch の Worker のみ、System Admin は organization scope の Worker のみ列挙する。
- Candidate facts は既存 `get_worker_shift_candidate_eligibility` を bounded composer 内で再利用し、Skill / Qualification / Availability / overlap / Worker status の判定を複製しない。
- 1 request 最大 100 件。`limit + 1` で truncation を検知し、client からの無制限読取を許可しない。
- order は Worker display name、staff code、Worker ID で決定し、各候補内の理由順は canonical reader の順序を保持する。
- missing / foreign Shift、Worker caller は safe unavailable に収束する。
- `SECURITY DEFINER`、`search_path = ''`、schema-qualified object、owner `postgres`、PUBLIC / anon / service_role revoke、authenticated のみ execute とした。

## UI

- Shift Placement の `候補を探す` から 512px desktop / full-width mobile Drawer を開く。
- 名前 / staff code 検索。
- `候補`、`確認が必要`、`候補外` の presentation group filter。
- blocking / warning reasons、Skill / Qualification summary、Availability、preference、other-Shift conflict、target Shift Assignment を表示。
- eligible と eligible-with-warning は選択可能。ineligible は disabled。
- 選択結果は Drawer 内の React state のみ。footer に非更新であることを明示する。
- empty、load error、bounded truncation state を実装。
- 44px target、keyboard focus、Escape close、trigger focus restore を既存 Drawer contract で維持。

Figma `1075:4167` の右 Drawer、検索、candidate card、state chip、select / disabled action を既存 design tokens へ合わせた。`1076:4229` は eligibility explanation の参照として使用し、ranking / score / Assignment confirmation は追加していない。

## Security and Privacy

- authenticated Admin と target Shift を server / DB で再認可する。
- Branch、eligibility、Worker status、requirements、Availability、conflict を client から信頼しない。
- credential number、Auth Profile ID、authorization internals は read model / UI に含めない。
- candidate list RPC に direct write はなく、統合テストで Assignment 件数不変を確認した。

## Browser Verification

通常の local System Admin password login を既存 fixture setup で復旧し、local Supabase 接続の Next.js dev server で確認した。

- Placement から Candidate Picker open: PASS
- name / staff code search: PASS
- eligible-with-warning selection state: PASS
- existing target Shift Assignment separate display: PASS
- selectionによる Assignment / Placement mutationなし: PASS
- Escape close / trigger focus restore: PASS
- 1440x900 horizontal overflow: 0
- 1280x900 horizontal overflow: 0
- 390x844 horizontal overflow: 0
- browser error / warning: 0
- server application exception: 0

## Verification

- STAFF-2G.3 read model integration: `15/15 PASS`
- STAFF-2F candidate eligibility: `22/22 PASS`
- STAFF-2G.1 target Shift Assignment facts: `12/12 PASS`
- STAFF-2G.2 candidate Assignment command: `31/31 PASS`
- Placement rules: `39/39 PASS`
- local DB lint: warning / error `0`
- focused ESLint: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS

DB fixture suites were run sequentially for their final evidence because they intentionally share canonical local actor rows. All STAFF-2G.3 fixtures were removed; cleanup assertion was `0`.

## Files Changed

- `supabase/migrations/20260922172502_candidate_picker_read_model.sql`
- `lib/admin/staff/candidate-picker-types.ts`
- `lib/admin/staff/get-shift-candidates.ts`
- `components/admin/placement/candidate-picker-drawer.tsx`
- `components/admin/placement/shift-placement-surface.tsx`
- `components/admin/drawer.tsx`
- `app/admin/shifts/[shiftId]/page.tsx`
- `scripts/integration/staff-candidate-picker-read-model-test.mjs`
- `docs/staff-2g-3-candidate-picker-read-ui-result.md`

## Explicit Non-Changes

- Assignment creation / `ensure_candidate_assignment` execution: not added
- Assignment confirmation UI / Placement handoff: not added
- Placement save semantics: unchanged
- eligibility rules / persistence: unchanged
- ranking / score / AI / travel matching: not added
- DB remote: unchanged
- packages: unchanged
- commit / push: not performed
- existing staged / unstaged / untracked work: preserved

`STAFF-2G.3: COMPLETE`
