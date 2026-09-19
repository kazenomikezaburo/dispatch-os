# ADMIN-QA-3.0B-6B.1 Regression Baseline Reconciliation

## Status

`ADMIN-QA-3.0B-6B.1: COMPLETE`

`ADMIN-DATA-3.0B-6B: COMPLETE`

`ADMIN-UI-3.0B-6C: READY`

The two pre-existing regression-baseline failures that blocked 6B were corrected in test scope only. Product code, Project History implementation, database schema, migrations, RLS, RPCs, and runtime behavior were not changed.

## Initial Blockers

1. `placement-core-schema-test.mjs` reused mutable seed Shift and Assignment rows. A seed Shift had acquired a Placement plan during later local work, so the test's assumption that the Shift had no plan was no longer reproducible.
2. `attendance-confirmation-test.ts` assertion `ATTENDANCE-CONFIRM-047` required the obsolete literal `勤怠確定済み`, while the current canonical detail UI presents the formal record as `正式実績` and `現在の正式勤怠`.

## Placement Fixture Root Cause

The Placement schema test wrapped its writes in `BEGIN`/`ROLLBACK`, but its input Shift and Assignment rows came from shared mutable seed data. The test therefore owned its derived Placement rows but not the precondition it asserted. Subsequent legitimate local Placement data made the unique-plan assertion collide before the suite could complete. This was test-state coupling, not a Placement schema or Project History regression.

## Placement Test Isolation Fix

The suite now creates dedicated Project, Job, Shift, and Assignment rows inside the same existing transaction before creating Placement plans, positions, and segments. The dedicated IDs are test-owned, all assertions preserve their original meaning, and the final rollback removes the complete fixture graph. No existing seed or business row is deleted, updated, or used as a mutable precondition.

## Attendance Assertion Root Cause

The runtime confirmation contract remained valid; 49 of 50 checks already passed. The sole failure was a source-text assertion bound to an older presentation literal rather than the current semantic contract.

## Attendance Canonical Terminology Evidence

- The detail view labels the read-only confirmed record `正式実績` and `現在の正式勤怠` and presents `確定者` and `確定日時`.
- The confirmation form and both UI guidance documents use `確定勤務実績` terminology.
- Existing Attendance visual-alignment results preserve the distinction between Worker punches and the official attendance record.

This establishes the current terminology as intentional and canonical; restoring the obsolete product literal would have been a UI regression.

## Attendance Test Adjustment

`ATTENDANCE-CONFIRM-047` now verifies the formal-record heading, official-attendance label, approver and confirmation-time metadata, and the existing `detail.record` conditional. The assertion remains meaning-based and continues to protect the read-only confirmed-record contract. Fixture semantics, login, confirmation behavior, cleanup, roles, and credentials handling are unchanged.

## Product Code Changes

None.

## Project History Changes

No Project History migration, table, trigger, RPC, RLS policy, data-access function, or focused test was changed in this phase. Only the 6B result status and regression evidence were reconciled after all gates passed.

## Regression Results

- Project History Foundation: 36/36 PASS.
- Project Setup: 35 assertions PASS.
- Project Management Hub: 31 assertions PASS.
- Unified Editors: 33 assertions PASS.
- Shift Views: 33/33 PASS.
- Placement Core Schema/Security: 26/26 PASS.
- Placement Editor Rules: 13/13 PASS.
- Placement Rules: 39/39 PASS.
- Placement Break Atomic Command: 20/20 PASS.
- Pre-shift Monitor: PASS.
- Pre-shift Rules: 20/20 PASS.
- Pre-shift Admin: 20/20 PASS.
- Pre-shift RLS: 16/16 PASS.
- Day-of Rules: 17/17 PASS.
- Day-of Fixture Matrix: 12/12 PASS.
- Admin Attendance: 40/40 PASS.
- Attendance Confirmation: 50/50 PASS.
- Attendance Revision: 53/53 PASS.
- Operational Incident: 47/47 PASS.

The first sandboxed orchestration attempt could not write Supabase CLI telemetry or spawn Docker. The same local-only suites were rerun with the required host permissions and correct CLI-to-test environment-variable mapping; the results above are from those completed runs.

## Static Verification

- Repository ESLint (`npm run lint`): PASS.
- TypeScript (`npx tsc --noEmit`): PASS.
- Production build (`npm run build`): PASS.
- `git diff --check`: PASS. Git reported only informational LF-to-CRLF working-copy notices for the two edited tests.

## Files Changed

- `scripts/integration/placement-core-schema-test.mjs`
- `scripts/integration/attendance-confirmation-test.ts`
- `docs/admin-data-3.0b-6b-project-history-foundation-result.md`
- `docs/admin-qa-3.0b-6b-1-regression-baseline-result.md`

## Explicit Non-Changes

- Product/Admin/Worker UI: unchanged.
- Project History implementation and focused test: unchanged.
- Database schema, migrations, RLS, grants, and RPCs: unchanged.
- Placement and Attendance runtime/domain behavior: unchanged.
- Auth architecture and credentials handling: unchanged.
- Packages and lockfile: unchanged.
- Figma: unchanged.
- Remote services and database: unchanged.
- Commit/push: none.
- Existing staged, unstaged, and untracked work: preserved.
