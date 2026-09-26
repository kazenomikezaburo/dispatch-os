# OCV1-02A — Recruitment Visibility & Discovery Contract

## Status

`OCV1-02A: CONTRACT FROZEN / NOT IMPLEMENTED`

This document freezes the OpsCue V1 Worker-facing “募集中の勤務” visibility, eligibility, and lifecycle contract. It adds no migration, RPC, UI, application mutation, Assignment change, or external delivery integration.

The contract distinguishes **publication visibility** from **Worker application eligibility**. Neither visibility nor a rendered CTA is Assignment authorization.

## 1. Current recruitment audit

### 1.1 Existing canonical sources

| Source | Existing contract | OCV1-02A use |
| --- | --- | --- |
| Project | `projects.status` includes `draft`, `recruiting`, `closed`, `in_progress`, `completed`, `cancelled`; Project carries the Branch scope and recruitment period fields. | Project `recruiting` is required for Worker recruitment publication. Project recruitment period is not an authoritative per-Shift application window. |
| Job | `jobs.status` shares the lifecycle vocabulary and owns Worker-facing conditions: description, clothing, belongings, access/meeting notes, transport, wage/fee fields, recruitment notes, manual URL, and structured requirements. | Job is the content/requirements owner. Current Worker apply/RLS rules do not use Job status as a publication gate, so OCV1-02A does not invent one. |
| Shift | `shift_slots.status`, schedule, `meeting_at`, `required_workers`, and optional `application_deadline` are the actionable recruitment unit. | Shift `recruiting` is the per-Shift publication state. |
| Application | `shift_applications` is one row per `(shift_slot_id, worker_id)`, with `applied`, `accepted`, `rejected`, or `withdrawn`. | It is the only V1 application lifecycle. |
| Assignment | Canonical Assignment derives from a reviewed accepted Application or direct Admin path; capacity is serialized by existing Assignment commands. | Active Assignment removes the Worker from recruitment discovery for that Shift. |
| Candidate Eligibility | STAFF-2F composes Worker status, structured requirements, Availability, and cross-Shift conflict into `implemented_hard_rules_only`. It is currently an Admin-authorized reader. | V1 discovery reuses its canonical facts server-side, but does not expose the Admin reader or raw internal detail to Workers. |

### 1.2 What currently acts as publication state

The current Worker RLS helper `private.worker_can_apply_to_shift_slot` permits an insert only when all of the following are true:

```text
active Worker in the Project Branch
AND Project.status = recruiting
AND Shift.status = recruiting
```

The Worker Shift read policy permits the related Shift because `private.worker_can_view_shift_slot` grants read for a Worker in a recruiting Project Branch. It does not currently filter the list to per-Shift lifecycle, deadline, capacity, existing Application/Assignment, or Candidate Eligibility.

Therefore the existing canonical publication basis is **Project + Shift recruitment state**, not a separate Recruitment aggregate. It is sufficient for V1 if the Worker reader makes the remaining V1 gates explicit. A new `recruitments` table is not justified.

### 1.3 Existing gaps that OCV1-02B/03 must close

- No Worker discovery/list/detail reader or route exists.
- The current Worker insert policy does not check `application_deadline`, capacity, Application status, or Candidate Eligibility.
- `get_worker_shift_candidate_eligibility` deliberately authorizes only active Admins and contains Admin-oriented raw facts; it cannot be called directly by Worker UI.
- The unique Application row means the current schema has no “new application after terminal Application” history model.
- Existing direct table RLS allows a Worker to insert an `applied` Application in the old narrow conditions; V1 application behavior needs a narrow command to revalidate all frozen conditions at write time.

## 2. Canonical publication and recruitment-type decision

### 2.1 V1 publication decision

A Shift is **published to the Worker recruitment discovery universe** only when all conditions below are true at server evaluation time:

```text
Worker is active and belongs to Project Branch
AND Project.status = recruiting
AND Shift.status = recruiting
AND now < Shift.starts_at
AND Shift is not cancelled or completed
```

`Job.status` is deliberately not a publication gate in V1 because no existing Worker RLS or application contract treats it as one. An Admin must keep Project/Job/Shift lifecycle coherent; OCV1-02B may report an inconsistent Job lifecycle as a safe operational error, but MUST NOT silently invent a third publication state.

Publication gives a Worker the right to receive a bounded safe **discovery projection**. It does not establish that the Worker can apply, is eligible, has capacity reserved, or may be assigned.

### 2.2 Recruitment type decision

V1 does **not** persist `NORMAL`, `ADDITIONAL`, or `EMERGENCY` recruitment types.

There is no existing canonical owner, validation rule, lifecycle, reporting behavior, notification policy, or Assignment difference for those labels. Persisting them now would create an unused second model. V1 discovery presents the neutral Worker-facing concept **募集中の勤務**.

If a later phase needs a type to alter publication, priority, notification, audit, or recovery behavior, it must define the canonical owner and lifecycle then. A list sort, Admin search context, or Attention source alone is not sufficient reason to persist it.

## 3. Worker visibility rules

### 3.1 Three independent outcomes

Every published Shift evaluated for a Worker has these independent values:

| Value | Meaning |
| --- | --- |
| `visible` | Worker may receive the safe discovery/detail projection. |
| `applicationState` | Worker’s canonical `shift_applications` state for the Shift, or `none`. |
| `applicationAvailability` | `apply_allowed`, `visible_unavailable`, or `not_visible`; derived server-side at read time and revalidated at write time. |

The list MUST NOT hide a published Shift merely because Candidate Eligibility is blocking, capacity is full, deadline has passed, or the Worker has a terminal Application. These are `visible_unavailable` states so the Worker receives a truthful, non-actionable explanation rather than an unexplained disappearance.

An active canonical Assignment (`assigned`, `confirmed`, or `completed` under the existing Assignment-active convention) makes the Shift `not_visible` in recruitment discovery for that Worker. The Assignment/My Shifts surfaces remain the canonical destination. A direct discovery-detail URL for an already assigned Worker MUST safely redirect to/offer the authorized Assignment context, not display a second recruitment action.

### 3.2 V1 discovery eligibility matrix

| Condition after publication | Visible | Application availability | Worker-facing state |
| --- | --- | --- | --- |
| No Application; capacity remains; before effective deadline; current Eligibility passes | Yes | `apply_allowed` | `available` or `available_with_warning` |
| Availability unknown, partial, or consultable; no blocking fact | Yes | `apply_allowed` | `available_with_warning`; preserve existing nonblocking semantics |
| Preference mismatch only | Yes | `apply_allowed` | `available_with_warning`; preference remains informational/nonblocking |
| Missing Skill/Qualification, inactive requirement master, inactive/suspended Worker, explicit unavailable period, or other-Shift Assignment conflict | Yes | `visible_unavailable` | `not_eligible`; show controlled safe category/reason summary |
| Existing `applied` Application | Yes | `visible_unavailable` | `applied`; no second application |
| Existing `accepted` Application without Assignment | Yes | `visible_unavailable` | `accepted_waiting_assignment`; no Worker assignment action |
| Existing `rejected` Application | Yes while published | `visible_unavailable` | `rejected`; no reapply in V1 |
| Existing `withdrawn` Application | Yes while published | `visible_unavailable` | `withdrawn`; no reapply in V1 |
| Capacity full | Yes while published | `visible_unavailable` | `capacity_full`; remaining capacity is zero/non-reservational |
| Effective deadline passed | Yes until Shift start | `visible_unavailable` | `deadline_passed` |
| Shift starts, becomes cancelled/completed, or Project leaves `recruiting` | No | `not_visible` | Not returned by discovery; known prior Application may appear only in a future My Applications/history surface |
| Foreign Branch/resource or inactive/non-Worker actor | No/safe unavailable | `not_visible` | No existence/Branch detail disclosure |

### 3.3 Effective deadline and capacity

The effective application deadline is:

```text
shift_slots.application_deadline ?? shift_slots.starts_at
```

Application is allowed only while `now < effective deadline`. The existing schema already guarantees an explicit deadline cannot be after Shift start. A null deadline does not mean indefinitely open after work begins.

Capacity is an informational discovery projection and a write-time gate:

```text
remainingCapacity = max(required_workers - activeAssignmentCount, 0)
activeAssignmentCount = Assignment statuses used by the existing canonical command:
  assigned | confirmed | completed
```

The projection may show `remainingCapacity` only as a current snapshot, never as a reservation or a promise that a later submit will succeed. Application does not consume Shift capacity: any number of distinct Workers may hold `applied` rows while fewer Assignment slots remain. Assignment creation remains the existing and exclusive final capacity authority.

At application submit time, the command checks whether canonical active Assignment capacity is already full. If it is full, apply is unavailable. That check is a point-in-time admission gate only: it MUST NOT lock, decrement, reserve, hold, or allocate capacity for an Application. Consequently, when one Assignment slot remains, concurrent eligible Workers may all successfully become `applied`; only the later existing canonical Assignment command serializes final slot consumption.

### 3.4 Candidate Eligibility use

Worker discovery uses the exact existing hard-rule composition:

```text
candidateEligible =
  workerStatusEligible
  AND requirementsEligible
  AND availabilityEligible
  AND overlapEligible
```

It retains `eligibilityScope = implemented_hard_rules_only`.

- Unknown, partial, and consultable Availability remain nonblocking warning states.
- Preference area/category/transport notes remain informational and MUST NOT become hard matching or hidden ranking.
- A requirement failure and cross-Shift conflict make application unavailable, but do not make the published Shift invisible.
- The Worker reader MUST create a Worker-owned safe presentation projection over the canonical source facts. It MUST NOT invoke or expose STAFF-2F’s existing Admin-only endpoint from client code.
- Worker-facing reasons may state safe controlled categories such as “required qualification is not currently met,” “availability needs confirmation,” or “another scheduled Shift overlaps.” They MUST NOT expose other Assignment IDs, other Shift names/times, credential numbers, internal authorization details, or raw Candidate/Manager-only facts.

## 4. Apply eligibility rules

At the moment a Worker submits an application, all conditions MUST be re-derived and true:

```text
active authenticated Worker
AND own Worker identity derived from auth.uid()
AND Worker belongs to the Project Branch
AND Project.status = recruiting
AND Shift.status = recruiting
AND now < coalesce(application_deadline, starts_at)
AND canonical active Assignment capacity is not already full at command evaluation time
AND no active canonical Assignment for same Shift/Worker
AND no existing Application row for same Shift/Worker
AND current STAFF-2F hard-rule eligibility passes
```

The successful V1 effect is exactly one existing `shift_applications` row with:

```text
status = applied
worker_id = server-derived own Worker
shift_slot_id = requested Shift after server authorization
applied_at = server time
```

The Worker cannot submit Application status, reviewer, Branch, capacity, eligibility, Assignment, or timestamps. A UI list result never authorizes the write; all checks run again atomically. Application success does not create a capacity reservation, hold, or allocation.

## 5. Application lifecycle reuse

### 5.1 Frozen lifecycle

```text
none --Worker apply--> applied --Admin accept/reject--> accepted | rejected
                         \--Worker withdraw--> withdrawn
accepted --existing canonical Assignment command--> Assignment
```

`shift_applications` remains the only Application state machine. Admin review remains the existing `applied -> accepted | rejected` decision. Existing Assignment creation from `accepted` remains authoritative and rechecks eligibility/capacity at its own execution time.

### 5.2 Apply/withdraw/reapply decisions

| Situation | V1 decision |
| --- | --- |
| Initial apply | Allowed only by section 4; creates the one canonical row. |
| Duplicate apply/retry | Same operation must converge to the existing row rather than create another row. OCV1-03 must use idempotency/unique-conflict-safe handling. |
| Withdraw while `applied` | Worker-owned transition to existing `withdrawn` state. It must be explicit, server-authorized, and audit-safe. |
| Withdraw after `accepted` | Not allowed in this contract. Existing accepted Application is an Admin/Assignment boundary; a separate cancellation policy is required if product needs it. |
| Reapply after `withdrawn` | Not allowed in V1. The unique `(shift_slot_id, worker_id)` row remains history and no current Worker update policy permits reopening it. |
| Reapply after `rejected` | Not allowed in V1. The result remains visible as `rejected` while published; no automatic overwrite/reapply. |
| Eligibility changes after apply | Application remains `applied`; it is not auto-withdrawn. Admin review and later Assignment command re-evaluate the canonical facts. |
| Capacity becomes full after apply | Application remains `applied`; it is not auto-rejected. Applications never consume/reserve capacity; the existing Assignment decision is the exclusive serialized capacity gate. |
| Shift is cancelled/closed after apply | Application history remains; no automatic Application state mutation is introduced. The Shift leaves discovery. Admin uses existing review/Assignment lifecycle constraints. |
| Worker becomes assigned by direct Admin path | Discovery removes the Shift for that Worker. Existing Application history is retained and no synthetic status transition occurs. |

The current database policy supports Worker insert but has no Worker update policy for withdrawing or reopening. OCV1-03 must add only the narrow command/policy needed for the frozen `applied -> withdrawn` transition; it MUST NOT add a second Application table or new status vocabulary.

## 6. Pre-Assignment detail projection

### 6.1 Safe Worker-facing detail

For a visible published Shift, the server may return the following derived/safe fields:

| Group | Fields |
| --- | --- |
| Identity/context | Project name, Job name, optional Shift label. |
| Schedule | Shift start/end, `meeting_at` when present, `Asia/Tokyo` presentation context. |
| Meeting/workplace | Workplace name, Worker-authorized address, meeting/access notes, and safe HTTPS manual/map links where already allowed. |
| Work/preparation | Work description, clothing, belongings, meal notes, transport type/amount/cap, recruitment notes. |
| Compensation | Hourly wage and transportation fee cap when configured. No payroll promise or calculation. |
| Requirements | Controlled Worker-facing summary of structured required skills/qualifications plus the Worker’s own safe eligibility state. |
| Recruitment | Effective application deadline, current Application state, safe availability/reason summary, and current remaining capacity when it is safe to show. |

The detail may be rendered for `visible_unavailable` states. It MUST make clear that no application is currently possible and why at the controlled category level.

### 6.2 Do not leak

The pre-Assignment projection MUST NOT expose:

- Worker IDs, profile IDs, Branch IDs, client IDs, raw database IDs, or authorization internals;
- other Applicants, Workers, Assignment records, application/review decisions, Candidate lists, or staff codes;
- exact conflicting Assignment IDs, names, routes, or schedules;
- credential numbers, raw qualification/skill holdings belonging to another Worker, or inactive-master internals;
- Placement plan/position/break details, manager identities, internal notes, private project history, audit/version data;
- raw latitude/longitude, location accuracy, GPS proof, or any future journey/attendance/Incident internals;
- Admin-only Candidate Eligibility payloads, ranking, scoring, free-text preference matching, or AI output.

`remainingCapacity` is safe only as an aggregate count and must be omitted rather than inferred if the source becomes unavailable. It never exposes who occupies the slots.

## 7. Security boundary

### 7.1 Server-derived discovery reader

OCV1-02B must use a bounded server/DB reader that:

1. derives the active Worker from `auth.uid()` and `workers.auth_profile_id`;
2. derives Project/Job/Shift/Branch from the requested/read Shift, never from client Branch data;
3. applies the publication predicate before returning detail;
4. reads only the Worker’s own Application/Assignment state;
5. derives capacity from canonical Assignment statuses;
6. evaluates canonical Eligibility server-side through a Worker-safe composition boundary;
7. returns safe unavailable/no-results behavior for foreign, missing, inactive, or unauthorized sources;
8. bounds pagination and ordering, and avoids per-Shift N+1 source reads.

### 7.2 Worker mutation boundary

OCV1-03’s apply/withdraw commands must derive Worker/Branch/actor/timestamps and recheck all facts inside the transaction. Apply checks whether canonical active Assignment capacity is already full at that instant, but it MUST NOT reserve or serialize capacity for Applications. It must not trust client-provided Worker ID, Branch, eligibility result, capacity, Application state, reviewer, or Assignment state.

All exposed persistence must retain RLS and explicit grants. If a `SECURITY DEFINER` command is used, it must follow the existing repository pattern: active profile checks, owner-derived scope, `search_path = ''`, schema-qualified references, revoked `PUBLIC`/`anon`/unneeded execution, and a safe controlled result. This follows current Supabase guidance that RLS and function execution are separate controls.

## 8. Required scenario matrix

| Scenario | Discovery result | Apply result |
| --- | --- | --- |
| Normal published Shift, eligible Worker | Visible, `available` | Allowed after write-time recheck. |
| Availability unknown | Visible, `available_with_warning` | Allowed; existing unknown semantics remain nonblocking. |
| Consultable Availability | Visible, `available_with_warning` | Allowed; no automatic hard block. |
| Missing Skill/Qualification | Visible, `not_eligible` with safe reason | Denied; no Application row. |
| Inactive requirement master | Visible, `not_eligible` with safe requirement reason | Denied; no Application row. |
| Other-Shift Assignment conflict | Visible, `not_eligible`; no conflicting Shift detail | Denied; no Application row. |
| Already applied | Visible, `applied` | No duplicate; retry converges to existing row. |
| Withdrawn | Visible, `withdrawn` while published | Reapply denied in V1. |
| Rejected | Visible, `rejected` while published | Reapply denied in V1. |
| Already assigned | Excluded from discovery; Assignment context is canonical | No apply. |
| Capacity full | Visible, `capacity_full`, remaining 0 | Denied by the point-in-time canonical Assignment-capacity gate; no Application reservation is created. |
| Last-capacity race | Both may initially see one remaining Assignment slot | Both concurrent eligible Workers may successfully become `applied`; neither Application reserves a slot. Exactly one later canonical Assignment command may consume the final capacity. |
| Deadline passed | Visible until Shift starts as `deadline_passed` | Denied. |
| Shift cancelled/completed or has started | Not returned by discovery | Denied. |
| Project no longer recruiting | Not returned by discovery | Denied. |
| Foreign Branch/resource | Safe no-result/unavailable | Denied without existence disclosure. |
| Eligibility changes after apply | Existing Application remains visible/statused | No automatic mutation; review/Assignment re-evaluate. |
| Direct Admin Assignment after apply | Discovery excludes Shift; Application history remains | No new apply. |

## 9. Explicit non-changes

- No `recruitments` table, Recruitment type persistence, Open Shift second model, or new lifecycle.
- No migration, RPC, UI, Worker application mutation, Assignment mutation, Notification, LINE, scheduler, ranking, AI, or remote service change.
- No change to Project/Job/Shift/Application/Assignment/Placement schemas or existing canonical status names.
- No Application reservation, hold, applicant-count capacity, first-come allocation, or use of discovery visibility as Assignment authorization.
- No change to STAFF-2F hard-rule meaning, Availability unknown/consultable semantics, structured requirements, Candidate ranking boundary, or Candidate Assignment command.
- No Worker access to Admin Candidate Eligibility payloads or other Worker data.
- No automatic application rejection/withdrawal because capacity, eligibility, or Shift lifecycle later changes.

## 10. Implementation implications

### OCV1-02B — Worker recruitment discovery and detail read/UI

OCV1-02B should implement a bounded Worker-owned discovery/detail projection using the publication predicate and safe output in this document. It should reuse existing tables and canonical fact readers, while introducing a Worker-safe eligibility presentation boundary rather than widening the Admin-only STAFF-2F endpoint.

It must test Project/Shift publication, deadline fallback, capacity display, all Application states, safe reason redaction, foreign Branch behavior, Worker RLS, pagination, and no N+1 behavior. It should not implement mutation.

### OCV1-03 — Worker application command/UI

OCV1-03 should implement only the frozen `none -> applied` and `applied -> withdrawn` paths over `shift_applications`. It must make duplicate/network retries idempotent and revalidate publication, deadline, current non-full Assignment capacity, and Eligibility at command time. It MUST NOT serialize, reserve, hold, decrement, or allocate capacity for Applications: concurrent applicants may all become `applied` while capacity remains. It preserves terminal `rejected`/`withdrawn` rows rather than creating reapplication history or an alternate state machine.

Admin review and canonical Assignment creation remain existing consumers. OCV1-03 must run focused Application/RLS/concurrency tests plus existing Assignment and Candidate Eligibility regressions.

## 11. Freeze summary

```text
Project recruiting + Shift recruiting + same-Branch active Worker + before Shift start
  -> published discovery projection
  -> visible status (available / warning / unavailable / application state)
  -> server-revalidated apply command
  -> existing shift_applications
  -> existing Admin review
  -> existing canonical Assignment command
```

V1 needs no Recruitment table or recruitment-type persistence. Existing Project and Shift state publish a safe discovery universe; canonical Eligibility, deadline, current Assignment capacity, Application, and Assignment facts determine whether an individual Worker can apply. Applications are expressions of interest, not capacity reservations; final capacity serialization remains exclusively in the existing canonical Assignment command. This is sufficient to implement discovery without guessing publication, visibility, eligibility, or Application semantics.

`OCV1-02A: CONTRACT FROZEN / NOT IMPLEMENTED`
