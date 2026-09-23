# STAFF-2G.2 — Canonical Candidate Assignment Command Result

## Status

`STAFF-2G.2: COMPLETE`

## Executive Summary

Added a local-only, idempotent `public.ensure_candidate_assignment(...)`
command that converts an authorized Candidate decision into one canonical
`public.assignments` row or reuses an existing active Assignment. The command
does not accept or trust Branch, actor, Application, Assignment, eligibility,
capacity, or provenance values from the client.

Candidate Picker and Placement UI were not changed. The existing
`create_assignment_from_application(uuid, uuid)` function was not modified.

## Canonical Command

Signature:

```text
ensure_candidate_assignment(
  shift_id,
  worker_id,
  assignment_path,
  idempotency_key
)
```

Closed paths:

- `accepted_application`
- `direct_admin`

The command locks and validates in the following order:

1. authenticated Admin context
2. target Shift and its canonical Branch/lifecycle/capacity
3. target Worker and its canonical Branch/status
4. existing target-Shift active Assignment
5. Shift + Worker Application
6. actor-scoped idempotency receipt
7. current STAFF-2F Candidate facts
8. current active Assignment capacity
9. canonical Assignment insert

## Assignment Behavior

- An existing active target-Shift Assignment is returned as
  `existing_assignment` before lifecycle, eligibility, or capacity checks.
- `direct_admin` is available only when no Application exists and creates
  `source = manager` with `assigned_by = auth.uid()`.
- `accepted_application` derives the Application from Shift + Worker, requires
  `accepted`, and creates `source = application` without mutating Application
  state.
- Applied, rejected, withdrawn, and accepted-plus-direct states return the
  frozen controlled outcomes.
- Missing accepted-Application source converges to `unavailable`.
- New Assignment creation is limited to Shift states `recruiting`, `closed`,
  `confirmed`, and `in_progress`.
- Capacity counts only canonical active Assignment statuses and is serialized
  by the Shift row lock.
- Placement continues to receive only the canonical Assignment UUID.

## Eligibility Re-evaluation

The command calls the canonical
`get_worker_shift_candidate_eligibility(worker_id, shift_id)` reader inside the
transaction after locks and path validation. It does not copy or reimplement
Skill, Qualification, Availability, Worker status, or cross-Shift overlap
rules. `not_eligible` includes only the existing closed blocking-reason shape.

## Idempotency and Concurrency

Private state:

```text
private.candidate_assignment_command_receipts
```

Receipt identity is `(actor_profile_id, idempotency_key)`. The fingerprint is
the stored `(shift_id, worker_id, assignment_path)` tuple.

- same key + same fingerprint: original result is replayed with
  `replayed = true`
- same key + different fingerprint: `IDEMPOTENCY_CONFLICT`
- different keys + same Worker/Shift: one insert, then canonical reuse
- different Workers at final capacity: one insert, then `capacity_reached`
- the existing partial unique index remains the final duplicate defense
- unexpected database failure rolls back both Assignment and receipt

## Authorization and Security

- `SECURITY DEFINER`, owner `postgres`, `search_path = ''`
- every referenced object is schema-qualified
- active Manager/System Admin is derived from `auth.uid()`
- both Shift and Worker scope are re-authorized server-side
- Manager is limited to accessible Branches
- System Admin retains organization-wide scope
- foreign/missing source cases converge to `unavailable`
- execution is revoked from `PUBLIC`, `anon`, and `service_role`
- only `authenticated` receives execute; Worker callers fail the internal
  Admin authorization check
- private receipts grant no runtime table access and are outside the public
  Data API schema
- direct writes to Assignment were not broadened

## Existing Command Compatibility

`public.create_assignment_from_application(uuid, uuid)` was left byte-for-byte
unchanged. Its existing authorization, Application validation, duplicate,
capacity, provenance, and error behavior remain intact. The existing
Assignment integrity suite passed 25/25.

## Verification

Dedicated command integration:

- `staff-candidate-assignment-command-test.mjs`: 31/31 PASS
- direct Admin and accepted Application creation: PASS
- existing Assignment reuse at full capacity: PASS
- current overlap/Availability/Worker/Qualification facts: PASS
- Application state outcome matrix: PASS
- Shift lifecycle and capacity: PASS
- Manager/System Admin scope: PASS
- replay and fingerprint conflict: PASS
- same-key concurrency: PASS
- different-key same Worker concurrency: PASS
- final-capacity concurrency: PASS
- unexpected failure rollback: PASS
- canonical Assignment UUID and provenance: PASS
- fixture cleanup: PASS

Focused regressions:

- STAFF-2F Candidate Eligibility: 22/22 PASS
- STAFF-2G.1 target-Shift Assignment facts: 12/12 PASS
- Assignment integrity/Application behavior: 25/25 PASS
- Placement core schema/security: 26/26 PASS
- Placement rules: 39/39 PASS

Static/database verification:

- local DB lint (`warning` level): PASS, 0 findings
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS

## Fixture Cleanup

All `S2G2-*` Workers and their Shift, Application, Assignment, Availability,
Qualification, requirement, and private receipt fixtures were removed. The
dedicated cleanup assertion returned zero residual rows.

## Files Changed

- `supabase/migrations/20260922165005_candidate_assignment_command.sql`
- `scripts/integration/staff-candidate-assignment-command-test.mjs`
- `docs/staff-2g-2-candidate-assignment-command-result.md`

## Explicit Non-Changes

- Candidate Picker UI: unchanged
- Placement UI and save validation: unchanged
- Assignment/Application lifecycle semantics: unchanged
- `create_assignment_from_application`: unchanged
- STAFF-2F/2G.1 eligibility semantics: unchanged
- packages: unchanged
- remote Supabase: unchanged
- commit/push: 0
- existing staged, unstaged, and untracked work: preserved

`STAFF-2G.2: COMPLETE`
