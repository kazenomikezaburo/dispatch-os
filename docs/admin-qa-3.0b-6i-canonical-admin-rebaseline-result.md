# ADMIN-QA-3.0B-6I — Canonical Admin Rebaseline

## Status

`ADMIN-QA-3.0B-6I: COMPLETE`

`ADMIN-QA-3.0B-6I.1: COMPLETE`

`ADMIN-FIX-3.0B-6I.2: COMPLETE`

## Figma Source and Method

- Latest source audited read-only: `Pmb52CO7UgsQDA5tvoqUjF`, Admin canvas `3:4`.
- Existing mapping and human-review records were used as the route/frame baseline.
- Figma design context at the canvas root required an interactive Figma selection, so the current canvas metadata plus the stored node-specific mapping evidence were used. No Figma mutation occurred.

## Canonical Classification

| Area | Classification |
| --- | --- |
| Project | implemented / aligned |
| Shift Operations | implemented / aligned |
| Shift Detail | implemented / aligned |
| Placement | implemented / minor difference |
| Confirmation | implemented / aligned |
| Client Master | implemented / aligned |
| Attendance | implemented / aligned |
| Staff | implemented / aligned |
| Communication | implemented / minor difference |

Placement differs intentionally because canonical single-Shift placement is part of Shift Detail while the date-wide placement board remains a retained compatibility surface. Communication intentionally separates Help Requests from immutable Announcements.

## Future Figma Features

Attention Center, Action-first Home variants, Skill/Qualification Master, Client Portal, Knowledge, advanced Governance/Settings/Audit, broadcast creation, delivery history, aggregation/closing, Shift week view, and Placement staff picker are future Figma concepts. They are not scope for a QA regression fix.

## Legacy Compatibility

- Pre-shift and day-of legacy links safely redirect to canonical cross-shift routes.
- Legacy Shift create routes safely forward only explicit validated context.
- Standalone placement and Workplace master remain intentionally compatible; neither can be redirected without guessing Project or Shift context.

## Browser QA

- Local fixture recovery: PASS. The fixed System Admin ID was restored through the repository's existing local-only Admin API fixture convention, then verified through a normal anon-key password login. The service-role client was not used by the browser.
- Local and LAN normal Admin login: PASS.
- `1440×900`: Project list/detail, Shift Detail placement, confirmation-day, and Placement drawer open/Escape/focus restore: PASS with no horizontal overflow or console errors.
- `1280×900`: Attendance, Staff, Client Master, Help Request, Announcement, day-of empty state, legacy redirect, and placement query back/forward: PASS with no horizontal overflow or console errors.
- `390×844`: Client Master drawer open/Escape/focus restore and Shift Detail placement: PASS with no horizontal overflow or console errors.
- Legacy `/admin/pre-shift` and `/admin/day-of`: PASS; both canonicalize to `/admin/shifts/pre-shift` and `/admin/shifts/day-of` after the redirect settles.
- Populated `/admin/shifts/pre-shift?date=2026-09-19`: PASS. Five assignments with `pre_shift_confirmations = null` render as the normal `未確認` state; browser errors/warnings 0, server response 200, and no horizontal overflow at the affected `1280px` baseline.
- Shift Detail `?tab=confirmation&phase=pre`: PASS. The same null-confirmation assignment renders as `未確認`; browser errors/warnings 0, server response 200, and no horizontal overflow.
- Existing confirmation semantics remain covered by the focused rules regression: a confirmation object remains `確認済み`, while a missing record remains `未確認`.

## ADMIN-FIX-3.0B-6I.2

- `pre_shift_confirmations` now reflects the actual PostgREST read shape (`array | null`).
- The reader uses optional element access, so a missing embedded relation maps to the existing `confirmation: null` presentation state.
- Non-null confirmation mapping, query predicates, confirmation domain semantics, fixture data, DB schema, RLS, and RPCs are unchanged.

## Verification

- `node scripts/integration/admin-legacy-compatibility-cleanup-test.mjs` — PASS
- `node scripts/integration/admin-canonical-project-ia-test.mjs` — PASS
- `node scripts/integration/admin-canonical-shift-operations-test.mjs` — PASS
- `node scripts/integration/admin-canonical-shift-detail-placement-test.mjs` — PASS
- `node scripts/integration/admin-canonical-single-shift-confirmation-test.mjs` — PASS
- `node scripts/integration/pre-shift-monitor-test.mjs` — PASS
- focused ESLint (`get-pre-shift-monitor.ts`, Single-Shift Confirmation regression) — PASS
- `npx tsc --noEmit` — PASS
- `git diff --check` — PASS

## Product Changes

One narrow reader fix in `lib/admin/pre-shift/get-pre-shift-monitor.ts`: nullable embedded confirmation data is handled without changing confirmation behavior.

## Remaining Blocker

None. The fixture/session recovery and the null-safe Pre-shift reader closure are complete. No remote, package, DB, fixture-data, commit, or push change occurred.
