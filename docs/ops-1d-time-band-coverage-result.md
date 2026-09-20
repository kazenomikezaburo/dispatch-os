# OPS-1D — Time-band Coverage Result

## Status

`OPS-1D: COMPLETE`

## Executive Summary

Shift Detail の Placement surface と Placement editor に、Shift勤務時間内の時間帯別Coverageを追加した。表示は既存の配置ポジション、Assignment配置区間、休憩区間から都度導出し、必要人数・Coverage人数・不足人数と、不足区間を明示する。

Coverageの永続化、配置ドメイン変更、autoscheduling、AI recommendation、polling、Realtimeは追加していない。

## Existing Contract Audit

- 必要人数の正本は `shift_positions.required_workers` であり、現行契約ではポジションごとにShift全体で一定。
- Coverageの正本は active Assignment、`assignment_placement_segments`、`assignment_break_intervals`。
- OPS-1B Attentionは `placementCoverageShortages(plan)` を利用済み。
- 現行source dataから、Shift境界、segment境界、break境界をchange pointとするbounded time bandを安全に導出できるため、schema/contract追加は不要だった。
- 時間帯ごとに異なるrequired staffingを保存する契約は追加していない。

## Shared Coverage Model

- `placementCoverageBands(plan)` を共有derived resultとして追加した。
- active Assignmentに属するsegment/breakのみを対象にする。
- activeかつ`requiredWorkers`設定済みのPositionのみを対象にする。
- 各bandをShift開始・終了でclampする。
- 同一Assignmentの重複segmentはSetで1人として数える。
- breakと重なるAssignmentはそのbandのCoverageから除外する。
- 隣接する同一状態のbandは結合し、不要な分割を表示しない。
- `placementCoverageShortages(plan)` はこの共有band結果の `shortage > 0` filterとなるため、AttentionとPlacementに第二の計算規則は存在しない。

## Placement Presentation

- Shift Detail Placementに「時間帯別Coverage」を追加。
- 各bandに Position、開始–終了、必要、Coverage、不足、充足/不足状態を表示。
- shortage bandはnon-color textでも「N名不足」と識別可能。
- Placement editorでも同じcomponentを使用し、未保存draftの派生Coverageを同じ規則で表示。
- Positionなし、required staffing未設定のempty stateを用意。
- desktopはcompact grid、mobileはstacked cardとして表示し、horizontal table scrollを必要としない。

## Boundary and Resolution Semantics

- Shift外のsegment/break境界はband生成に含めない。
- Shift開始前/終了後のCoverageは表示しない。
- source segmentまたはbreakが変更・解消されると、次回renderでbandも自動的に変化する。
- persisted coverage row、manual completion、reconciliation jobはない。

## Attention Consistency

- Attention shortageは `placementCoverageBands(plan).filter(shortage > 0)` と同一結果。
- focused regressionで両結果のdeep equalityを確認。
- Attention側のseverity、identity、destination、scope contractは変更していない。

## Verification

### Focused Tests

- `node scripts/integration/placement-time-band-coverage-test.mjs` — PASS, 8/8
  - fully covered Shift
  - partially uncovered interval
  - break coverage gap
  - overlapping assignments
  - Shift boundary clamp
  - Attention shared-result equality
  - inactive Assignment isolation
  - Placement shared component wiring
- `node scripts/integration/placement-editor-rules-test.mjs` — PASS, 13/13
- `node scripts/integration/admin-attention-center-test.mjs` — PASS, 16 assertions
- `node scripts/integration/admin-canonical-shift-detail-placement-test.mjs` — PASS, 37 assertions
- focused ESLint — PASS
- `npx tsc --noEmit` — PASS
- `git diff --check` — PASS

### Authenticated Browser QA

- Repository既存のlocal-only auth fixture復旧手順を使用し、normal password loginでSystem Admin sessionを取得。browserでservice-roleは使用していない。
- 実データShift `09:00–18:00` で以下を確認。
  - `09:00–12:00`: 必要1名 / Coverage 1名 / 不足0名 / 充足
  - `12:00–18:00`: 必要1名 / Coverage 0名 / 不足1名
- `1440×900`: PASS、horizontal overflow 0
- `1280×900`: PASS、horizontal overflow 0
- `390×844`: PASS、stacked card、horizontal overflow 0
- Placement editor: 同じCoverage表示、固有heading ID、Escape close、trigger focus restore PASS
- browser console errors/warnings: 0
- server request errors/exceptions: 0
- remote Supabase mutation: 0

## Files Changed

- `lib/admin/placement/placement-editor-rules.ts`
- `components/admin/placement/time-band-coverage.tsx`
- `components/admin/placement/shift-placement-surface.tsx`
- `components/admin/placement/placement-editor.tsx`
- `scripts/integration/placement-time-band-coverage-test.mjs`
- `scripts/integration/admin-canonical-shift-detail-placement-test.mjs`
- `docs/ops-1d-time-band-coverage-result.md`

## Explicit Non-Changes

- Placement domain semantics: unchanged
- DB schema / RLS / RPC / migrations: unchanged
- persisted Coverage rows: not added
- autoscheduling / AI recommendation: not added
- polling / Realtime: unchanged
- packages: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- existing staged / unstaged / untracked work: preserved

`OPS-1D: COMPLETE`
