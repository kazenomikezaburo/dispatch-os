# ADMIN-UI-3.0B-6F Canonical Single-Shift Confirmation

## Status

- `ADMIN-UI-3.0B-6F: COMPLETE`
- `ADMIN-UI-3.0B-6G: READY`

## Existing Architecture Audit

`/admin/shifts/[shiftId]` のcanonical 4-tab detail、既存Pre-shift monitor/drawer、Day-of loader/rules/monitor/drawer、Attendance facts、Incident attentionを監査した。旧Confirmationは単一Shift summaryだけで、phase URLとDay-of integrationは未実装だった。Cross-Shift `/admin/shifts/pre-shift` と `/admin/shifts/day-of` は共有実装のまま保持した。

## Figma Reference

Figma `Pmb52CO7UgsQDA5tvoqUjF` をread-onlyで監査した。Confirmation `941:3676`、Pre-shift `523:2`、Pre Drawer `525:2`、Day-of `523:257`、Day Drawer `525:229` のhierarchy、compact phase control、row density、right Drawer languageを参照した。Figma mutationは0。

## Canonical Confirmation IA

main tabsは `概要 / 応募 / 配置 / 確認` の4項目を維持した。`確認` 内だけに `前日確認 / 当日確認` のcompact sub-switchを追加した。独立main tab、nested modal、fake dataは追加していない。

## Phase Selection Rule

- explicit `phase=pre` / `phase=day` が常に優先される。
- missing/invalid phaseは、現在のAsia/Tokyo calendar dateとShift開始のAsia/Tokyo dateを比較する。
- 現在日がShift日より前なら`pre`、同日以後なら`day`。
- server-sideで最終URLを `?tab=confirmation&phase=pre|day` へcanonicalizeする。
- explicit phaseはreload後も維持される。
- `confirmations` legacy aliasも同じ規則でcanonical URLへ移す。
- unknown queryはallowlist canonicalizationで破棄する。

## Exact Shift Boundary

authorized path `detail.id` をPre/Day loaderへ直接渡す。両loaderにoptional exact Shift predicateを追加し、Detail経由ではDB queryを `.eq("shift_slot_id", exactShiftId)` で制約する。date-wide結果からfirst/latest/nearest Shiftを選ぶ処理はない。

## Pre-shift Reuse

既存`getPreShiftMonitor`、`PreShiftMonitor`、`PreShiftDrawer`を再利用した。Detailでは日付・案件・Shift・状態filterを表示せず、exact Shift assignmentsのみを表示する。DrawerはURLのexact `assignmentId`をserver result内で再検証し、不一致はsafe not-foundとなる。

## Day-of Reuse

既存`getDayOf`、`buildDayOfItems`、`DayOfMonitor`、`DayOfDrawer`を再利用した。Attendance event/record、placement/break、pre-shift、Incident attentionの既存mapperを保ち、exact Shift predicateだけを追加した。Detailにdate/project/shift/state filterは複製していない。

## Attendance Boundary

Day phaseはAttendance factsをread-only表示し、exact Assignmentの`/admin/attendance/[assignmentId]`へ遷移する。Attendance edit、confirm/revise UI、audit history、write actionは複製していない。

## Incident Boundary

Day phaseは既存のopen/acknowledged Incident attentionとexact Incident linkをread-onlyで表示する。acknowledge/resolve/retract等のlifecycle actionは追加していない。

## Drawer URL / Focus

- Pre: `?tab=confirmation&phase=pre&assignmentId=<exact-id>`
- Day: `?tab=confirmation&phase=day&assignmentId=<exact-id>`
- close先は同じShift・同じphaseのcanonical URL。
- phase切替時はstale `assignmentId`を持ち越さない。
- Escape、close、Back/ForwardでURL stateを復元する。
- close後は既存bounded pollingでexact Assignment triggerへfocusを戻す。

## Responsive / Accessibility

`1440x900`、`1280x900`、`390x844`で確認した。document overflowは0。mobile Drawerはviewport幅内、body scroll lockあり。main tabsは4項目、phase linksは各44px。semantic nav、real Link、`aria-current`、visible focus、active surface/weight/shadowによるnon-color stateを維持した。

## Browser QA

Local Managerでfuture Shiftのmissing phaseが`pre`へcanonicalizeされること、manual `day`切替、reload保持、Pre/Day row、exact Drawer、Attendance link、Escape、focus restoreを確認した。local/LAN origin双方でcanonical Day phaseを表示した。application console error 0、React warning 0、hydration warning 0。DB integration suiteによるAuth fixture refresh後のdev server refresh-token失効ログはbrowser QA完了後のfixture再生成に由来し、UI console結果とは分離した。

## Tests

- Canonical Single-Shift Confirmation: 55 assertions PASS
- Canonical Shift Detail & Placement: 37 PASS
- Canonical Shift Operations: 32 PASS
- Shift Views: 33/33 PASS
- Pre-shift Monitor: PASS
- Pre-shift Admin: 20/20 PASS
- Pre-shift RLS: 16/16 PASS
- Day-of Rules: 17/17 PASS
- Day-of Fixture Matrix: 12/12 PASS
- Placement Core: 26/26 PASS
- Placement Editor Rules: 13/13 PASS
- Placement Rules: 39/39 PASS
- Placement Atomic: 20/20 PASS
- Placement Security: 28/28 PASS
- Attendance UI Rules: PASS
- Attendance Admin: 40/40 PASS
- Attendance Confirmation: 50/50 PASS
- Attendance Revision: 53/53 PASS
- Operational Incident: 47/47 PASS
- Canonical Project IA: 36 PASS
- Admin Shell: 11 PASS

## Static Verification

- `npm run lint`: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS。sandbox内初回はGoogle Fonts network拒否のみで停止し、同一buildをnetwork許可付きで再実行してPASS。
- `git diff --check`: PASS（既存working-copyのLF/CRLF noticeのみ、whitespace error 0）

## Files Changed

- `app/admin/shifts/[shiftId]/page.tsx`
- `components/admin/shifts/confirmation-phase-nav.tsx`
- `components/admin/pre-shift/pre-shift-monitor.tsx`
- `components/admin/day-of/day-of-monitor.tsx`
- `lib/admin/shifts/single-shift-confirmation-rules.ts`
- `lib/admin/pre-shift/get-pre-shift-monitor.ts`
- `lib/admin/day-of/get-day-of.ts`
- `scripts/integration/admin-canonical-single-shift-confirmation-test.mjs`
- `scripts/integration/admin-canonical-shift-detail-placement-test.mjs`
- `docs/admin-ui-3.0b-6f-canonical-single-shift-confirmation-result.md`

## Explicit Non-Changes

- DB schema/migrations、RLS/RPC/GRANT: 変更0
- Cross-Shift Pre/Day routes: retained
- Attendance/Incident domain and write semantics: unchanged
- Placement domain/write semantics: unchanged
- Project/Shift domain: unchanged
- Worker/Auth architecture: unchanged
- packages/lockfile: unchanged
- Figma/remote: unchanged
- commit/push: 0
- existing staged/unstaged/untracked work: preserved

## Remaining Risks

なし。6Gへ進行可能。
