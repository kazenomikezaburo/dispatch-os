# Placement / Break Domain Design v1

> **Status: PROPOSED / NOT IMPLEMENTED**  
> **Phase:** DOMAIN-2.5B  
> This is a domain decision record. It contains no executable migration, no database change, and no UI implementation.

## 1. Executive Summary

- **Recommended domain:** a shift-scoped placement plan with shift-owned positions, assignment placement segments, and independent assignment break intervals.
- **Minimal v1:** `Position`, `Placement Segment`, `Break Interval`; coverage is derived, never a second source of truth.
- **Placement:** an existing Assignment answers *who participates in the Shift*; one or more segments answer *when and at which operational position that person is placed*.
- **Break:** a planned, independent time interval. It is not a special Position and is not attendance actuals.
- **Coverage:** calculated at read time from position requirement, effective segments, assignment status, and breaks. A shortage is an operational warning, not invalid persisted data.
- **Persistence:** a logical `Shift Placement Plan` is the edit/concurrency aggregate. A 1:1 plan root with versioning is recommended when this domain is implemented, but its storage name is deliberately not frozen here.
- **Migration implemented:** none. **DB changed:** no.

## 2. Sources and current facts

| Source | What it establishes |
| --- | --- |
| Figma Main `515:2` | Time-based staff lanes, positions, breaks, coverage/shortage and an eventual confirm/notify intent. |
| Figma Drawer `515:431` | A single staff placement edit needs position, time and operational-note inputs; it is not evidence that these facts already persist. |
| Figma Picker `517:14` | Candidate selection is an interaction intent, not authorization for arbitrary Worker-to-Shift assignment. |
| Figma Shift `496:3034`, Staff `544:2` / `544:271`, Pre-shift `523:2` | Existing Shift, Worker and day-of surfaces are neighbouring domains, not new placement SOTs. |
| `docs/admin-placement-foundation-result.md` | `/admin/placement` is currently read-only and intentionally has no position, segment, break rotation, coverage timeline or direct assignment mutation. |
| `docs/admin-final-alignment-audit-v1.md` | Placement is a Future Domain boundary; Figma cannot override existing security/domain facts. |
| migrations `001`–`011`, local read-only schema/RLS/grant inspection | Existing constraints and authorization are the primary source. |

Current database facts:

- `assignments` belongs to one `shift_slot` and one `worker`; its lifecycle is `assigned`, `confirmed`, `completed`, `cancelled_by_worker`, `cancelled_by_company`, `absent`, `no_show`. The shared active projection is `assigned | confirmed | completed`.
- Assignment creation is the accepted-application RPC path; there is no safe existing arbitrary Worker-ID direct-assignment action. Authenticated users have `SELECT`, not direct `INSERT/UPDATE/DELETE`, on `assignments`.
- `shift_slots` owns scheduled `starts_at`/`ends_at`, `required_workers` and planned `break_minutes`. Existing rows may have no placement facts.
- `attendance_records.total_break_minutes` and attendance events are actual/confirmed attendance facts. They must not be populated from planned break intervals.
- Existing tables have RLS. Assignment uniqueness already prevents duplicate active `(shift_slot_id, worker_id)` assignments, but it does not model time segments or cross-shift double booking.

## 3. Problem, goals and non-goals

The current board can truthfully show Shift required/assigned/shortage and the Shift-level planned break, but cannot say where a worker is placed, when a placement applies, when that worker is off duty, or whether a position is covered during a break.

Goals:

1. Add only the facts necessary to model planned placement and breaks safely.
2. Preserve Assignment, Application, Shift, Worker and Attendance ownership.
3. Make incomplete plans and shortages visible without fabricating facts or blocking normal in-progress work.
4. Define atomic save, branch authorization, history, and stale-edit protection before UI work.

Non-goals:

- direct assignment, applicant matching, availability, skills, worker consent/notification, multi-venue master data, route optimization, a full scheduling engine, day-of arrival/SOS, or attendance actuals;
- a `draft`/`published` workflow, a notification delivery state, or a global audit-log domain without a business SOT;
- a migration, RLS/GRANT/RPC/function/trigger, seed, API, server action or UI change.

## 4. Terminology and ownership

| Term | Responsibility |
| --- | --- |
| Assignment | Existing participation fact: this Worker is assigned to this Shift. It does not say position or effective working area. |
| Position | Shift-owned named operational target such as `受付` or `入口誘導`; it is not a hard-coded enum or a Workplace master. |
| Placement Segment | `[start, end)` assignment of one existing Assignment to one Position. Multiple segments may exist for an Assignment. |
| Break Interval | `[start, end)` planned off-duty interval for one Assignment. |
| Coverage Requirement | Position-level required count, constant across the Shift in minimal v1. |
| Coverage Result | Derived count/shortage for a Position and time interval. It is never persisted as an independent fact. |
| Shift Placement Plan | Logical aggregate containing a Shift's positions, segments, breaks and concurrency version. |

```
Branch -> Project -> Job -> Shift Slot
                              |-- Assignment -> Worker
                              |       |-- Placement Segment -> Position
                              |       `-- Break Interval
                              `-- Shift Placement Plan (logical aggregate)
```

### Assignment vs Placement vs Break

- **Assignment owns:** eligibility/participation, worker, Shift, existing lifecycle and cancellation/absence/completion.
- **Placement owns:** the planned operational position and effective work intervals inside the parent Shift.
- **Break owns:** planned off-duty intervals inside the parent Shift.
- **Coverage owns nothing:** it is a read model derived from the above facts.

## 5. Decision records

### D1 — Position ownership: Shift-owned instance

**Decision:** Position is defined per Shift. It has stable identity, display label, optional required count, display order and retirement semantics.

**Why:** the same Job can run with different layouts, required staffing and labels on different dates. A Shift instance preserves the historical meaning without coupling to a future multi-venue/location master.

| Alternative | Rejected now because |
| --- | --- |
| Job-owned Position | Good reuse, but later edits silently rewrite operational intent for historic Shift instances. |
| Workplace-master Position | Workplace sub-locations and multi-venue facts do not exist; it couples this phase to an unbuilt master. |
| Reusable template + Shift instance | Likely useful later, but needs copy/snapshot/template lifecycle. It is not minimal v1. |

**Consequences:** labels such as `会場A` remain free text labels on the Shift instance, not an enum. A future Job template may create copied Shift positions, never a live linked master reference.

Identity is required; display name alone is insufficient for segment references, order and audit. `display_order` is required for deterministic timeline rendering. A position with no historical reference may be removed in an edit batch; after use it is retired/superseded rather than deleted. A rename after use must not rewrite historical meaning: create a successor position (or a versioned label) and retain the original label in the old revision.

### D2 — Assignment supports multiple Placement Segments

**Decision:** an Assignment may have zero, one or many Placement Segments.

**Why:** a single `position_id` on Assignment cannot represent 09:00–12:00 reception, 12:00–15:00 guidance, 15:00–18:00 reception. `Assignment Position Membership` is therefore derived from segments, not a redundant permanent relation.

### D3 — Break is an independent interval

**Decision:** use an independent Break Interval, not a `BREAK` Position and not a generic segment type.

**Why:** breaks are off-duty time, do not satisfy a business position requirement, and must not pollute position coverage. The timeline can render both kinds without making their semantics identical.

`type` and `source` are not needed in minimal v1. Actor/time/revision belong to plan audit, avoiding duplication of `assignments.source`.

### D4 — Coverage is derived

**Decision:** do not persist coverage result rows.

**Why:** stored shortages become stale whenever a segment, break, requirement or Assignment status changes. Persist only inputs and calculate coverage over bounded plan data.

### D5 — Time and overlap model

**Decision:** all effective ranges use `[start_at, end_at)` with `start_at < end_at`, stored with the same `timestamptz` semantics as Shift. UI displays Asia/Tokyo.

Segments and breaks must fall entirely within their Shift's scheduled range, including overnight shifts. Gaps are valid: an Assignment can participate in a Shift yet have an unplanned position during a portion of it. Same-Assignment placement overlaps and same-Assignment break overlaps are invalid. A Break and a Placement Segment for the same Assignment may not overlap; a batch must split/remove the work segment around the break.

### D6 — Required count model

**Decision:** Shift `required_workers` remains the overall staffing commitment. Position `required_workers` is an optional operational requirement. When any position requirements are present, their sum must be **less than or equal to** Shift `required_workers`, not necessarily equal.

**Why:** partial position definition is a valid operational state: Shift required=10, positions 3+2, and five workers may be unpositioned. Equality would force fake positions. A sum above Shift required creates two contradictory commitments and must be rejected.

Position requirements are constant for the full Shift in minimal v1. Time-specific requirement segments are deferred until a real operation requires them.

### D7 — Assignment lifecycle interaction

**Decision:** child placement/break history is retained and derived as inactive when parent Assignment is cancelled, absent or no-show; it is not cascade-deleted. Completed facts remain history.

Existing lifecycle remains authoritative:

```
accepted application -> Assignment -> assigned -> confirmed -> completed
                                      |-> cancelled_by_worker / cancelled_by_company
                                      `-> absent / no_show
```

New placement data neither changes nor creates any of these transitions. Current coverage excludes non-active operational Assignment states (`cancelled_*`, `absent`, `no_show`). Cross-shift overlap for one Worker is an **Assignment Domain** future rule, not silently added by Placement.

### D8 — Concurrency aggregate and save

**Decision:** the aggregate/edit conflict scope is one Shift Placement Plan, not one child row. Save is a transactional, idempotent Shift-plan batch with an expected plan version.

**Why:** moving several staff, splitting segments and rotating breaks must validate the final graph; saving only part would create misleading coverage. Child-row locks alone cannot protect cross-row overlap rules.

**Recommended persistence direction:** a 1:1 separate logical plan root under Shift with opaque `version`/revision is preferable to relying on `shift_slots.updated_at`. It avoids unrelated Shift edits becoming placement conflicts and supplies a stable audit boundary. The storage/table name is **PROPOSED, NOT IMPLEMENTED**. If an implementation chooses Shift as the physical root, it must still expose an independent placement-version token and equivalent atomic history.

The write transaction locks the plan/Shift, compares expected version, resolves all parent rows under RLS/authorization, validates the requested final set, writes all changes, appends one revision and increments version. A mismatch returns a safe conflict; UI reloads the latest plan and lets the user reapply intended changes. Do not use advisory locks for v1.

### D9 — Audit and historical immutability

**Decision:** `updated_at` alone is insufficient. Record an append-only plan revision per successful batch: actor, time, prior/new version, changed facts and a correction reason when the Shift has started or ended.

Before Shift start, normal plan editing is allowed. During the Shift, changes are operational corrections and require the business owner to define who may make them and whether a reason is mandatory; the recommended default is manager/system-admin correction with reason. After Shift end/completion, ordinary edit is immutable; a controlled correction flow retains both old and new revision. Worker deactivation does not erase history.

### D10 — Direct assignment boundary

**Decision:** no direct assignment is introduced or implied. A Picker may select among existing eligible Assignments/accepted applications only when the corresponding Assignment-domain capability exists.

Adding direct assignment requires a separate business decision for no-application cases, `assignments.source`, worker consent, confirmation, capacity, notification and RLS/RPC controls.

## 6. Break and coverage model

`shift_slots.break_minutes` is the existing Shift-level planned break amount. It is not an interval and it is not Attendance actual break time. Minimal v1 treats it as the standard planned break target **per participating Assignment**, subject to the open business confirmation below; it must not be reinterpreted as an aggregate break budget for all staff.

For one Assignment, the sum of its Break Interval durations is compared with `break_minutes` when that value is non-null. Under/over allocation is **valid but warning-worthy** while planning; it is not a persistence error. Exact equality must not be a DB invariant because existing assignments may have no break intervals and incomplete plans are valid. A future explicit confirmation/publish workflow may require an override reason or enforce readiness rules, but that workflow does not exist today.

At time `t`, for a Position:

```
placed(t) = active Assignments with a Placement Segment for the Position containing t
            and no Break Interval containing t
shortage(t) = max(position.required_workers - placed(t), 0)
```

With the chosen no-overlap rule, breaks are normally represented by a gap between work segments; the break remains as an explicit explanation on the timeline. Coverage is calculated for intervals formed by all relevant start/end boundaries. Missing coverage, including everyone being on break, is an operational warning rather than invalid data. A Position with no requirement has no numerical coverage result.

Break order is derived by start time, then stable Assignment/Break identity for ties. Do not persist `1st/2nd/3rd` order or a replacement-worker field in v1: replacement is a coverage decision visible from the plan, not an independent fact.

## 7. Conceptual persistence model

**PROPOSED / NOT IMPLEMENTED — concept names are not final table names.**

| Entity | Key facts | Relations | Important constraints |
| --- | --- | --- | --- |
| Shift Placement Plan | Shift reference, version, current revision metadata | one per Shift | same branch scope as parent Shift; expected-version write |
| Position | stable id, label snapshot, required count nullable, display order, retired/superseded metadata | belongs to plan/Shift | label not enum; requirement non-negative; sum requirements <= Shift required |
| Placement Segment | Assignment, Position, start/end | same plan/Shift | parent equality, `[start,end)`, no same-Assignment overlap |
| Break Interval | Assignment, start/end | same plan/Shift | range valid/in Shift; no same-Assignment break overlap; no overlap with placement |
| Plan Revision | plan version, actor, changed-at, reason, immutable change payload/snapshot | append-only per batch | no mutation/deletion by ordinary operations |

Candidate database enforcement for a future approved phase:

- FK/composite scope checks must make it impossible to reference a Position from another Shift or Assignment from another plan; application validation alone is insufficient.
- `CHECK` constraints cover non-negative counts and `start < end`.
- PostgreSQL `tstzrange` + `EXCLUDE USING gist` is a strong option for same-table overlap prevention. It does not by itself protect overlap across separate segment/break entities.
- Cross-entity overlap and Shift-boundary checks need final-graph validation in the locked plan transaction unless a later unified time-block representation is deliberately adopted.
- Index plan/Shift, Assignment, Position and effective range for bounded daily plan reads. Do not introduce a materialized view before measured need.
- Prefer `RESTRICT`/history-safe removal over cascading operational history. No fake backfill: old Assignments remain valid with placement unknown.

## 8. Security and authorization

| Actor | Read | Edit |
| --- | --- | --- |
| Manager | Placement plans under existing accessible Shift branch | Own accessible branch only, subject to current Shift/edit lifecycle |
| System Admin | All branches | All branches, subject to lifecycle/correction rule |
| Worker | Future own-plan read can be designed separately; no other workers/coverage visibility by default | No Admin placement edit |
| anon/inactive | None | None |

RLS must derive scope through the persisted Shift/Assignment relationship and existing branch access; client-provided `branch_id`, `shift_id`, `assignment_id` or `position_id` never establish authorization. Do not duplicate `branch_id` just for convenience unless a later performance design proves it necessary and enforces consistency. Direct table mutation remains unavailable to normal clients; any future command must re-read current parent facts and enforce RLS plus server validation.

Threats explicitly addressed: cross-branch ID guessing, Shift-A position injected into Shift-B Assignment, hidden Worker disclosure, stale-version overwrite, direct API child-row mutation, and client-only authorization bypass.

## 9. Figma mapping

| Figma UI | Required fact | Existing | New domain | Derived | Decision |
| --- | --- | --- | --- | --- | --- |
| Main `515:2` staff lane | Assignment/Worker/Shift | Yes | Segment only when a timed position is shown | active staff | Keep current read-only counts truthful; add lanes after domain exists. |
| Main position lane | label, requirement | No | Position | coverage/shortage | Shift-owned Position. |
| Main break bar/rotation | interval | Shift break minutes only | Break Interval | ordered breaks, coverage effect | Independent planned break. |
| Main shortage | requirement + effective staffing | Shift shortage only | inputs above | Coverage Result | Warning, not stored fact. |
| Drawer `515:431` time/position | segment range and Position | No | Placement Segment | validation feedback | Batch-save final graph. |
| Drawer note/replacement | none today | No | Deferred | coverage explanation | Do not create ungoverned notes/replacement facts. |
| Picker `517:14` candidate | existing eligible Assignment | accepted application flow | Deferred direct assignment | eligibility | No arbitrary Worker mutation. |
| Shift Hub `496:3034` | Shift range/required/break | Yes | parent inputs | restrictions | Preserve current ownership. |
| Staff/Pre-shift | Worker/Assignment/actual day-of | Yes | none | future own schedule | No new profile or attendance facts. |

## 10. Valid and invalid scenarios

### Valid A — simple plan

09:00–18:00 Shift; Worker A has an existing Assignment. A Position `受付` has requirement 1. Worker A has Placement Segments 09:00–12:00 and 13:00–18:00, and Break 12:00–13:00. The break and work do not overlap; coverage is 1 then 0 then 1.

### Valid B — position change

Worker A has 09:00–12:00 `受付`, 12:00–15:00 `誘導`, 15:00–18:00 `受付`. Adjacent half-open segments do not overlap.

### Valid C — overnight shift

22:00–06:00 Shift, with a Break 02:00–02:45 the next calendar day. It is valid because both timestamps are inside the parent range.

### Invalid examples

- `end <= start`, a Break outside Shift, or a Position from another Shift: reject as integrity violation.
- Overlapping 09:00–12:00 and 11:00–13:00 segments for the same Assignment: reject.
- Overlapping breaks or a 12:00–13:00 Break with a 09:00–18:00 unsplit Segment for the same Assignment: reject.
- Position requirements totaling 11 for Shift required 10: reject.
- Requirement 3 with only 2 placed, or a 60-minute target with 40 planned: save successfully but show shortage/duration warning.

## 11. Compatibility, risks and open decisions

Compatibility:

- Existing Assignments without new rows remain valid and mean `placement unknown`.
- `/admin/placement` continues to use existing Shift required/assigned/shortage facts until an approved plan read model is introduced.
- The existing Shift Hub remains the owner of applications and Assignment creation/cancellation.
- Attendance planned/actual/revision data remains untouched; no break plan is copied into actual attendance.

Key risks and mitigations:

- **Double booking:** keep cross-shift Worker overlap as an explicit future Assignment rule; do not falsely claim it is prevented.
- **Stale overwrite/partial save:** plan version + locked transactional batch.
- **Historical mutation:** append-only revisions and post-completion correction flow.
- **Branch leakage/cross-shift injection:** parent-derived RLS and composite scope validation.
- **Fake coverage/dual SOT:** calculate from current inputs only.
- **Premature multi-venue coupling:** free-text Shift Position label until a real location master is designed.

Open business decisions (these prevent a `COMPLETE` without qualifier):

1. Confirm that `shift_slots.break_minutes` is a per-participating-worker standard target, rather than a total Shift break budget, and define permitted exception/override policy.
2. Define day-of authority: who may correct a started/ended Shift plan, whether a reason is mandatory, and whether any notification workflow becomes a separate SOT.
3. Decide whether future Worker self-service may expose planned position/break and what peer coverage information is privacy-safe.
4. Decide whether direct assignment is a business capability; it is not part of this Placement/Break design.

## 12. Migration and API preview

No migration is executed. A future approved implementation should be split:

1. **DB-2.5C1:** approved plan root/Position/Placement Segment schema, constraints, indexes, RLS/GRANT and read-only security tests.
2. **DB-2.5C2:** Break Interval, final-graph transaction, revision/audit and concurrency tests; this can remain separate if Break policy is not decided.
3. **UI-2.5D:** plan read model and editor only after commands and RLS tests pass; preserve the current board throughout.

Candidate interfaces only (not implemented): `getPlacementPlan(shiftId)`, `savePlacementPlan(planDelta, expectedVersion, idempotencyKey)`, and a bounded plan read query. The command is one Shift-plan transaction, not separate row updates. Repeated idempotency keys must return the original result rather than duplicate revision work.

## 13. Recommended minimal v1 and next phase

Implement only shift-owned Positions, Assignment Placement Segments, Break Intervals, plan revision/version and derived coverage. This enables the factual parts of the Figma timeline/editor while intentionally leaving direct assignment, notifications, multi-venue, time-varying requirements and a scheduling engine blocked.

The next phase should be **DB-2.5C1 design review/implementation approval**, first resolving open decision 1 and confirming the correction authority from open decision 2. No UI implementation should precede that approval.

## 14. Completion checklist

- Figma Main/Drawer/Picker and neighbouring Shift/Staff/Pre-shift contexts checked.
- Existing Application → Assignment flow, lifecycle, local schema, RLS/GRANT and Placement board boundary checked.
- Position ownership, identity, requirement, multi-segment, time, overlap, break, coverage, cancellation, concurrency, audit and security decisions recorded.
- No migration, DB mutation, RLS/GRANT/RPC/function/trigger/seed/Auth/UI/package/remote action performed.

**DOMAIN-2.5B: COMPLETE WITH OPEN BUSINESS DECISIONS**
