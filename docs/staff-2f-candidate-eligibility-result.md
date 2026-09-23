# STAFF-2F — Explainable Candidate Eligibility

## Status

`STAFF-2F: COMPLETE`

STAFF-2CのRequirement factsとSTAFF-2EのAvailability / Worker status / Assignment overlap / Preference factsを合成する、read-only Candidate Eligibility readerをlocal PostgreSQLへ実装した。新しいeligibility persistence、Candidate Picker UI、Assignment blockingは追加していない。

## Existing Contract Audit

- Skill / Qualification rules: `get_worker_shift_requirement_facts(worker_id, shift_id)`を正本として再利用。
- Worker status / Availability / Assignment overlap / Preferences: `get_worker_shift_availability_facts(worker_id, shift_id)`を正本として再利用。
- 両readerはWorker、Shift、Branch、target Shift日時をserver-sideで導出している。
- Candidate composerは上記rulesを再実装せず、source scopeの再認可、結果の合成、透明なBoolean AND、理由の分類だけを行う。

## Candidate Reader

追加:

- `get_worker_shift_candidate_eligibility(worker_id, shift_id)`

返却する独立fact:

- `workerStatusEligible`
- `requirementsEligible`
- `availabilityEligible`
- `overlapEligible`
- requirement facts / reason codes
- Availability state / coverage / reason codes
- conflicting Assignments
- preference matches

合成値:

```text
candidateEligible =
  workerStatusEligible
  && requirementsEligible
  && availabilityEligible
  && overlapEligible
```

`eligibilityScope = implemented_hard_rules_only`を返し、final placement eligibilityではないことを明示する。

## Reason Contract

各reasonはclosed `code`、`category`、`classification`、server-controlled `label`を持つ。catalogの固定順で返すため、同じsource factsから常に同じ順序になる。

Blocking:

- `worker_inactive`
- `worker_suspended`
- `requirement_master_inactive`
- `skill_missing`
- `qualification_missing`
- `qualification_not_yet_valid`
- `qualification_expired`
- `qualification_revoked`
- `availability_unavailable`
- `assignment_time_conflict`

Warning / nonblocking:

- `availability_consultation_required`
- `availability_partially_confirmed`
- `availability_unknown`
- `preferred_time_partially_matched`
- `preferred_time_not_matched`

Informational:

- `availability_confirmed`
- `preferred_time_matched`
- `preference_not_configured`

Availability unknown、partial、consultable、preference mismatchは`candidateEligible`をfalseにしない。area / work category / transportのfree-textからreason codeやmatching resultを生成しない。

## Authorization and Safe Unavailable

- Candidate evaluationはManager / System Admin向けAdmin readとした。
- composer自身がWorkerとShiftのBranchをDB内で再導出し、active Admin、Worker Branch access、Shift Branch accessを再検証する。
- Managerはown-Branch Worker + Shiftだけを評価可能。
- System Adminはorganization scopeでcross-Branch contextを評価可能。
- missing / foreign Worker、missing / foreign Shift、inactive / non-Admin actorは同じsafe unavailable shapeへ収束する。
- safe unavailableは`sourceAvailable=false`、`candidateEligible=false`、空のreason collectionsだけを返し、対象の存在差やauthorization detailsを漏らさない。
- anon / PUBLIC / service_roleにはexecuteをgrantしない。
- credential number、Auth profile identity、内部authorization情報は返さない。

## Database Hardening

- incremental migrationのみ。
- function owner: `postgres`
- `SECURITY DEFINER`
- `STABLE`
- `search_path = ''`
- schema-qualified object references
- authenticated executeのみ
- table、RLS、既存reader、既存domain semanticsは変更なし

## Verification

### STAFF-2F integration

`scripts/integration/staff-candidate-eligibility-test.mjs`: `22/22 PASS`

Covered:

- all hard facts true -> candidate true
- missing Skill、expired / revoked Qualification
- inactive Worker
- unavailable overlap
- Assignment conflict
- unknown / partial / consultable Availabilityがwarningのままeligible
- preference mismatchがnonblocking
- multiple blocking reasonsの同時表示
- deterministic reason order / classification
- Manager foreign scope / missing source safe unavailable
- System Admin cross-Branch
- Worker / anon denial
- credential / Auth identity非公開
- fixture cleanup 0

### Existing regressions

- STAFF-2B persistence: `38/38 PASS`
- STAFF-2C requirements: `33/33 PASS`
- STAFF-2E Availability / Work Conditions: `41/41 PASS`
- Assignment integrity: `25/25 PASS`
- Placement rules: `39/39 PASS`
- Placement editor rules: `13/13 PASS`
- Time-band coverage: `8/8 PASS`

Assignment suiteは既存designによりfixtureを残すため、実行後に固定2035 intervalのShift 16件と`ASSIGN-*` Worker 3件を読み取り確認し、関連Assignment / Applicationを含むその専用fixtureだけをlocal DBから清掃した。

### Static / database

- local DB lint (`warning`): PASS, findings 0
- `npx tsc --noEmit`: PASS
- focused ESLint: PASS
- `git diff --check`: PASS
- STAFF-2F fixture remaining: 0

## Files Changed

- `supabase/migrations/20260922152121_explainable_candidate_eligibility.sql`
- `scripts/integration/staff-candidate-eligibility-test.mjs`
- `docs/staff-2f-candidate-eligibility-result.md`

## Explicit Non-Changes

- STAFF-2C requirement rules: unchanged
- STAFF-2E Availability / overlap / preference rules: unchanged
- Candidate eligibility persistence: not added
- Candidate Picker UI: not added
- ranking / scoring / AI recommendation: not added
- automatic Assignment creation / blocking: not added
- Assignment / Placement semantics: unchanged
- travel-time / area-category matching / Open Shift: not added
- Auth architecture / packages: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- existing staged, unstaged, and untracked work: preserved

## Next Phase Readiness

The read model is ready for `STAFF-2G Candidate Picker`. Consumers must continue to present it as the currently implemented hard-rule result, not as final placement eligibility.

`STAFF-2F: COMPLETE`
