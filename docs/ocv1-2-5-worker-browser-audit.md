# OpsCue Phase 2.5 — Worker Browser Audit

Status: `BROWSER AUDIT COMPLETE WITH DOCUMENTED LIMITS`

Audit date: 2026-09-30  
Environment: local Next.js (`http://127.0.0.1:3000`) + local Supabase only  
Browser: installed Google Chrome, automated through Playwright and independently spot-checked in the Codex in-app browser  
Account: existing fixed local test Worker (`TEST Worker A`); no Auth or business fixture was created, updated, or deleted

## 1. Scope and safety

The ten requested Worker routes were opened as an authenticated Worker and captured at 390x844. The six primary work surfaces were also captured at 1280x900 and 1440x900.

The audit was read-oriented. It did not:

- apply to or withdraw from a Shift;
- record pre-shift, Wake, Departure, Arrival, Attendance, or Incident facts;
- link/unlink LINE or change Reminder consent;
- open an inbox item through its mutation-backed drawer, because that action marks it read;
- create/update/delete Auth or database fixtures;
- contact remote Supabase, AWS, or the real LINE Provider.

A recipient-owned Notification detail was verified by direct local URL without changing read state. A missing Announcement and a missing Notification were also captured as safe unavailable states.

## 2. Result summary

| Check | Result |
|---|---|
| Requested routes | 10/10 opened |
| 390x844 screenshots | 10 route screens + 1 additional Notification unavailable state |
| 1280x900 screenshots | 6 primary screens |
| 1440x900 screenshots | 6 primary screens |
| Total screenshots | 23 |
| HTTP status | All audited requests returned 200 |
| Horizontal overflow | 0px on all 22 matrix captures |
| Console errors/warnings | 0 |
| React errors | 0 |
| Hydration errors | 0 |
| Failed requests / HTTP >= 400 | 0 |
| Keyboard focus traversal | Completed on every captured route |
| Browser Back | `/worker/recruitment` → Back → `/worker`, PASS |
| Long-page scroll | Worker Home moved to `scrollY=2488`, PASS |

The screenshots include the Next.js development indicator at the lower-left. It is a local development artifact, not Worker product UI.

## 3. Screenshot inventory

### 3.1 Mobile — 390x844

| Screen / state | Screenshot | Notes |
|---|---|---|
| Worker Home / normal | [home__normal__390x844.png](screenshots/worker-audit/home__normal__390x844.png) | Next action plus a very long Shift history. |
| Recruitment list / normal, mixed application states | [recruitment-list__normal__390x844.png](screenshots/worker-audit/recruitment-list__normal__390x844.png) | Withdrawn, rejected, accepted-waiting, unavailable and other controlled states are visible in the fixture. |
| Recruitment detail / withdrawn | [recruitment-detail__normal__390x844.png](screenshots/worker-audit/recruitment-detail__normal__390x844.png) | Non-mutating state; no reapply control. |
| Assignment detail / confirmed, journey partially not-required | [assignment-detail__empty-or-partial__390x844.png](screenshots/worker-audit/assignment-detail__empty-or-partial__390x844.png) | Timeline, pre-shift, Attendance and help section present. |
| Availability / no intervals | [availability__empty-or-partial__390x844.png](screenshots/worker-audit/availability__empty-or-partial__390x844.png) | Empty interval state plus editable Work Conditions form. |
| Notification inbox / normal | [notifications__normal__390x844.png](screenshots/worker-audit/notifications__normal__390x844.png) | Multiple unread Reminder notifications. |
| Notification deep-link detail / own | [notification-detail__normal__390x844.png](screenshots/worker-audit/notification-detail__normal__390x844.png) | Safe title/summary and Assignment source CTA. |
| Notification deep-link / unavailable | [notification-detail__unavailable__390x844.png](screenshots/worker-audit/notification-detail__unavailable__390x844.png) | Missing/foreign-safe wording; no data disclosure. |
| Announcement list / empty | [announcements__empty-or-partial__390x844.png](screenshots/worker-audit/announcements__empty-or-partial__390x844.png) | No published announcement for this Worker. |
| Announcement detail / unavailable | [announcement-detail__unavailable__390x844.png](screenshots/worker-audit/announcement-detail__unavailable__390x844.png) | Controlled unavailable state. |
| LINE settings / unlinked, consent OFF | [line-settings__normal__390x844.png](screenshots/worker-audit/line-settings__normal__390x844.png) | Buttons were observed only; no provider action. |

### 3.2 Desktop — 1280x900

- [Worker Home](screenshots/worker-audit/home__normal__1280x900.png)
- [Recruitment list](screenshots/worker-audit/recruitment-list__normal__1280x900.png)
- [Recruitment detail](screenshots/worker-audit/recruitment-detail__normal__1280x900.png)
- [Assignment detail](screenshots/worker-audit/assignment-detail__empty-or-partial__1280x900.png)
- [Availability](screenshots/worker-audit/availability__empty-or-partial__1280x900.png)
- [Notifications](screenshots/worker-audit/notifications__normal__1280x900.png)

### 3.3 Desktop — 1440x900

- [Worker Home](screenshots/worker-audit/home__normal__1440x900.png)
- [Recruitment list](screenshots/worker-audit/recruitment-list__normal__1440x900.png)
- [Recruitment detail](screenshots/worker-audit/recruitment-detail__normal__1440x900.png)
- [Assignment detail](screenshots/worker-audit/assignment-detail__empty-or-partial__1440x900.png)
- [Availability](screenshots/worker-audit/availability__empty-or-partial__1440x900.png)
- [Notifications](screenshots/worker-audit/notifications__normal__1440x900.png)

## 4. Screen-by-screen audit

### 4.1 `/worker`

Observed:

- current/upcoming, past, and terminal group structure;
- the first card promotes “今対応するAction”; later cards use “次のAction”;
- 50 Assignment detail links existed in the fixture;
- page height was 11,717px at 390px width.

Issues:

- P0: the mobile header consumes most of the horizontal space. Worker name is truncated, icon meanings are not visible without accessible names, and Logout wraps to two lines.
- P0: fifty Assignments make one page extremely long. There is no bounded pagination, collapse, or “recent history” limit at the UI layer.
- P1: `Worker`, `My Shifts`, and `Action` mix English with Japanese UI.
- P1: the first actionable Shift is prominent, but the page remains a Shift archive and next-action home at the same time.
- P2: desktop uses the same narrow `max-w-3xl` column, leaving large unused space rather than presenting a more scannable desktop summary.

### 4.2 `/worker/recruitment`

Observed:

- 14 visible detail links;
- multiple application/eligibility states shown without exposing internal facts;
- cards remain readable at all three widths.

Issues:

- P0: no search, date filter, status grouping, or quick filter despite a 5,177px mobile page.
- P1: unavailable and completed application states occupy the same continuous list as actionable work; scanning for “応募できる” work is slow.
- P1: deadline and fixture dates are visually secondary even though they determine actionability.
- P2: desktop does not use additional width for filters or a denser two-column layout.

### 4.3 `/worker/recruitment/[shiftId]`

Observed:

- explicit “募集中の勤務へ戻る” link;
- safe withdrawn state, controlled conflict reason, deadline/capacity snapshot;
- work and compensation sections; no active mutation for withdrawn state.

Issues:

- P1: Project, Job, state, date, conflict, deadline and remaining capacity compete without one compact decision summary.
- P1: unavailable reason and application state should be grouped into a single “応募可否” summary above secondary detail.
- P1: compensation displays “未設定”; the product needs a deliberate policy for whether unpublished compensation is acceptable or blocks recruitment publication.
- P2: the semantic-token design differs from the LINE/Notification/Availability surfaces.

### 4.4 `/worker/assignments/[assignmentId]`

Observed:

- one Shift detail contains preparation, pre-shift response, canonical Timeline, next action, Attendance, Incident/SOS, and conditions;
- Arrival is visually described as separate from Attendance;
- the safe fixture state had Wake/Departure not required and Arrival not yet open.

Issues:

- P0: no explicit “勤務一覧へ戻る” action; return depends on the header brand or browser Back.
- P0: the page is 2,449px tall at mobile width and the next action is below preparation and pre-shift cards. “One Shift, One Timeline” exists, but “next action first” is not fully achieved.
- P1: `勤務詳細` is a small eyebrow rather than a strong context/breadcrumb.
- P1: Timeline, Attendance, and Help are correctly separate domains but visually have equal weight; current urgency is not sufficiently dominant.
- P1: hidden dialog controls are part of the DOM/focusable inventory; dialog closed-state focusability should be verified outside dev instrumentation.

### 4.5 `/worker/availability`

Observed:

- explicit dated intervals and “登録なし＝不明” explanation;
- Work Conditions are clearly described as informational;
- form controls were keyboard reachable.

Issues:

- P0: this is both interval management and preference/profile editing, but has no local sub-navigation or save-state overview.
- P1: at 390px, native date-time inputs and seven weekday checkboxes create a long form with weak section progress.
- P1: the minimum measured native interactive box was 13px because of checkboxes. Label hit areas appear available, but effective 44px target and focus indication need a dedicated accessibility check.
- P1: no unsaved-change warning was exercised or visibly discoverable.
- P2: desktop keeps a narrow single-column editor despite room for current registrations beside the edit form.

### 4.6 `/worker/notifications`

Observed:

- unread count 31 and bounded initial list with “もっと見る”;
- type, unread state, summary, and time are visible;
- LINE settings is discoverable from this screen;
- inbox item opening is a mutation-backed drawer that marks the item read.

Issues:

- P0: repeated Reminder notifications with identical titles dominate the inbox. Grouping by Assignment/logical reminder or stronger date/Shift context is needed without changing immutable history.
- P0: “open” and “mark read” are one action. That is canonical today, but it prevented a strictly read-only drawer audit and should remain explicit in UX/test language.
- P1: notification rows are buttons while external LINE deep links use a dedicated page; the two detail presentations differ.
- P1: Shift/Project context is not shown in the list, making repeated Reminder rows difficult to distinguish.
- P2: desktop remains one long narrow list and does not use a master/detail option.

### 4.7 `/worker/notifications/[notificationId]`

Observed:

- recipient-owned Notification displayed without changing its read state;
- safe summary and one controlled source CTA;
- missing/non-owned-like UUID produced the same safe unavailable screen;
- no Worker/Branch/Assignment authorization data appeared in the URL.

Issues:

- P1: the valid detail has no explicit “通知一覧へ戻る” action, while the unavailable state does.
- P1: dedicated page and inbox drawer should share one visual detail component while retaining the stable C1/C2 route.
- P2: source CTA is visually dominant, but there is no secondary route back to the inbox.

### 4.8 `/worker/announcements`

Observed:

- useful empty-state explanation;
- no published items for the authenticated fixture.

Issues:

- P1: Notification and Announcement are separate header icons, but their difference is not explained in navigation.
- P1: with no normal item available, list hierarchy, importance badge, pagination, and detail navigation remain unverified in this run.
- P2: the large empty area is acceptable, but a Support/Inbox hub could explain where operational notices versus durable announcements live.

### 4.9 `/worker/announcements/[announcementId]`

Observed:

- controlled unavailable state and explicit list return;
- no information leakage.

Issues:

- normal detail could not be audited because no authorized published Announcement existed.
- unavailable state uses a compact card while the normal design remains unverified.

### 4.10 `/worker/settings/line`

Observed:

- unlinked destination, Reminder consent OFF, and safe-linking explanation;
- link and consent are visibly separate concepts;
- all controls were only observed, not activated.

Issues:

- P0: the page is reachable from Notifications but not from a persistent Profile/Settings destination.
- P0: “LINEリマインダーをONにする” appears as an enabled primary button while the explanatory text says linking/friendship is required. The eventual controlled failure is less clear than disabling the action with prerequisite guidance.
- P1: link and consent buttons share the same dominant dark style, weakening action hierarchy.
- P1: no explicit return to Notification settings/inbox.

## 5. Navigation and reachability

### Directly reachable from the persistent header

- Worker Home
- Recruitment
- Availability / Work Conditions
- Announcements
- Notifications
- Logout

### Reachable only through content

- Assignment detail: Home card.
- Recruitment detail: Recruitment card.
- LINE settings: Notification page link.
- Announcement detail: Announcement item, but no item existed in this fixture.
- Notification dedicated detail: intended as the stable external/LINE deep-link route; inbox items currently open a separate drawer instead.

### Implemented but not discoverable as a named navigation item

- My Shifts is the Worker Home content rather than a separate named navigation destination.
- Incident/SOS is inside Assignment detail only.
- LINE settings has no profile/settings navigation.
- There is no Worker Support hub or My Page matching the current Figma product map.

## 6. Responsive and accessibility findings

### Responsive

- All measured routes had 0px document-level horizontal overflow at 390, 1280, and 1440 widths.
- Mobile cards stack safely and text wraps rather than overflowing.
- The header technically fits at 390px but is visibly compressed: name truncation, icon-only destinations, and wrapped Logout make it the largest cross-screen issue.
- Desktop pages remain capped at approximately the mobile content width. This is readable but underuses desktop space for lists, filters, timelines, and forms.

### Keyboard

- Tab focus reached the brand/home link, all four header destinations, Logout, and page controls on every route.
- Browser Back returned correctly to Worker Home.
- Primary recent controls were 44px high; native Availability checkbox boxes measured smaller and need label-target verification.
- No action that would write data was activated with Enter/Space.
- Dialog focus trap/return and pending focus behavior were not exercised because opening Notification/Incident actions would mutate state.

## 7. Important states captured and not captured

Captured safely:

- normal Home, recruitment list/detail, Assignment detail, Notifications, Notification deep-link, and LINE settings;
- mixed Application statuses in the Recruitment list;
- withdrawn Recruitment detail;
- Availability empty interval state;
- Announcement empty list;
- Notification and Announcement safe unavailable states;
- unlinked LINE with consent OFF;
- journey state where Wake/Departure are not required and Arrival is not yet open.

Not captured:

- loading/skeleton states: local server responses completed too quickly and no request interception was introduced;
- general server error states: deliberately breaking local reads would not represent a normal browser run;
- pending Apply/Withdraw/Journey/Attendance/Incident/LINE consent UI: activation would mutate data or contact the Provider;
- Notification drawer loading/detail: opening it marks the Notification read;
- Announcement normal detail: fixture had no authorized published Announcement;
- linked_available / linked_unavailable / consent ON LINE states: would require link/consent fixture mutation or real Provider interaction;
- empty Home, empty Recruitment, empty Notification inbox: the existing Worker had data and fixtures were not changed;
- unauthenticated Notification login continuation: this run focused on authenticated Worker screens and did not destroy the active session.

## 8. Prioritized UI/UX problem list

| Priority | Finding | Affected screens |
|---|---|---|
| P0 | Replace compressed icon-header navigation with a coherent Worker mobile navigation and named Profile/Settings entry | All Worker screens |
| P0 | Bound/collapse the 50-item, 11,717px Worker Home history | Home |
| P0 | Put current next action before secondary preparation/history content | Assignment detail |
| P0 | Add recruitment filtering/grouping for actionable versus unavailable/application-history states | Recruitment list |
| P0 | Distinguish repeated Reminder notifications with Shift context/grouping | Notifications |
| P0 | Make LINE consent prerequisite state obvious before an apparently enabled CTA | LINE settings |
| P1 | Standardize Japanese terminology and semantic design tokens | Home, Recruitment, Assignment |
| P1 | Add consistent explicit return/navigation actions to retained detail pages | Assignment, Notification, LINE |
| P1 | Unify Notification drawer and deep-link detail presentation without removing the deep-link route | Notifications |
| P1 | Clarify Notification versus Announcement responsibilities | Header, Notifications, Announcements |
| P1 | Verify checkbox hit targets, form error summary, unsaved state and dialog focus behavior | Availability, mutation surfaces |
| P2 | Use desktop width for list/filter or master-detail layouts where it improves scanning | Home, Recruitment, Notifications, Availability |

## 9. Recommended comparison baseline for future Figma upload

Use the 390x844 screenshots as the primary Worker baseline. Compare Figma in this order:

1. global Worker shell/header/navigation;
2. Home next-action priority and history bounding;
3. Recruitment actionable-state scanning;
4. one-Shift Timeline/action hierarchy;
5. Inbox/Announcement/Support responsibility;
6. Profile/Availability/LINE settings grouping;
7. common empty, unavailable, pending, error and focus states;
8. desktop adaptation at 1280/1440 rather than simple centered mobile width.

Do not interpret a visual difference as authorization to change Application, Assignment, Journey, Attendance, Notification, LINE identity/consent, deep-link, or RLS contracts.

## 10. Explicit non-changes

- No application source, package, migration, schema, AWS, Supabase, LINE, Scheduler, or provider state changed.
- No Worker action or Notification read mutation was performed.
- No QA fixture was created, updated, or removed.
- Existing dirty worktree and `.tmp-notif-2c-local.*` were preserved.
- No commit or push was performed.
