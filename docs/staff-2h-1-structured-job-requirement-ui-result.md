# STAFF-2H.1 — Structured Job Requirement UI Result

## Status

`STAFF-2H.1: COMPLETE`

既存Job編集Drawerへ、STAFF-2Cのcanonical Skill / Qualification requirementを閲覧・追加・削除するUIを追加した。既存の `jobs.requirements` は「応募条件（自由記述）」として維持し、構造化された必須要件とは別セクションで表示する。

## Existing Contract Audit

- Canonical persistence: `job_skill_requirements`, `job_qualification_requirements`
- Mutation boundary: `add_job_skill_requirement`, `remove_job_skill_requirement`, `add_job_qualification_requirement`, `remove_job_qualification_requirement`
- Authorization: Manager own-Branch / System Admin organization scope; Worker / anon unavailable
- Candidate facts: `get_worker_shift_requirement_facts` and STAFF-2F composer consume the same canonical rows
- Free text: `jobs.requirements` remains an independent human-readable note

No schema, RLS, RPC, Assignment, Placement, or Candidate eligibility rule was changed.

## Read Model

`getProjectDetail` now performs bounded, batched reads for all Jobs in the selected Project:

- existing Skill requirements
- existing Qualification requirements
- Skill masters
- Qualification masters

Existing requirements retain inactive masters for historical/configuration visibility. Add-option lists contain active masters only. The implementation does not perform a per-Job N+1 query.

## Job UI

The existing Job edit Drawer now contains a separate `構造化された必須要件` section:

- required Skill list with master name and code
- required Qualification list with master name and code
- active-master-only selectors
- add and remove controls
- success/error feedback
- pending/double-submit protection
- inactive master warning (`Master無効 — 設定を確認してください`)

The existing field is labelled `応募条件（自由記述）` with explanatory text that it is separate from structured Skill / Qualification facts. It is neither parsed nor used as a substitute for structured requirements.

## Mutation and Security

The Server Action validates only the closed UI input (`jobId`, master ID, kind, operation), rejects Worker callers early, and delegates all canonical authorization and invariants to the existing STAFF-2C RPCs.

- no direct table mutation was added
- no client-provided Branch or role is trusted
- inactive-master and duplicate protection remain DB-enforced
- foreign/missing resources use a non-disclosing unavailable response
- no service-role product path was added

## Browser Verification

Authenticated local System Admin verification on the canonical Project / Job edit flow confirmed:

- free-text and structured requirements render as distinct sections
- Skill add and remove succeed through the existing RPC
- Qualification add and remove succeed through the existing RPC
- master name/code and success feedback render correctly
- an existing inactive Skill requirement remains visible with a configuration warning
- the inactive master is absent from selectable add options
- the inactive requirement can still be removed
- controls expose keyboard-accessible native select/buttons and 44px minimum targets
- 1440x900: horizontal overflow `0`
- 1280x900: horizontal overflow `0`
- 390x844: horizontal overflow `0`; structured requirement section remains visible
- application / React / hydration console warnings and errors: `0`
- server exceptions during the exercised flow: `0`

## Verification

- STAFF-2B persistence/security: `38/38 PASS`
- STAFF-2C structured requirements: `33/33 PASS`
- STAFF-2F candidate eligibility: `22/22 PASS`
- STAFF-2G.3 Candidate Picker read model: `15/15 PASS`
- focused ESLint: `PASS`
- `npx tsc --noEmit`: `PASS`
- `npm run build`: `PASS`
- `git diff --check`: `PASS` (line-ending notices only; no whitespace errors)

The STAFF-2C suite explicitly reconfirmed duplicate rejection, inactive-master add rejection, Manager own/foreign Branch boundaries, System Admin access, immediate requirement-fact consumption, and unchanged `jobs.requirements`.

## Fixture Cleanup

Dedicated local QA masters and their possible holding/requirement links were removed. Remaining dedicated fixtures: `0`.

## Files Changed

- `app/actions/job-requirements.ts`
- `components/admin/projects/jobs/job-structured-requirements.tsx`
- `components/admin/projects/jobs/job-edit-drawer.tsx`
- `components/admin/projects/jobs/form/job-create-form.tsx`
- `lib/admin/projects/get-project-detail.ts`
- `lib/admin/projects/project-detail-rules.ts`
- `lib/admin/projects/project-detail-types.ts`
- `docs/staff-2h-1-structured-job-requirement-ui-result.md`

## Explicit Non-Changes

- STAFF-2C domain semantics: unchanged
- `jobs.requirements` value/meaning: unchanged
- Skill / Qualification persistence: unchanged
- Candidate eligibility rules: unchanged
- Assignment / Placement behavior: unchanged
- DB schema / RLS / RPC: unchanged
- packages: unchanged
- remote Supabase: unchanged
- commit / push: not performed
- pre-existing uncommitted work: preserved
