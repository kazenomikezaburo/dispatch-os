# NOTIF-2B — Pre-confirmation Reminder Projection Foundation Result

## Status

`NOTIF-2B: COMPLETE`

The frozen NOTIF-2A contract is implemented as a local-only, narrow Notification foundation. No Admin or Worker UI was changed.

## Existing Architecture Audit

- `public.in_app_notifications` remains the recipient-owned Notification envelope with Worker-only SELECT RLS and the existing first-read command.
- Incident sources remain `source_incident_event_id`; Announcement sources remain `source_announcement_id`.
- Existing RPCs use PostgreSQL-owned `SECURITY DEFINER` functions with an empty `search_path`, schema-qualified objects, explicit authorization, and restricted execute grants.
- Pre-shift eligibility remains derived from Assignment, Shift, and `pre_shift_confirmations`; no Attention state is persisted or trusted.

## Persistence

Private tables added:

- `private.pre_confirmation_reminder_commands`
  - authenticated actor, UUID idempotency key, single/bulk mode, canonical request fingerprint, created/completed timestamps
  - unique `(actor_profile_id, idempotency_key)`
- `private.pre_confirmation_reminder_occurrences`
  - command, requested Assignment identity, server-derived recipient when applicable, controlled outcome, projected Notification reference, requested timestamp
  - unique `(command_id, assignment_id)` and unique Notification reference

Both tables have RLS enabled and no table privileges for `PUBLIC`, `anon`, `authenticated`, or `service_role`. They are outside the exposed `public` schema.

## Notification Extension

- Added controlled type `pre_confirmation_reminder`.
- Added `source_pre_confirmation_reminder_id`, referencing exactly one immutable reminder occurrence.
- The DB source-shape check now enforces exactly one valid source kind for every Incident, Announcement, or Reminder type.
- Unique `(source_pre_confirmation_reminder_id, recipient_profile_id)` prevents duplicate projection.
- Snapshot copy is server-controlled:
  - title: `勤務前確認の回答をお願いします`
  - summary: `勤務前確認が未回答です。勤務詳細から回答してください。`

Incident and Announcement source invariants remain exact.

## Commands

Public authenticated commands:

- `send_pre_confirmation_reminder(uuid, uuid)`
- `send_pre_confirmation_reminders(uuid[], uuid)`

The shared private command core:

- accepts 1–50 distinct Assignment IDs;
- normalizes, sorts, and fingerprints targets server-side;
- replays the same actor/key/fingerprint without new writes;
- returns `IDEMPOTENCY_CONFLICT` for a reused key with a different fingerprint;
- re-checks actor authorization, current eligibility, recipient linkage, and cooldown in one transaction;
- derives Worker/Profile recipients from Assignment state only;
- serializes candidate Assignment rows in normalized UUID order;
- enforces the 15-minute cooldown from the latest successfully projected occurrence;
- returns deterministic per-target outcomes;
- rolls back the entire command on unexpected database failure.

Manager scope uses the existing `private.has_assignment_branch_access` rule. Active System Admin scope remains organization-wide. Nonexistent and foreign-scope Assignment IDs converge to `unavailable`.

## Resolver

Added:

```text
resolve_pre_confirmation_reminder_source_context(notification_id)
```

The resolver accepts only a Notification ID and revalidates the active Worker Profile, recipient ownership, exact Notification type/source mapping, occurrence linkage, current Worker/Profile link, and existing Assignment ownership contract.

Success exposes only `source_available` and the Worker-owned `assignment_id`. Null, nonexistent, foreign, wrong-type, corrupt, inactive, recipient-mismatch, and relinked cases converge to the same safe unavailable shape.

## Security

- All five new functions are owned by `postgres`, are `SECURITY DEFINER`, and have `search_path = ''`.
- Every accessed object is schema-qualified.
- Private helpers are unavailable to all runtime roles.
- Public command/resolver RPCs revoke `PUBLIC`, `anon`, and `service_role`; only `authenticated` receives execute.
- No direct Notification or private reminder table writes were granted.
- Existing Worker Notification RLS remains recipient-owned.
- No client Worker, recipient, Branch, Shift, Attention, title, summary, or authorization hint is accepted.

## Verification

Dedicated local integration suite:

```text
node scripts/integration/pre-confirmation-reminder-projection-test.mjs
26/26 PASS
```

Covered first projection, replay, fingerprint conflict, cooldown, later intentional re-notify, same-key concurrency, different-key concurrency, no/inactive recipient, submitted confirmation, started Shift, Manager foreign Branch, System Admin cross-Branch, mixed bulk, max-50 boundary, forced unexpected failure rollback, own/foreign resolver, read independence, Worker RLS, grants, and private API isolation.

Existing regressions:

- Worker In-app Notification: `40/40 PASS`
- Announcement Notification Integration: `30/30 PASS`
- Pre-shift RLS: `16/16 PASS`
- Announcement wrong-type use of the Reminder resolver: safe unavailable PASS
- Incident/Announcement projection, duplicate prevention, resolver, read, and RLS behavior remained unchanged.

Static/database checks:

- `npx supabase db lint --local --schema public,private --level warning --fail-on warning`: PASS, warning/error 0
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS (Git emitted only existing line-ending conversion notices)
- Dedicated NOTIF-2B fixture residue: 0
- Local migration `20260920124830`: applied

## Files Changed

- `supabase/migrations/20260920124830_pre_confirmation_reminder_projection.sql`
- `scripts/integration/pre-confirmation-reminder-projection-test.mjs`
- `scripts/integration/in-app-notification-test.mjs`
- `scripts/integration/announcement-notification-integration-test.mjs`
- `docs/notif-2b-pre-confirmation-reminder-projection-result.md`

## Explicit Non-Changes

- Admin UI: unchanged
- Worker Inbox UI: unchanged
- Incident Notification semantics: unchanged
- Announcement Notification semantics: unchanged
- Pre-shift confirmation semantics: unchanged
- Attention persistence/completion: not added
- Auth/RLS architecture: unchanged
- Packages: unchanged
- Remote Supabase: unchanged
- Scheduled reminders, external delivery, polling, and Realtime: not added
- Commit/push: not performed
- Existing staged, unstaged, and untracked work: preserved

`NOTIF-2B: COMPLETE`
