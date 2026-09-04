# Phase UI-2.4F Admin Final Alignment Audit v1

## Executive Summary

- Current Admin page routes: 16。業務UI 14、Placeholder 2（Staff / Settings）。
- Latest Figma `03 Admin`: screen-level Frame / State 81。Design System参照は除外。
- Figma分類: implemented / partially aligned 48、Future Domain 26、Existing Domain gap 7（Staff）。
- 今回はP1 minor cleanupを7点適用。Backend Domain、query/action contract、route architectureは変更していない。
- P0のdead link、security regression、document overflow、runtime errorは検出しなかった。
- 最大の未完了Existing DomainはStaff Basic。PlacementはAssignment coreだけではFigmaのposition / break rotationを保存できず、Domain境界の決定が必要。
- Admin SOTを `Latest Figma + implemented Domain + Design Foundation + existing RLS/Server authorization` としてfreezeする。

## Route Coverage

| Route | Status | Figma | Notes |
| --- | --- | --- | --- |
| `/admin` | Implemented / partial | Home desktop/mobile | real KPIのみ。SOSはFuture |
| `/admin/projects` | Implemented | Project List desktop/mobile | list/filter/summary |
| `/admin/projects/new` | Implemented | Project Create | canonical create route |
| `/admin/projects/[projectId]` | Implemented | Project Hub | Job/Shift integration。multi-venueはFuture |
| `/admin/projects/[projectId]/jobs/new` | Compatibility | Job Create Drawer | Hub Drawerがcanonical、direct routeを保持 |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | Implemented | Unified Shift Create | single/multiple datesを統合 |
| `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` | Compatibility | Unified Shift Create | UI導線の主入口ではない |
| `/admin/shifts` | Implemented | List / Week / Calendar | GET URL state |
| `/admin/shifts/[shiftId]` | Implemented | Shift Hub | edit/application/assignment/pre-shift |
| `/admin/pre-shift` | Implemented | Pre-shift Page/Drawer | Day-ofは含めない |
| `/admin/attendance` | Implemented | Attendance List | date/filter/pagination |
| `/admin/attendance/[assignmentId]` | Implemented | Attendance states | official/raw/revision/correction |
| `/admin/workers` | Placeholder | Staff List | header + 明示的準備中stateのみ |
| `/admin/clients` | Implemented | Client Master | list/create/edit |
| `/admin/workplaces` | Implemented | Workplace Master | list/create/edit |
| `/admin/settings` | Placeholder | Settings | persistence Domainなし |

`/admin/workers/[workerId]` は存在しない。Worker linkをこのRouteへ向けずdead linkを回避している。

## Figma Coverage

| Frame group | Count | Status | Route / Boundary |
| --- | ---: | --- | --- |
| Home | 4 | Partially aligned | `/admin`; SOS / arrival facts omitted |
| Project | 6 | Implemented | project list/hub/create/edit |
| Shift Editor | 3 | Implemented | unified create/edit |
| Shift List / Hub | 4 | Implemented | list/week/calendar/detail |
| Placement | 3 | Future Domain boundary | no position/break rotation storage |
| Pre-shift / Day-of | 4 | 2 implemented / 2 Future | pre-shift only |
| Mobile / Drawer variants | 8 | Implemented | responsive common patterns |
| Attendance | 6 | Implemented within existing facts | no fake arrival/wake/depart |
| Staff | 7 | Existing Domain gap | workers data exists; Admin UI absent |
| Aggregation | 4 | Future Domain | aggregation/closing/transport |
| Communications | 7 | Future Domain | inbox/notice/delivery |
| Knowledge | 4 | Future Domain | content/history/analytics |
| Masters | 4 | Implemented | clients/workplaces |
| Settings | 6 | Future/Placeholder | persistence/audit log absent |
| Common States / Navigation | 11 | Partially aligned | shared states/nav implemented; form-specific use varies |
| **Total** | **81** |  |  |

## Gap Matrix

| Area | Current | Figma | Status | Severity | Domain Ready | Action |
| --- | --- | --- | --- | --- | --- | --- |
| Staff | Header-only route | List/Hub/History/Basic/Create/Edit | Placeholder | P1 next phase | Yes, basic workers/profile facts | Dedicated Staff Basic Phase |
| Placement | assignment/application actions | position + break timeline/editor | Future Domain | P2 | Partial | UI-2.5Aでboundary design。fieldを発明しない |
| Day-of | attendance/absence facts | day-of monitor/drawer | Future Domain | P2 | Partial | arrival/SOSなしで可能な範囲を再設計 |
| Dashboard | real staffing/attendance facts | includes SOS/arrival | Partially aligned | P2 | Partial | fake KPIを追加しない |
| Settings | Header-only route | multiple tabs/audit log | Placeholder | P2 | No | persistence/security domain first |
| Aggregation | routeなし | monthly/transport/closing | Future Domain | P2 | No | later domain phase |
| Communications | routeなし | inbox/notices/history | Future Domain | P2 | No | later domain phase |
| Knowledge | routeなし | list/editor/analysis/history | Future Domain | P2 | No | later domain phase |
| Project styles | some legacy slate/blue classes | semantic token system | Legacy visual residue | P1 follow-up | Yes | component-by-component token cleanup; large sweep禁止 |
| Shift styles | some legacy status/control classes | semantic token system | Legacy visual residue | P1 follow-up | Yes | separate visual-only cleanup |
| Job empty guidance | implemented Workplace still called pending | Stale label | P1 | Yes | Fixed |
| Projects error | bespoke state | common Error | Common-state gap | P1 | Yes | Fixed |
| Pagination edge | clickable anchor with aria-disabled | truly disabled control | A11y gap | P1 | Yes | Fixed in Attendance/Client/Workplace |
| Placeholder direct URLs | almost empty page | explicit state | Placeholder clarity | P1 | Yes | Fixed |
| Staff URL state | none | filters/tabs/history | Existing Domain gap | P1 next phase | Yes | Not faked |
| 390 re-audit | current browser backend has no viewport override | 390×844 | QA limitation | P1 follow-up | N/A | prior phase evidence + code audit; rerun when available |

## Minor Fixes Applied

1. Job formのstale messageを、実装済み勤務先マスタへの正しい案内へ変更。
2. Projects listのbespoke Errorを共通`AdminErrorState`へ統一。
3. Attendance / Client / Workplace paginationの端を非linkの`aria-disabled` stateへ変更。
4. `/admin/workers`と`/admin/settings`のdirect URLで、未実装範囲を明示する共通Empty stateを追加。

## Remaining Existing-Domain Work

1. Staff Basic: list、basic hub、safe fields、bounded history、create/editの権限・SOT確認。
2. Existing assignment factsだけで成立する配置概観。ただしpositionとbreak rotationを含めない設計に限定。
3. Project/Shift旧色classのsemantic token化。Domainと同時に触らずvisual-only phaseとする。
4. Attendance listの派生filter後memory paginationを、大規模日次件数向けに再評価。

## Future Domain

- Placement position / time segment / break rotation
- Day-of arrival / location / SOS / escalation
- Aggregation / transportation settlement / closing / NEO
- Communications / announcements / notification delivery
- Knowledge content / revision / analytics
- Settings persistence / role administration / integrations
- System-wide Audit Log
- Multi-venue project model

## Legacy / Compatibility

- `bulk-new`は旧bookmark互換route。canonical create UIはUnified Dates。
- `jobs/new`はdirect compatibility surface。Project Hub Drawerが主導線。
- `docs/ui-2.0-figma-code-gap-analysis.md`は当時点のhistorical audit。現在のroute/coverage判断には本書を使用する。
- legacy slate/blue classは動作不良ではないが、Design Foundation移行残としてP1 follow-upへ送る。

## Responsive QA

- Chrome current desktop viewport 1454pxで13 core surfacesを実描画。全件`scrollWidth === innerWidth`。
- 1440 targetのhierarchy/densityはFigmaと比較し、Home、Projects、Shift、Pre-shift、Attendance、Mastersで大きな崩れなし。
- 1280は前Phaseの実査結果とresponsive class/codeを再監査。今回のbrowser backendでは厳密なviewport override不可。
- 390×844は前Phaseの実査証跡とcard/full-screen Drawer/nav実装を再監査。今回の新規pixel runは未実施。
- Mobile tableはProjects/Shifts/Attendance/Mastersで縮小tableに依存せず、breakpoint別構造またはstacked rowsを使用。

## Security / DB

- `requireAdmin`、Server Component data access、Server Action auth、RLSを維持。
- Client-side hidden/disabledだけをauthorizationに使用していない。
- Staff sensitive fieldsは未実装のため一覧露出なし。
- Cross-branch判定はlocal read-only security testで確認する。
- Migration / RLS / GRANT / RPC / Function / Trigger / Seed / Auth / package変更なし。
- Local Supabase `127.0.0.1:54321`のみ。remoteへのwrite/connect operationなし。
- Supabase 2026 Data API auto-exposure changeは新規table向けであり、本Phaseはtableを追加しないため影響なし。

## Performance / Data

- Projects / Shifts / Pre-shift / Attendance / Mastersはrowごとのqueryを行わずbatch relation/queryを使用。
- Shift week/calendarは期間でbounded。Pre-shift/Attendanceは1日でbounded。
- Attendance Raw Eventは100、Revisionは最新50にbounded。
- Client/Workplaceは20件DB range pagination。
- Staff historyは未実装であり、implemented扱いしない。

## Browser QA

- Core routes: Home、Projects、Project Hub、Shift List/Week/Calendar/Hub、Pre-shift、Attendance List/Hub、Staff placeholder、Client、WorkplaceをChromeで実描画。
- Shift History: List→Week→Calendar→Back→Forwardを確認。
- Pre-shift: fixture detail Drawerのopen、Back、Forward、Escape closeを確認。
- Attendance: date/filter URLとdetailを確認。前PhaseでBack/Forward確認済み。
- Masters: list/search URL contractを確認。前PhaseでBack/ForwardとDrawerを確認済み。
- Staff: Placeholderのためtab/filter/history QAは対象外。
- Navigation: implemented itemだけlink、Placeholderはdisabled、Futureは非表示。active stateを主要routeで確認。
- Console: Chrome warning/error 0。
- No mutation QA。DB writeなし。

## Accessibility

- Visible navigationに`aria-current="page"`、Placeholderに`aria-disabled`。
- Controlsは原則`min-h-11` / `size-11`で44px target。
- Common Drawerはfocus trap、Escape、focus restore、body scroll lock、`aria-labelledby`を実装。
- Pre-shift Drawerでopen/Escapeをspot check。
- Statusはtext labelを併記しcolor-onlyにしない。
- Pagination edgeをfocusable linkからdisabled text stateへ修正。

## Placement Boundary Preview

- Existing Assignment fields: `id`, `shift_slot_id`, `worker_id`, `source`, `status`, `assigned_by`, assigned/confirmed/cancelled timestamps、cancel reason、timestamps。
- Existing assignment status: assigned、confirmed、cancelled_by_worker、cancelled_by_company、absent、no_show、completed。
- Required count: `shift_slots.required_workers`。
- Break data: Shift単位のplanned `break_minutes`とAttendance official `total_break_minutes`は存在。
- Position storage: なし。
- Break rotation storage: なし。
- DBなしで構築可能: Shiftごとのrequired/assigned/shortage、assigned worker list、assignment status、既存break予定のread-only summary。
- Domain workが必要: position、time segment、break start/end/rotation、coverage timeline、multi-venue placement。

## Validation

- TypeScript: `npx tsc --noEmit` PASS。
- Build: `npm run build` PASS。
- scoped ESLint: PASS。
- `git diff --check`: PASS（既存のLF/CRLF warningのみ）。
- Admin UI alignment: 24/24 PASS。
- Shift views: 33/33 PASS。
- Pre-shift / Attendance / Master rule tests: PASS。
- Local read-only security regression: 7/7 PASS。

## Next Phase Recommendation

- Recommended: UI-2.4C Staff Basicの実装実態を是正するStaff Basic Phaseを、UI-2.5Aより先に行う。
- Reason: Figma 7 framesとExisting workers/profile Domainがあり、NavigationはすでにPlaceholderを示す最大のExisting-Domain gap。
- Placement next: Staffのcanonical list/detail linkが成立した後にUI-2.5A Assignment / Placement Foundationへ進む。
- Blockers: Placement position / break rotationをFigma同等にするには新Domain設計が必要。今回追加しない。

## Final Alignment Freeze

本Phase後のAdmin UI/IA正本は、最新Figmaの階層・密度・responsive intentを、実装済みDomainとDesign Foundationの範囲で表現し、SecurityはDB/RLSとServer-side authorizationを最優先する。Figma-only stateはDomainが存在するまで非clickable placeholderまたは非表示とし、fake completionを禁止する。

UI-2.4F: COMPLETE WITH MINOR FOLLOW-UP
