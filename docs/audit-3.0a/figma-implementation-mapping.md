# AUDIT-3.0A-3 Figma ↔ Implementation Screen Mapping

## Executive Summary

- Status: **AUDIT-3.0A-3: COMPLETE WITH MAPPING GAPS**
- Figma source: `Dispatch OS — Product Design` (`Pmb52CO7UgsQDA5tvoqUjF`), inspected read-only through the authenticated Figma integration on 2026-09-11.
- Implementation sources: `route-inventory.md` (31 `page.tsx` routes / 29 canonical visual screens) and `screenshot-inventory.md` (51 planned targets: 50 captured, 1 documented capture gap).
- Target coverage: **51 / 51 mapped**. Every target has a mapping class, confidence, and Human Review status.
- Screenshot evidence: **50 AVAILABLE / 1 NOT AVAILABLE** (`admin-placement-conflict-desktop.png`).
- Human Review: **NOT REVIEWED for all 51 targets**. This phase establishes correspondence only; it does not assign P0/P1/P2 or decide implementation correctness.
- Figma mutation: **0**. Product/UI/code/DB/fixture/package/browser state mutation: **0**.

The principal gaps are not missing audit rows. They are genuine source mismatches: auth has no corresponding Figma screen; Incident and mixed Notification Inbox are represented only by older communication/support concepts; several implementation states (empty, archived, unavailable, revision dialog, Help Request open) have no dedicated Figma frame; and the Figma Announcement editor contains intentionally excluded product concepts.

## Sources and Method

| Source | Role |
| --- | --- |
| `docs/audit-3.0a/route-inventory.md` | route, role, canonical screen, state, and viewport source of truth |
| `docs/audit-3.0a/screenshot-inventory.md` | immutable screenshot filename/status source of truth |
| Figma pages `03 Admin` (`3:4`) and `04 Worker` (`3:5`) | screen/frame/node inventory and visual intent |
| `docs/domain-2.9a-announcement-design-result.md` | Announcement domain boundary and intentional omissions |
| `docs/db-2.9b-announcement-persistence-result.md` | published immutability and persistence contract |
| `docs/ui-2.9c-admin-announcement-ui-result.md` | Admin Announcement adaptation decisions |
| `docs/ui-2.9d-worker-announcement-ui-result.md` | Worker Announcement adaptation decisions |

Figma node IDs below are exact IDs returned by the integration. Matching considered role, route intent, state, viewport, shell, hierarchy, and visible content. Similar wording alone was not treated as an exact match.

### Classification

| Class | Meaning |
| --- | --- |
| Exact | Same screen purpose, state, viewport, and substantially the same composition |
| Strong | Same canonical screen and primary state; fixture/content or minor composition differs |
| Partial | Some structure or intent maps, but state/domain/viewport materially differs |
| Figma-only | Figma concept has no implementation route/state in the audited inventory |
| Implementation-only | Implementation target has no safe corresponding Figma frame |
| Legacy / Obsolete Candidate | Figma artifact is explicitly legacy or conflicts with frozen domain/route intent; human decision required |

Confidence indicates the strength of the correspondence evidence, not design quality.

## Figma Inventory

### Pages and top-level structure

| Page | Node | Relevant inventory |
| --- | --- | --- |
| `00 Cover` | `0:1` | empty |
| `01 Foundations` | `3:2` | empty |
| `02 Components` | `3:3` | 22 top-level component/documentation nodes; includes Admin Sidebar `191:91`, Content State `193:73`, Mobile Full-screen Navigation `275:169`, Worker Sidebar `275:170` |
| `03 Admin` | `3:4` | 13 top-level sections; 82 named screen/state roots found |
| `04 Worker` | `3:5` | 9 top-level sections; 53 screen-sized frame candidates found |
| `05 Flows` | `3:6` | empty |
| `06 Playground` | `3:7` | empty |
| `10 Components｜Navigation Item` | `752:2` | navigation item and Admin Sidebar component sets |
| `11 Components｜Button` | `792:2` | Button component set |
| `12 Components｜Badge` | `793:2` | Badge component set |
| `13 Components｜Input` | `794:2` | Input component set |
| `14 Components｜Tab` | `795:2365` | Tab component set |
| `15 Components｜Admin Header` | `796:2` | Admin Header component set |

### Canonical Figma screen groups used by this mapping

| Area | Page / section node | Representative frame nodes | Dimensions |
| --- | --- | --- | --- |
| Admin home | `162:2` | `459:3284`, `464:2` | 1440×1024 |
| Projects / jobs | `373:3235`, `162:3` | `469:2`, `489:310`, `492:6`, `29:2`, `599:5` | 1440×1024/1120 |
| Shift authoring | `373:3236` | `501:2821`, `504:2541`, `823:218`, legacy `501:2974` | 1440×1024/1120 |
| Shift management | `373:3237` | `496:2900`, `496:3034`, `505:512` | 1440×1024 |
| Placement | `373:3238` | `515:2`, `515:431`, `517:14` | 1440×1024 |
| Pre-shift / day-of | `373:3239` | `523:2`, `523:257`, `525:2`, `525:229` | 1440×1024 |
| Attendance | `162:6` | `530:2122`, `530:2369`, `533:2044`, `533:2197` | 1440×1024 |
| Workers | `535:1850` | `544:2`, `544:271`, `546:2` | 1440×1024 |
| Admin communication / Announcement | `162:9` | `109:2`, `110:2`, `117:2`, `117:233`, `119:2` | 1440×1110–1154 |
| Master data | `283:208` | `286:401`, `286:569`, `286:763`, `286:931` | 1440×1024 |
| Common states | `602:11` | `602:12` Empty, `602:48` Conflict, plus loading/error/forbidden/not-found states | 800×240 |
| Worker home / assignment | `226:78`, `226:79`, `226:80` | `225:2`, `188:52`, state frames including `68:124`, `226:28` | 390×844 |
| Worker support / Announcement | `229:3` | `229:4`, `229:37`, `229:84`; quick entry `338:85` | 390×844; entry 166×92 |
| Worker responsive shell | `282:90` | `282:91`, `282:118`, `339:193`; Announcement region `339:251` | 390×844 / 1440×900 |

Known Announcement nodes were re-resolved directly: `117:2`, `117:233`, `119:2`, `229:37`, `338:85`, and `339:251` all exist with the names and dimensions recorded above.

## Master Mapping — 51 Screenshot Targets

`Human Review` is deliberately `NOT REVIEWED` in every row.

| Screen ID | Route | State | Screenshot | Figma Node | Figma Frame | Mapping | Confidence | Human Review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCR-AUTH-001 | `/login` | default | `auth/login-desktop.png` (AVAILABLE) | — | — | Implementation-only | High | NOT REVIEWED |
| SCR-AUTH-002 | `/auth/error?reason=inactive` | inactive | `auth/auth-error-inactive-desktop.png` (AVAILABLE) | — | — | Implementation-only | High | NOT REVIEWED |
| SCR-A-001 | `/admin` | populated | `admin/admin-dashboard-desktop.png` (AVAILABLE) | `459:3284` | `[Page] ホーム｜Desktop / Sidebar=Collapsed` | Strong | High | NOT REVIEWED |
| SCR-A-002 | `/admin/projects` | default | `admin/admin-projects-list-desktop.png` (AVAILABLE) | `469:2` | `[Page] 案件一覧｜Desktop / Sidebar=Expanded / Final` | Strong | High | NOT REVIEWED |
| SCR-A-002 | `/admin/projects` | empty/filtered | `admin/admin-projects-empty-desktop.png` (AVAILABLE) | `469:2` + `602:12` | 案件一覧 + common Empty | Partial | Medium | NOT REVIEWED |
| SCR-A-003 | `/admin/projects/new` | default | `admin/admin-project-new-desktop.png` (AVAILABLE) | `489:310` | `[Editor] 案件｜Mode=Create` | Strong | High | NOT REVIEWED |
| SCR-A-004 | `/admin/projects/[projectId]` | populated hub | `admin/admin-project-detail-desktop.png` (AVAILABLE) | `383:3183` | `[Hub] 案件詳細｜通常案件` | Strong | High | NOT REVIEWED |
| SCR-A-004 | `/admin/projects/[projectId]` | edit drawer | `admin/admin-project-edit-drawer-desktop.png` (AVAILABLE) | `492:6` | `[Editor] 案件｜Mode=Edit` | Partial | Medium | NOT REVIEWED |
| SCR-A-005 | `/admin/projects/[projectId]/jobs/new` | default fallback | `admin/admin-job-new-desktop.png` (AVAILABLE) | `599:5` | `[Drawer] 業務・勤務先｜Mode=Create` | Partial | High | NOT REVIEWED |
| SCR-A-006 | `/admin/projects/[projectId]/jobs/[jobId]/shifts/new` | preview | `admin/admin-shift-new-preview-desktop.png` (AVAILABLE) | `501:2821` | `[Editor] シフト｜Mode=Create / Unified Dates` | Strong | High | NOT REVIEWED |
| SCR-A-008 | `/admin/shifts` | list | `admin/admin-shifts-list-desktop.png` (AVAILABLE) | `496:2900` | `[Page] シフト一覧｜Desktop / View=List` | Strong | High | NOT REVIEWED |
| SCR-A-008 | `/admin/shifts?view=calendar` | calendar | `admin/admin-shifts-calendar-desktop.png` (AVAILABLE) | `505:512` | `[State] シフト一覧｜Desktop / View=Calendar` | Strong | High | NOT REVIEWED |
| SCR-A-009 | `/admin/shifts/[shiftId]` | staffing detail | `admin/admin-shift-detail-desktop.png` (AVAILABLE) | `496:3034` | `[Hub] シフト詳細｜Desktop` | Strong | High | NOT REVIEWED |
| SCR-A-009 | `/admin/shifts/[shiftId]` | edit drawer | `admin/admin-shift-edit-drawer-desktop.png` (AVAILABLE) | `823:218` | `[Editor] シフト｜Mode=Edit / Unified Layout v2` | Partial | Medium | NOT REVIEWED |
| SCR-A-010 | `/admin/placement` | board | `admin/admin-placement-board-desktop.png` (AVAILABLE) | `515:2` | `[Page] 配置・休憩回し｜Desktop / Unified / Final v2` | Strong | High | NOT REVIEWED |
| SCR-A-010 | `/admin/placement?shift=[shiftId]` | editor open | `admin/admin-placement-editor-desktop.png` (AVAILABLE) | `515:431` | `[State] 配置・休憩回し｜Drawer=Edit` | Strong | High | NOT REVIEWED |
| SCR-A-010 | `/admin/placement?shift=[shiftId]` | conflict/error | `admin/admin-placement-conflict-desktop.png` (**NOT AVAILABLE**) | `515:431` + `602:48` | Placement editor + common Conflict | Partial | Medium | NOT REVIEWED |
| SCR-A-011 | `/admin/pre-shift` | mixed statuses | `admin/admin-pre-shift-desktop.png` (AVAILABLE) | `523:2` | `[Page] 前日確認｜Desktop` | Strong | High | NOT REVIEWED |
| SCR-A-011 | `/admin/pre-shift?assignment=[assignmentId]` | drawer open | `admin/admin-pre-shift-drawer-desktop.png` (AVAILABLE) | `525:2` | `[Drawer] 前日確認｜スタッフ詳細` | Strong | High | NOT REVIEWED |
| SCR-A-012 | `/admin/day-of` | mixed operations | `admin/admin-day-of-desktop.png` (AVAILABLE) | `523:257` | `[Page] 当日確認｜Desktop` | Strong | High | NOT REVIEWED |
| SCR-A-012 | `/admin/day-of?assignment=[assignmentId]` | drawer/Incident | `admin/admin-day-of-drawer-desktop.png` (AVAILABLE) | `525:229` | `[Drawer] 当日確認｜スタッフ詳細` | Partial | Medium | NOT REVIEWED |
| SCR-A-013 | `/admin/attendance` | mixed states | `admin/admin-attendance-list-desktop.png` (AVAILABLE) | `530:2122` | `[Page] 勤怠一覧｜Desktop / Sidebar=Expanded / Final` | Strong | High | NOT REVIEWED |
| SCR-A-014 | `/admin/attendance/[assignmentId]` | confirmed + history | `admin/admin-attendance-detail-desktop.png` (AVAILABLE) | `533:2044` / `533:2197` | confirmed / revised attendance states | Strong | High | NOT REVIEWED |
| SCR-A-014 | `/admin/attendance/[assignmentId]` | revision dialog | `admin/admin-attendance-revision-dialog-desktop.png` (AVAILABLE) | `533:2197` | `[State] 勤怠詳細｜訂正済み` | Partial | Low | NOT REVIEWED |
| SCR-A-015 | `/admin/workers` | default | `admin/admin-workers-list-desktop.png` (AVAILABLE) | `544:2` | `[Page] スタッフ一覧｜Desktop / Final` | Strong | High | NOT REVIEWED |
| SCR-A-016 | `/admin/workers/[workerId]` | overview | `admin/admin-worker-detail-desktop.png` (AVAILABLE) | `544:271` | `[Hub] スタッフ詳細｜概要` | Strong | High | NOT REVIEWED |
| SCR-A-016 | `/admin/workers/[workerId]?tab=history` | history | `admin/admin-worker-history-desktop.png` (AVAILABLE) | `546:2` | `[Tab] スタッフ詳細｜勤務履歴` | Strong | High | NOT REVIEWED |
| SCR-A-017 | `/admin/incidents` | unresolved list | `admin/admin-incidents-list-desktop.png` (AVAILABLE) | `109:2` | `[Page] 連絡｜受信トレイ / Final` | Partial | Medium | NOT REVIEWED |
| SCR-A-017 | `/admin/incidents?incident=[incidentId]` | drawer open | `admin/admin-incident-drawer-desktop.png` (AVAILABLE) | `110:2` | `[Page] 連絡｜詳細 / Final` | Partial | Medium | NOT REVIEWED |
| SCR-A-018 | `/admin/announcements` | mixed lifecycle | `admin/admin-announcements-list-desktop.png` (AVAILABLE) | `119:2` | `[Page] 連絡｜お知らせ一覧 / Final` | Partial | High | NOT REVIEWED |
| SCR-A-018 | `/admin/announcements` | empty | `admin/admin-announcements-empty-desktop.png` (AVAILABLE) | `119:2` + `602:12` | Announcement list + common Empty | Partial | Medium | NOT REVIEWED |
| SCR-A-019 | `/admin/announcements/new` | completed preview | `admin/admin-announcement-new-desktop.png` (AVAILABLE) | `117:2` | `[Editor] 連絡｜お知らせ / Mode=Create` | Partial | High | NOT REVIEWED |
| SCR-A-020 | `/admin/announcements/[announcementId]` | published read-only | `admin/admin-announcement-published-desktop.png` (AVAILABLE) | `117:233` | `[Editor] 連絡｜お知らせ / Mode=Edit` | Legacy / Obsolete Candidate | High | NOT REVIEWED |
| SCR-A-020 | `/admin/announcements/[announcementId]?edit=1` | draft edit | `admin/admin-announcement-draft-edit-desktop.png` (AVAILABLE) | `117:233` | `[Editor] 連絡｜お知らせ / Mode=Edit` | Partial | Medium | NOT REVIEWED |
| SCR-A-020 | `/admin/announcements/[announcementId]` | archived read-only | `admin/admin-announcement-archived-desktop.png` (AVAILABLE) | — | — | Implementation-only | High | NOT REVIEWED |
| SCR-A-021 | `/admin/clients` | default | `admin/admin-clients-list-desktop.png` (AVAILABLE) | `286:401` | `[Page] マスタ｜取引先一覧` | Strong | High | NOT REVIEWED |
| SCR-A-021 | `/admin/clients` | editor open | `admin/admin-client-editor-desktop.png` (AVAILABLE) | `286:569` | `[Drawer] 取引先｜Mode=Create / Edit` | Strong | High | NOT REVIEWED |
| SCR-A-022 | `/admin/workplaces` | default | `admin/admin-workplaces-list-desktop.png` (AVAILABLE) | `286:763` | `[Page] マスタ｜勤務先一覧` | Strong | High | NOT REVIEWED |
| SCR-A-022 | `/admin/workplaces` | editor open | `admin/admin-workplace-editor-desktop.png` (AVAILABLE) | `286:931` | `[Drawer] 勤務先｜Mode=Create / Edit` | Strong | High | NOT REVIEWED |
| SCR-W-001 | `/worker` | assignments | `worker/worker-home-mobile.png` (AVAILABLE) | `225:2` | `[Page] Workerホーム｜Mobile` | Strong | High | NOT REVIEWED |
| SCR-W-001 | `/worker` | desktop spot-check | `worker/worker-home-desktop.png` (AVAILABLE) | `282:118` | `[Page] Workerホーム｜Desktop` | Strong | High | NOT REVIEWED |
| SCR-W-002 | `/worker/assignments/[assignmentId]` | actionable detail | `worker/worker-assignment-detail-mobile.png` (AVAILABLE) | `188:52` | `[Hub] 勤務詳細｜Mobile / Overview` | Strong | High | NOT REVIEWED |
| SCR-W-002 | `/worker/assignments/[assignmentId]` | Help Request open | `worker/worker-help-request-open-mobile.png` (AVAILABLE) | `229:84` | `[Page] SOS・問い合わせ｜Mobile` | Partial | Low | NOT REVIEWED |
| SCR-W-003 | `/worker/notifications` | mixed unread/read | `worker/worker-notifications-mobile.png` (AVAILABLE) | `229:4` / `339:193` | Support hub mobile / desktop | Partial | Low | NOT REVIEWED |
| SCR-W-003 | `/worker/notifications` | Incident detail open | `worker/worker-notification-incident-detail-mobile.png` (AVAILABLE) | `229:84` | `[Page] SOS・問い合わせ｜Mobile` | Partial | Low | NOT REVIEWED |
| SCR-W-003 | `/worker/notifications` | Announcement detail open | `worker/worker-notification-announcement-detail-mobile.png` (AVAILABLE) | `229:37` | `[Page] お知らせ詳細｜Mobile` | Partial | Medium | NOT REVIEWED |
| SCR-W-003 | `/worker/notifications` | source unavailable | `worker/worker-notification-source-unavailable-mobile.png` (AVAILABLE) | — | — | Implementation-only | High | NOT REVIEWED |
| SCR-W-004 | `/worker/announcements` | published list | `worker/worker-announcements-list-mobile.png` (AVAILABLE) | `229:4` + `338:85` | Support hub + `Quick / Announcements` | Partial | Medium | NOT REVIEWED |
| SCR-W-004 | `/worker/announcements` | empty | `worker/worker-announcements-empty-mobile.png` (AVAILABLE) | — | — | Implementation-only | High | NOT REVIEWED |
| SCR-W-005 | `/worker/announcements/[announcementId]` | important detail | `worker/worker-announcement-detail-mobile.png` (AVAILABLE) | `229:37` | `[Page] お知らせ詳細｜Mobile` | Strong | High | NOT REVIEWED |
| SCR-W-005 | `/worker/announcements/[announcementId]` | safe unavailable | `worker/worker-announcement-unavailable-mobile.png` (AVAILABLE) | — | — | Implementation-only | High | NOT REVIEWED |

## Coverage Reconciliation

| Measure | Expected | Mapped | Gap |
| --- | ---: | ---: | ---: |
| `page.tsx` routes | 31 | 31 represented by route inventory; 27 visual routes are represented in the 51-target matrix and 4 redirect/skip/placeholder routes are covered below | 0 undocumented |
| Canonical visual screens | 29 | 29 | 0 |
| Screenshot targets | 51 | 51 | 0 mapping rows |
| Screenshot files | 51 planned | 50 available | 1 documented capture gap |
| Human Review statuses | 51 | 51 `NOT REVIEWED` | 0 |

The four routes not requiring their own screenshot mapping row are: `/` (redirect to login), legacy `/admin/projects/[projectId]/jobs/[jobId]/shifts/bulk-new` (redirect), `/admin/settings` (placeholder/skip), and the shared redirect handling represented in the route inventory. They remain in the 31-route audit population and are not silently dropped.

## Shared Shell Mapping

### Admin shell

- Implementation baseline uses an expanded fixed left sidebar, top header, role/user control, grouped navigation, and desktop-first main content. The inspected dashboard screenshot shows the same overall shell family as Figma `464:2` (expanded) more than `459:3284` (collapsed).
- Figma component sources include Admin Sidebar `191:91`, newer Admin Sidebar `755:473`, navigation item `752:9`, and Admin Header `796:36`.
- Route-level Figma screens vary between collapsed and expanded sidebar variants. This is a shell variance, not evidence that routes differ semantically.
- Implementation includes current navigation labels (`ヘルプリクエスト`, `お知らせ`, master links) that do not map one-to-one to older Figma communication group labels.

### Worker shell

- Implementation is mobile-first with a compact header, Announcement entry and Bell/Notification entry kept separate. The captured Notification Inbox visibly preserves this separation.
- Figma includes Mobile Full-screen Navigation `282:91`, Worker Sidebar `275:170`, Worker desktop shell examples `282:118` / `339:193`, and a support Announcement quick entry `338:85`.
- Figma `339:251` is a desktop Support-hub Announcement region, not a standalone `/worker/announcements` list and not the mixed Notification Inbox.

## Figma-only Inventory

The following are notable Figma concepts without a matching production route/state in the audited implementation. This list is intentionally broader than the 51-row matrix because it records surplus design intent.

| Figma Node | Frame | Classification / note | Human Review |
| --- | --- | --- | --- |
| `29:2` / `383:3413` | multi-venue project detail variants | Figma-only variant; implementation has one authorized Project hub route | NOT REVIEWED |
| `505:352` | Shift Week view | Figma-only state in the current 51-target baseline | NOT REVIEWED |
| `517:14` | Placement Staff Picker open | Figma-only/uncaptured state candidate | NOT REVIEWED |
| `501:2974` | Shift Edit / Legacy | Legacy / Obsolete Candidate; Figma itself labels it Legacy | NOT REVIEWED |
| `116:2` | broadcast creation | Figma-only; separate Broadcast/External Delivery domain | NOT REVIEWED |
| `118:2` | delivery history | Figma-only; no audited Announcement production route | NOT REVIEWED |
| `121:2`, `121:268`, `122:211`, `122:396` | knowledge screens | Figma-only relative to current route inventory | NOT REVIEWED |
| `553:1363`, `553:1621`, `553:1847`, `601:7` | monthly/expense/closing screens | Figma-only relative to current route inventory | NOT REVIEWED |
| `123:2`, `123:364`, `123:540`, `123:696`, `123:868`, `123:1022` | settings and audit log | Figma-only; implementation `/admin/settings` is only a placeholder | NOT REVIEWED |
| `245:83`, `246:108`, `248:134`, `249:162`, `278:*` | Worker recruitment | Figma-only relative to audited Worker routes | NOT REVIEWED |
| `188:2`, `280:14`, `280:39` | Worker shift list tabs | Figma-only route family; current Worker home/detail architecture differs | NOT REVIEWED |
| `230:4`, `230:36`, `230:68` | My Page/profile/notification settings | Figma-only relative to audited Worker routes | NOT REVIEWED |
| `281:14`, `281:35`, `281:56`, `281:77` | FAQ/manual/rules | Figma-only relative to audited Worker routes | NOT REVIEWED |

## Implementation-only Inventory

| Implementation target | Why no direct Figma mapping | Human Review |
| --- | --- | --- |
| Login and account error | inspected Figma pages contain no auth screen root | NOT REVIEWED |
| Dedicated Admin Incident list/drawer | Figma has broader `連絡` inbox/detail, not the frozen Incident operations UI | NOT REVIEWED |
| Mixed Incident + Announcement Notification Inbox | Figma has support and Announcement content, but no recipient-owned mixed attention list/drawer contract | NOT REVIEWED |
| Archived Announcement detail | no dedicated archived read-only Figma state | NOT REVIEWED |
| Announcement/Notification safe unavailable states | no dedicated Worker source-unavailable frame | NOT REVIEWED |
| Announcement list empty state | no dedicated Worker Announcement list/empty frame | NOT REVIEWED |
| Attendance revision dialog | Figma shows revised result state, not the same dialog-open state | NOT REVIEWED |
| Placement conflict capture | common Conflict component exists, but no dedicated captured implementation screenshot; screenshot is NOT AVAILABLE | NOT REVIEWED |

## Ambiguous and Legacy Candidates

- `117:233` is visually an Announcement editor but its original intent includes published editing, target/period editing, channel controls, view metrics, and unpublish. The production contract permits draft editing only and makes published content immutable. Therefore it is a useful structural reference for draft edit, but a **Legacy / Obsolete Candidate** for published detail.
- `109:2` and `110:2` model a broad communication inbox/detail. Current `/admin/incidents` is a narrow Help Request/Incident operations surface. These are Partial mappings and must not be treated as route identity.
- `229:84` is a standalone SOS/inquiry composition. Current Help Request is embedded in owned Assignment detail; its mapping is conceptual only.
- `229:4`, `338:85`, and `339:251` establish Announcement discovery inside Support. They do not establish the production standalone Announcement list or Notification Inbox.
- `602:48` is a generic conflict component. It can inform the missing placement-conflict state, but it is not proof of that screen's full composition.

## Known Intentional Deviations — Announcement

These differences are frozen product/domain decisions, not findings to “fix” in this phase.

| Figma intent | Production implementation | Mapping consequence |
| --- | --- | --- |
| published content/target editing | published Announcement immutable | `117:233` cannot be an Exact published-detail mapping |
| scheduled publish | publish-now only | omitted intentionally |
| expiration / deadline | no expiration lifecycle | omitted intentionally |
| mandatory read / read analytics / view count | Announcement itself has no read state; attention read state belongs to Notification | omitted intentionally |
| Push and LINE delivery/channel controls | in-app Announcement/Notification only | omitted intentionally |
| sender ownership/display snapshot | actor is audit metadata, not Announcement owner | omitted intentionally |
| category, pin, badges | only `normal` / `important` importance in MVP | omitted intentionally |
| broad or condition-based targeting | only organization active Workers or authorized branch active Workers, snapshotted on publish | adapted intentionally |

The implemented Admin Announcement UI adapts `117:2`, `117:233`, and `119:2` only where consistent with the frozen domain. The implemented Worker detail adapts `229:37` for title, body, importance and publication date; Figma deadline, target, sender and extra CTA concepts are intentionally absent.

## Notification Boundary

The production `/worker/notifications` screen is a mixed recipient-owned attention inbox for Incident and Announcement projections. It owns unread/read state and resolves a source only after explicit detail open. Figma contains:

- Announcement content/discovery (`229:37`, `338:85`, `339:251`),
- SOS/inquiry content (`229:84`), and
- a broader Admin communication inbox/detail (`109:2`, `110:2`).

None is the same as the mixed Worker Notification Inbox. Accordingly the Inbox rows are Partial or Implementation-only, while `/worker/announcements/[announcementId]` → `229:37` is Strong. This separation preserves the product boundary between “通知” (attention projection) and “お知らせ” (canonical content).

## Screenshot Gap

- `admin-placement-conflict-desktop.png`: **NOT AVAILABLE** from AUDIT-3.0A-2.
- Figma-side references: placement editor `515:431` and common Conflict state `602:48`.
- Mapping: Partial / Medium because the two Figma references establish the editor and generic conflict treatment separately, not a composed conflict screenshot.
- This is a local evidence gap, not a blocker for completing the 51-target mapping inventory. It remains a comparison limitation for the next visual review phase.

## Mapping Gaps and Handoff

### Gaps carried forward

- One screenshot unavailable: placement conflict.
- No Figma auth screens.
- No dedicated Figma mixed Notification Inbox, Announcement unavailable states, Worker Announcement list/empty state, or archived Admin detail.
- Incident mappings rely on older broad communication/SOS concepts.
- Some dialog/drawer implementation states map only to a page/result frame, not an exact open-state frame.
- Figma contains substantial route families outside the implemented 31-route inventory.

### AUDIT-3.0A-4 readiness

The mapping is ready for human visual review because every screenshot target is addressable and every uncertainty is explicit. A-4 should compare only rows with AVAILABLE screenshots, preserve all `NOT REVIEWED` statuses until a human review action occurs, and treat the placement conflict row as pending evidence. It must keep intentional Announcement deviations separate from visual discrepancy findings.

## Integrity and Non-Changes

- Existing A-1/A-2 files and 50 PNGs: unchanged.
- Figma: read-only inspection; no node, component, variable, style, comment, or metadata mutation.
- UI/code/routes: unchanged.
- DB/migrations/RLS/GRANT/Auth/fixtures: unchanged.
- Packages/lockfiles: unchanged.
- Browser product state: unchanged.
- Remote environments: unchanged.
- Commit/push: 0.
- Existing uncommitted work: preserved.

## Final Status

- **AUDIT-3.0A-3: COMPLETE WITH MAPPING GAPS**
- **AUDIT-3.0A-4: READY**
