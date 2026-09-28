# OCV1-07C0 — LINE Delivery Contract Freeze

## 0. Status and authority

**OCV1-07C0: CONTRACT FROZEN**

This document freezes the OpsCue V1 contract for linking a Worker to LINE and delivering already-created Reminder Notifications through LINE. It creates no schema, migration, route, UI, provider call, credential, or remote change.

Canonical authority remains:

1. OCV1-07A decides whether a Reminder is due and creates the immutable occurrence plus `public.in_app_notifications`.
2. OCV1-07B invokes that evaluator and records scheduler execution evidence.
3. OCV1-07C may deliver an existing Notification. It never creates or reinterprets operational facts.

LINE is only a notification and entry channel. OpsCue remains the operational source of truth.

## 1. Current-state audit

The repository currently has:

- recipient-owned `public.in_app_notifications` with controlled title/summary;
- one canonical scheduled occurrence for each Assignment, Reminder type, and phase;
- Worker-only Notification RLS and type-specific safe source resolvers;
- authenticated `/worker/notifications` and Assignment detail routes;
- a trusted every-minute database scheduler with no browser or service-role entry point;
- no LINE channel, identity link, consent setting, webhook, provider credential, external outbox, external attempt history, or direct Notification route;
- no safe post-login continuation: the current login always routes a Worker to `/worker`.

Therefore OCV1-07C must add a narrow LINE boundary and a validated login continuation, but must not replace the Notification or Reminder domains.

## 2. V1 LINE channel topology

V1 uses:

- one LINE Login channel;
- one LINE Official Account / Messaging API channel;
- both channels under the **same LINE Provider**;
- the Official Account linked to the LINE Login channel;
- push message delivery to a one-to-one LINE user destination.

LINE issues the same user ID across LINE Login and Messaging API channels only when the channels belong to the same Provider. This topology is therefore a deployment prerequisite, not an optional convention. Channels must not be created under separate Providers and reconciled by display name, phone number, or email.

LIFF is not required for V1. LINE's Messaging API account-link feature is also not used for initial linking because the Worker can initiate LINE Login from an already-authenticated OpsCue session. LINE Login provides the smaller flow while still proving control of the LINE identity.

References: [LINE user ID scope](https://developers.line.biz/en/docs/messaging-api/getting-user-ids/), [provider/channel management](https://developers.line.biz/en/docs/line-developers-console/best-practices-for-provider-and-channel-management/), [LINE Login integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/).

## 3. Worker ↔ LINE identity contract

### 3.1 Cardinality

V1 freezes these invariants:

- one active OpsCue Worker may have **zero or one** linked LINE destination;
- one LINE Provider-scoped user ID may be actively linked to **zero or one** OpsCue Worker;
- group IDs, room IDs, phone numbers, LINE search IDs, display names, email addresses, and profile names are never destinations or ownership proof;
- an existing link is never silently moved to another Worker.

Both active-Worker uniqueness and LINE-user uniqueness must be database-enforced in OCV1-07C. A collision returns one controlled, non-disclosing error. It must not reveal which Worker owns the other link.

### 3.2 Canonical identities

- OpsCue side: authenticated active Worker profile derived from the server session.
- LINE side: verified OpenID Connect `sub` from the configured LINE Login channel.
- Push destination: that same Provider-scoped LINE user ID, usable by the Messaging API channel only because the channels share a Provider.

The LINE user ID is private delivery data. It must live only in a private/server-only persistence boundary and must never be copied into `in_app_notifications`, occurrence rows, browser payloads, logs, URLs, or Admin screens.

### 3.3 Link lifecycle

Conceptual link states are:

- `linked_available`: identity verified and Official Account friendship currently available;
- `linked_unavailable`: identity verified, but friendship/destination is currently unavailable;
- `suspended`: Worker is inactive or delivery is administratively disabled by canonical Worker lifecycle;
- `unlinked`: no active identity association.

These are LINE-link facts, not Worker, Assignment, Notification, or journey states.

An inactive Worker is immediately ineligible for external delivery. Deactivation suspends the link and turns external Reminder enablement off. Reactivation does not silently re-enable delivery; the Worker must explicitly enable it again. Hard Worker/profile deletion removes the live destination and outstanding linking sessions, and terminalizes pending/retryable delivery state without deleting immutable attempt evidence. Attempt history must not retain the raw LINE user ID.

### 3.4 Unlink

Only the authenticated Worker may unlink their own destination. Unlink is always available and takes effect immediately:

- external Reminder enablement becomes false;
- the live LINE destination is removed from future claims;
- pending/retryable deliveries become `terminal_failure` with controlled reason `destination_unlinked`;
- delivered history and in-app Notifications remain unchanged;
- unlink does not mark Notifications read and does not mutate LINE's own consent or automatically block/unfriend the Official Account.

Admin manual linking, destination entry, reassignment, or impersonation is forbidden. Support may explain recovery but may not assert ownership on behalf of a Worker.

## 4. Linking flow

### 4.1 Initiation

1. An authenticated, active OpsCue Worker chooses `LINEを連携` from a Worker-owned settings surface.
2. The server derives the Worker from the current session; the client sends no Worker ID or LINE destination.
3. The server creates a single-use linking transaction containing only a random opaque state hash, random OIDC nonce hash, Worker identity, created/expiry timestamps, and used/cancelled state.
4. Transaction lifetime is **10 minutes**. A Worker may have only one active linking transaction; starting another invalidates the previous one.
5. The server redirects to LINE Login with `response_type=code`, exact registered callback URI, `state`, `nonce`, `scope=openid profile`, and `bot_prompt=aggressive`.

`profile` is requested only because LINE's friendship-status endpoint requires it. OpsCue does not persist display name, profile image, status message, email, LINE access token, or refresh token.

### 4.2 Callback and ownership proof

The server callback must:

1. require a normal authenticated OpsCue session;
2. require that the session is the same active Worker bound to the linking transaction;
3. compare `state` exactly and atomically consume the single-use transaction;
4. reject expired, missing, cancelled, already-used, or replayed transactions;
5. exchange the one-time authorization code server-side using the exact registered callback URI;
6. validate the ID token signature and `iss`, `aud`, `exp`, and stored `nonce` before accepting `sub`;
7. call LINE's friendship-status endpoint server-side using the short-lived access token;
8. enforce both uniqueness invariants before activating the link;
9. discard the authorization code, access token, refresh token, and ID token after the callback completes.

The authorization code is single-use and LINE documents a 10-minute validity. `state` protects the OAuth response and `nonce` binds the ID token against replay. See [LINE Login authorization flow](https://developers.line.biz/en/docs/line-login/integrate-line-login/) and [LINE Login API verification](https://developers.line.biz/en/reference/line-login/).

`friendFlag=true` produces `linked_available`. `friendFlag=false` may still complete identity linking as `linked_unavailable`, but the Worker cannot enable LINE Reminders until the Official Account is added/unblocked and a verified `follow` event or a fresh linking check establishes availability. `friendship_status_changed` alone is not proof of current availability because `false` has multiple meanings; the server must use the friendship-status API.

If the OpsCue session expired during LINE Login, no link is committed. The Worker must authenticate normally and restart linking. V1 does not carry a half-authenticated link across sessions.

## 5. Consent and effective enablement

Identity linking and external Reminder consent are separate facts.

- A successful link defaults `external_reminders_enabled` to **false**.
- Only the authenticated Worker may enable or disable their own LINE Reminders.
- Enabling is allowed only when the Worker is active and the link is `linked_available`.
- Disabling is immediate and does not unlink the account.
- Linking, re-linking, follow, or unblock never silently enables Reminders.
- In-app Notification creation and display continue regardless of link or consent state.

Effective LINE delivery eligibility at enqueue/claim time requires all of:

1. Notification type is one of `pre_confirmation_reminder`, `wake_reminder`, `departure_reminder`, or `arrival_reminder`;
2. Notification was created at or after the current enablement timestamp;
3. recipient is still an active Worker;
4. one active `linked_available` destination exists;
5. external Reminders are enabled.

No historical backfill occurs after link, re-link, re-enable, follow, or unblock. Notifications created while unlinked, disabled, inactive, or unavailable remain in-app only.

## 6. Provider credentials

Server-only secrets are:

- LINE Login channel secret;
- Messaging API channel access token;
- Messaging API channel secret used for webhook signature verification;
- any future credential used to rotate or issue a channel access token.

They may exist only in the production hosting platform's encrypted server secret store and the corresponding server/Edge Function environment. They may not exist in:

- `NEXT_PUBLIC_*` variables or client JavaScript;
- Worker/Admin pages, props, actions, or browser network responses;
- database Notification, occurrence, link, delivery, attempt, or webhook receipt rows;
- URLs, query strings, cookies, provider request logs, test snapshots, or repository files.

The non-secret channel ID and callback URL are configuration, but V1 should still keep them server-side unless a browser redirect builder specifically needs the channel ID. No Supabase `service_role` key is needed in a browser or product client. External delivery should use a narrow trusted database claim/complete boundary rather than general privileged table access.

## 7. Canonical delivery source

Every LINE delivery starts from one existing `public.in_app_notifications` row. For scheduled Reminders it must also retain the valid scheduled occurrence relation already enforced by OCV1-07A.

The LINE layer may read only:

- Notification ID;
- recipient identity needed for server-side destination lookup;
- controlled Notification type;
- controlled title;
- controlled summary;
- created timestamp;
- stable source relation required to construct the safe OpsCue entry URL.

It must not decide or recalculate:

- whether a Reminder is due;
- `approaching` / `overdue` phase;
- cooldown;
- Worker eligibility;
- Assignment or Shift lifecycle;
- journey completion or supersede;
- Notification title or summary.

No LINE delivery is created for Incident or Announcement Notifications in V1 unless a later named contract explicitly adds those types.

## 8. Minimal LINE delivery state

OCV1-07C must add a LINE-specific, not generic multi-provider, delivery boundary.

### 8.1 Delivery row

Exactly one logical LINE delivery may exist for one Notification:

```text
unique(notification_id, channel = LINE)
```

The persisted state vocabulary is exactly:

- `pending`
- `delivered`
- `retryable_failure`
- `terminal_failure`

The row owns one stable random UUID-form LINE retry key, created before the first request and reused for every retry of that logical delivery. It also owns attempt count, `next_attempt_at`, lease token/expiry, final timestamp, and one controlled terminal/retry reason code. It does not own Notification content or the LINE user ID.

`delivered` means the LINE Platform accepted the request or reported that the same retry key had already been accepted. It does not prove display, device push, or reading by the Worker.

### 8.2 Claim / lease

A trusted dispatcher claims a bounded batch using database server time and row locking equivalent to `FOR UPDATE SKIP LOCKED`.

- claimable: `pending`, or `retryable_failure` with `next_attempt_at <= now()`;
- lease: **60 seconds**;
- completion requires the exact delivery ID plus lease token;
- expired lease is reclaimable;
- two dispatchers must not hold the same live lease;
- before returning a claim, the database rechecks active Worker, current link, availability, and consent;
- loss of those gates terminalizes the delivery without a provider call.

Provider/network work occurs outside the database transaction. Claim and completion commands are narrow trusted-server operations; browser, Worker, Admin, anon, and ordinary service-role product paths cannot invoke them.

### 8.3 Retry schedule

Maximum attempts: **4 total**.

```text
attempt 1: immediately after enqueue
attempt 2: 1 minute after retryable failure
attempt 3: 5 minutes after retryable failure
attempt 4: 15 minutes after retryable failure
```

All attempts use the same `X-Line-Retry-Key`. LINE retains retry-key deduplication for 24 hours, so no retry may begin at or after 23 hours from the first attempt. A provider `Retry-After` later than the normal schedule is honored only if it stays inside that 23-hour boundary; otherwise the delivery becomes terminal. Jitter of 0–15 seconds may be added server-side to retry times without changing attempt count.

References: [LINE retry guidance](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/), [Messaging API reference](https://developers.line.biz/en/reference/messaging-api/).

### 8.4 Result classification

| Result | Delivery transition | Controlled reason |
|---|---|---|
| LINE 2xx accepted | `delivered` | `provider_accepted` |
| LINE 409 for the same retry key / accepted request | `delivered` | `provider_already_accepted` |
| network failure, timeout, 408, 429, 5xx | `retryable_failure` if attempts/time remain | `network`, `timeout`, `rate_limited`, `provider_unavailable` |
| retry budget or 23-hour window exhausted | `terminal_failure` | `retry_exhausted` |
| deterministic 4xx other than 408/409/429 | `terminal_failure` | allowlisted `invalid_request`, `invalid_destination`, `provider_forbidden`, or `provider_auth` |
| missing/unlinked/unavailable destination at claim | `terminal_failure` without API call | `destination_unavailable` |
| consent disabled or Worker inactive at claim | `terminal_failure` without API call | `delivery_disabled` |

401/403 is also an operational credential/configuration alert; it must not automatically unlink a Worker. A blocked account may still yield a provider-accepted response, so `delivered` must never be presented as proof that the Worker saw the message.

### 8.5 Immutable attempt history and redaction

Each actual provider request appends one immutable attempt containing only:

- delivery ID and sequential attempt number;
- attempted/completed server timestamps;
- controlled outcome/reason;
- HTTP status when present;
- whether a timeout/network failure occurred;
- opaque LINE accepted-request ID when returned, if operationally required.

Do not persist raw response bodies, request Authorization headers, access tokens, LINE user IDs, message bodies, Worker/Branch/Assignment details, stack traces, or unrestricted provider error strings. Duplicate webhook/delivery responses converge on existing state and do not append a second logical attempt for the same claimed attempt number.

External failure never deletes the Notification, marks it read, mutates journey/Attendance, or resolves Attention.

## 9. LINE message shape

V1 sends one concise text message constructed only from:

1. the existing controlled Notification title;
2. the existing server-derived safe summary;
3. one HTTPS OpsCue entry URL.

No provider-side template may add operational facts. Do not include credential numbers, phone/email, Worker ID, Branch ID, Assignment metadata, workplace private notes, other Shift data, journey version/event IDs, correction history, idempotency keys, or raw source payloads.

V1 does not use Flex Message, rich menu, AI-generated content, reply commands, or LIFF.

## 10. Deep-link authorization

The frozen entry shape is:

```text
/worker/notifications/[opaqueNotificationId]
```

The route flow is:

1. normal OpsCue session authentication;
2. active Worker role check;
3. recipient-owned Notification read through existing RLS/server boundary;
4. existing type-specific safe source resolver;
5. authorized Assignment destination, or controlled safe-unavailable UI.

The path contains only the opaque Notification UUID. It contains no Worker ID, Branch ID, Assignment ID, journey identity, role, scope, signature granting authorization, or source payload. Knowledge of the UUID never grants access.

External delivery does not mark a Notification read. After authenticated recipient authorization, opening the Notification detail may reuse the existing explicit open/mark-read behavior.

### 10.1 Login continuation

The current repository does not preserve a destination through login, so OCV1-07C must add a narrow continuation mechanism.

- preserve only the exact internal Notification path in a short-lived, integrity-protected, HttpOnly, Secure, SameSite=Lax continuation cookie or server-side opaque continuation record;
- allow only `/worker/notifications/{valid UUID}`;
- reject absolute URLs, protocol-relative URLs, encoded path escapes, other roles/routes, and repeated use;
- expire after **10 minutes**;
- after login, re-run normal Worker and recipient authorization before redirecting;
- invalid/expired continuation falls back to `/worker/notifications`;
- never place authorization data or provider credentials in query parameters.

## 11. Webhook boundary

Webhook handling **is required for V1**, but only to keep destination availability safe when a Worker blocks/unblocks or newly follows the Official Account.

Accepted event types:

- `follow`: mark an already-linked matching destination available; never enable Reminders automatically;
- `unfollow`: mark an already-linked matching destination unavailable, turn enablement off, and terminalize pending/retryable deliveries;
- empty `events` array used by LINE webhook verification: acknowledge with no mutation.

All message, postback, read, account-link, join/leave, membership, beacon, and content events are unsupported in V1. After a valid signature they return 2xx and are ignored without storing message content. They never invoke Worker commands.

Before JSON parsing or any mutation, verify `x-line-signature` over the **unaltered raw request body** using HMAC-SHA256 and the server-only Messaging API channel secret. Missing/invalid signature returns non-2xx and performs no write. IP allowlisting is not a substitute because LINE does not publish webhook source IPs. See [LINE webhook signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/).

Webhook events may be redelivered or arrive out of order. Persist only the `webhookEventId` receipt and controlled event type/timestamp needed for idempotency. A duplicate ID is acknowledged without a second mutation. State transitions must compare event timestamps so an older redelivered `unfollow` cannot overwrite a later `follow`. Raw request bodies and message content are not retained. LINE documents `webhookEventId` for duplicate detection and `deliveryContext.isRedelivery` for redelivery context. See [receiving LINE webhooks](https://developers.line.biz/en/docs/messaging-api/receiving-messages).

Webhook receipt or LINE message reading must never record Wake, Departure, Arrival, Attendance, Incident, Application, Assignment, or Notification read state.

## 12. Failure and privacy matrix

| Condition | Required behavior |
|---|---|
| Not linked | no LINE delivery row; in-app Notification remains |
| Linked but disabled | no LINE delivery row; no backfill after enable |
| Linked but destination unavailable | no new LINE delivery; pending/retry terminalized; in-app remains |
| Worker inactive | effective off; link suspended; pending/retry terminalized; explicit re-enable after reactivation |
| Worker deleted | live destination/link transaction removed; pending/retry terminalized; redacted attempt history retained |
| Block/unfollow | verified webhook marks unavailable and disables; accepted historical deliveries unchanged |
| Invalid destination / deterministic provider 4xx | terminal failure; optionally mark unavailable only for an allowlisted destination-invalid code |
| Provider 401/403 | terminal failure plus operator alert; do not unlink Worker automatically |
| Provider 429 | retryable, honor bounded Retry-After |
| Provider 5xx / timeout / network | retryable with same retry key |
| Duplicate 409 for same retry key | delivered/already accepted |
| Unlinked or disabled during retry | terminal without provider call |
| External delivery fails | no Notification deletion/read, no journey/Attention mutation |

Only live link storage contains the LINE user ID. Delivery and attempt history refer to internal link/delivery identities and controlled codes. Unlink/deletion must prevent further resolution of the old destination.

## 13. Security boundary

- Worker identity, link owner, consent, current destination, and timestamps are server-derived.
- Linking callback accepts no Worker ID and Admin cannot create a link.
- LINE secrets and tokens are server-only and absent from browser bundles and database rows.
- Link, consent, delivery, attempt, and webhook receipt tables belong in a private/non-exposed boundary with RLS defense in depth and no runtime Data API grants.
- Worker-facing link/unlink/enable commands are narrow authenticated commands that derive `auth.uid()` and allow only the caller's active Worker record.
- Dispatcher claim/complete commands and webhook mutation functions are not executable by browser roles.
- Webhook mutation authority exists only after raw-body signature verification.
- Direct table writes by Worker/Admin/anon are forbidden.
- No service-role key is exposed to a browser or used as a general product client.

## 14. OCV1-07C implementation implications

OCV1-07C may implement only these bounded pieces:

1. private Worker↔LINE link, one-time linking transaction, consent, delivery, immutable attempt, and webhook-receipt persistence;
2. authenticated Worker link/unlink/enable commands and status projection;
3. LINE Login initiate/callback server routes;
4. authenticated Notification deep-link route and safe login continuation;
5. trusted bounded delivery claim/complete dispatcher using existing Notifications;
6. LINE push call with one stable retry key;
7. signature-verified `follow`/`unfollow` webhook handling;
8. Worker settings UI required to link, unlink, and enable/disable.

Implementation must test uniqueness races, OAuth callback replay, link expiry, cross-Worker collision, consent watermark/no-backfill, concurrent claims, lease expiry, retry-key reuse, timeout/409 behavior, block/unblock ordering, webhook replay, secret absence, deep-link authorization, safe unavailable, and in-app independence.

## 15. Explicit non-changes / out of scope

- no LINE API call, schema, migration, route, UI, webhook, or environment secret in this phase;
- no LINE chat or Worker replies as commands;
- no journey, Attendance, Incident, Assignment, Application, or Attention mutation from LINE;
- no rich menu, Flex Message, LIFF, GPS, email, SMS, push, or multi-provider abstraction;
- no Admin linking, impersonation, or destination entry;
- no phone/display-name/email identity matching;
- no historical Notification backfill;
- no change to OCV1-07A timing/eligibility/cooldown;
- no change to OCV1-07B scheduler cadence;
- no external delivery effect on in-app read state;
- no package, remote service, or remote Supabase change.
