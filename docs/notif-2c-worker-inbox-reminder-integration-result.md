# NOTIF-2C — Worker Inbox Reminder Integration Result

## Status

`NOTIF-2C: COMPLETE`

`pre_confirmation_reminder` now behaves as a normal recipient-owned Worker in-app Notification and safely resolves to the Worker-owned Assignment through the NOTIF-2B resolver.

## Existing Inbox Audit

- The Inbox read model is recipient-scoped and uses stable `created_at DESC, id DESC` keyset pagination.
- The bell badge is the exact unread count across all Notification types.
- Explicit detail open uses the existing `mark_in_app_notification_read` RPC.
- Incident and Announcement sources already use separate safe resolver RPCs.
- The list does not read or trust source IDs or domain metadata.

## Implementation

- Extended the closed `WorkerNotificationType` union with `pre_confirmation_reminder`.
- Added the type label `勤務前確認`.
- Preserved the controlled NOTIF-2B title and summary as ordinary Inbox snapshot content.
- Added explicit type-specific resolver routing:
  - Incident → `resolve_in_app_notification_source_context`
  - Announcement → `resolve_announcement_notification_source_context`
  - Reminder → `resolve_pre_confirmation_reminder_source_context`
- Reminder resolver success uses the existing Assignment source kind and canonical route `/worker/assignments/{assignment_id}`.
- Resolver unavailable/error creates no Assignment URL and exposes no internal reason.
- Updated the Inbox introduction to include勤務前確認.

No source Assignment ID is read from Notification metadata or accepted from the client.

## Read and Attention Semantics

- Listing a Reminder does not mark it read.
- Explicit open uses the existing first-read contract and updates the shared bell count.
- Reading a Reminder does not create a pre-shift confirmation and does not resolve Attention.
- A later pre-shift confirmation removes the underlying pending condition normally while Notification history remains.
- The safe resolver continues to return the Worker-owned Assignment after confirmation, matching the frozen history/navigation contract.

## Browser Verification

Local Supabase-backed authenticated Worker verification:

- Reminder visible in mixed Inbox: PASS
- Label, controlled title, and summary: PASS
- Bell unread count includes Reminder: PASS (`3` before open)
- Explicit open marks Reminder read: PASS
- Bell count decrements through existing behavior: PASS (`3 → 2`)
- Resolver CTA navigates to the exact fixture Assignment: PASS
- Reminder source unavailable state has generic text and no URL: PASS
- Incident items remain visible in the same mixed list: PASS
- 390×844 Inbox document width: `390 / 390`, overflow 0
- 390×844 open detail width: `389 / 389`, overflow 0
- Browser console warning/error: 0
- Server exception/hydration/error log: 0

The ordinary desktop browser flow was also verified before the temporary 390×844 viewport override. The override was reset after verification.

## Automated Verification

- Worker Notification Inbox UI rules: `24/24 PASS`
- Pre-confirmation Reminder projection/history: `27/27 PASS`
- Worker In-app Notification regression: `40/40 PASS`
- Announcement Notification regression: `30/30 PASS`
- Changed-scope ESLint: PASS
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS (line-ending conversion notices only)
- Browser fixture residue: 0

## Files Changed

- `lib/worker/notifications/worker-notification-types.ts`
- `app/actions/worker-notifications.ts`
- `components/worker/notifications/worker-notification-inbox.tsx`
- `app/worker/notifications/page.tsx`
- `scripts/dev/setup-worker-notification-fixtures.mjs`
- `scripts/integration/worker-notification-inbox-ui-test.mjs`
- `scripts/integration/pre-confirmation-reminder-projection-test.mjs`
- `docs/notif-2c-worker-inbox-reminder-integration-result.md`

## Explicit Non-Changes

- Notification schema/RPC: unchanged
- Incident Notification behavior: unchanged
- Announcement Notification behavior: unchanged
- list ordering/pagination/unread count contract: unchanged
- pre-shift confirmation semantics: unchanged
- Attention persistence/manual completion: not added
- reminder acknowledgement/automatic confirmation: not added
- scheduled or external delivery: not added
- polling/Realtime: not added
- packages: unchanged
- remote Supabase: unchanged
- commit/push: not performed
- existing staged, unstaged, and untracked work: preserved

`NOTIF-2C: COMPLETE`
