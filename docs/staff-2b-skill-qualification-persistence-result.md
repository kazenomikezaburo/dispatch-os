# STAFF-2B — Skill / Qualification Master and Staff Holding Persistence Result

## Status

`STAFF-2B: COMPLETE`

## Executive Summary

STAFF-2AでFreezeした4つのcanonical sourceをLocal PostgreSQLへ実装した。

```text
public.skills
public.qualifications
public.worker_skills
public.worker_qualifications
```

Staff identityは既存`public.workers`のまま維持し、holdingは`worker_id`へ接続した。Auth Profile、Assignment、Placement、Job requirementへSkill / Qualification factを複製していない。

Runtime table accessはauthorized readだけに限定し、mutationはSystem Admin専用のnarrow RPC 6本へ集約した。Managerは既存Branch authorizationに従うread only、Worker / anonは新規accessなしである。

## Canonical Tables

### `public.skills`

- UUID primary key
- stable unique `code`
- `name`, optional `description`
- `is_active`
- timestamps
- no expiry fields

Codeはcommand / triggerでouter whitespaceをtrimしuppercaseへ正規化する。許可文字は`A-Z`, `0-9`, `.`, `_`, `-`で、blank / internal whitespaceを拒否する。作成後のcode変更は`master_code_immutable`で拒否する。

### `public.qualifications`

- Skillと同じstable code / metadata / lifecycle
- `expiry_policy = none | optional | required`

`none`はholdingの`expires_on`を禁止し、`required`は必須とする。既存holdingと矛盾するpolicy変更も拒否する。

### `public.worker_skills`

- composite primary key `(worker_id, skill_id)`
- optional `acquired_on`
- holding-level `is_active`
- Worker / Skillへのrestrict FK

one current holding per Worker / SkillをDB-levelで保証する。

### `public.worker_qualifications`

- composite primary key `(worker_id, qualification_id)`
- optional credential number
- `issued_on`, `valid_from`, `expires_on`
- `revoked_at`
- Worker / Qualificationへのrestrict FK

`valid_from <= expires_on`をDB CHECKで保証する。資格有効性を現在時刻でmaterializeするcolumnやflagは追加していない。将来のCandidate readはSTAFF-2A contractどおり、target Shift start dateへこれらのfactsを評価する。

## Lifecycle

Masterはactive作成、metadata更新、deactivate、reactivateを扱う。hard delete commandは追加していない。

- inactive masterへの新規holding作成: rejected
- inactive Skill配下の既存holding deactivate: allowed
- inactive Qualification配下の既存credential correction / revoke: preserved
- inactive Qualification配下でrevoked credentialをactiveへ戻す操作: rejected
- master deactivate: existing holding rows remain

## Commands

System Admin専用:

```text
create_skill_master
update_skill_master
create_qualification_master
update_qualification_master
set_worker_skill_holding
set_worker_qualification_holding
```

全commandは:

- owner `postgres`
- `SECURITY DEFINER`
- `search_path = ''`
- schema-qualified object access
- actorを`auth.uid()`から再導出
- active System AdminをDB内で再検証
- PUBLIC / anon / service_role revoke
- authenticatedへEXECUTEのみgrant

holding commandはclientからrole / Branch / Auth Profileを受け取らない。

## Reads and RLS

全4 tableでRLSを有効化し、Data API table privilegeはauthenticated SELECTだけとした。INSERT / UPDATE / DELETE / TRUNCATEはgrantしていない。

- System Admin: 全master / 全Branch holding read
- Manager: master read + `private.has_branch_access(workers.branch_id)`を満たす自支店holding read
- Manager foreign Branch: 0 rows
- Worker: master / holdingとも0 rows
- anon: table privilegeなし

RLS用`private.is_active_admin()`はactive `manager | system_admin`だけを返すactor predicateである。既存private helper conventionに合わせ、authenticatedへRLS evaluation用EXECUTEのみgrantした。

## Constraints and Normalization

- master code unique
- canonical uppercase code
- code / name nonblank
- stable code immutable
- Qualification expiry policy closed set
- one current holding per Worker / master
- `valid_from <= expires_on`
- nonblank credential number when present
- inactive master new-holding rejection
- policy / credential expiry consistency
- holding identity immutable

Duplicate preventionはapplication-side SELECT-before-INSERTに依存しない。

## Incremental Migration Notes

Primary migration:

- `20260921133722_staff_skill_qualification_persistence.sql`

Local integrationで、inactive master配下の既存holding updateが`INSERT ... ON CONFLICT`のBEFORE INSERT validationへ先に当たる境界を検出した。適用済みmigrationを変更せず、UPDATE-first / INSERT-secondへ修正した。

- `20260921134232_fix_staff_holding_upsert.sql`

RLS policy helperはauthenticated actorによるpolicy評価にEXECUTEが必要だったため、既存`has_branch_access`と同じnarrow patternで追加grantした。

- `20260921134335_grant_staff_admin_rls_helper.sql`

## Verification

### STAFF-2B Integration

`scripts/integration/staff-skill-qualification-persistence-test.mjs`: `38/38 PASS`

Covered:

- Skill create / update / deactivate
- Qualification create / update / deactivate
- code normalization / immutability / duplicate rejection
- blank protection
- duplicate Worker Skill / Qualification rejection
- holding active / inactive
- no-expiry / required-expiry credentials
- invalid expiry-policy combinations
- invalid date order
- revoked credential persistence
- inactive master new-holding rejection
- holding survival after master deactivation
- conflicting master policy update rejection
- System Admin mutation / organization read
- Manager own-Branch read / foreign isolation for both holding types
- Worker / anon denial
- direct authenticated writes denied
- SECURITY DEFINER hardening
- fixture cleanup

### Existing Regressions

- Admin Worker rules: `8/8 PASS`
- Assignment integrity: `25/25 PASS`
- Placement rules: `39/39 PASS`
- Placement editor rules: `13/13 PASS`
- Time-band coverage: `8/8 PASS`
- Placement core schema / security: `26/26 PASS`
- Placement Break atomic command: `20/20 PASS`

### Static / Database

- Local DB lint public/private, warning threshold: `0 findings`
- focused ESLint: PASS
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS

The first Assignment regression invocation lacked local environment variables and stopped before mutation. It was rerun with values read from `supabase status --output env`; its local-only guard remained active and the suite passed 25/25.

## Fixture Cleanup

- `S2B-%` Skill masters: 0
- `S2B-%` Qualification masters: 0
- related Worker Skill holdings: 0
- related Worker Qualification holdings: 0
- existing seed / product fixtures: preserved

## Files Changed

- `supabase/migrations/20260921133722_staff_skill_qualification_persistence.sql`
- `supabase/migrations/20260921134232_fix_staff_holding_upsert.sql`
- `supabase/migrations/20260921134335_grant_staff_admin_rls_helper.sql`
- `scripts/integration/staff-skill-qualification-persistence-test.mjs`
- `docs/staff-2b-skill-qualification-persistence-result.md`

STAFF-2A result document remains the frozen domain source and was not reinterpreted.

## Explicit Non-Changes

- `workers` Staff identity: unchanged
- Auth Profile holding relation: not added
- `jobs.requirements` free-text note: unchanged
- Job / Shift structured requirements: not added
- Candidate Picker / candidate eligibility: not added
- Availability / Open Shift: not added
- Assignment / Placement / Break / Coverage semantics: unchanged
- AI scoring / automatic placement: not added
- packages: unchanged
- remote Supabase: unchanged
- commit / push: 0
- existing uncommitted work: preserved

## Readiness

The four canonical sources are ready for a separate structured Job requirement phase. That phase must evaluate Qualification validity against target Shift start date and must not use current time as the credential-validity source.

`STAFF-2B: COMPLETE`
