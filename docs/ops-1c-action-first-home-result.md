# OPS-1C — Action-first Admin Home Result

## Status

`OPS-1C: COMPLETE`

Admin Home now presents the canonical Attention queue first, followed by an operational summary and today's existing Shift/workplace overview. Home does not define or persist a second Attention model.

## Figma Alignment

Figma Action-first Home node `809:3358` was inspected read-only. The implemented structure follows its useful production intent:

1. `対応が必要`: total count, top four priority items, and `すべて確認`.
2. `今日のサマリー`: active workers, normal operation, all Attention, and open SOS.
3. `今日の現場`: existing staffing/progress overview and the Shift operations link.

Figma examples that are not part of the OPS-1A contract were not invented. Current canonical terminology and destination routes take precedence.

## Attention Reuse

- Home and `/admin/attention` call the same `getAdminAttention(now)` composer.
- Both use the same `AttentionSummary.total` and `AttentionSummary.urgent` values.
- Home displays `items.slice(0, 4)` without sorting, filtering, or reclassifying the result.
- Row keys, labels, titles, descriptions, and canonical destinations come directly from `AttentionItem`.
- The legacy Home-specific alert list is no longer rendered by `/admin`.
- No new staffing, placement, confirmation, Day-of, SOS, or attendance predicate was added to Home.

## Operational Summary

- Existing same-day Shift reads continue to supply active-worker and workplace staffing/progress information.
- Attention count and SOS count are supplied exclusively by the OPS-1B composer.
- Existing today's-workplace empty state is preserved.
- `現場一覧を見る` opens canonical Shift Operations.

## Loading, Empty, and Error Behavior

- Existing route loading state remains active while the server reads current operational data.
- An empty canonical Attention result renders `現在、対応が必要な項目はありません` while preserving the Attention Center link.
- Attention and today's-operation failures render separate generic error states, so one failed source does not expose internal errors or misrepresent the other source as empty.

## Browser Verification

Normal authenticated local System Admin verification used real derived data.

- Home Attention total: 7.
- Attention Center total: 7.
- Home top four: identical order to the first four Attention Center items.
- `すべて確認`: `/admin/attention` PASS.
- First canonical action: exact Shift Confirmation `phase=day` and Assignment context PASS.
- 1440x900: four Attention rows, four summary cards, horizontal overflow 0.
- 1280x900: four Attention rows, four summary cards, horizontal overflow 0.
- 390x844: stacked Attention rows and summary cards, horizontal overflow 0.
- Browser console errors/warnings: 0.
- Server exceptions during Home, Attention Center, and canonical action reads: 0.

## Focused Verification

- `admin-action-first-home-test.mjs`: PASS, 13 assertions.
- `admin-attention-center-test.mjs`: PASS, 16 assertions.
- Pre-shift shared rule regression: PASS, 20/20.
- Admin shell workflow tabs: PASS, 11 assertions.
- Changed-scope ESLint: PASS.
- `npx tsc --noEmit`: PASS.
- `git diff --check`: PASS.

## Files Changed

- `app/admin/page.tsx`
- `components/admin/dashboard/dashboard-attention-list.tsx`
- `components/admin/dashboard/dashboard-summary.tsx`
- `components/admin/dashboard/dashboard-summary-card.tsx`
- `components/admin/dashboard/dashboard-workplace-list.tsx`
- `scripts/integration/admin-action-first-home-test.mjs`
- `docs/ops-1c-action-first-home-result.md`

OPS-1B files already present in the working tree remain the canonical Attention implementation and were reused rather than copied.

## Explicit Non-Changes

- No new Attention rule, table, persistence, owner, manual completion, priority override, polling, Realtime, or AI scoring.
- Existing Shift, Placement, Pre-shift, Day-of, Attendance, and Incident semantics are unchanged.
- No DB schema, migration, RLS, RPC, Auth architecture, package, remote, commit, or push change.
- Existing staged, unstaged, and untracked work was preserved.

## Readiness

Admin Home is now a reliable action-first summary of the same current operational state rendered by the Attention Center.

`OPS-1C: COMPLETE`
