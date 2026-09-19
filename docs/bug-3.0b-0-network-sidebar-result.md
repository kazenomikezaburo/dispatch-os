# BUG-3.0B-0 Network Sidebar Result

## Status

COMPLETE

`BUG-3.0B-0: COMPLETE`

`ADMIN-UI-3.0B-1: READY`

## Reproduction

Local (`http://localhost:3000/admin`) rendered and hydrated the Admin shell. The
sidebar toggle changed `data-sidebar-state`, the desktop sidebar width, and the
content inset as expected.

Network (`http://192.168.11.64:3000/admin`) initially rendered the same enabled
toggle and expanded sidebar from server HTML, but clicking it did not change
`aria-pressed`, `data-sidebar-state`, sidebar width, or the content inset.
Next.js simultaneously reported that cross-origin requests for development
resources from `192.168.11.64` were blocked. This separated the failure from a
transition-only defect: the client event handler had not hydrated.

Both origins were tested in Chrome with the same Local Manager fixture and the
same dev server. Final side-by-side verification used the same Chrome session
and display conditions.

## Root Cause

Next.js 16.3.1 development-origin protection blocked LAN-origin requests for
development resources, including client chunks and HMR resources. The server
HTML therefore displayed the Admin sidebar on the network origin, but
`AdminShellFrame` did not hydrate and its React toggle handler was not attached.

The sidebar state implementation itself was origin-independent. It uses React
state plus a path-scoped cookie and has no `localStorage`, `sessionStorage`,
hostname/origin branch, random value, secure-context API, or media-query-based
desktop/mobile selection in the toggle path.

## Evidence

- Local before fix: the enabled toggle changed the shell from expanded to
  collapsed (`240px` to `72px`) and updated `aria-pressed`.
- Network before fix: the button remained enabled but the click left
  `aria-pressed`, shell state, sidebar width, and content inset unchanged.
- Next.js terminal before fix: requests from `192.168.11.64` to development
  client resources were explicitly blocked and identified `allowedDevOrigins`
  as the supported configuration.
- DOM/pointer inspection found no covering overlay, disabled state, or
  origin-specific responsive branch.
- Runtime-origin inspection confirmed the expected hostname/origin separation;
  no secure-context, crypto, storage, or hostname API is used by the sidebar
  interaction path.
- After fix: both origins hydrated, toggled repeatedly, retained the cookie-backed
  state across reload, and produced no application, React, or hydration warning.

## Fix

`next.config.ts` now derives `allowedDevOrigins` from the current machine's
active, non-internal IPv4 network interfaces.

No current LAN address is hardcoded, and no product component branches on a
hostname. The change is limited to Next.js development-resource origin handling;
production Admin UI rendering and behavior are unchanged.

## Why This Fix

`allowedDevOrigins` is the framework-supported narrow control for this observed
development-only block. Deriving entries from active local interfaces makes the
configuration portable across DHCP/IP changes while limiting the allowance to
addresses actually assigned to the development machine. It does not weaken Auth,
Supabase, application CORS, CSP, RLS, or production authorization.

## Local Browser QA

- Authenticated `/admin`: collapse and expand PASS.
- Repeated toggle and cookie-backed reload persistence: PASS.
- Direct `/admin`, `/admin/projects`, and `/admin/shifts`: hydration/toggle PASS.
- Representative navigation and route changes: PASS.
- Browser console application errors, React warnings, and hydration warnings:
  0.

## Network Browser QA

- Authenticated `/admin`: collapse and expand PASS.
- Repeated toggle and cookie-backed reload persistence: PASS.
- Direct `/admin`, `/admin/projects`, and `/admin/shifts`: hydration/toggle PASS.
- Representative navigation, back, and forward: PASS; handlers remained active.
- Expanded navigation labels/current route and collapsed icon rail remained
  usable without layout overlap.
- Browser console application errors, React warnings, and hydration warnings:
  0.
- Post-fix dev-server requests for the verified routes returned 200 without the
  prior cross-origin development-resource warning.

## Regression

- TypeScript (`npx tsc --noEmit`): PASS.
- Focused ESLint (`npx eslint next.config.ts`): PASS.
- Production build (`npm run build` with process-only Local Supabase public env):
  PASS.
- `git diff --check`: PASS.
- No dedicated sidebar unit test was added because this repository has no
  existing focused component-test harness for this interaction; actual Chrome
  E2E covered the framework-origin and hydration boundary that caused the bug.
- Existing staged, unstaged, and untracked work was preserved.

## Files Changed

- `next.config.ts`
- `docs/bug-3.0b-0-network-sidebar-result.md`

## Explicit Non-Changes

- Admin visual design unchanged
- Worker unchanged
- DB/RLS/RPC unchanged
- Auth architecture unchanged
- Packages unchanged
- Figma unchanged
- Remote unchanged
- Commit/push: 0

