# OPS-1A — Attention Foundation

## Status

`OPS-1A: COMPLETE`

OPS-1A defines Attention as a bounded, authorization-aware read model derived from existing operational sources. It does not add an Attention table, generic Todo lifecycle, acknowledgement flag, owner, due date, score, or second source of truth.

## Existing Architecture Audit

| Domain | Canonical source | Existing shared rule/read model |
| --- | --- | --- |
| Staffing | `shift_slots.required_workers` plus active `assignments` | `ACTIVE_ASSIGNMENT_STATUSES`, `getStaffingState`, `buildShiftList` |
| Placement / Break / Coverage | `shift_placement_plans`, `shift_positions`, `assignment_placement_segments`, `assignment_break_intervals`, active Assignment state | `validatePlacementDraft`, `positionCoverage`; coverage is already defined as derived and is not persisted |
| Pre-shift Confirmation | Assignment, Shift start, `pre_shift_confirmations` | `getPreShiftConfirmationState` and `getPreShiftConfirmationOpenAt` |
| Day-of arrival | Assignment state and append-only `attendance_events` | `deriveAdminAttendance`, `buildDayOfItems` |
| SOS | `operational_incidents` root lifecycle | unresolved means `open | acknowledged`; `open` is the highest Day-of attention facet |
| Attendance review | `attendance_events`, `attendance_records`, revisions, Assignment/Shift | `deriveAdminAttendance`; `confirmationState` is `unconfirmed | confirmed | corrected` |

Existing Dashboard alerts already prove the core model for staffing shortage, pre-shift missing, and start-work missing: deterministic IDs are derived from current source facts and disappear when those facts no longer match. OPS-1A generalizes that approach without making the Dashboard implementation the new domain source.

## Figma Audit

Latest Attention Center node `1056:3831` was inspected read-only.

The design establishes useful presentation intent:

- summary groups for urgent, unassigned, confirmation, and day-of work;
- a mixed queue with priority, type, issue, target, occurrence, and canonical action;
- examples for SOS, staffing shortage, pre-confirmation, delayed arrival, coverage shortage, and attendance review;
- an explicit note that source-derived items disappear when their cause is resolved.

The Figma `担当` column is not a domain contract. No common assignment/ownership source exists across the six domains, so OPS-1A does not add one. Likewise, Figma wording such as “未到着” is adapted to the existing factual `開始未報告` state; presence or location is not inferred.

## Canonical Principle

```text
Attention = current source facts + shared domain rules + request-time clock
```

An Attention item is not independently opened or closed. On each read:

1. read only authorized, bounded source rows;
2. apply the existing domain rule;
3. emit an item only while its activation predicate is true;
4. derive its deterministic identity, priority, labels, and destination;
5. discard it from the result as soon as the source predicate becomes false.

There is no Attention mutation command. Actions always navigate to and mutate the canonical source domain. A subsequent Attention read reflects the result.

## Initial Contract

```ts
type AttentionType =
  | "staffing_shortage"
  | "placement_conflict"
  | "pre_confirmation_overdue"
  | "day_of_arrival"
  | "open_sos"
  | "attendance_needs_review";

type AttentionSeverity = "critical" | "high" | "medium";

type AttentionItem = {
  id: string;                 // deterministic type + canonical source identity
  type: AttentionType;
  severity: AttentionSeverity;
  sourceKind: "shift" | "assignment" | "incident" | "placement_plan";
  sourceId: string;
  shiftId: string;
  assignmentId: string | null;
  projectId: string;
  startsAt: string;
  occurredAt: string;         // source timestamp or rule boundary, never Attention-created time
  reason: string;             // closed union per type, not arbitrary metadata
  destination: string;        // server-built canonical application route
};
```

The implementation should use a discriminated union so type-specific fields are explicit. The compact shape above records only the common envelope. Full Incident messages, internal receipt IDs, audit events, private worker data, and arbitrary JSON are not part of the queue row.

### Identity and stability

| Type | Deterministic identity |
| --- | --- |
| Staffing shortage | `staffing_shortage:{shiftId}` |
| Placement conflict | `placement_conflict:{planId}:{positionId}`; append interval boundaries only when multiple independent shortage intervals must be shown |
| Pre-confirmation overdue | `pre_confirmation_overdue:{assignmentId}` |
| Day-of arrival | `day_of_arrival:{assignmentId}`; reason may progress from start-missing to late/no-show without creating a Todo history |
| Open SOS | `open_sos:{incidentId}` |
| Attendance needs review | `attendance_needs_review:{assignmentId}` |

IDs are read-model keys, not database identifiers. They support stable React rows and keyset tie-breaking but are never accepted as authorization evidence.

## Attention Type Matrix

| Type | Source domain | Activation condition | Resolution condition | Severity / priority basis | Canonical destination/action |
| --- | --- | --- | --- | --- | --- |
| `staffing_shortage` | Shift + active Assignments | Shift is in the requested operational window, is not cancelled, and active Assignment count is below `required_workers`. `assignedWorkers = 0` is reason `unassigned`; otherwise `shortage`. Reuse `ACTIVE_ASSIGNMENT_STATUSES` and `getStaffingState`. | Active assignment count reaches requirement, requirement is reduced consistently through the Shift domain, or Shift leaves the active window/is cancelled. | `high`; `unassigned` before partial shortage, then earlier `startsAt`, larger shortage, stable Shift ID. No percentage or AI score. | `/admin/shifts/{shiftId}?tab=overview`; staffing/assignment actions stay in the Shift workflow. |
| `placement_conflict` | Placement Plan + Position + Segment + Break + active Assignment | A non-retired Position with a numeric requirement has one or more bounded time slices where derived `shortage > 0`. Reason is `coverage_shortage`. Persisted overlap/invalid-reference states should normally be impossible because the save command rejects them; editor validation errors are not global Attention rows. | Position requirement, segments, breaks, or active Assignment state changes so every slice has shortage 0; Position is retired; plan/Shift becomes out of scope. | `high` when the affected interval includes the current time for an active Shift; otherwise `medium`. Then interval start, Shift start, Position ID. | `/admin/shifts/{shiftId}?tab=placement`; edit the canonical plan. |
| `pre_confirmation_overdue` | Pre-shift Confirmation + Assignment + Shift | Active Assignment has `getPreShiftConfirmationState(...) === "pending"` and `now < startsAt`. “Overdue” means the existing submission window has opened; OPS-1A adds no SLA or reminder deadline. | A confirmation row exists; Assignment becomes inactive; or Shift reaches `startsAt`, at which point any missing start report is governed by Day-of rules instead of duplicate pre-shift Attention. | `high`; earlier Shift start, then worker/Assignment stable key. No age threshold is invented. | `/admin/shifts/{shiftId}?tab=confirmation&phase=pre&assignmentId={assignmentId}`. |
| `day_of_arrival` | Assignment + Attendance Events + Shift | Existing derived state is `start_missing` or `no_show`, or an actual start exists with `lateMinutes > 0`. Reasons are `start_missing`, `late`, `no_show`. Do not infer physical non-arrival. | `start_missing`: start event is recorded or canonical Assignment state changes. `late`: official source/correction moves actual start to `<= startsAt`. `no_show`: canonical Assignment status is corrected through its existing command. Leaving the requested historical window also removes it from that bounded queue response, not from source history. | `critical`: `no_show`, then `start_missing`; `medium`: recorded late arrival. Use existing Day-of ordering before time/ID tie-breaks. | `/admin/shifts/{shiftId}?tab=confirmation&phase=day&assignmentId={assignmentId}`; attendance detail remains available from the drawer. |
| `open_sos` | Operational Incident | Incident root is `state = open`. Acknowledged incidents remain unresolved operational history but are not `open_sos`; they continue in the Incident monitor. | Existing acknowledge command changes `open -> acknowledged`, or owner retracts `open -> retracted`. Resolution continues through the required `acknowledged -> resolved` lifecycle. | `critical`, before all non-SOS work; oldest `created_at`, then Incident ID, matching the existing unresolved Incident ordering. | `/admin/incidents?state=unresolved&incident={incidentId}`; acknowledge through the Incident command. |
| `attendance_needs_review` | Attendance Events + official Attendance Record | Assignment has a complete start/end event pair (`state = finished`) and `confirmationState = unconfirmed`. This is official-record review, not the broader operational `needsAttention` flag. Absent/no-show cannot be attendance-confirmed under the existing contract and therefore are excluded here. | `attendance_records` gains the official record through `confirm_attendance_record`. Later revisions produce `corrected`, which is history and not an open review item. | `high`; older completed Shift first, then Assignment ID. No generic approval request or Worker correction-request state is invented. | `/admin/attendance/{assignmentId}`; confirm the official Attendance record. |

## Placement Boundary

`placement_conflict` intentionally means an operational coverage conflict, not a persisted invalid plan and not optimistic-concurrency failure.

- Coverage continues to be calculated, never stored.
- The calculation must reuse the existing `positionCoverage` semantics: half-open intervals, unique active Assignments, and breaks excluding staff from coverage.
- The OPS-1B aggregator must include Shift start/end as interval boundaries in addition to Segment/Break boundaries. This makes a Position with no segments visibly short for the whole Shift. This is a shared-rule completion, not a new source of truth.
- `VERSION_CONFLICT`, overlapping draft rows, and invalid retired-position references stay editor/save errors. They are not durable Attention because a rejected draft is not canonical operational state.

## Priority and Ordering

Severity is a small presentation classification derived from factual state, not a persisted or editable field.

```text
critical: open SOS, no-show, start-missing
high: staffing unassigned/shortage, current coverage shortage,
      pending pre-confirmation, completed attendance awaiting confirmation
medium: future coverage shortage, recorded late arrival
```

Stable order:

1. severity rank;
2. type-specific operational rank defined above;
3. relevant source time (`created_at`, interval start, Shift start/end);
4. deterministic Attention ID.

There is no AI score, manual priority, snooze, pin, or user-editable ordering.

## Resolution Guarantee

The read model must not contain `resolved_at`, `completed`, `dismissed`, or `is_done`. Resolution is tested as a source transition:

```text
derive(source before) -> item present
apply existing source-domain command/fact
derive(source after)  -> item absent or a different current reason
```

Examples:

- Assigning enough active workers removes staffing shortage.
- Editing the Placement Plan so each Position slice is covered removes the placement item.
- Submitting Pre-shift Confirmation removes the pre-confirmation item.
- Recording start removes `start_missing`; a late timestamp may leave the factual `late` reason until corrected.
- Acknowledging an open SOS removes it from `open_sos` while retaining Incident history.
- Confirming an Attendance record removes attendance review; the record and revisions remain canonical history.

No background close job or reconciliation table is required because a stale Attention row is never persisted.

## Read-model Boundary for OPS-1B

The first production implementation should be a server-only composer, not a public generic SQL view and not a client-side join.

Recommended boundary:

```ts
getAdminAttention({ from, to, limit, cursor, filters }, now)
  -> { items, summary, nextCursor }
```

Requirements:

- Manager scope is limited to authorized Branch data; System Admin retains existing organization-wide authority.
- Reuse existing server-side Admin authentication and source RLS. Never accept Branch, Project, worker, or source authorization hints from the client.
- `[from, to)` is mandatory and bounded. The exact default product window belongs to OPS-1B; unbounded full-history scans are forbidden.
- Batch each source family and compose in memory for the initial bounded queue; no N+1 source or resolver calls.
- Build destinations on the server from canonical IDs. Do not persist or accept arbitrary routes.
- Cursor is based on derived sort fields plus deterministic ID. Source rows are re-evaluated on every page read, so the contract is current-state oriented rather than snapshot pagination.
- Summary counts and queue rows must come from the same authorized source window and predicates.

If OPS-1B demonstrates that bounded server composition cannot meet measured latency, a database view/materialized projection may be proposed separately. It must remain rebuildable from canonical sources, use `security_invoker` or an equally reviewed authorization boundary, and must not acquire an independent completion lifecycle.

## Security and Data Minimization

- Attention grants no new access to Shift, Worker, Incident, Placement, or Attendance data.
- The composer may emit an item only if the actor can read and operate on its canonical destination under existing authorization.
- Queue rows expose bounded display facts only. Incident full message and audit history remain in the protected Incident detail.
- Deterministic IDs are opaque UI keys, not proof that a source exists or that the actor may access it.
- No `service_role` browser use, client-side role trust, SECURITY DEFINER shortcut, or new Data API surface is proposed.

## Verification Contract for OPS-1B

Each type needs focused before/after tests using existing source mutations:

| Type | Active fixture | Source resolution | Expected rerun |
| --- | --- | --- | --- |
| Staffing | required 3, active 2 | add third active Assignment | item absent |
| Placement | required Position uncovered during one slice | add/move segment or break to restore coverage | item absent |
| Pre-confirmation | state `pending` before Shift start | create confirmation | item absent |
| Day-of start missing | now after start, no start event | record start | start-missing absent; late may remain if factual |
| Day-of no-show | canonical `no_show` | existing authorized correction/transition if permitted | item reflects current canonical state only |
| SOS | Incident `open` | acknowledge | `open_sos` absent; Incident remains acknowledged |
| Attendance review | finished events, no record | confirm record | item absent; official record remains |

Also verify Branch isolation, System Admin scope, bounded query enforcement, mixed stable ordering, no duplicates, no N+1 reads, canonical destination IDs, and zero Attention writes.

## Persistence Decision

No schema or migration is required for OPS-1A.

Persistence would be harmful at this stage because every initial item is reproducible from existing current state. A stored Attention row would create reconciliation, duplicate-prevention, stale-close, RLS, and audit semantics without adding a business fact. The only implementation gap identified is a shared, bounded Placement coverage aggregator that includes Shift bounds; it belongs in application/domain rules during OPS-1B and does not require storage.

## Explicit Non-Changes

- Existing Placement, Break, Coverage, Pre-shift, Day-of, Attendance, and Incident semantics: unchanged.
- Existing Incident lifecycle and history: unchanged.
- Existing Assignment and Attendance commands: unchanged.
- DB schema, RLS, RPCs, migrations, Auth, packages, routes, and UI: unchanged.
- No generic Todo, manual completion, owner/assignee, due date, acknowledgement, snooze, AI score, Realtime, polling, notification, or background job.
- Figma: read-only; no mutation.
- Remote environments: unchanged.
- Commit/push: not performed.

## OPS-1B Readiness

`OPS-1B Attention Center: READY`

OPS-1B can implement the bounded server composer, the missing shared Placement coverage aggregation, focused derivation tests, and the queue UI against this contract. It must not introduce persistence unless measured evidence invalidates bounded derivation and a separate security/schema phase is approved.
