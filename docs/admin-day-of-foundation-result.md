# Phase UI-2.6A 実装結果

## Executive Summary
- Route: `/admin/day-of`。
- Navigation: 「当日運用」をimplemented / clickableへ変更。
- Day-of mode: read-first operational monitor。
- Domain used: Shift、Assignment、Worker、Attendance events/record、Pre-shift response、Placement Position/Segment/Break。
- Mutations: なし。
- Future omitted: Arrival、Departure、Location、GPS、SOS、Escalation、Notification。

## Sources
- Figma Main: `523:257` design context / screenshot。
- Figma Drawer: `525:229` design context / screenshot。
- Pre-shift: existing monitor query / rules / result document。
- Attendance: `deriveAdminAttendance`、date query、admin result document。
- Placement: frozen v2 read model / result documents。
- Current schema: existing Supabase tables、RLS、GRANT。

## Git State
- Branch: `small-ui-a11y-fix`。
- Start clean/dirty: clean、`9f551ab`から開始。
- Existing diff: なし。
- Changed: Day-of route / components / rules / batch read / tests / navigation / report。
- Commit: なし。
- Push: なし。

## Existing Domain Inventory

### Shift
- Date semantics: Asia/Tokyo `00:00 <= starts_at < next day 00:00`。
- Schedule: starts_at / ends_at、overnightは開始日に所属。

### Assignment
- Included statuses: assigned、confirmed、completed、absent、no_show。
- Excluded statuses: cancelled_by_worker、cancelled_by_company。
- Special statuses: absent / no_showはAttendance eventより優先。

### Attendance
- Raw facts: start_work / end_work のserver_received_at。
- Official facts: Attendance Recordの有無をread。
- State helper: existing `deriveAdminAttendance`を直接再利用。
- Late rule: start_workとShift開始の実差分。新しい閾値なし。

### Pre-shift
- Facts used: 提出有無、can_work。
- Sensitive omitted: health_status、comment、planned wake/departure、連絡先。

### Placement
- Position: Segmentが参照するlabel。
- Segment: Assignment別start/end。
- Break: planned Break Interval。
- Coverage: Placement正本UIに残しDay-ofへ複製しない。

## Route Architecture
- Main: Server Component。
- Query: `date`、`q`、`project`、`state`、`assignment`。
- Drawer: `assignment=<assignmentId>` URL state。
- Default date: Tokyo今日。
- Invalid fallback: Tokyo今日。

## Navigation
- Before: future / hidden。
- After: implemented `/admin/day-of`。
- Desktop: sidebarに表示。
- Mobile: shared navigation definitionに表示。
- Active: routeとquery付きrouteでactive。

## Summary
- Shifts: 可視Assignmentに紐づくdistinct Shift数。
- Scheduled staff: 対象Assignment数。
- Working: existing Attendance state `working`。
- Finished: existing Attendance state `finished`。
- Attention: derived attentionReasonあり。
- Omitted fake KPI: 到着、未到着、SOS、連絡済み。

## Operational State Mapping
| Existing facts | Day-of label | Attention | Notes |
| --- | --- | --- | --- |
| Shift開始前、startなし | 勤務前 | no | arrival推測なし |
| Shift開始以後、startなし | 開始未報告 | yes | 未到着とは表示しない |
| startあり、endなし | 勤務中 | late時yes | start遅れ分を既存ruleで表示 |
| start/endあり | 勤務終了 | early leave時yes | official correctionは勤怠画面 |
| Assignment absent | 欠勤 | yes | eventより優先 |
| Assignment no_show | 無断欠勤 | yes | eventより優先 |
| Pre-shift can_work=false | 勤務前等 | yes | 前日確認で勤務不可 |

## Attention Rule
- Derived: Attendance needsAttention＋pre-shift can_work=false。
- Priority: no_show → absent → start_missing → late → early leave → pre-shift勤務不可。
- Persisted: しない。
- Filters: `state=attention`。

## Filters
- Search: Staff name/code、Project、Job、Workplace。
- Project: 対象日のRLS可視Project。
- State: all / attention / scheduled / working / finished。
- URL: GET query。
- Back/Forward: URL stateで対応。

## Shift Grouping
- Header: 時間、必要人数、勤務予定人数、Project / Job / Workplace。
- Time: Tokyo時刻。
- Project: Project Hub link。
- Job: text context。
- Workplace: text context。
- Required: Shift required_workers。
- Assigned: roster内Assignment数。

## Staff Row
- Name: Staff Hub link。
- Staff ID: staff_code。
- Schedule: Shift start/end。
- Attendance state: existing helper label。
- Assignment: state導出の入力。
- Placement: current segmentがあるtodayのみ「現在配置」、それ以外は「配置」。
- Break: 常に「予定休憩」と明示。
- Pre-shift: 未提出 / 提出済み / 勤務不可回答。
- Attention: text＋semantic color。

## Placement Integration
- Position: Assignment Segmentからread。
- Current/today wording: todayかつnow内Segmentのみ「現在配置」。
- Break: Assignment Break Interval。
- Planned vs actual: planned表記のみ。Attendance actual breakとは呼ばない。
- Placement link: `/admin/placement?date=...&shift=...`。

## Pre-shift Integration
- Submission: response row有無。
- can_work: 勤務不可のみattentionへ反映。
- planned times: 表示しない。
- comment: 表示しない。
- health: 表示しない。
- Link: existing Pre-shift Drawer URL。

## Attendance Integration
- Current state: existing helper。
- Actual start: start_work server_received_at。
- Actual end: end_work server_received_at。
- Raw event: Drawerに開始/終了だけをbounded表示。
- Official record: readするが編集UIは複製しない。
- Attendance link: `/admin/attendance/<assignmentId>`。

## Staff Drawer
- URL state: assignment query。
- Header: Staff name / code。
- Schedule: Project / Job / Workplace / planned time / Assignment status。
- Day-of: operational Attendance stateとattention。
- Placement: Segment一覧。
- Break: planned Break一覧。
- Pre-shift: 提出と勤務可否のみ。
- Related links: Attendance、Placement、Pre-shift、Staff、Shift。

## Mutations
- Implemented: なし。
- Reused: read-only route linksのみ。
- Deferred: Attendance correction、Placement edit、Pre-shift operation。
- Reason: 各canonical UIが正本。

## Figma Future Domain Omitted
- Arrival: omitted。
- Departure: omitted。
- Location: omitted。
- SOS: omitted。
- Escalation: omitted。
- Notification: omitted。
- Admin confirmation: omitted。
- Other: emergency call log、presence heartbeat、arbitrary notes omitted。

## Data Access
- Shift query: Assignment joinでdate bounded。
- Assignment query: included status＋RLS。
- Attendance: IDsを使ったbatched event / record query。
- Pre-shift: Assignment relation batch read。
- Placement: date Shift IDs→Plan、then Plan IDs→Position/Segment/Break。
- Batch: fixed query groups。Shift/Workerごとのqueryなし。
- N+1: なし。
- Bounds: Tokyo day＋visible IDs。
- Drawer lazy read: Main payloadからselected itemを表示。追加requestなし。

## Security
- Manager: existing branch RLS。
- System Admin: existing cross-branch read scope。
- Worker: `requireAdmin`でblocked。
- Branch: query-side bypassなし。
- RLS: 最終防御を維持。
- Client authorization: 依存しない。

## Privacy
- Main list: name / staff_code / operational factsだけ。
- Drawer: contact infoなし。
- Health: omitted。
- Contact info: omitted。

## Responsive

### 1440
- Main: summary / filters / dense Shift rowsを確認。
- Shift grouping: structured desktop columns。
- Drawer: Main contextを残す既存Drawer。
- Overflow: 0。

### 1280
- Main: content / sidebar共存。
- Drawer: scroll可能、関連linksまで到達可能。
- Overflow: 0。

### 390×844
- Main: summary、filters、Staff rowsをstack。
- Staff cards: name / time / state / placement / attention順。
- Drawer: full-screen。
- Navigation: 当日運用active。
- Touch targets: 44px controls。
- Overflow: 0。

## Chrome QA
- Auth: local Manager fixture。
- Default: 2026-09-08 Tokyo today、empty state正常。
- Date: 2099-02-15 direct date正常。
- Prev: URL date navigationを確認。
- Today: today linkを確認。
- Next: URL date navigationを確認。
- Search: GET form / visible label確認。
- Project filter: visible select / URL state実装。
- State filter: visible select / URL state実装。
- Drawer: open、Escape対応shared Drawer、mobile full-screen。
- Back/Forward: Back close / Forward reopen PASS。
- Shift link: canonical Shift route。
- Staff link: canonical Staff route。
- Placement link: canonical Placement URL。
- Attendance link: canonical Attendance detail route。
- Console: warning / error 0。

## Data Verification
- Assignment: 2099-02-15 confirmed AssignmentをUIで確認。
- Attendance: eventなし→勤務前を確認。
- Placement: Position「受付」09:00–12:00を確認。
- Pre-shift: responseなし→未提出を確認。
- DB: local only。
- UI: 上記factsと一致。

## State QA
- Scheduled: actual browser PASS。
- Start missing: rule test PASS。
- Late: existing Attendance regression PASS。
- Working: rule test PASS。
- Finished: rule test PASS。
- Absent: rule test PASS。
- No-show: rule test PASS。
- Actual browser: scheduledのみfixtureあり。
- Rule-only: start_missing / late / working / finished / absent / no_show。

## Accessibility
- Keyboard: semantic links / controls。
- Focus: shared Drawer focus trap。
- Escape: shared Drawer onCancel / key handling。
- Restore: close後trigger IDへ復元。
- 44px: inputs / buttons / close。
- Labels: search / project / state / date。
- Color-only: state / attention text併用。

## Performance
- Date bound: yes。
- Batch: yes。
- N+1: no。
- Raw event bound: assignment IDs＋event type。
- Main payload: day roster factsのみ。
- Drawer payload: same bounded item、追加fetchなし。

## Regression
- Pre-shift: rule PASS、admin 20/20 PASS。
- Attendance: UI rules PASS、admin 39/40（既存static query-count期待のみFAIL）。
- Placement: rules 39/39、editor 13/13、security 28/28 PASS。
- Shift Hub: canonical link維持。
- Staff Hub: canonical link維持。
- Navigation: alignment 24/24 PASS。

## Tests
- Day-of: 17/17 PASS。
- Attendance: UI PASS、admin 39/40。
- Pre-shift: monitor PASS、admin 20/20。
- Placement: 39/39、13/13。
- Security: Placement read-only 28/28＋existing branch RLSを再利用。
- Other: Admin UI alignment 24/24。

## Validation
- TypeScript: PASS。
- Build: PASS、`/admin/day-of` generated。
- scoped ESLint: PASS。
- git diff --check: PASS。

## DB / Security Changes
- Migration: 0。
- RLS: 0。
- GRANT: 0。
- RPC: 0。
- Function: 0。
- Trigger: 0。
- Seed: 0。
- Auth: 0。
- Package: 0。
- Remote: 0。

## Figma Alignment

### Implemented
- Date navigator、summary、filters、Shift grouping、dense Staff rows、Staff Drawer、responsive hierarchy。

### Intentionally Adapted
- Figmaの「未出勤」は`開始未報告`、休憩は`予定休憩`、リアルタイム文言はexisting factsのread monitorへ変更。

### Omitted
- Arrival / departure / GPS / SOS / escalation / notification / admin arrival confirmation。

## Limitations
- local browser fixtureは勤務前のみ。その他operational statesはexisting Attendance regressionとDay-of pure rulesで確認。
- Attendance admin testの既存query-count assertion 1件が現行実装と不一致。本PhaseはAttendance code/testを変更していない。

## Documentation
- `docs/admin-day-of-foundation-result.md`

## Next Phase Recommendation
- Recommended: actual day-of fixture matrixを別test-fixture phaseで整備後、UI-2.6B visual polishへ進む。
- Reason: production data mutationなしでbrowser state coverageを増やすため。
- Domain blockers: Arrival / GPS / SOS等はschema/domain phaseが先。

UI-2.6A: COMPLETE WITH LIMITED STATE QA
