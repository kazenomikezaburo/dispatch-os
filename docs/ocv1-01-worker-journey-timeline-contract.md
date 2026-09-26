# OCV1-01 — Worker Journey Events & Shift Timeline Contract

## Status

`OCV1-01: CONTRACT FROZEN / NOT IMPLEMENTED`

This document freezes the V1 domain contract for Worker journey facts and the read-only Shift Timeline. It does not create a migration, RPC, UI, Attention rule, scheduler, notification, or external integration.

Normative terms in this document are `MUST`, `MUST NOT`, `SHOULD`, and `MAY`. Repository evidence is authoritative over aspirational terminology in the product plan.

## 1. Existing architecture audit

### 1.1 Canonical facts that remain unchanged

| Domain | Existing canonical contract | OCV1-01 treatment |
| --- | --- | --- |
| Assignment | `assignments` owns Worker-to-Shift commitment and statuses `assigned`, `confirmed`, cancellation, absence/no-show, and completion. | Remains the authorization and journey scope root. Wake/Departure/Arrival MUST NOT be added to Assignment status. |
| Placement | Placement Plan, positions, segments, breaks, versions, and revisions are separate from Assignment. | Read-only context in Timeline. A journey action MUST NOT create or imply Placement. |
| Pre-shift confirmation | One immutable `pre_shift_confirmations` row per Assignment; current product action records workability and health. Columns for `planned_wake_at` and `planned_departure_at` exist, but the current Worker action/UI does not populate them. | Confirmation remains canonical. Planned times may become journey schedule inputs only after a later phase explicitly exposes and validates them. |
| Attendance | Current Worker RPCs, readers, UI, and tests canonically use only `start_work` and `end_work`, with server receipt time. | Remains formal work-start/work-end evidence. Arrival MUST remain distinct from `start_work`. |
| Incident / Help Request | Assignment-scoped root plus append-only versioned events; Worker create/retract and Admin acknowledge/resolve use idempotent narrow commands. | Timeline references the canonical Incident root/events. Incident does not automatically complete or cancel a journey action. |
| Notification | Recipient-owned projection with safe source resolution and first-read behavior. | Delivery/read/page-open MUST NOT record Wake, Departure, Arrival, or confirmation. |
| Attention | Derived in application code from staffing, placement, confirmation, attendance, and Incident source facts. | Future journey cues are derived consumers only. No Attention mutation is part of this contract. |
| Worker surfaces | `/worker` lists upcoming active Assignments; Assignment detail composes attendance, Help Request, confirmation, and preparation information. | Later UI should consume the Timeline/nextAction projection instead of recreating journey precedence in components. |

### 1.2 Existing contract conflict: dormant attendance vocabulary

The initial schema permits `attendance_events.event_type` values `wake_up`, `depart`, and `arrive`. However, no canonical command, current read model, normal UI, or focused behavior contract uses those values. Subsequent attendance migrations intentionally narrow Worker writes to `start_work` and `end_work`.

Therefore:

- the dormant enum values are **legacy reserved vocabulary, not completed journey facts**;
- OCV1 implementation MUST NOT begin writing them merely because the check constraint permits them;
- journey persistence MUST be additive and separate from attendance;
- a later cleanup may deprecate those unused enum values, but OCV1-01 does not rename or remove them.

### 1.3 Existing conventions to reuse

- `timestamptz` canonical storage and `Asia/Tokyo` presentation.
- Server-derived actor, Worker, Assignment, Shift, and Branch context.
- Narrow `SECURITY DEFINER` commands only where RLS-safe direct mutation is insufficient, with `search_path = ''`, schema-qualified objects, explicit `EXECUTE` grants, and internal authorization.
- Actor-scoped idempotency keys, request fingerprint comparison, row locking, stable controlled outcomes, and no raw SQL details in UI errors.
- Append-only event/revision history for corrections rather than destructive rewriting.
- Safe unavailable/not-found behavior for foreign or missing resources where existence disclosure would create IDOR risk.

Current Supabase guidance continues to require explicit RLS on exposed tables, careful review of `SECURITY DEFINER`, an empty `search_path` with fully qualified objects, and restricted function execution. No changelog item reviewed for this contract requires a different design.

## 2. Frozen event vocabulary

### 2.1 Shared identity and terminology

The canonical logical identity of a journey fact is:

```text
(assignment_id, journey_type)
```

where `journey_type` is exactly:

```text
wake | departure | arrival
```

Each type is at most one **current effective fact** per Assignment. Persistence retains an append-only version history so an authorized correction can void an erroneous fact and a later valid action can be recorded without deleting audit evidence.

The three journey facts are observations reported by the assigned Worker. They are not Assignment lifecycle states, attendance events, Notification outcomes, location proofs, or guarantees that the statement is physically true.

### 2.2 Wake

| Boundary | Frozen decision |
| --- | --- |
| Meaning | Worker explicitly reports “I am awake for this Assignment.” |
| Identity | `(assignment_id, wake)` |
| Actor | The active Worker who owns the Assignment. |
| Timestamp | `occurred_at = clock_timestamp()` recorded by the database. No client occurrence time in V1. |
| Required | Only when the Assignment has an authorized `planned_wake_at`. A missing plan makes Wake `not_required`, not overdue. |
| Open | `planned_wake_at - 6 hours`. Earlier attempts return `NOT_OPEN` and write nothing. |
| Due | `planned_wake_at`. |
| Overdue | No current Wake fact and server time is at or after `planned_wake_at + 15 minutes`. |
| Late fact | A valid Wake recorded after the due time. `timeliness = late`; it still completes Wake. |
| Close/supersede | Worker action is unavailable after the first of current Arrival, `start_work`, Shift end, Assignment terminal state, or Shift cancellation. A downstream fact does not synthesize Wake. |
| Duplicate | Same idempotency key/request replays. A different key after a current fact returns `ALREADY_RECORDED` with the canonical fact. |
| Correction | Manager/System Admin may void through a versioned correction with reason. Worker cannot erase it; Worker may raise a Help Request. |

Wake MUST NOT be inferred from login, session refresh, notification delivery/read, route visit, page open, or another action.

### 2.3 Departure

| Boundary | Frozen decision |
| --- | --- |
| Meaning | Worker explicitly reports “I have departed for the site for this Assignment.” |
| Identity | `(assignment_id, departure)` |
| Actor/timestamp | Owning active Worker; database `clock_timestamp()`. |
| Required | Only when an authorized `planned_departure_at` exists. Missing plan means `not_required`. |
| Open | `planned_departure_at - 2 hours`. Earlier attempts return `NOT_OPEN`. |
| Due | `planned_departure_at`. |
| Overdue | No current Departure fact at or after `planned_departure_at + 10 minutes`. |
| Late fact | Recorded after due; completes Departure while preserving `timeliness = late`. |
| Wake dependency | Wake is not a write prerequisite. If Wake is required but missing, Departure is accepted and Wake becomes `missing_superseded`; field operations must not be blocked by an omitted earlier tap. |
| Close/supersede | Unavailable after current Arrival, `start_work`, Shift end, terminal Assignment, or cancelled Shift. No Departure is inferred from a map/navigation action. |
| Duplicate/correction | Same model as Wake. |

### 2.4 Arrival

| Boundary | Frozen decision |
| --- | --- |
| Meaning | Worker explicitly reports physical arrival at the required meeting/work site for the Assignment. It is a Worker operational report, not GPS proof. |
| Identity | `(assignment_id, arrival)` |
| Actor/timestamp | Owning active Worker; database `clock_timestamp()`. |
| Required | Required for every active V1 Assignment unless a future explicit Shift policy disables it. V1 has no client-controlled opt-out. |
| Target | `shift_slots.meeting_at` when present; otherwise `shift_slots.starts_at`. |
| Open | Arrival target minus 3 hours. Earlier attempts return `NOT_OPEN`. |
| Due | Arrival target. |
| Timeliness | `early_or_on_time` when `occurred_at <= target`; `late` when after target. |
| Attention threshold | Missing at `target + 5 minutes` is `arrival_overdue`. The five-minute grace affects Attention only; an event after target is still late. |
| Close/supersede | Recording remains allowed until Shift end. If `start_work` already exists, Arrival CTA is suppressed as `missing_superseded_by_work`; a retroactive Worker Arrival is not accepted. |
| Duplicate/correction | Same model as Wake. |

Arrival MUST remain separate from:

- attendance `start_work`;
- Assignment state;
- Placement position/segment;
- GPS or map usage;
- a Manager marking absence/no-show.

The contract explicitly supports both `Arrival -> start_work` and `start_work` without Arrival. An Arrival does not create `start_work`; `start_work` does not backfill Arrival.

## 3. Time and window semantics

### 3.1 Canonical time

- All persisted timestamps MUST be `timestamptz` instants.
- Journey action `occurred_at`, command processing time, and correction time MUST come from database time (`clock_timestamp()` where a per-command instant is required).
- Client/browser time, timezone, and user-provided event timestamps MUST NOT be trusted or persisted as the V1 canonical occurrence time.
- Presentation uses IANA `Asia/Tokyo`; stored values are not converted into timezone-less local timestamps.
- Due/open/overdue comparisons operate on instants. Shift crossing midnight requires no special storage rule and MUST NOT be grouped by the server/browser calendar date.

### 3.2 Schedule inputs

| Action | Schedule source | When source is absent |
| --- | --- | --- |
| Pre-shift confirmation | Existing `getPreShiftConfirmationOpenAt(starts_at)` contract | Existing behavior unchanged. |
| Wake | Authorized `pre_shift_confirmations.planned_wake_at` | Not required; no Wake CTA/overdue cue. |
| Departure | Authorized `pre_shift_confirmations.planned_departure_at` | Not required; no Departure CTA/overdue cue. |
| Arrival | `shift_slots.meeting_at ?? shift_slots.starts_at` | Always available because Shift start exists. |

`planned_wake_at` and `planned_departure_at` are schedule inputs, not proof the Worker acted. OCV1-04 must decide how those fields become populated in the normal flow while preserving the existing immutable confirmation contract. It MUST NOT silently fabricate default Wake/Departure times.

### 3.3 Lifecycle gates

- Journey actions require Assignment status `assigned` or `confirmed` and a non-cancelled Shift.
- Before the action open time: action state is `not_open`; no write.
- After due time but before close: action remains recordable and is late/overdue as defined above.
- At/after Shift start:
  - Wake/Departure may be recorded only until superseded by Arrival or `start_work`; otherwise their normal Shift-end close applies.
  - Arrival remains recordable until `start_work` or Shift end.
- At/after Shift end: all journey action writes return `CLOSED`.
- Assignment `cancelled_by_worker`, `cancelled_by_company`, `absent`, `no_show`, or `completed`, and Shift `cancelled`, make all unrecorded journey actions unavailable. Existing recorded facts remain visible history.
- A later cancellation/completion never deletes or rewrites prior facts.

## 4. Persistence decision

### 4.1 Decision

OCV1-04 should add one narrow append-only table, conceptually:

```text
public.assignment_journey_event_versions
```

It records the version history of exactly three logical facts. It is not a generic Timeline/event store.

Proposed contract columns:

```text
id uuid primary key
assignment_id uuid not null references assignments(id) on delete restrict
journey_type text not null check (wake | departure | arrival)
version bigint not null check (version >= 1)
operation text not null check (recorded | voided)
occurred_at timestamptz null
actor_profile_id uuid not null references profiles(id) on delete restrict
actor_category text not null check (worker | manager | system_admin)
idempotency_key text not null
request_snapshot jsonb not null
correction_reason text null
created_at timestamptz not null default now()
```

Required invariants:

- unique `(assignment_id, journey_type, version)`;
- unique `(actor_profile_id, command_name-or-operation, idempotency_key)` either on this table or a private command receipt;
- version 1 MUST be `recorded`;
- `recorded` MUST have `occurred_at` and no correction reason;
- `voided` MUST retain the previous fact occurrence through history, have no new occurrence, and require a bounded nonblank reason;
- versions are contiguous and serialized by locking the Assignment and current journey identity;
- current state is the highest version: `recorded` means current fact exists; `voided` means no current fact;
- after `voided`, a later Worker action may create the next `recorded` version using the then-current server time and normal lifecycle/window rules;
- UPDATE and DELETE are prohibited to runtime roles; history is append-only.

An implementation MAY use a small private command-receipt table if that is needed to guarantee fingerprint-safe replays without leaking receipts through the Data API. It MUST NOT add generic payload types beyond the three frozen journey types.

### 4.2 Rejected persistence alternatives

- **Assignment statuses:** rejected because Assignment commitment/lifecycle is not a sequential journey state machine.
- **`attendance_events` dormant types:** rejected because it would overload the current attendance contract and its formal downstream consumers.
- **Generic Timeline rows/JSON event bus:** rejected because it duplicates canonical facts and weakens relational constraints.
- **Mutable timestamp columns on Assignment:** rejected because correction/audit/idempotency history would be lost.
- **Notification/read rows:** rejected because notification is a delivery projection, not operational truth.

## 5. Idempotency and correction model

### 5.1 Worker record command

Conceptual command:

```text
record_own_assignment_journey_event(
  assignment_id,
  journey_type,
  idempotency_key
)
```

Only these client inputs are accepted. Worker, Branch, actor, scheduled time, occurrence time, state, timeliness, and Assignment/Shift context are derived server-side.

The request fingerprint is `(assignment_id, journey_type)`.

| Condition | Stable outcome |
| --- | --- |
| Same actor/key/fingerprint | Replay original result; no new version. |
| Same actor/key, different fingerprint | `IDEMPOTENCY_CONFLICT`; no write. |
| Current fact exists under another key | `ALREADY_RECORDED` plus canonical safe result; no write. |
| Concurrent different keys | Assignment/type locking produces one record; loser receives `ALREADY_RECORDED`. |
| Foreign/missing Assignment | Safe `NOT_FOUND`/unavailable outcome with no existence leak. |
| Before window | `NOT_OPEN`. |
| Terminal/cancelled/superseded/after close | `CLOSED` or `SUPERSEDED` as applicable. |
| Unexpected failure | Transaction rolls back event and receipt together. |

### 5.2 Correction command

Conceptual Admin command:

```text
void_assignment_journey_event(
  assignment_id,
  journey_type,
  expected_version,
  correction_reason,
  idempotency_key
)
```

- Manager: own-Branch only; System Admin: organization-wide.
- Worker cannot correct/void history directly in V1.
- `expected_version` provides optimistic concurrency; stale requests return `VERSION_CONFLICT`.
- Correction appends `voided`; it never updates/deletes the original record.
- A voided fact reopens the Worker action only if the action remains within its lifecycle/window and is not superseded.
- Correction changes future Timeline/Attention derivation, while the audit history remains available to authorized Admins.
- No Manager command may invent a Worker journey occurrence in V1. If later business needs require Admin-assisted recording, that requires a separate explicit contract.

## 6. Shift Timeline read contract

### 6.1 Projection boundary

`Shift Timeline` is a read-only server/DB composition over canonical sources. No generic Timeline table is persisted in V1.

The reader accepts only an authorized Shift/Assignment identity plus bounded presentation context. It derives items from:

- Recruitment/Application where applicable to the requesting view;
- Assignment decision/current lifecycle;
- Placement context;
- pre-shift confirmation;
- current and corrected journey event history;
- attendance `start_work` / `end_work`;
- Incident / Help Request root and authorized lifecycle events;
- completion/cancellation state.

Worker output is scoped to own Assignment and omits Admin-only actor/correction details. Admin output is Branch/organization scoped. Missing or newly unauthorized sources become unavailable items or are omitted according to the source contract; authorization is never inherited merely from a Timeline reference.

### 6.2 Read shape

Conceptual TypeScript contract:

```ts
type ShiftTimelineItem = {
  id: string; // stable derived key: source kind + canonical source identity/version
  type:
    | "recruitment_published"
    | "application_submitted"
    | "assignment_confirmed"
    | "placement_context"
    | "pre_shift_confirmation"
    | "wake"
    | "departure"
    | "arrival"
    | "attendance_start"
    | "attendance_end"
    | "incident_created"
    | "incident_acknowledged"
    | "incident_resolved"
    | "incident_retracted"
    | "assignment_cancelled"
    | "assignment_completed";
  occurredAt: string | null;   // canonical fact/event time
  effectiveAt: string | null;  // scheduled/due/context time when relevant
  state:
    | "scheduled"
    | "not_open"
    | "actionable"
    | "overdue"
    | "completed"
    | "completed_late"
    | "missing_superseded"
    | "voided"
    | "cancelled"
    | "unavailable";
  actorCategory: "worker" | "manager" | "system" | "derived" | null;
  sourceCategory:
    | "recruitment"
    | "application"
    | "assignment"
    | "placement"
    | "confirmation"
    | "journey"
    | "attendance"
    | "incident";
  label: string;              // server-controlled presentation label/key
  actionable: boolean;
  action: null | { kind: string; href: string };
  sourceAvailable: boolean;
  navigationTarget: string | null;
};

type ShiftTimelineProjection = {
  assignmentId: string;
  shiftId: string;
  timeZone: "Asia/Tokyo";
  generatedAt: string;
  items: ShiftTimelineItem[];
  nextAction: WorkerNextAction | null;
};
```

Rules:

- `occurredAt` is used only for an actual canonical occurrence.
- `effectiveAt` carries a planned/due/context instant and MUST NOT be displayed as an occurrence.
- Items sort by `coalesce(occurredAt, effectiveAt)`, then fixed domain rank, then stable derived ID. Sorting does not change source semantics.
- `label`, action kind, and navigation target are allowlisted/derived. Arbitrary database HTML/route strings are not accepted.
- Placement item is context (“where/position/break plan”), never evidence that a Worker arrived.
- Corrected/voided journey history may be visible to Admin audit views. The normal Worker Timeline shows the current fact state plus safe correction notice, not internal actor/reason details.
- Timeline source navigation rechecks the source's own authorization, following the existing safe Notification source resolver pattern.

## 7. Deterministic `nextAction` rules

### 7.1 Shape

```ts
type WorkerNextAction = {
  kind:
    | "pre_shift_confirmation"
    | "wake"
    | "departure"
    | "arrival"
    | "start_work"
    | "end_work";
  state: "not_open" | "actionable" | "overdue";
  dueAt: string | null;
  href: string;
  label: string;
};
```

There is at most one primary `nextAction` per Assignment and at most one primary action on Worker Home after Home selects its highest-priority Assignment.

### 7.2 Eligibility and precedence

Evaluate server-side using canonical facts and `now`:

1. If Shift/Assignment is cancelled, absent, no-show, or completed: `nextAction = null`.
2. If an open/acknowledged Incident exists, it coexists with journey state and is shown as an urgent secondary status/shortcut. It does **not** replace or complete the primary next action. The Worker may still perform a safe journey action.
3. If pre-shift confirmation is pending and open: primary is `pre_shift_confirmation`.
4. If Wake is required, current fact is missing, and it is not superseded/closed: primary is Wake.
5. If Departure is required, current fact is missing, and it is not superseded/closed: primary is Departure.
6. If Arrival is missing and not superseded/closed: primary is Arrival.
7. If Arrival exists or is superseded by work, apply the existing attendance contract: `start_work` when its canonical window is open; `end_work` when working.
8. Otherwise `nextAction = null` (or a future scheduled preview outside this primary-action contract).

Additional rules:

- A non-required Wake/Departure is skipped entirely.
- An earlier missing action never blocks a valid downstream action; once downstream evidence exists it becomes `missing_superseded` and is removed from `nextAction`.
- `overdue` changes urgency/presentation, not the action identity.
- An action completed late is completed and never remains primary.
- `start_work` without Arrival suppresses the Arrival CTA but MUST NOT create an Arrival fact.
- Home ordering across multiple Assignments is: actionable/overdue before not-open; overdue severity by action rank `arrival > departure > wake > confirmation`; then earliest due time; then Shift start; then Assignment UUID. This guarantees deterministic one-card primacy.

## 8. Future Attention source rules

These are frozen derivation inputs for a later phase. They do not add Attention items now.

| Cue | Source condition | Resolution condition | Frozen severity inputs |
| --- | --- | --- | --- |
| `wake_overdue` | Wake required; no current Wake; `now >= planned_wake_at + 15m`; not terminal/cancelled; not superseded. | Current Wake recorded, downstream Arrival/`start_work` supersedes it, schedule no longer requires it, or Assignment/Shift becomes terminal. | Default `high`; elapsed overdue minutes; Shift start proximity. No client priority. |
| `departure_overdue` | Departure required; no current Departure; `now >= planned_departure_at + 10m`; not terminal/cancelled; no Arrival/`start_work`. | Departure recorded, Arrival/`start_work` supersedes it, no longer required, or terminal. | Default `high`; may become `critical` when Arrival target is reached and no Arrival/work start. |
| `arrival_overdue` | Arrival required; no current Arrival; no `start_work`; `now >= arrival_target + 5m`; active Assignment/non-cancelled Shift. | Arrival recorded, `start_work` exists, or Admin records canonical absent/no-show/cancellation/completion. | Default `critical`; elapsed minutes and existing Incident are display/context inputs, not manual completion truth. |

Attention MUST remain derived. A Manager dismiss/complete button cannot resolve a cue without changing its canonical source condition. Coverage remains staffing/placement coverage and is unrelated to these Worker journey cues.

## 9. Authorization boundary

| Actor | Read | Mutation |
| --- | --- | --- |
| Worker | Own Assignment Timeline/current journey facts; safe own history. | Record own Wake/Departure/Arrival through narrow command only. No direct table insert/update/delete; no correction. |
| Manager | Timeline/current/history for Assignments in accessible Branches. | No Worker occurrence creation. May append a void correction with expected version and reason for own Branch. |
| System Admin | Organization-wide Timeline/current/history. | Same correction capability organization-wide; no impersonated Worker occurrence. |
| anon | None. | None. |
| service role runtime | No public product path. | No normal client path; grants should remain revoked unless a separately audited internal process requires them. |

Security requirements:

- derive active Profile role from `auth.uid()` and Worker from `workers.auth_profile_id`;
- re-authorize Assignment ownership/Branch inside every privileged reader/command;
- never trust client Worker ID, Branch ID, actor, state, timeliness, event timestamp, planned time, or correction actor category;
- RLS on every exposed table and explicit grants separate from policies;
- `SECURITY DEFINER` commands revoke `PUBLIC`, `anon`, and unneeded roles, set `search_path = ''`, and fully qualify objects;
- foreign and missing Assignment behavior must not reveal existence;
- Timeline references never grant source access.

## 10. Required scenario matrix

| Scenario | Frozen result |
| --- | --- |
| Normal confirmation → Wake → Departure → Arrival | Each canonical source/fact is independently recorded; Timeline orders them; nextAction advances one step at a time. |
| Wake early but inside open window | Accepted, `timeliness = early_or_on_time`. |
| Wake before open | `NOT_OPEN`, no write; scheduled preview may remain. |
| Wake overdue | Wake remains actionable until superseded/closed; future `wake_overdue` cue exists; late record completes it. |
| Departure overdue | Departure remains actionable until Arrival/work/close; future cue exists; late record completes it. |
| Arrival early but inside open window | Accepted and completed as `early_or_on_time`. |
| Arrival before open | `NOT_OPEN`, no write. |
| Arrival late | Accepted until close; `completed_late`; overdue cue resolves. |
| Arrival before `start_work` | Both facts remain distinct Timeline items. Arrival does not start attendance. |
| Arrival but no `start_work` | Arrival is complete; existing attendance start remains independently actionable/overdue according to attendance rules. |
| `start_work` without Arrival | No Arrival is synthesized. Arrival becomes `missing_superseded_by_work`; CTA and arrival-overdue cue resolve, while audit/readiness may retain the missing fact. |
| Duplicate button/action | Same key replays; different key returns `ALREADY_RECORDED`; one current fact. |
| Network retry after unknown response | Client retains and resends the same idempotency key; original result replays. |
| Concurrent requests | Locking produces one version; no double fact. |
| Shift crosses midnight | Instant-based windows remain correct; presentation is Asia/Tokyo; no server-date grouping. |
| Action after Shift start | Allowed only under the lifecycle/supersession gates in section 3.3; recorded as late where applicable. |
| Cancelled Shift/Assignment | New action rejected as `CLOSED`; prior facts remain Timeline history; nextAction null. |
| Completed Assignment | New action rejected; nextAction null; completion item remains. |
| Incident while journey action pending | Incident is an urgent coexisting status/Timeline item; journey action remains primary unless unsafe/terminal source state changes. |
| Incorrect event recorded | Authorized Admin appends `voided` with reason/expected version. Original remains audit history; Worker may re-record only if still eligible. |
| Missing planned Wake/Departure | Action is `not_required`; no overdue cue; no fabricated schedule. |
| Missing required event | Timeline shows scheduled/actionable/overdue or missing-superseded from source conditions; no placeholder fact is persisted. |
| Worker foreign Assignment | Safe not-found/unavailable result; no write and no existence disclosure. |
| Manager foreign Branch | Read/correction denied or safe unavailable; no event/history disclosure. |
| Notification read/page open | No journey mutation; nextAction unchanged. |
| Map/navigation opened | No Departure/Arrival mutation. |

## 11. Explicit non-changes

- No migration, table, index, RPC, RLS policy, grant, trigger, or seed change.
- No product code, UI, route, Server Action, package, Auth, local/remote Supabase, or service change.
- No change to Assignment/Application/Placement/Candidate/Coverage contracts.
- No rename or repurpose of attendance `start_work`/`end_work`.
- No use of dormant `attendance_events` journey-like enum values.
- No change to immutable pre-shift confirmation behavior.
- No Attention implementation or manual Attention completion truth.
- No LINE, scheduler, Notification delivery, realtime, GPS/location proof, automatic Incident, or AI.
- No generic persisted Timeline or Assignment mega-state machine.
- No payroll/formal attendance system-of-record claim.

## 12. Implementation implications

### OCV1-02 — Recruitment discovery and pre-assignment detail

- OCV1-02 should not implement journey persistence.
- Recruitment/Application Timeline items are only included where an authorized canonical source exists; pre-assignment views have no Assignment-scoped Wake/Departure/Arrival.
- Shift detail should expose `meeting_at` and preparation context because `meeting_at ?? starts_at` becomes the later Arrival target.
- Avoid introducing a second Shift detail vocabulary that conflicts with the eventual Assignment Timeline.

### OCV1-04 — Journey persistence and Timeline reader

OCV1-04 should:

1. re-audit the then-current migration chain and Supabase changelog;
2. create an incremental local migration only, using the approved migration workflow;
3. implement the narrow append-only version model and indexes, not a generic event JSON table;
4. implement Worker record and Admin void-correction commands with server time, locks, idempotency fingerprints, safe outcomes, and explicit grants;
5. add RLS/read boundaries for Worker own, Manager own-Branch, System Admin organization, anon none;
6. expose a bounded Timeline/nextAction reader that composes canonical sources without N+1 reads or persisting duplicate Timeline rows;
7. decide and implement the normal authorized population path for `planned_wake_at`/`planned_departure_at`; missing values must remain `not_required` until that path exists;
8. preserve existing Attendance, Assignment, Placement, Notification, Incident, and pre-shift tests unchanged, then add focused journey/idempotency/concurrency/correction/IDOR/scenario tests;
9. leave Admin Attention/UI/LINE/scheduler work to their named later phases.

## 13. Freeze summary

The implementable V1 boundary is:

```text
canonical source facts
  Assignment + Placement context
  Pre-shift Confirmation
  Wake / Departure / Arrival (new narrow append-only version history)
  Attendance start/end
  Incident / Help Request
  Completion/cancellation
        ↓
read-only Shift Timeline + deterministic nextAction
        ↓
future Worker UI / Admin Day-of / derived Attention / Notification consumers
```

Wake, Departure, and Arrival are explicit Worker operational reports with server timestamps. Arrival is not attendance start. Timeline is not a mutable source of truth. Notifications do not complete actions. Assignment and Placement remain separate. These boundaries are sufficient for OCV1-04 to implement the journey facts and projection without reinterpreting the completed canonical contracts.

`OCV1-01: CONTRACT FROZEN / NOT IMPLEMENTED`
