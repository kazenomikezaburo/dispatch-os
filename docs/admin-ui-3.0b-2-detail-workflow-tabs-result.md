# ADMIN-UI-3.0B-2 Detail Workflow Tabs Result

## Status

`ADMIN-UI-3.0B-2: COMPLETE`

`ADMIN-UI-3.0B-3: READY`

## Existing Detail Architecture

Project detail and Shift detail previously rendered their overview, child collections, staffing, and operational shortcuts as one long page. Navigation within those pages was section-anchor based, so the selected detail view was not represented by the URL and all sections remained in the DOM.

The existing canonical Placement, Pre-shift, Day-of, and Attendance pages already loaded authorized rows through the current Server Component/data-access/RLS path. Placement already accepted Project and Shift filters; Pre-shift and Day-of accepted Project/Assignment context but not Shift context; Attendance accepted date and presentation filters but not Shift context.

## Data Relationship Audit

- Project owns Jobs and its detail result includes its authorized Jobs and Shift Slots.
- Job belongs to a Project and Workplace.
- Shift Slot belongs to a Job, so its authorized detail result provides the parent Project and Job without guessing identifiers.
- Assignment belongs to a Shift Slot. A Shift may have zero, one, or multiple Assignments.
- Placement, Pre-shift, Day-of, and Attendance rows already expose `shiftId`; Project-linked rows also expose `projectId` where relevant.

No relationship was inferred from client input. Context links are built only from IDs returned by the authorized Project or Shift detail query.

## Route Strategy

- Project internal views use `/admin/projects/[projectId]`, `?tab=jobs`, and `?tab=shifts`.
- Shift internal views use `/admin/shifts/[shiftId]`, `?tab=applications`, `?tab=assignments`, and `?tab=confirmations`.
- Operational destinations reuse the canonical `/admin/placement`, `/admin/pre-shift`, `/admin/day-of`, and `/admin/attendance` routes.
- Shift context uses the actual Shift start date and Shift ID in query parameters.
- Invalid or missing `tab` values safely render `overview`.

## Collection vs Detail Navigation

The five collection Workflow Tabs from ADMIN-UI-3.0B-1 remain on the collection routes. Project and Shift detail pages instead render a contextual workflow row plus a compact internal detail navigation row. Collection and detail navigation are not duplicated on the same detail page.

## Project Detail

Project detail now renders only the selected content:

- `overview`: staffing summary and Project basic information
- `jobs`: Jobs and Workplaces
- `shifts`: Project Shift list

Its contextual workflow links retain the Project ID for Project, Shift list, Placement, Pre-shift, and Day-of navigation. No Shift or Assignment is auto-selected from Project context.

## Shift Detail

Shift detail now renders only the selected content:

- `overview`: staffing summary, working time, and conditions
- `applications`: application list
- `assignments`: assigned staff list and Placement CTA
- `confirmations`: Pre-shift confirmation summary

The contextual workflow resolves the parent Project from the Shift detail result and links Placement, Pre-shift, Day-of, and Attendance with the actual Shift ID and Shift start date.

## Placement Context

Existing Placement query semantics were reused. Project links use `project`; Shift links use `date` plus `shift`. The Placement editor/data contract was not copied or changed.

## Pre-shift Context

A narrow `shift` UX query was added. It filters the already authorized, date-bounded server result and is preserved across date navigation, filters, reset, drawer close, reload, and deep links. It is not an authorization boundary.

## Day-of Context

A narrow `shift` UX query was added to the existing server-side derived monitor result. Overall date summary derivation remains unfiltered; the displayed list honors Shift context. Query state is preserved through date navigation, filters, reset, drawer close, reload, and deep links.

## Assignment Ambiguity Handling

No contextual link supplies an Assignment ID unless a user explicitly opens an Assignment row through the existing canonical list behavior. Multiple Assignments remain a Shift-filtered list and zero Assignments render the existing empty state. Browser QA verified both a populated Shift and an Assignment-zero Shift; neither generated an unrelated or implicit Assignment URL.

Attendance received the same narrow Shift UX filter so a Shift context can display zero or multiple authorized Assignment rows without selecting one.

## URL Source of Truth

Active detail content is derived from `searchParams.tab`; no React selection state or hidden panels are used. Every tab is a real `Link`, so URL transition, browser history, reload, direct entry, and deep-link behavior are native.

## Security / Scope Preservation

- Existing Server Component, data-access, GRANT, and RLS boundaries remain authoritative.
- Project/Shift query parameters only narrow already authorized results.
- Invalid Project/Shift IDs retain the existing not-found/non-disclosure behavior.
- No client-side filtering was introduced as a security boundary.
- No foreign or arbitrary Assignment is selected.
- No Worker route is generated by the Admin detail route helpers.

## Accessibility

Both navigation rows use semantic `nav`, real links, `aria-current="page"`, non-color active underlines, focus-visible outlines, and minimum 44px targets. Rows horizontally overflow safely at narrow widths and preserve keyboard link navigation.

## Local Browser QA

Chrome against `localhost:3000` verified:

- Project list and Project detail
- Project overview/jobs/shifts URL transitions
- reload and browser back/forward
- Shift overview/assignments/confirmations transitions
- Shift-to-Pre-shift context with the correct date and Shift ID
- populated Shift shows its matching rows without auto-opening an Assignment
- zero-Assignment Shift shows `配置 0`, valid operational links, and a safe Pre-shift empty state
- invalid detail tab falls back to overview
- breadcrumb appears once with the correct Project/Shift context
- application console errors: 0
- React warnings: 0
- hydration warnings: 0

## Network Browser QA

Chrome against the current LAN origin `192.168.11.64:3000` verified Shift detail direct entry, a URL-backed confirmation tab, contextual route links, Project collection Workflow Tabs, and the Sidebar collapse/expand regression. Navigation remained on the LAN origin and console/hydration errors were 0.

## Tests

- `admin-detail-workflow-tabs-test.mjs`: 29/29 assertions PASS
- `admin-shell-workflow-tabs-test.mjs`: 11/11 assertions PASS
- Pre-shift monitor rules: PASS
- Day-of rules: 17/17 PASS
- Attendance UI rules: PASS
- Admin Attendance integration: 40/40 PASS

Coverage includes Project/Shift route generation, active/default/invalid tab selection, Project and Shift context hrefs, missing Shift context, no Assignment inference, multiple Assignment retention, missing Shift filter behavior, and Worker route exclusion.

## Static Verification

- `npm run lint`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS (line-ending notices only; no whitespace errors)

## Files Changed

- `app/admin/projects/[projectId]/page.tsx`
- `app/admin/shifts/[shiftId]/page.tsx`
- `app/admin/pre-shift/page.tsx`
- `app/admin/day-of/page.tsx`
- `app/admin/attendance/page.tsx`
- `components/admin/admin-detail-workflow-nav.tsx`
- `components/admin/admin-detail-workflow-routes.ts`
- `components/admin/admin-breadcrumb.tsx`
- `components/admin/attendance/attendance-filters.tsx`
- `components/admin/projects/detail/project-detail-header.tsx`
- `lib/admin/pre-shift/pre-shift-rules.ts`
- `lib/admin/day-of/day-of-rules.ts`
- `lib/admin/day-of/get-day-of.ts`
- `lib/admin/attendance/attendance-types.ts`
- `lib/admin/attendance/attendance-query-schema.ts`
- `lib/admin/attendance/attendance-rules.ts`
- `scripts/integration/admin-detail-workflow-tabs-test.mjs`
- `scripts/integration/admin-attendance-test.ts`
- `docs/admin-ui-3.0b-2-detail-workflow-tabs-result.md`

## Explicit Non-Changes

- Project create and edit behavior: unchanged
- Shift create and edit behavior: unchanged
- Worker UI: unchanged
- Database schema, migrations, RLS, RPC, and GRANT: unchanged
- Auth architecture: unchanged
- Packages and lockfiles: unchanged
- Remote systems: unchanged
- Commit/push: 0
- Existing staged, unstaged, and untracked work: preserved
