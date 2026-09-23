# STAFF-2C — Structured Job Requirements & Requirement Facts

## Status

`STAFF-2C: COMPLETE`

Job単位のmandatory Skill / Qualification requirementsと、対象Shift開始日のJST日付を基準にしたWorker requirement factsをlocal DBへ実装した。`requirementsEligible`は構造化されたSkill / Qualification requirementsだけの充足を表し、配置可否全体を意味しない。

## Existing Architecture Audit

- Staff identityは既存どおり`public.workers`。
- Skill / Qualification masterとholdingはSTAFF-2Bの`skills`、`qualifications`、`worker_skills`、`worker_qualifications`を正本として再利用。
- JobのBranchは`jobs -> projects.branch_id`から導出。
- ShiftのJobは`shift_slots.job_id`から導出。
- Adminの認可は既存`private.is_active_admin()`と`private.has_branch_access()`を再利用。
- `jobs.requirements`は自由記述のhuman noteとして変更していない。

## Canonical Persistence

追加した正本:

- `public.job_skill_requirements`
  - primary key: `(job_id, skill_id)`
- `public.job_qualification_requirements`
  - primary key: `(job_id, qualification_id)`

初期contractはmandatory presenceのみ。preferred、weight、proficiency、scoreは保存しない。

両tableはJob/masterへの`ON DELETE RESTRICT` FKを持つ。active masterだけを新規attachでき、attach済みrequirementはmasterの後続deactivate後も保持する。attach triggerはmaster rowを`FOR SHARE`でlockし、master lifecycle updateとの競合窓も閉じた。

## Authorized Commands

以下のnarrow RPCを追加した。

- `add_job_skill_requirement(job_id, skill_id)`
- `remove_job_skill_requirement(job_id, skill_id)`
- `add_job_qualification_requirement(job_id, qualification_id)`
- `remove_job_qualification_requirement(job_id, qualification_id)`

認可はclientのBranch hintを受け取らず、JobからProject/BranchをDB内で導出する。active Managerはown-Branch、active System Adminはorganization scopeで利用できる。duplicateはapplication-side事前確認ではなく複合primary keyで拒否する。

## Requirement Fact Reader

追加:

- `get_worker_shift_requirement_facts(worker_id, shift_id)`

readerはShiftからJobを導出し、`(shift_slots.starts_at AT TIME ZONE 'Asia/Tokyo')::date`を評価日とする。現在時刻は資格判定に使わない。

Skill state:

- `satisfied`
- `missing`
- `requirement_master_inactive`

Qualification state:

- `satisfied`
- `missing`
- `not_yet_valid`
- `expired`
- `revoked`
- `requirement_master_inactive`

Qualificationの`expires_on`当日は有効で、評価日が`expires_on`を過ぎた場合だけ`expired`となる。closed aggregate reason codesは次のとおり。

- `skill_missing`
- `qualification_missing`
- `qualification_not_yet_valid`
- `qualification_expired`
- `qualification_revoked`
- `requirement_master_inactive`

`requirementsEligible`は全requirement stateが`satisfied`の場合だけtrue。Availability、重複勤務、移動、Assignment/Placement可否は含まない。

## Security

- 両public tableでRLSを有効化。
- Data APIは`authenticated SELECT`だけを明示grantし、直接INSERT/UPDATE/DELETEはgrantしない。
- Manager readはJobのown-Branch requirementだけ。
- Worker/anonには新しいtable readを付与しない。
- RPCは`SECURITY DEFINER`、owner `postgres`、`search_path = ''`、schema-qualified object、明示的actor/source authorizationを使用。
- PUBLIC / anon / service_roleのRPC executeをrevokeし、必要なauthenticated executeだけをgrant。
- foreign/missing WorkerまたはShift、inactive/non-admin actorは同じsafe unavailable shapeへ収束。
- fact resultにcredential numberを含めない。

## Verification

### STAFF-2C integration

`scripts/integration/staff-structured-job-requirements-test.mjs`: `33/33 PASS`

Covered:

- Skill / Qualification requirement add/remove
- DB-level duplicate rejection
- inactive masterのnew attach拒否
- master deactivate後の既存requirement保持
- Skill satisfied / missing / inactive master
- Qualification no expiry / satisfied / missing / not-yet-valid / expired / revoked / inactive master
- Shift開始日基準とAsia/Tokyo日付境界
- closed reason codesと`requirementsEligible`
- Manager own-Branch / foreign-Branch isolation
- System Admin cross-Branch read
- Worker safe unavailable / anon execute denial
- credential number非公開
- `jobs.requirements`不変
- fixture cleanup 0

### Existing regressions

- STAFF-2B Skill / Qualification persistence: `38/38 PASS`
- Assignment integrity: `25/25 PASS`
- Placement rules: `39/39 PASS`
- Placement editor rules: `13/13 PASS`
- Time-band coverage: `8/8 PASS`
- Placement core schema/security: `26/26 PASS`
- Placement Break atomic command: `20/20 PASS`

Assignment suite初回は過去runの`ASSIGN-*` fixture残存により開始前にduplicateとなった。明示的test fixtureだけをlocal DBから清掃して再実行し、`25/25 PASS`後にも同fixtureを清掃した。

### Static / database

- local DB lint (`warning`): PASS, findings 0
- `npx tsc --noEmit`: PASS
- focused ESLint: PASS
- `git diff --check`: PASS
- STAFF-2C / Assignment fixture remaining: 0

## Files Changed

- `supabase/migrations/20260921145905_structured_job_requirements.sql`
- `supabase/migrations/20260921150636_lock_job_requirement_master_attach.sql`
- `scripts/integration/staff-structured-job-requirements-test.mjs`
- `docs/staff-2c-structured-job-requirements-result.md`

## Explicit Non-Changes

- `jobs.requirements` free text: unchanged
- Assignment / Placement semantics: unchanged
- Shift-specific requirements: not added
- preferred / weighted requirements: not added
- proficiency / score: not added
- Availability / overlap / travel eligibility: not added
- Candidate Picker / automatic blocking / autoscheduling / AI: not added
- Auth architecture / package dependencies: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- pre-existing staged, unstaged, and untracked work: preserved
