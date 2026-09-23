# STAFF-2G — Candidate Picker

## Status

`STAFF-2G: BLOCKED`

Candidate PickerのFigma、現行Placement editor、STAFF-2F reader、Assignment / Placement commandを監査した結果、既存contractのままでは「eligible Workerを選択して既存Placement flowへ戻す」を安全に成立させられない。

UIだけでこの境界を迂回するとAssignment / Placement semanticsを変更するため、本Phaseではproduct codeを変更していない。

## Figma Audit

参照:

- Candidate Picker `1075:4167`
- Placement eligibility concept `1076:4229`

FigmaはShift scoped drawerとして以下を示す。

- Staff name / ID search
- eligible / warning / ineligible presentation
- reason badges and details
- eligible or warning candidate selection
- selected Staffを配置作成フォームへ返すflow

Ranking、score、experience-based recommendationは現行domainに存在せず、本Phaseでも追加対象外。

## Existing Placement Contract

現行Placement editorはShiftのactive Assignmentだけを`PlacementPlan.assignments`へ読み込む。

`save_shift_placement_plan(...)`はsegment / breakの`assignment_id`について、対象Shiftに属する既存Assignmentかつ許可されたstatusであることをDB内で再検証する。

したがって、Pickerが未Assignment Worker IDを返してもPlacement draftへ安全に追加できない。Worker IDをAssignment IDとして扱う、仮Assignment IDを生成する、client-side candidate resultを認可証明として扱う方法はいずれも不正。

## STAFF-2F Contract Conflict

`get_worker_shift_candidate_eligibility(worker_id, shift_id)`はSTAFF-2E overlap factsを正本として再利用する。

STAFF-2Eは対象Shiftを含め、Workerのactive Assignmentがtarget Shift intervalと重なる場合に次を返す。

```text
overlapEligible = false
reason = assignment_time_conflict
```

そのため、現行Placement editorへ安全に追加可能な「対象ShiftのAssignment済みWorker」は、STAFF-2Fをそのまま使うと全員ineligibleになる。

一方、STAFF-2Fでeligibleになり得る未Assignment Workerは、Placement save contractが受け付けない。

```text
Assignment済みWorker
→ Placementへ追加可能
→ STAFF-2Fでは同一Shift conflictによりcandidateEligible=false

未Assignment Worker
→ STAFF-2FでcandidateEligible=trueになり得る
→ Placementへ追加不可
```

## Existing Assignment Command

既存のAssignment作成commandは`create_assignment_from_application(shift_id, application_id)`のみ。

これはaccepted Shift Applicationを正本としてAssignmentを作成するcommandであり、任意のWorker IDからAssignmentを作らない。Candidate Picker selectionからこのcommandを自動実行するには、accepted applicationの存在をUI contractへ追加し、Assignment creationをselection flowへ組み込む必要がある。

しかしSTAFF-2G scopeは以下を禁止している。

- automatic Assignment creation
- existing Assignment / Placement semanticsの変更
- Candidate resultをauthorization proofとして使用

よって既存commandの暗黙実行も採用しない。

## Unsafe Workarounds Rejected

- 未Assignment Workerをplacement draftへ直接追加する
- client側でsynthetic Assignment IDを作る
- `save_shift_placement_plan`のAssignment scope validationを弱める
- 同一Shift Assignment conflictをUI側で無視する
- Candidate Picker selection時にaccepted applicationを自動Assignment化する
- STAFF-2Fの結果をclient側で上書きする
- ineligible Workerを通常選択可能にする

## Minimal Required Follow-up

実装前にnarrow domain decisionが必要。

推奨する最小Phase:

`STAFF-2G.0 — Candidate Selection / Assignment Boundary Freeze`

Freezeすべき事項:

1. Candidate Pickerの選択結果が何を意味するか
   - Worker selection only
   - accepted Application selection
   - explicit Assignment proposal
2. CandidateからAssignmentを作る場合のcanonical sourceとcommand
3. Manager / System Admin authorization、capacity、duplicate、concurrency、idempotency
4. accepted applicationがないWorkerを選択可能にするか
5. STAFF-2F overlapで「target Shift自身のAssignment」を除外するか
6. 既存AssignmentのPlacement editing時はCandidate Eligibilityを適用するのか、別のplacement-edit factsを使うのか
7. eligible-with-warning selection後もwarningをどこまで保持するか

最も狭い安全な候補は、Candidate EligibilityのAssignment overlapから「評価対象Shift自身の既存Assignment」を除外するcontractを明示した上で、Pickerを既存Assignment staff専用にする方法。ただしこれはSTAFF-2F / STAFF-2Eのfrozen semantics変更になるため、本Phaseで暗黙に実施しない。

全Branch WorkerをPicker対象にする場合は、別途explicit Assignment creation contractが必要。

## Verification Performed

- Figma Candidate Picker / Placement concept inspected
- current Placement editor data flow inspected
- `getPlacementPlan` Assignment scope inspected
- `save_shift_placement_plan` Assignment validation inspected
- `create_assignment_from_application` boundary inspected
- STAFF-2F / STAFF-2E overlap semantics inspected
- no product code changed
- no migration / DB / RLS / RPC changed
- remote Supabase unchanged
- packages unchanged
- existing work preserved

## Files Changed

- `docs/staff-2g-candidate-picker-result.md`

## Explicit Non-Changes

- Candidate Picker UI: not added
- Candidate eligibility rules: unchanged
- Assignment creation: unchanged
- Placement save contract: unchanged
- Assignment / Placement semantics: unchanged
- DB / RLS / RPC: unchanged
- packages / Auth architecture: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- existing staged, unstaged, and untracked work: preserved

## Remaining Blocker

An eligible Worker cannot currently be both:

1. selectable by the canonical STAFF-2F result, and
2. consumable by the canonical Placement save command.

Resolving this requires an explicit Candidate Selection / Assignment boundary decision, not a UI-only change.

`STAFF-2G: BLOCKED`
