# NOTIF-2A — Pre-confirmation Reminder Contract

## Status

`NOTIF-2A: COMPLETE`

This document freezes the narrow Notification contract required to send an in-app reminder for a currently eligible `pre_confirmation_overdue` Assignment. It defines behavior for a first reminder, an intentional later re-notify, transport retry/double-submit, single and bounded bulk actions, recipient derivation, authorization, safe source resolution, and abuse prevention.

No schema, migration, RPC, UI, scheduler, external delivery, or retry worker is implemented in this phase.

## 1. Domain Boundary

```text
Assignment + Shift + pre_shift_confirmation
  = canonical eligibility source

Admin reminder command
  = immutable reminder occurrence fact

In-app Notification
  = recipient-owned projection of one reminder occurrence

Attention
  = current-state derived read model only
```

The reminder occurrence records that an authorized Admin intentionally requested an in-app reminder at a specific time. It does not own or complete the underlying pre-shift task.

Reading the Notification changes only `in_app_notifications.read_at`. It does not create a pre-shift confirmation and does not remove Attention. The Attention disappears only when its existing source predicate is no longer true.

## 2. Existing Contract Preserved

- Existing types remain unchanged: `incident_acknowledged`, `incident_resolved`, `announcement_published`.
- Incident event projection and reconciliation remain unchanged.
- Announcement publication projection and immutable recipient snapshot remain unchanged.
- Announcement is not used for transactional reminders.
- Worker Notification list ordering, pagination, unread count, and mark-read semantics remain unchanged.
- Admin never directly inserts into `in_app_notifications`.
- Recipient, title, summary, Branch, route, Worker, and authorization hints are never accepted from the client.

## 3. Notification Type

The new narrow type is:

```text
pre_confirmation_reminder
```

Controlled snapshot copy:

```text
title:   勤務前確認の回答をお願いします
summary: 勤務前確認が未回答です。勤務詳細から回答してください。
```

The command owns this copy. The Admin cannot provide or edit it. Worker name, Manager identity, health data, contact data, free text, or arbitrary metadata are not copied into the Notification.

Worker Inbox label:

```text
勤務前確認
```

## 4. Canonical Source Identity

Eligibility is derived from the canonical Assignment and its current Shift/confirmation state:

```text
assignment_id
-> assignments.worker_id
-> assignments.shift_slot_id
-> shift_slots.starts_at / status
-> pre_shift_confirmations.assignment_id
```

`assignment_id` is the business-source identity. The relevant confirmation window is derived using the existing `getPreShiftConfirmationOpenAt(startsAt)` semantics: Tokyo midnight on the day before the Shift.

The client does not submit `shift_id`, `worker_id`, `recipient_profile_id`, `branch_id`, `open_at`, or `starts_at`.

An Assignment alone cannot identify multiple intentional sends. Therefore it is not the Notification projection identity.

## 5. Reminder Command and Occurrence Identity

One explicit Admin action creates one immutable command:

```text
reminder_command_id = server-generated UUID
```

For each normalized target Assignment, the command creates one immutable occurrence:

```text
reminder_occurrence_id = server-generated UUID
unique(command_id, assignment_id)
```

The Notification source is the occurrence, not Attention and not the mutable pending condition:

```text
source_pre_confirmation_reminder_id = reminder_occurrence_id
```

DB-level identity for a projected item:

```text
unique(source_pre_confirmation_reminder_id, recipient_profile_id)
```

One occurrence can therefore create at most one Notification for its server-derived recipient. A later intentional re-notify creates a new command and occurrence and may create a new Notification.

## 6. Retry Idempotency Identity

Each UI action generates one UUID `idempotency_key` and keeps it stable until that action receives a definitive response.

Command identity:

```text
unique(actor_profile_id, idempotency_key)
```

The server stores a canonical request fingerprint:

```text
mode + sorted distinct assignment IDs
```

Rules:

1. Same actor + same key + same fingerprint returns the original command and per-target results with `replayed = true`; no new occurrence or Notification is created.
2. Same actor + same key + different fingerprint returns `IDEMPOTENCY_CONFLICT`; nothing new is written.
3. A later intentional re-notify must use a fresh key. It creates a new command only if the target is still eligible and outside the cooldown.
4. Keys are scoped to the authenticated actor. A key from one Admin does not replay another Admin's command.

The server must not infer retry identity from timestamps, button labels, Attention IDs, or client-generated occurrence IDs.

## 7. Eligibility Predicate

The command re-derives eligibility inside its transaction. An Assignment is eligible only when all conditions hold at command time:

- Assignment exists and status is one of the existing active statuses: `assigned`, `confirmed`, `completed`.
- Shift is not cancelled.
- `now >= pre-confirmation open_at`.
- `now < shift.starts_at`.
- no `pre_shift_confirmations` row exists for the Assignment.
- caller is authorized for the Assignment.

The implementation must reuse the existing pre-shift confirmation time rule. It must not trust the Attention row or client selection as evidence that the predicate is still true.

If the confirmation arrives between page render and command execution, the target outcome is `not_eligible` and no Notification is created.

## 8. Server-derived Recipient

Recipient derivation is:

```text
Assignment
-> Worker
-> workers.auth_profile_id
-> active Worker Profile
```

Projection is eligible only when:

- the Assignment still belongs to that Worker;
- `workers.status = 'active'`;
- `auth_profile_id` is non-null;
- linked Profile exists and `is_active = true`;
- `profiles.account_type = 'worker'`.

Recipient identity is never accepted from the Admin client. Re-linking after an occurrence does not rewrite an existing Notification or recipient snapshot.

## 9. Authorization

Caller identity is always `auth.uid()` and must resolve to an active Profile.

### System Admin

An active `system_admin` may target any eligible Assignment in the organization.

### Manager

An active `manager` may target only Assignments for which the existing `private.has_assignment_branch_access(assignment_id)` rule returns true.

### Worker / anon / inactive actor

Not permitted.

The command accepts no Branch ID. For nonexistent and foreign-scope Assignment IDs, the result is the same safe `unavailable` outcome. It must not reveal whether a foreign Assignment exists, its Worker, Shift, Branch, recipient state, or eligibility state.

## 10. Rate and Abuse Boundary

The MVP boundary is:

- maximum 50 distinct Assignment IDs per bulk command;
- empty input, malformed UUID, or more than 50 distinct IDs is rejected before processing; repeated IDs are deduplicated;
- minimum 15 minutes between successfully projected reminder occurrences for the same Assignment;
- the cooldown is based on server time and the latest `projected` occurrence, never client time;
- the first successfully projected reminder has no cooldown prerequisite;
- replay of the same command key returns the original result and does not consume or extend the cooldown;
- concurrent distinct commands for the same Assignment are serialized by locking Assignment rows in UUID order; only one may project, and the other returns `rate_limited` after rechecking;
- no scheduled send, automatic retry, daily campaign, arbitrary repeat count, or background reminder engine is introduced.

There is no separate lifetime reminder cap in MVP. The 15-minute server-enforced cooldown and 50-target command bound are the frozen abuse controls. Changing these limits requires an explicit contract change, not a UI-only change.

## 11. Future Persistence Shape

The migration phase should use narrow private command/occurrence state rather than an Attention or generic delivery table.

Candidate logical records:

```text
private.pre_confirmation_reminder_commands
  id
  actor_profile_id
  idempotency_key
  mode: single | bulk
  request_fingerprint
  created_at
  completed_at

private.pre_confirmation_reminder_occurrences
  id
  command_id
  assignment_id
  recipient_profile_id nullable
  notification_id nullable
  outcome
  requested_at
```

Required invariants:

- unique `(actor_profile_id, idempotency_key)`;
- unique `(command_id, assignment_id)`;
- projected outcome requires recipient and Notification;
- non-projected outcome has no Notification;
- Notification type `pre_confirmation_reminder` requires only the reminder occurrence source;
- Incident and Announcement type/source invariants remain exact;
- never both, never none, never a mismatched source kind;
- private records are not exposed through the Data API and have no anon/authenticated table privileges.

The exact physical column names belong to the migration phase, but these identities and invariants are frozen.

## 12. Single Command Contract

Candidate command:

```text
send_pre_confirmation_reminder(
  p_assignment_id uuid,
  p_idempotency_key uuid
) returns jsonb
```

Success shape:

```json
{
  "ok": true,
  "command_id": "uuid",
  "replayed": false,
  "status": "complete",
  "counts": {
    "requested": 1,
    "projected": 1,
    "skipped": 0
  },
  "items": [
    {
      "assignment_id": "uuid",
      "outcome": "projected",
      "notification_id": "uuid"
    }
  ]
}
```

Stable top-level errors:

```text
INVALID_INPUT
FORBIDDEN
IDEMPOTENCY_CONFLICT
INTERNAL_ERROR
```

Nonexistent/foreign source does not use `FORBIDDEN`; it returns an `ok:true` item with `unavailable` so existence is not distinguished.

## 13. Bounded Bulk Command Contract

Candidate command:

```text
send_pre_confirmation_reminders(
  p_assignment_ids uuid[],
  p_idempotency_key uuid
) returns jsonb
```

Rules:

- 1–50 distinct Assignment IDs.
- IDs are normalized, deduplicated, sorted, and fingerprinted server-side.
- Assignments are locked in deterministic UUID order to avoid deadlocks.
- Each target is re-authorized and re-evaluated independently.
- Output items use deterministic Assignment ID order.
- Logical mixed outcomes commit together and return `status = 'partial'`.
- An unexpected database error aborts the whole transaction. It must not commit an incomplete command or only some projected Notifications.
- Retrying after an aborted transaction with the same key is safe because no command receipt committed.
- Retrying a completed command with the same key returns its original item results.

Bulk result example:

```json
{
  "ok": true,
  "command_id": "uuid",
  "replayed": false,
  "status": "partial",
  "counts": {
    "requested": 4,
    "projected": 1,
    "skipped": 3
  },
  "items": [
    { "assignment_id": "uuid-1", "outcome": "projected", "notification_id": "uuid" },
    { "assignment_id": "uuid-2", "outcome": "not_eligible", "notification_id": null },
    { "assignment_id": "uuid-3", "outcome": "no_recipient", "notification_id": null },
    { "assignment_id": "uuid-4", "outcome": "unavailable", "notification_id": null }
  ]
}
```

## 14. Per-target Outcomes

| Outcome | Meaning | Notification created | Retry with same key |
| --- | --- | --- | --- |
| `projected` | eligible, authorized, active recipient, outside cooldown | yes | original result replayed |
| `not_eligible` | authorized source no longer matches the pre-confirmation predicate | no | original result replayed |
| `no_recipient` | authorized eligible Assignment has no linked Worker Profile | no | original result replayed |
| `inactive_recipient` | linked Worker/Profile exists but is not an active Worker recipient | no | original result replayed |
| `rate_limited` | a different projected occurrence exists within the prior 15 minutes | no | original result replayed |
| `unavailable` | nonexistent or foreign-scope target; no existence disclosure | no | original result replayed |

`status` derivation:

```text
complete: every item projected
no_recipient: no item projected and every visible authorized skip is no_recipient/inactive_recipient
no_action: no item projected for any other uniform skip result
partial: projected and skipped outcomes are mixed, or multiple skip kinds are mixed
```

UI wording may group `no_recipient` and `inactive_recipient` as「通知先なし」but must not fabricate a delivery attempt.

## 15. Transaction and Concurrency Boundary

One single or bulk command is one database transaction:

```text
authenticate actor
-> normalize and fingerprint request
-> replay/conflict check
-> lock authorized candidate Assignments in deterministic order
-> re-evaluate eligibility and cooldown
-> derive recipient
-> create occurrence
-> create Notification for projected outcomes
-> finalize command result
-> commit
```

Unique command/occurrence/Notification constraints are the final duplicate defense. Application-side SELECT-before-INSERT is insufficient.

Two concurrent calls with the same key converge to one stored command result. Two concurrent calls with different keys for the same Assignment converge to one `projected` and one `rate_limited` outcome.

## 16. Worker Inbox and Safe Source Resolver

The Inbox displays the new type using the existing title, summary, created time, read/unread state, stable mixed ordering, pagination, and bell count.

Candidate resolver:

```text
resolve_pre_confirmation_reminder_source_context(
  p_notification_id uuid
) returns jsonb
```

Input is Notification ID only.

The resolver revalidates:

- current actor is an active Worker Profile;
- Notification recipient equals `auth.uid()`;
- type is exactly `pre_confirmation_reminder`;
- source mapping points to a valid reminder occurrence;
- occurrence Assignment belongs to the Worker linked to this recipient;
- the current Worker/Profile link remains active;
- the Assignment is readable through the existing Worker Assignment contract.

Success returns only:

```json
{
  "ok": true,
  "source_available": true,
  "assignment_id": "uuid"
}
```

Foreign Notification, nonexistent ID, wrong type, corrupt mapping, recipient mismatch, inactive Worker/Profile, or profile relink returns the same safe unavailable result:

```json
{
  "ok": true,
  "source_available": false,
  "assignment_id": null
}
```

The resolver does not return Worker ID, recipient ID, Branch, Shift, Manager, command ID, occurrence outcome, idempotency key, or internal receipt metadata.

Canonical route is built in Worker UI only after resolver success:

```text
/worker/assignments/{assignment_id}
```

Resolver availability is a navigation/authorization decision. It does not require the confirmation to remain pending; an answered reminder remains readable history and can still resolve to the Worker-owned Assignment while that Assignment remains safely accessible.

## 17. Read and Attention Independence

| Action | Notification | Attention |
| --- | --- | --- |
| Admin sends reminder | new unread item for projected occurrence | unchanged until source facts change |
| Worker views Inbox list | unchanged | unchanged |
| Worker opens reminder | first `read_at` set | unchanged |
| Worker opens Assignment | no separate read receipt | unchanged |
| Worker submits pre-shift confirmation | Notification history/read state retained | `pre_confirmation_overdue` absent on next read |
| Shift starts without confirmation | Notification history retained | pre-confirmation Attention absent; Day-of rules may apply |

No reminder acknowledgement, manual Attention completion, or Assignment mutation is added.

## 18. Security and Function Hardening

The migration phase must explicitly verify:

- projection commands and resolver are not executable by `PUBLIC` or `anon`;
- only `authenticated` receives execute where required;
- each SECURITY DEFINER function, if used, is owned by `postgres`, has `search_path = ''`, schema-qualifies every object, and performs explicit actor/source authorization;
- no `service_role` product path;
- no direct INSERT/UPDATE/DELETE grant on Notification or private reminder tables;
- Worker Notification RLS remains recipient-owned only;
- Manager/System Admin still cannot SELECT Worker Notification rows;
- malformed/foreign IDs do not expose source existence;
- private command and occurrence state is absent from the Data API.

## 19. Verification Matrix for the Implementation Phase

| Scenario | Expected |
| --- | --- |
| first eligible reminder | one occurrence, one unread Notification |
| same-key retry | same command/result, zero new occurrence/Notification |
| same key, different target set | `IDEMPOTENCY_CONFLICT`, zero new write |
| intentional later re-notify after 15 minutes | new occurrence and new Notification |
| intentional re-notify inside 15 minutes | `rate_limited`, zero Notification |
| concurrent same key | one command/result |
| concurrent different keys, same Assignment | one projected, one rate-limited |
| no linked Profile | `no_recipient`, zero Notification |
| inactive Worker/Profile | `inactive_recipient`, zero Notification |
| confirmation submitted before command | `not_eligible`, zero Notification |
| Shift starts before command | `not_eligible`, zero Notification |
| Manager foreign Branch | `unavailable`, zero Notification, no existence leak |
| System Admin valid cross-Branch | projected |
| bulk mixed targets | explicit `partial` with exact per-target outcomes |
| bulk unexpected SQL failure | whole transaction rollback |
| Worker opens reminder | read_at set; Attention remains |
| Worker submits confirmation | Attention removed; Notification retained |
| own resolver | available + correct Assignment ID |
| foreign/wrong type/corrupt resolver | safe unavailable |
| existing Incident/Announcement flows | unchanged |

## 20. Explicit Non-Goals

- Attention persistence, owner, completion, snooze, or dismissal
- scheduled Reminder engine
- delivery retries or provider outbox
- Push, Email, LINE, SMS
- Announcement reuse
- generic Notification composer or arbitrary message body
- client-selected recipient
- automatic polling or Realtime
- reminder analytics, acknowledgement, or mandatory response
- changes to pre-shift confirmation submission semantics

## 21. Implementation Readiness

The contract distinguishes:

- first reminder: first projected occurrence for an eligible Assignment;
- intentional later re-notify: fresh command key and new occurrence after cooldown;
- retry/double-submit: same actor/key/fingerprint replay;
- no recipient: explicit terminal per-target outcome;
- no longer eligible: server-rederived `not_eligible`;
- foreign scope: non-disclosing `unavailable`;
- partial bulk result: committed logical mixed outcomes with no technical partial transaction;
- safe Worker source resolution: own Notification to own Assignment only.

The next phase may design and implement the narrow migration, projection commands, resolver, and integration tests without inventing these behaviors.

`NOTIF-2A: COMPLETE`
