# OPS-1B — Attention Center Result

## Status

`OPS-1B: COMPLETE`

The Admin Attention Center now renders a bounded, mixed queue derived at read time from the existing Placement, Pre-shift, Day-of, Attendance, and Incident sources. No Attention row, completion state, owner, priority, job, or secondary source of truth was added.

## Implemented Foundation

- Added `/admin/attention` and the implemented Admin navigation entry `要対応`.
- Added a server-only composer guarded by `requireAdmin()` and backed by the normal RLS-aware Supabase client.
- The read window is Tokyo today through eight days, source reads are batched, and the returned queue is capped at 100 items.
- Added a discriminated Attention item union, deterministic IDs, derived severity, stable sorting, summary counts, and server-built canonical destinations.
- Extended the existing placement coverage rule with explicit Shift bounds and exposed a shared coverage-shortage aggregation. Coverage remains derived and is not persisted.

## Attention Types

| Type | Activation | Automatic resolution | Canonical action |
| --- | --- | --- | --- |
| `staffing_shortage` | required workers exceed active assignments | staffing reaches requirement | Shift overview |
| `placement_conflict` | active placement position has uncovered intervals | coverage fills every interval | Shift placement |
| `pre_confirmation_overdue` | confirmation window is open, Shift has not started, confirmation is pending | confirmation exists or Shift starts | pre-shift confirmation |
| `day_of_arrival` | start report is missing, no-show is active, or the official actual start is late | source state changes or the attendance actual start is corrected to the planned start | day-of Shift confirmation |
| `open_sos` | incident is open | incident is acknowledged or retracted; later resolution remains in Incident operations | Incident operations |
| `attendance_needs_review` | finished attendance remains unconfirmed | record becomes confirmed/corrected | Attendance detail |

Every item is recalculated from source facts. Resolving the source predicate removes the item on the next read; there is no manual Attention completion.

## Identity and Ordering

- IDs are stable combinations of type and canonical source identity, such as Assignment, Shift, Incident, or placement-plan/position IDs.
- Ordering is deterministic: severity, type rank, source occurrence time, then deterministic ID.
- Summary values are derived from the full bounded result; presentation does not persist counters.

## Scope and Security

- Recipient/branch scope is inherited from existing RLS policies and the authenticated Admin profile.
- The composer does not use `service_role`, direct writes, RPC mutations, or client-supplied role/branch claims.
- Links contain only the canonical source context already used by the target Admin surfaces.
- Local fixture recovery used the repository's existing local-only setup. Browser authentication used the ordinary anon-key password flow. Remote Supabase was not read or mutated during the QA server run.

## UI

- Summary cards cover urgent SOS, placement/staffing, confirmation/attendance, and day-of attention.
- Desktop uses the Figma-aligned mixed table; mobile uses readable stacked cards.
- Loading, read-error, and derived empty states are explicit.
- Action links remain at least 44px high and preserve visible severity/type labels without relying on color alone.

## Browser Verification

Authenticated local System Admin verification used real derived rows.

- `/admin/attention`: PASS; summary and seven mixed current items rendered.
- Canonical action: PASS; a Day-of item opened the exact Shift Confirmation URL with `phase=day` and the Assignment context, and showed the correct staff detail.
- Back/forward and query state: PASS.
- 1440x900: PASS; desktop table, four summary cards, page horizontal overflow 0.
- 1280x900: PASS; desktop table, four summary cards, page horizontal overflow 0.
- 390x844: PASS; mobile cards, mobile Admin shell, page horizontal overflow 0.
- Browser console errors/warnings after authenticated load: 0.
- Server exceptions during authenticated Attention and canonical-action reads: 0.
- Empty state: covered by the pure composer test with all source conditions resolved.

## Verification

- `node scripts/integration/admin-attention-center-test.mjs`: PASS, 16 assertions.
- placement editor rules: PASS, 13/13.
- placement rules: PASS, 39/39.
- pre-shift Admin integration: PASS, 20/20.
- Day-of rules: PASS, 17/17.
- attendance UI rules: PASS.
- Admin Incident UI rules: PASS, 19/19.
- Admin shell workflow tabs: PASS, 11 assertions.
- changed-scope ESLint: PASS.
- `npx tsc --noEmit`: PASS.
- `git diff --check`: PASS.

## Files Changed

- `app/admin/attention/page.tsx`
- `app/admin/attention/loading.tsx`
- `app/admin/attention/error.tsx`
- `components/admin/attention/attention-summary.tsx`
- `components/admin/attention/attention-queue.tsx`
- `components/admin/admin-nav.ts`
- `lib/admin/attention/attention-types.ts`
- `lib/admin/attention/attention-rules.ts`
- `lib/admin/attention/get-admin-attention.ts`
- `lib/admin/placement/placement-editor-rules.ts`
- `scripts/integration/admin-attention-center-test.mjs`
- `docs/ops-1b-attention-center-result.md`

## Explicit Non-Changes

- No Attention persistence, owner, manual completion, priority override, reconciliation job, polling, or AI scoring.
- No database schema, migration, RLS, RPC, Auth architecture, package, or existing domain semantic change.
- No remote mutation, commit, or push.
- Existing staged, unstaged, and untracked work was preserved.

## Readiness

The derived summary and mixed queue are ready to feed `OPS-1C Action-first Home` without introducing a second operational source of truth.

`OPS-1B: COMPLETE`
