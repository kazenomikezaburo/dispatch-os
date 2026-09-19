# ADMIN-UI-3.0B-5B Project Management Hub Result

## Status

- `ADMIN-UI-3.0B-5B: COMPLETE`
- `ADMIN-UI-3.0B-5C: READY`

The Project List and Project Detail implementation is complete. Focused/static checks and authenticated Local/LAN browser QA pass. The existing Local Manager fixture was minimally recovered in `ADMIN-QA-3.0B-5B.1`; Auth architecture and business fixture data remain unchanged.

## Existing Project UI

The Project list already had a header, collection workflow tabs, three derived KPI cards, filters, responsive Project rows, semantic status badges, and distinct empty/filtered states. Project Detail already used URL-backed overview/jobs/shifts views, but a five-item Project/Shift/Placement/Pre-shift/Day-of row appeared above the internal tabs, giving Project the same visual hierarchy as a single-Shift operation screen. The header also promoted Shift creation alongside Project editing.

## Project vs Operation Hierarchy

- Project is now the management hub for Client, period, Jobs, Workplaces, and child Shifts.
- The Project's primary internal navigation is Overview, Jobs/Workplaces, and Shifts.
- Shift, Placement, Pre-shift, and Day-of remain the operation flow only after a user selects a concrete Shift.
- Project-level operation links are secondary shortcuts and only apply the existing Project filter. They never select a Shift or Assignment.

## Project List

The list remains a management collection rather than a real-time monitor. The header description now states its portfolio purpose. Existing production data supplies the three KPI cards: in-progress Projects, Projects with staffing shortage, and Projects starting this Tokyo calendar week. Explanatory text was added without adding a query or metric. Search, status/period filters, semantic Project badges, row hierarchy, progress, empty state, and the existing create route are preserved.

## Project Detail Header

The header retains Project name, semantic status, Client, period, breadcrumb, and `?edit=1`. Project editing is now the sole primary header action. Shift creation remains available contextually from a Job, preserving the existing creation flow without competing with Project management at the header level. A branch name was not fabricated because the authorized detail result exposes only its internal ID.

## Project Internal Navigation

Overview, Jobs/Workplaces, and Shifts are the single primary navigation row. Each item is a real Link backed by the existing canonical URLs. `aria-current="page"`, underline, typography, focus treatment, 44px targets, and contained narrow-screen overflow reuse `AdminDetailWorkflowNav`.

## Overview

Overview is summary-only. It renders the existing Project staffing KPI summary plus one basic-information card containing Client, period, Job/Workplace count, Shift count, and description. Full Job and Shift collections are not duplicated.

## Jobs / Workplaces

The selected Jobs/Workplaces view retains one Job per grouped item with its associated Workplace, address, status, shift count, staffing summary, compensation metadata, Job edit behavior, and contextual Shift creation. The existing Job creation behavior is unchanged.

## Shifts

The selected Shifts view retains the Project's chronological child Shift collection with date/time, Job, Workplace, status, required/assigned/shortage values, and canonical `/admin/shifts/[shiftId]` links. No Shift is auto-selected.

## Operation Shortcuts

Overview contains a secondary Related Operation Screens section for Project-filtered Shift list, Placement, Pre-shift, and Day-of destinations. Hrefs reuse `projectWorkflowHrefs`; none contains a Shift ID or Assignment ID. The helper and B2 Project context contract remain intact.

## Responsive

The implementation uses the existing responsive grids, wrapped header actions, contained tab overflow, 44px targets, and cards that collapse to one column. Authenticated verification passed at 1440x900, 1280x900, and 390x844 with no page-level horizontal overflow.

## Accessibility

- Semantic headings, sections, navigation landmarks, lists, and description lists are retained.
- Primary names and dates remain real Links.
- Active internal navigation uses `aria-current="page"` and non-color underline/font treatment.
- Actions and navigation retain at least 44px targets and focus-visible rings.
- Project status continues to use the shared semantic `AdminStatusBadge` primitive.

## Local Browser QA

PASS. Project List -> Overview -> Jobs -> Shifts -> Shift Detail -> Placement, browser Back/Forward, and Overview/Jobs/Shifts reload all retained the intended canonical context. Console, React, and hydration warnings were `0`.

## Network Browser QA

PASS. The current runtime LAN origin was used for Manager login, Project List/Detail/tabs, reload, and Sidebar collapse persistence. No LAN origin was hardcoded.

## Tests

- Project management hub consistency: `31/31 PASS`
- Admin detail workflow tabs: `29/29 PASS`
- Admin operation screen unification: `43/43 PASS`
- Admin shell workflow tabs: `11/11 PASS`
- Admin unified editors: `33/33 PASS`
- Admin visual consistency: `35/35 PASS`

Coverage includes list composition, canonical URL-backed tabs, selected-content branches, Project edit preservation, secondary operation shortcuts, no implicit Shift/Assignment selection, canonical Shift detail links, and Worker exclusion.

## Static Verification

- `npm run lint`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS (line-ending notices only)

## Files Changed

- `app/admin/projects/[projectId]/page.tsx`
- `components/admin/projects/detail/project-detail-header.tsx`
- `components/admin/projects/detail/project-overview.tsx`
- `components/admin/projects/detail/project-operation-shortcuts.tsx`
- `components/admin/projects/project-page-header.tsx`
- `components/admin/projects/project-summary.tsx`
- `scripts/integration/admin-project-management-hub-test.mjs`
- `docs/admin-ui-3.0b-5b-project-management-hub-result.md`
- `docs/admin-qa-3.0b-5b-1-project-browser-verification-result.md`

All pre-existing staged, unstaged, and untracked work was preserved.

## Explicit Non-Changes

- Project Create: unchanged
- Project Edit behavior and update contract: unchanged
- Job Create/Edit behavior: unchanged
- Shift Create/Edit and operation screens: unchanged
- Master and Communication: unchanged
- Worker: unchanged
- Database, migrations, RLS, RPC, and GRANT: unchanged
- Auth architecture: unchanged; only the existing Local Manager fixture password was restored to the canonical local test value during QA
- Packages and lockfiles: unchanged
- Figma: read-only; nodes changed `0`
- Remote environments: unchanged
- Commit/push: not performed

## Remaining Blocker

None.
