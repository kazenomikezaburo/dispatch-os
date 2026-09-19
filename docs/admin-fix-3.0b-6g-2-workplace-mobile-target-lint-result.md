# ADMIN-FIX-3.0B-6G.2 Workplace Mobile Target & Lint Closure

## Status

`ADMIN-FIX-3.0B-6G.2: COMPLETE`

`ADMIN-QA-3.0B-6G.1: COMPLETE`

`ADMIN-UI-3.0B-6G: COMPLETE`

`ADMIN-MIG-3.0B-6H: READY`

## Initial Blockers

- 390x844 shared Workplace editor close target: 24.27x44px。
- repo-wide ESLint: `lib/admin/projects/get-project-detail.ts:24`の`prefer-const` 1件。

## Close Target Root Cause

Close buttonは`size-11`で44px高さを持っていたが、header flex rowのchildとして横方向にshrinkし、computed widthが24.27pxになっていた。

## Close Target Fix

`components/admin/masters/master-editor.tsx`のshared MasterEditor close buttonへ`shrink-0`を追加した。icon visual size、header content、Drawer behaviorは変更していない。

## Exact Mobile Measurement

- requested / actual viewport: 390x844 / 390x844
- clientWidth / scrollWidth: 390 / 390
- close target before / after: 24.27x44px / 44x44px
- warning visible: PASS
- field labels visible: PASS
- body scroll lock: `hidden`
- editor own scroll: PASS
- document horizontal overflow: 0
- evidence: `docs/evidence/admin-6g/390x844-shared-workplace-editor-fixed.png`

## Desktop Regression

Project Edit smoke verified at exact 1440x900 and 1280x900. Both have matching `innerWidth` / `innerHeight`, no horizontal overflow, and no header layout regression.

## Escape / Focus Restore

Escape closes the editor and returns focus to `勤務先・会場情報を編集`: PASS。

## ESLint Root Cause

`activeAssignmentShiftIds` was mutated with `push` but its binding was never reassigned. The binding was declared with `let`.

## ESLint Fix

Changed only `let activeAssignmentShiftIds` to `const activeAssignmentShiftIds`. Query batching, authorization, result construction, and assignment loading are unchanged. No eslint disable or rule configuration change was added.

## Browser Console

390x844 Project Edit / shared editor:

- application errors: 0
- React warnings: 0
- hydration warnings: 0
- uncaught exceptions: 0
- unhandled rejections: 0

Only the existing React DevTools information message and Turbopack HMR connection message were observed.

## LAN Smoke

Runtime LAN origin `http://192.168.11.64:3000` authenticated render and shared Workplace editor open: PASS. Close target was 44x44px and React/hydration warnings were 0.

## Focused Regression

6G focused integration: 37 / 37 PASS with fixture cleanup.

## Project Regression

- Canonical Project IA: 36 assertions PASS
- Project History Foundation: 36 / 36 PASS
- Unified Project Setup: 35 assertions PASS
- Master Workspace: 36 assertions PASS

## Static Verification

- repo-wide ESLint: PASS, 0 errors / 0 warnings
- TypeScript: PASS
- production build: PASS
- `git diff --check`: PASS (existing LF/CRLF notices only)

The first build attempt was blocked by offline Google Fonts; the escalated retry then exposed a workspace-local temporary Chrome profile lock. After deleting only that dedicated QA profile, the production build passed. No Product source change was made to address either environment artifact.

## Diff Audit

6G.2 Product diff is limited to the close control `shrink-0` and the `let` to `const` lint correction. Documents and the updated PASS screenshot are the only other changes.

## Files Changed

- `components/admin/masters/master-editor.tsx`
- `lib/admin/projects/get-project-detail.ts`
- `docs/evidence/admin-6g/390x844-shared-workplace-editor-fixed.png`
- `docs/admin-fix-3.0b-6g-2-workplace-mobile-target-lint-result.md`
- `docs/admin-qa-3.0b-6g-1-browser-evidence-closure-result.md`
- `docs/admin-ui-3.0b-6g-project-workplace-canonical-ux-result.md`

## Explicit Non-Changes

- Project / Job / Workplace relation: unchanged
- Workplace shared semantics: unchanged
- Project History contract: unchanged
- Shift IA, Placement, Confirmation, Attendance, Incident, Worker: unchanged
- Auth, DB schema, migrations, RLS, RPC, GRANT: unchanged
- packages / lockfile, Figma, remote: unchanged
- commit / push: 0
- existing staged / unstaged / untracked work: preserved

## Updated 6G / 6G.1 Status

6G.1 evidence blockers and its two Product blockers are closed by 6G.2. 6G Completion Gate is now complete, and 6H is ready.

## Remaining Blocker

none
