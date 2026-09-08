# Phase UI-2.5E 実装結果

## Executive Summary
- Placement final state: Placement v2 の visual / interaction polish を完了し、UI SOT として Freeze 可能。
- Main: 一覧密度を維持しつつ Position preview を最大3件＋残数表示へ限定。
- Drawer: desktop を `max-w-4xl`、mobile を full-screen とし、内部 scroll と sticky footer を維持。
- Picker: existing Assignment 限定を明文化し、検索・空状態・配置あり表示・44px操作領域を整理。
- Timeline: Shift開始から終了までの実時間比率、適度な時刻marker、Segment / Break の非色依存表示を追加。
- Coverage: derived 表示を維持し、不足は warning、必要人数未設定は unknown として扱う。
- Mobile: 390×844 では timeline を縮小せず、時刻付きstacked intervalsへ切替。
- Conflict: Chrome 2-tabで競合、draft保持、unsafe mergeなし、最新読込、復元保存を実査。
- Figma: 515:2 / 515:431 / 517:14 を再取得し、Domain境界を保ったままhierarchyを整合。
- Domain changes: なし。

## Sources
- Figma Main: node `515:2`。
- Figma Drawer: node `515:431`。
- Figma Picker: node `517:14`。
- UI-2.5D: `docs/admin-placement-break-v2-result.md`。
- C1: core schema / RLS / GRANT implementation と 26件の既存test。
- C2: atomic Placement Plan RPC implementation と 20件の既存test。

## Git State
- Branch: `small-ui-a11y-fix`。
- Start dirty: UI-2.5A〜D / DB-2.5C1〜C2 の既存 staged 27 filesを保持。
- Changed: Drawer幅、Main Position preview、Editor timeline / Picker / warning / conflict reload、pure helper test、本report。
- Commit: なし。
- Push: なし。

## Environment
- Supabase: local `127.0.0.1` only。
- `.env.local`: remote向きであることを確認し、変更なし。
- process override: dev / build のプロセスだけ local URL / publishable keyへ上書き。
- Remote: 接続・write・pushなし。
- Auth setup: 既存local authenticated Manager fixtureを再利用。credentialは記録しない。

## Figma Recomparison

### Main
- Hierarchy: 日付 → summary → filter → Shift groupingを維持。
- Density: Shift比較を妨げるEditor詳細はMainへ展開しない。
- Spacing: 既存Design Foundationのsection / card spacingを維持。
- Actions: Shift名を主navigation、Placement編集を明示actionとして維持。
- Deviations: Figma上の将来workflow表現はDomain未実装のため追加しない。

### Drawer
- Width: desktop `max-w-4xl`。1440 / 1280でもMain contextを残し、timelineを読める幅に調整。
- Sections: Position → Timeline → Staff / Break → Coverage の順。
- Timeline: Segment / Breakの実時間比率とmarkerを追加。
- Footer: border / solid background付きsticky footer。
- Deviations: confirm、notification、memo、status workflowは追加しない。

### Picker
- Search: visible label付き。
- Staff identity: name primary、staff_code / Assignment status secondary。
- Existing Assignment boundary: 「新しいAssignmentは作成しません」を明示。
- Mobile: inline panel、縦積みrow、44px CTA。
- Deviations: availability / Direct Assignmentなし。

## Main Board Polish
- Summary: 必要 / 配置 / 不足の既存優先度を維持。
- Shift grouping: Shift単位のcompact cardを維持。
- Required/Assigned/Shortage: tabular numbersとwarning色を維持。
- Position preview: 最大3件＋`ほかN件`。
- Warnings: shortageはdanger一色ではなく数値と文言で表示。
- Overflow: 1440 / 1280 / 390でdocument horizontal overflow 0。

## Position Editor
- Layout: label / required count / reorder / retireを1 sectionに集約。
- Label: visible labelあり。
- Requirement: 合計とShift必要人数を並記。
- Order: up/down controlを維持。
- Retirement: destructive labelを明示。
- Validation: requirement超過を対象section近傍に表示。
- Accessibility: reorder aria-label、disabled boundary、label associationを維持。

## Staff Picker
- Candidates: existing Assignmentのみ。
- Search: name / staff code検索。
- Existing placement: `配置あり`を表示。
- Direct Assignment: CTAなし。
- Accessibility: visible search label、button semantics、44px target。

## Segment Editor
- Layout: Staff card内にPosition / start / end / removeを配置。
- Multiple: 同一Staff card内で複数rowとしてまとまる。
- Time: native time input、Shift範囲基準。
- Overnight: pure helperで翌日へ解決。
- Overlap: 保存blockし対象Staff近傍に表示。
- Gap: valid。
- Adjacent: valid。

## Break Editor
- Layout: 対象Staff card内でSegment直下。
- Target: `予定 / 目標`をcompact表示。
- Under: 差分warning＋保存可能を明示。
- Exact: quiet success text。
- Over: 差分warning＋保存可能を明示。
- Conflict: Segmentとの重複は保存block。
- Save behavior: under / overはwarningでありblockしない。

## Coverage
- Persisted: しない。derivedのみ。
- Timeline: BreakはCoverageから除外されることを説明。
- Full: quiet state。
- Shortage: Position別不足時間帯件数を表示。
- Unknown: `必要人数未設定`として扱い、不足0を捏造しない。
- Warning severity: warning。

## Timeline
- Scale: Shift start→endのrelative position。
- Markers: 通常60分、12時間超は120分間隔。
- Segment: Position label＋tooltip＋screen reader用start/end。
- Break: dashed green border＋`休憩`＋screen reader用start/end。
- Coverage: 説明文と別section warningで因果を示す。
- Overnight: 翌日markerへ`翌` prefix。
- Tiny interval: `min-w-1`で存在を保持し、計算上の幅は歪めない。
- Accessibility: 色だけに依存せずlabel / time textを提供。

## Conflict QA
- Method: authenticated Chromeで同じShift editorを2 tabs同時open。
- Tab A: Position labelを`受付QA`へ変更し保存成功。
- Tab B: stale versionのまま別labelを入力して保存。
- Conflict: expected-version conflictを表示し、保存は不成立。
- Draft: Tab Bの入力値を保持。
- Reload: local stateが残る不具合を発見し、明示clickでfull reloadする最小修正後、最新`受付QA`を取得。
- DB final state: 既存Server Action経由で元の`受付`へ復元。QAによりrevisionは2件追加。

## Responsive

### 1440
- Main: summary / filters / Shift cardを同時把握可能。
- Drawer: Main contextを残すwide drawer。
- Picker: inlineでTimeline / Staff contextを失わない。
- Timeline: 09:00–18:00を1時間markerで表示。
- Overflow: 0。

### 1280
- Main: Drawer背面にcontextを保持。
- Drawer: Position / Timeline / Staffを内部scrollで操作可能。
- Picker: width内に収まる。
- Timeline: label truncation＋tooltip。
- Overflow: 0。

### 390×844
- Main: summary / filter / Shiftをstack。
- Drawer: full-screen。
- Picker: searchとcandidateを縦積み。
- Position: mobile width内に収まる。
- Segment: inputsを縦積み可能。
- Break: Staff context内。
- Coverage: text warning。
- Footer: viewport bottomにsticky、Save操作可能。
- Navigation: mobile header / menuを維持。
- Overflow: 0。

## Accessibility
- Keyboard: semantic button / input / selectを維持。
- Focus: picker searchへvisible focusを確認。
- Escape: shared Drawer behaviorを再利用。
- Focus restore: shared Drawer behaviorを再利用。
- Reorder: aria-labelとdisabled boundaryあり。
- Labels: picker search、Position、time controlsにlabelあり。
- 44px: CTA / mobile inputsを満たす。
- Color-only: Segment / Break / warningsはtextも併用。

## Chrome QA
- Auth: local Managerでauthenticated。
- Main: 1440 / 1280 / 390実査。
- Drawer: desktop wide / mobile full-screen、internal scroll実査。
- Picker: open / search focus / existing Assignment copy実査。
- Save: 成功feedback実査。
- Unsaved: conflict時に保持表示を実査。
- Back/Forward: URL drawer stateの既存実装を維持。
- Conflict: 2-tab actual QA PASS。
- Console: 2 tabsともwarning / error 0。
- Network: duplicate mutationの兆候なし。

## Performance
- Main query: existing batch queryを変更しない。
- Editor lazy load: selected ShiftのURL drawer readを維持。
- N+1: 追加なし。
- duplicate fetch: visual helperはpure client calculation。
- duplicate save: pending中button disableを維持。

## Tests
- C1: 本Phase変更前 26/26 PASS。browser QA後の再実行は同じ固定Shiftに残ったPlanとfixture insertが衝突。local DB resetは安全審査で実施せず。
- C2: 20/20 PASS。
- Placement rules: 39/39 PASS。
- Placement security: read-only local security 28/28 PASS。
- Editor rules: 13/13 PASS。
- New tests: timeline relative geometry、overnight marker label。

## Validation
- TypeScript: PASS。
- Build: PASS（local process override）。
- scoped ESLint: PASS。
- git diff --check: PASS（既存line-ending warningのみ）。

## DB / Security
- Migration: 本Phase追加・変更なし。
- RLS: 変更なし。
- GRANT: 変更なし。
- RPC: 変更なし。
- Function: 変更なし。
- Trigger: 変更なし。
- Auth: 変更なし。
- Package: package / lockfile変更なし。
- Remote: 接続・writeなし。

## Intentional Domain Deviations
- Staff Picker: existing Assignment限定。
- Direct Assignment: なし。
- Availability: 表示しない。
- Notification: なし。
- Multi-venue: なし。
- Other: memo / placement status workflow / confirm flowなし。

## Remaining Limitations
- Server Action独立mock suiteは追加しない。実RPC browser save、2-tab conflict、C2 20/20が現在のcontract riskを直接coverするため。
- C1再実行はfixture collisionで非ゼロ終了したが、本Phaseにschema / SQL変更はなく、変更前の26/26 baselineを維持。

## Placement Final Freeze
- UI SOT: latest Figma intent＋本実装＋Design Foundation / UI Patterns。
- Domain SOT: DB-2.5C1 / C2とPlacement Domain Design。
- Security SOT: RLS / GRANT / atomic RPC。
- Remaining P0: なし。
- Remaining P1: なし。
- Remaining Future: Assignment作成、availability、notification等は別Domain Phase。

## Documentation
- `docs/admin-placement-visual-polish-result.md`

## Next Phase Recommendation
- Recommended: Placement v2をFreezeし、次の未完了Admin/Worker domainへ進む。
- Reason: fixed viewport、authenticated interaction、conflict safety、responsive、build / relevant regressionを確認済み。

UI-2.5E: COMPLETE
