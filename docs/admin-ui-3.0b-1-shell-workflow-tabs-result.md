# ADMIN-UI-3.0B-1 Admin Shell & Workflow Tabs Result

## Status

`ADMIN-UI-3.0B-1: BLOCKED`

`ADMIN-UI-3.0B-2: NOT READY`

The requested UI implementation and browser verification are complete. The
phase remains BLOCKED only because the mandatory repository-wide ESLint command
does not pass on pre-existing and generated files outside this phase.

## Existing Audit

- The Admin shell is shared by all `/admin/**` routes through
  `app/admin/layout.tsx`, `AdminShellFrame`, `AdminSidebar`, and `AdminHeader`.
- Sidebar collapsed state is React state initialized from the existing
  `dispatch_admin_sidebar` cookie. BUG-3.0B-0's dynamic `allowedDevOrigins`
  configuration remains unchanged.
- Canonical workflow list routes are `/admin/projects`, `/admin/shifts`,
  `/admin/placement`, `/admin/pre-shift`, and `/admin/day-of`.
- Shifts, Pre-shift, and Day-of previously contained different local
  `AdminSectionNav` sets; Projects and Placement had no equivalent common row.
- `--background` was already the canonical light-gray token and `--surface`
  the canonical white surface token.

## Admin Shell Changes

- Moved the desktop collapse control from the isolated sidebar footer into the
  product-identity header area while preserving its 44px target, state-aware
  label, `aria-pressed`, cookie, and 240px/72px behavior.
- Kept expanded navigation groups, icons, text labels, active states, and
  collapsed tooltips.
- Changed the global header's contextual left area to the consistent
  `Dispatch OS` identity. Page titles remain exclusively in main content.
- Moved the existing breadcrumb into the main content container so route
  context is retained without making it global-header content.
- Expanded the shared content ceiling from 1200px to 1440px so placement,
  day-of operations, and wide tables can use available space without imposing
  a fixed narrow column. Shared responsive padding remains intact.
- The shell continues to expose the existing light-gray canvas; cards, forms,
  tables, dialogs, and drawers retain white `bg-surface` treatment.

## Workflow Tabs

`AdminWorkflowTabs` renders five actual Next.js links. It uses `usePathname()`
only to derive the one active canonical list route; it creates no duplicated
selection state. The active link has `aria-current="page"`, heavier text,
white surface, and a visible underline, so active state is not color-only.

The component is mounted immediately after each list page's title/description
header. Dashboard, attendance, worker management, incidents, announcements,
master data, settings, Project create/detail, and Shift create/detail do not
render these list-level tabs.

## Route Mapping

| Label | Canonical route |
| --- | --- |
| 案件 | `/admin/projects` |
| シフト | `/admin/shifts` |
| 配置・休憩 | `/admin/placement` |
| 前日確認 | `/admin/pre-shift` |
| 当日運用 | `/admin/day-of` |

## Active State Rules

- Exact canonical list-route match only.
- Query strings do not affect active selection because pathname is the source.
- Detail/create routes intentionally return no workflow active route and do
  not mount the component in this phase.
- Sidebar active matching remains unchanged and continues to cover the current
  domain route.

## Accessibility

- Semantic labeled `nav` and actual links.
- One `aria-current="page"` on each workflow list route.
- 44px link targets, keyboard focus ring, Enter navigation, and horizontal
  overflow containment on narrow screens.
- Sidebar toggle remains a 44px button with state-aware accessible name and
  `aria-pressed`.
- Mobile dialog still supports Escape, focus restoration, and scroll locking.

## Local Browser QA

- All five direct routes rendered five tabs and the correct single active tab.
- Actual tab navigation and keyboard Enter navigation changed the URL.
- Dashboard and `/admin/projects/new` rendered no workflow tabs.
- Expanded/collapsed sidebar and representative Sidebar navigation passed.
- 1440x900 and 1280x900 produced no page-level horizontal overflow.
- 390x844 used the existing mobile menu; the workflow row scrolled within its
  own region without page overflow. Escape closed the menu and restored focus.
- Application errors: 0. React warnings: 0. Hydration warnings: 0.

## Network Browser QA

- Authenticated LAN origin reached all five canonical routes.
- Each route rendered five tabs, one correct active tab, the correct sidebar
  active item, and one main page title.
- Tab navigation, Sidebar hydration/toggle, back, and forward passed.
- BUG-3.0B-0 regression passed; no LAN-only client-resource block returned.
- Application errors: 0. React warnings: 0. Hydration warnings: 0.

## Tests

- `admin-shell-workflow-tabs-test.mjs`: PASS, 11 assertions.
- Covers five labels/hrefs, exact active-route derivation, Dashboard,
  non-workflow route, create route, detail route, and Worker exclusion.
- Actual Chrome QA covers render semantics, `aria-current`, keyboard navigation,
  Sidebar regression, and responsive behavior.

## Static Verification

- TypeScript (`npx tsc --noEmit`): PASS.
- Changed-scope ESLint: PASS.
- Production build with process-only Local Supabase public environment: PASS.
- `git diff --check`: PASS.
- Repository-wide `npm run lint`: FAIL outside this phase:
  - pre-existing `scripts/integration/auth-fixtures.ts` has one
    `@typescript-eslint/ban-ts-comment` error;
  - generated `supabase/.temp/start-secrets/**` has 186 lint findings.
  These files were not modified, deleted, ignored, or auto-fixed.

## Files Changed

- `app/admin/projects/page.tsx`
- `app/admin/shifts/page.tsx`
- `app/admin/placement/page.tsx`
- `app/admin/pre-shift/page.tsx`
- `app/admin/day-of/page.tsx`
- `components/admin/admin-content-container.tsx`
- `components/admin/admin-header.tsx`
- `components/admin/admin-sidebar.tsx`
- `components/admin/admin-workflow-tabs.tsx`
- `components/admin/admin-workflow-tabs-config.ts`
- `scripts/integration/admin-shell-workflow-tabs-test.mjs`
- `docs/admin-ui-3.0b-1-shell-workflow-tabs-result.md`

`next.config.ts` remains modified only by the preceding BUG-3.0B-0 phase.
Existing AUDIT-3.0A staged and untracked artifacts were preserved.

## Explicit Non-Changes

- Detail tabs unchanged
- Project editors unchanged
- Shift editors unchanged
- Worker unchanged
- DB/RLS/RPC unchanged
- Auth unchanged
- Packages unchanged
- Figma unchanged
- Remote unchanged
- Commit/push: 0

## Remaining Blocker

The repository-wide ESLint baseline must be made clean without weakening rules:
exclude Supabase CLI's generated `.temp` tree through the repository's agreed
lint policy and separately repair the pre-existing `@ts-ignore`. Both are
outside this UI phase's authorized change scope.
