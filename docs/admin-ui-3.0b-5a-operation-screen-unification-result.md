# ADMIN-UI-3.0B-5A Unified Operation Screens Result

## Status

- `ADMIN-UI-3.0B-5A: COMPLETE`
- `ADMIN-UI-3.0B-5B: READY`

The implementation, Local and Network browser workflow, responsive checks, focused regression suites, repository lint, TypeScript, production build, and diff hygiene pass. The browser follow-up found and fixed one LAN-only Placement editor failure caused by `crypto.randomUUID()` being unavailable on an insecure HTTP origin. Full evidence is recorded in `docs/admin-qa-3.0b-5a-1-browser-verification-result.md`.

## Existing Differences

- Collection pages already shared the five-item Projects/Operations navigation, but their date controls, summaries, and content starts varied by domain.
- Shift detail had a broad Project/Shift/Placement/Pre-shift/Day-of/Attendance workflow row, while Placement, Pre-shift, and Day-of retained collection tabs even when a Shift filter was active.
- Shift identity was rendered differently in each domain, despite each authorized result already containing enough Project, Job, Workplace, and time information for a common context.
- Summary labels overlapped but were not consistently scoped to the selected Shift.

## Shared Collection Structure

The existing collection hierarchy and `AdminWorkflowTabs` are retained when no authorized Shift context is resolved. Projects remains in the collection workflow and was not modified. Domain-specific date, filter, summary, and body implementations remain intact.

## Shared Shift Context

Added `ShiftOperationContext`, a narrow Admin-only server-compatible presentation component. It renders:

- selected Shift date and start/end time;
- Project, Job, and Workplace;
- Shift status when the existing result supplies it;
- shared four-phase operation navigation;
- only the staffing metrics safely available from the current authorized result.

Shift detail uses `getShiftDetail`; Placement uses the selected authorized `PlacementShift`; Pre-shift and Day-of use only an item whose `shiftId` exactly matches `query.shift`. No first Shift or first Assignment fallback was added.

## Operation Navigation

The primary operation row is shared across:

1. Shift
2. Placement / Break
3. Pre-shift
4. Day-of

Every item is a real Link. `shiftOperationItems` derives all hrefs through the existing `shiftWorkflowHrefs` contract and preserves the actual Shift ID and Tokyo Shift-start date. Active state is derived from the server-rendered route phase and exposed with `aria-current="page"`; it is not React selection state.

The row shares height, padding, typography, underline, hover, focus-visible, border, and mobile horizontal overflow behavior. Shift internal overview/applications/assignments/confirmations navigation remains a visually secondary compact row.

## Shared Summary

The metric vocabulary is closed to `必要人数`, `配置済み`, `未配置`, `応募`, and `確認済み`.

- Shift detail: required, assigned, unassigned, applications.
- Placement: required, assigned, unassigned, applications.
- Pre-shift: assigned and confirmed, because the current result does not expose required/application counts.
- Day-of: required, assigned, unassigned, confirmed.

No value is fabricated or fetched through a new query. Domain-level collection summaries remain in their bodies.

## Shift

Shift detail now uses the shared context, four-phase operation navigation, and staffing vocabulary. Edit action and all four internal detail views are preserved. The previous duplicated overview summary was removed because the shared context supplies the same metrics.

## Placement

When an authorized selected Shift exists, the shared context replaces collection tabs and anchors the editor to that Shift. Board, positions, breaks, Assignment editor, plan/version/conflict rules, filters, pagination, and empty states are unchanged.

## Pre-shift

An exact `query.shift` match within the authorized monitor result supplies context and Shift-scoped assigned/confirmed counts. Confirmation filters, Worker rows, Assignment drawer, date controls, and safe missing-Assignment behavior are unchanged.

## Day-of

An exact `query.shift` match within the authorized operational result supplies context and Shift-scoped staffing/confirmation counts. Attendance facts, state priority, Incident context, filters, Worker rows, and drawer content are unchanged.

## Responsive

The shared operation row uses `overflow-x-auto` and `min-w-max`; each Link has a 44px minimum target. Browser verification passed at 1440x900, 1280x900, and 390x844 with page-level horizontal overflow `0`. The Placement drawer also passed at all three sizes; its mobile timeline fallback rendered at 390x844.

## Accessibility

- Semantic `nav` with label `シフト運用工程`.
- Real Links and exactly one `aria-current="page"`.
- Active state uses text weight, foreground, surface, and underline rather than color alone.
- 44px targets and focus-visible ring.
- Summary uses semantic `dl`, `dt`, and `dd` pairs.

## Local Browser QA

PASS. An authorized Shift was selected from the rendered Shift list rather than guessed. Shift, Placement, Pre-shift, Day-of, return-to-Shift, browser back/forward, reload on all four screens, desktop Sidebar persistence, mobile menu Escape/focus restoration, three viewports, and console inspection passed with the same Shift/date context.

## Network Browser QA

PASS after one focused repair. The initial LAN Placement visit reproduced `TypeError: crypto.randomUUID is not a function`; the editor used the secure-context-only convenience API. `newId` now preserves native UUID generation when available and uses `crypto.getRandomValues` to construct an RFC 4122 version-4 UUID otherwise. Shift, Placement, Pre-shift, Day-of, reload, Sidebar persistence, and console inspection then passed at the current dev-server LAN origin. No origin was added to product code.

## Tests

- Admin operation screen unification: `43/43 PASS`
- Admin shell workflow tabs: `11/11 PASS`
- Admin detail workflow tabs: `29/29 PASS`
- Admin unified editors: `33/33 PASS`
- Shift views: `33/33 PASS`
- Placement rules: `39/39 PASS`
- Placement editor rules: `13/13 PASS`
- Pre-shift monitor rules: PASS
- Day-of rules: `17/17 PASS`

Coverage includes four routes, four hrefs, exact active state, Shift/date preservation, authorized exact-match context selection, no arbitrary Assignment selection, Worker exclusion, internal Shift tabs, and mobile overflow semantics.

## Static Verification

- `npm run lint`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS after rerun with network access; the sandboxed attempt failed only while fetching existing Google Fonts
- `git diff --check`: PASS (line-ending notices only)

## Files Changed

- `app/admin/shifts/[shiftId]/page.tsx`
- `app/admin/placement/page.tsx`
- `app/admin/pre-shift/page.tsx`
- `app/admin/day-of/page.tsx`
- `components/admin/admin-detail-workflow-routes.ts`
- `components/admin/placement/placement-editor.tsx` (QA-discovered LAN UUID compatibility fix)
- `components/admin/shifts/shift-operation-context.tsx`
- `scripts/integration/admin-operation-screen-unification-test.mjs`
- `docs/admin-ui-3.0b-5a-operation-screen-unification-result.md`
- `docs/admin-qa-3.0b-5a-1-browser-verification-result.md`

All pre-existing staged, unstaged, and untracked work was preserved.

## Explicit Non-Changes

- Projects and Project create UI: unchanged
- Master Data: unchanged
- Attendance architecture: unchanged
- Worker Management, Incident, and Announcement UI: unchanged
- Worker UI: unchanged
- Placement, Pre-shift, Day-of, Shift, Assignment, and Incident domain rules: unchanged
- Database, migrations, RLS, RPC, and GRANT: unchanged
- Auth architecture: unchanged
- Packages and lockfiles: unchanged
- Figma: read-only; mutated nodes `0`
- Remote environments: unchanged
- Commit/push: not performed

## Remaining Blocker

None.
