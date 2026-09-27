# OCV1-04A — Worker Journey Facts Foundation Result

## Status

`OCV1-04A: COMPLETE`

Wake / Departure / Arrival are now independent canonical Worker journey facts with append-only correction history. They do not write or reinterpret Attendance, Assignment, Placement, Incident, Notification, or Attention.

## 1. Implemented persistence

Added `public.assignment_journey_event_versions` as the single narrow journey history table.

- Allowed logical identities are only `(assignment_id, journey_type)` where `journey_type` is `wake`, `departure`, or `arrival`.
- Versions are unique and contiguous per logical identity under an Assignment row lock.
- `recorded` versions preserve DB-received `occurred_at` and server-derived `timeliness`.
- `voided` versions contain no replacement occurrence and require a normalized correction reason.
- Version 1 must be `recorded`.
- Runtime `INSERT`, `UPDATE`, and `DELETE` privileges are absent. Corrections append; they do not mutate or delete earlier rows.
- The table is not a generic event store or Timeline table.

No direct Data API read surface was added in this phase. The OCV1-04B Timeline/current-state projection must expose only the actor-appropriate safe shape and must not expose raw request snapshots or Admin correction details to Workers.

## 2. Worker record command

Added:

```text
public.record_own_assignment_journey_event(
  p_assignment_id uuid,
  p_journey_type text,
  p_idempotency_key uuid
) -> jsonb
```

The command derives the active Worker, Assignment, Shift, authorized schedule, DB occurrence time, timeliness, lifecycle state, and supersede state server-side.

Frozen behavior implemented:

| Type | Schedule | Open | Due/timeliness | Close/supersede |
| --- | --- | --- | --- | --- |
| Wake | `pre_shift_confirmations.planned_wake_at` | planned − 6h | late after planned | current Arrival, `start_work`, Shift end, cancelled/terminal |
| Departure | `pre_shift_confirmations.planned_departure_at` | planned − 2h | late after planned | current Arrival, `start_work`, Shift end, cancelled/terminal |
| Arrival | `meeting_at ?? starts_at` | target − 3h | late after target | `start_work`, Shift end, cancelled/terminal |

Missing Wake/Departure plans return `NOT_REQUIRED`; no defaults are fabricated. Missing Wake does not block Departure. A downstream fact does not synthesize an earlier event.

Idempotency and concurrency:

- same actor/key/fingerprint replays the canonical result;
- same actor/key with a different Assignment/type returns `IDEMPOTENCY_CONFLICT`;
- another key after a current fact returns `ALREADY_RECORDED` with the safe canonical fact;
- the Assignment row lock serializes concurrent record attempts;
- a voided fact may be re-recorded only if the current lifecycle/window still permits it.

## 3. Admin correction command

Added:

```text
public.void_assignment_journey_event(
  p_assignment_id uuid,
  p_journey_type text,
  p_expected_version bigint,
  p_correction_reason text,
  p_idempotency_key uuid
) -> jsonb
```

- Manager access is limited to an accessible Branch.
- System Admin access follows the repository's organization-wide scope.
- Worker calls return `FORBIDDEN`.
- Foreign or missing Assignment access returns safe `NOT_FOUND`.
- `expected_version` mismatch returns `VERSION_CONFLICT`.
- A current `recorded` version is required.
- The correction appends the next `voided` version and preserves the original occurrence.
- The command cannot create a Worker occurrence.

## 4. Security boundary

Both commands:

- are PostgreSQL-owned `SECURITY DEFINER` functions;
- use `search_path = ''` and schema-qualified objects;
- derive actor and scope from `auth.uid()` and canonical tables;
- grant `EXECUTE` only to `authenticated`;
- revoke `PUBLIC`, `anon`, and `service_role` execution;
- return controlled outcomes for foreign/missing resources;
- use no service-role product runtime path.

The journey table has RLS enabled and no runtime table privileges. Current Supabase guidance was followed for explicit grants, RLS as a separate control, restricted function execution, and empty-search-path SECURITY DEFINER functions.

## 5. Focused DB verification

`scripts/integration/worker-journey-facts-test.mjs`: **52/52 PASS**.

Covered evidence:

- Wake: before-open, normal, late, duplicate, same-key replay, different-key concurrency, missing plan, Arrival supersede, terminal/cancelled.
- Departure: before-open, normal, late, missing plan, missing Wake allowed, no synthetic Wake, Arrival supersede.
- Arrival: before-open, normal, late, retry, independent occurrence before `start_work`, `start_work` without Arrival, superseded after `start_work`, Shift-end close.
- Correction: own-Branch Manager, foreign-Branch denial, System Admin, Worker denial, stale expected version, preserved history, contiguous versions, eligible re-record after void.
- Security: foreign Worker Assignment, anon denial, service-role product-path denial, direct insert/update/delete denial, hardened function metadata.
- Non-interference: no journey-created Attendance, Assignment lifecycle, or Placement mutation.

Dedicated OCV1-04A fixtures remaining after verification: **0**.

## 6. Regression results

| Existing contract | Result |
| --- | --- |
| Worker Attendance | PASS, 40/40 |
| Pre-shift RLS | PASS, 16/16 |
| Operational Incident | PASS, 47/47 |
| Candidate Assignment command | PASS, 31/31 |
| Worker Application command | PASS, 26/26 |

Attendance regression confirms `start_work` / `end_work` remain their existing formal facts. Arrival neither creates nor replaces `start_work`, and an existing `start_work` only makes a missing Arrival `SUPERSEDED`.

## 7. Static, build, and database checks

| Check | Result |
| --- | --- |
| Focused ESLint | PASS |
| `npx tsc --noEmit` | PASS |
| Production build | PASS |
| Supabase DB lint (`public,private`, warning level) | PASS, 0 issues |
| Supabase security advisor | PASS, 0 issues |
| `git diff --check` | PASS |

The initial DB lint found one unused local variable in the void command. A follow-up migration changed only the authorization query target to `PERFORM`; command behavior and authorization remained unchanged. The focused suite was rerun at 52/52 after the fix.

## 8. Migrations

- `20260927070242_ocv1_worker_journey_facts.sql`: table, invariants, record command, correction command, grants.
- `20260927071032_ocv1_worker_journey_void_lint.sql`: behavior-preserving lint cleanup for the correction command.

Both migrations were applied only to the local Supabase environment. No reset, linked operation, remote push, or remote mutation was performed.

## 9. Explicit non-changes

- No Timeline/current-state reader or UI.
- No Worker/Admin journey UI or Server Action.
- No planned Wake/Departure editing path; missing values remain `NOT_REQUIRED` until OCV1-04B.
- No Attention rule, reminder, Notification, LINE, scheduler, or external integration.
- No Assignment journey status.
- No generic event store or Timeline table.
- No writes to dormant attendance types `wake_up`, `depart`, or `arrive`.
- No changes to Attendance, Assignment, Placement, Pre-shift Confirmation, Incident, Notification, or Application contracts.
- No package changes, commit, or push.

## 10. OCV1-04B implications

OCV1-04B can now build a bounded server-derived current-state/Timeline projection over this version history and the existing canonical sources. It must:

1. take the highest journey version per `(assignment_id, journey_type)` as current state;
2. treat `recorded` as a current fact and `voided` as currently missing while retaining audit history;
3. derive `not_required`, `not_open`, overdue, closed, and missing-superseded states rather than persisting placeholders;
4. redact raw request snapshots, correction actors/reasons, other Assignment details, and internal authorization data from Worker responses;
5. add the normal authorized input path for planned Wake/Departure times without changing the immutable Pre-shift Confirmation contract;
6. keep Arrival and Attendance `start_work` as separate facts in both next-action precedence and display.
