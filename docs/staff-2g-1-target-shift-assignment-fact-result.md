# STAFF-2G.1 — Target Shift Assignment Fact Refinement

## Status

`STAFF-2G.1: COMPLETE`

STAFF-2G.0でFreezeしたcontractに従い、対象Shift自身のactive Assignmentをtime conflictから分離し、`targetShiftAssignment`としてSTAFF-2E / STAFF-2Fの公開readerへ追加した。

Assignment作成、Placement save、capacity / Application semantics、Candidate Picker UIは変更していない。

## Existing Problem

STAFF-2EのAssignment conflict aggregateは、Workerのactive Assignmentがtarget intervalへ重なるかだけを評価していた。このため対象Shift自身のAssignmentも`assignment_time_conflict`となり、Placementで利用可能なcanonical AssignmentがSTAFF-2Fではineligibleになる矛盾があった。

## Implementation

incremental migrationで公開readerをnarrowにrefineした。

### Availability facts

`get_worker_shift_availability_facts(worker_id, shift_id)`:

- 既存internal readerをcanonical calculationとして再利用
- `conflictingAssignments`から`shiftId = target Shift`を除外
- filtered resultから`overlapEligible` / `overlapReasonCodes`を再構成
- 対象Shiftのactive Assignmentを`targetShiftAssignment`として独立返却

shape:

```json
{
  "state": "none",
  "assignmentId": null,
  "status": null
}
```

または:

```json
{
  "state": "active_existing",
  "assignmentId": "canonical-assignment-id",
  "status": "assigned | confirmed | completed"
}
```

active statusesは既存contractの`assigned / confirmed / completed`を維持した。

### Candidate facts

旧`get_worker_shift_candidate_eligibility`実装を非公開internal functionへrenameし、新しい公開wrapperがrefined Availability factsの`targetShiftAssignment`を返す。

internal functionのruntime executeはrevokeした。公開functionだけをauthenticatedへgrantしている。

## Eligibility Semantics

`candidateEligible`式は変更していない。

```text
workerStatusEligible
&& requirementsEligible
&& availabilityEligible
&& overlapEligible
```

`overlapEligible`の意味だけを以下へ精密化した。

```text
target Shift以外のactive Assignmentとのhalf-open time conflictがない
```

対象ShiftのAssignment existenceは第五のeligibility条件ではなく、独立factである。

## Preserved Behavior

- other Shiftのoverlapは引き続きblocking
- touching intervalはconflictではない
- cancelled / absent / no-show historyはactive conflictではない
- half-open `[start, end)` semantics維持
- requirement / Availability / Worker status rules不変
- blocking reasonのfixed ordering不変
- foreign / missing safe unavailable不変
- credential / Auth identity非公開

## Security

- function owner: `postgres`
- `SECURITY DEFINER`
- `STABLE`
- `search_path = ''`
- schema-qualified references
- PUBLIC / anon / service_role execute revoke
- authenticatedは公開readerのみexecute可能
- internal candidate implementationはruntime rolesからexecute不可
-既存readerによるWorker / Shift / Branch authorizationを維持

## Verification

### STAFF-2G.1 focused integration

`scripts/integration/staff-target-shift-assignment-fact-test.mjs`: `12/12 PASS`

Covered:

- unassigned Worker -> `targetShiftAssignment=none`
- unassigned eligible behavior unchanged
- target Shift Assignment is not conflict
- canonical Assignment ID / active status returned
- other overlapping Shift remains conflict
- touching interval is not conflict
- inactive Assignment history is not conflict
- Candidate composer returns same target Assignment
- deterministic reason ordering
- internal function execute denial
- anon execute denial
- fixture cleanup 0

### Existing regressions

- STAFF-2E Availability / Work Conditions: `41/41 PASS`
- STAFF-2F Candidate Eligibility: `22/22 PASS`
- Assignment integrity: `25/25 PASS`
- Placement rules: `39/39 PASS`
- Placement editor rules: `13/13 PASS`
- Time-band coverage: `8/8 PASS`

STAFF-2F regressionのmultiple blocker fixtureは、旧self-conflict前提から別Shift overlapへ修正した。期待するreason setと順序は変更していない。

Assignment suiteが残す固定2035 fixtureは、関連Assignment / Application、Shift 16件、`ASSIGN-*` Worker 3件を対象確認後にlocal DBから清掃した。

### Static / database

- local DB lint (`warning`): PASS, findings 0
- `npx tsc --noEmit`: PASS
- focused ESLint: PASS
- `git diff --check`: PASS
- STAFF-2G.1 / Assignment fixture remaining: 0

## Files Changed

- `supabase/migrations/20260922155501_target_shift_assignment_fact_refinement.sql`
- `scripts/integration/staff-target-shift-assignment-fact-test.mjs`
- `scripts/integration/staff-candidate-eligibility-test.mjs`
- `docs/staff-2g-1-target-shift-assignment-fact-result.md`

## Explicit Non-Changes

- Assignment creation: unchanged
- Placement read / save contract: unchanged
- capacity / Application semantics: unchanged
- Candidate Picker UI: not added
- Candidate eligibility formula: unchanged
- eligibility persistence: not added
- Assignment / Placement domain semantics: unchanged outside the frozen self-conflict refinement
- packages / Auth architecture: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- existing uncommitted work: preserved

## Next Phase Readiness

Candidate facts now cleanly distinguish:

```text
target Shift canonical Assignment
from
other Shift time conflict
```

This foundation is ready for the explicit Candidate Assignment command defined by STAFF-2G.0.

`STAFF-2G.1: COMPLETE`
