# OPS-1E — Attention Actions & Re-notify Result

## Status

`OPS-1E: COMPLETE`

> Resolution update (OPS-1E.1): the narrow contract described below was frozen in NOTIF-2A, implemented in NOTIF-2B, integrated into the Worker Inbox in NOTIF-2C, and connected to Attention Center in OPS-1E.1. The original architecture audit and rejected-workaround analysis remain below as the historical decision record. Current implementation evidence is in `docs/ops-1e-attention-renotify-actions-result.md`.

## Executive Summary

Attention Centerからpre-confirmation overdue対象へsingle / bulk re-notifyするには、現行Notification v1が持たない新しいsource type、notification type、projection identity、repeat/idempotency contractが必要である。

既存Notification contractだけで安全に実装する方法はない。Announcementをtransactional reminderとして流用すること、Incident/Announcement typeへ偽装すること、Admin UIから直接Notificationをinsertすることはいずれも既存contractと本Phaseの禁止事項に反するため実施していない。

本Phaseではschema、RLS、RPC、Server Action、UIを変更せず、必要なdomain boundaryをFreezeした。

## Existing Architecture Audit

### Attention

- `pre_confirmation_overdue` は `assignmentId` をcanonical source identityとして持つderived Attention。
- activationは既存pre-shift submission windowが開き、Shift開始前かつconfirmation未回答であること。
- confirmation作成、Assignment非active化、またはShift開始で次回readから自動的に消える。
- Notificationのread stateはAttention source predicateへ含まれない。

### Existing Notification Domain

Local PostgreSQLとmigrationを照合した結果、Notification typeは以下の3種に閉じている。

```text
incident_acknowledged
incident_resolved
announcement_published
```

DB-level source invariantは以下のみを許可する。

```text
Incident notification
  -> source_incident_event_id required
  -> source_announcement_id null

Announcement notification
  -> source_incident_event_id null
  -> source_announcement_id required
```

`pre_shift_confirmation`、Assignment reminder、Attentionをsourceとするcolumn/FK/type/function/receiptは存在しない。

既存projection primitiveは以下だけである。

```text
project_incident_in_app_notification(source incident event)
project_announcement_in_app_notifications(announcement)
```

Worker Inboxも同じ3 typeのclosed union、type label、type-specific safe resolverだけを扱う。

## Blocking Domain Gap

### 1. No valid Notification source

pre-confirmation overdueは現在のsource factであり、Incident EventでもAnnouncement publicationでもない。既存source constraintを維持したままNotificationへmappingできない。

### 2. Re-notify needs an occurrence identity

既存projectionはimmutable source identityにつきeffectively-onceである。一方re-notifyは、同じAssignmentが未回答のままでも管理者操作ごとに新しいattention eventを意図する可能性がある。

以下が未定義である。

- 初回通知と再通知を同じitemとしてreplayするか、別itemとして作成するか
- 同一操作のdouble submitと、管理者が後から意図して再実行した操作をどう区別するか
- duplicate identityが `assignment_id`、submission window、admin action occurrence、または別event IDのどれか
- minimum interval / rate limit / repeated reminder ceiling
- notification title/summaryのcontrolled snapshot
- source resolverとcanonical Worker destination

このidentityをUI timestampやclient-generated random keyだけで決めると、duplicate preventionとintentional re-notifyを同時に保証できない。

### 3. Bulk partial-result contract is absent

安全なbulk actionには、authorized eligible targetsをserver-sideで再導出し、各recipientについて以下を安定結果として返すcontractが必要である。

```text
projected
replayed
no_recipient
no_longer_eligible
forbidden / foreign scope hidden
unexpected failure
```

現行RPCはpre-confirmationをsourceとして受けず、このper-target outcomeを返さない。UIだけで複数direct insert/RPCを並べてもatomicity、partial failure、retry safety、scope revalidationを保証できない。

## Security Consequence

既存contractを無理に流用すると以下の危険がある。

- foreign Branch AssignmentへのIDOR/BOLA
- client-supplied recipientによる誤配信
- inactive/unlinked Workerへの送信
- double submitやbulk retryによるunbounded duplicate
- Incident/Announcement source resolverのtype/source invariant破壊
- Worker Inboxからcanonical pre-shift sourceへ安全に遷移できない
- read_atとAttention resolutionの誤結合

Attention ID、assignment ID、recipient profile IDをclientからauthorization hintとして信頼してはならない。

## Unsafe Workarounds Rejected

- `announcement_published`として生成: Announcementはtransactional reminderではなく、本Phaseで明示禁止。
- Incident typeとして生成: source/typeが虚偽となりDB invariantとresolver contractを破壊。
- `in_app_notifications` direct insert: recipient derivation、scope authorization、duplicate preventionを回避するため禁止。
- title/summaryだけ変えて既存sourceを再利用: unique identityに衝突し、read historyを壊す。
- client-side SELECT-before-INSERT: concurrency-safeではない。
- Notification readでAttentionを閉じる: Attentionのsource-derived resolution contract違反。
- Attention table / reminder rowを場当たり的に追加:別Task systemを作るためscope外。

## Minimal Next Phase

新しい狭いNotification domain phaseで、実装前に以下をFreezeする必要がある。

1. controlled type候補 `pre_confirmation_reminder`
2. canonical source: Assignment + applicable pre-shift confirmation window
3. intentional re-notify occurrence identityとdouble-submit idempotency identity
4. server-derived recipient: Assignment -> Worker -> active auth Profile
5. active Manager own-Branch / System Admin authorization
6. no-longer-eligible、no-recipient、inactive recipientのterminal outcome
7. DB-level type/source shape invariantとunique identity
8. private receipt/audit boundary。delivery retry infrastructureにはしない
9. single commandとbounded bulk commandのper-target result contract
10. Worker Inbox type label、mark-read、safe Assignment resolver
11. Notification readとAttention resolutionが独立することのE2E test
12. rate/abuse boundary。scheduled reminder engineにはしない

このcontractが承認された後、OPS-1E implementation phaseでAttention selectionとsingle/bulk UIを接続できる。

## Verification Performed

- repo migration audit: PASS
- Local PostgreSQL constraint audit: PASS
- Local function inventory audit: PASS
- Worker Inbox closed-union audit: PASS
- Attention pre-confirmation source audit: PASS
- existing pre-shift confirmation rows are present locally, but matching Notification source/type/projection is absent
- remote read/write: 0
- product code change: 0
- DB schema/RLS/RPC change: 0
- package change: 0
- commit/push: 0
- `git diff --check`: PASS

## Completion Gate Assessment

| Gate | Result |
| --- | --- |
| only eligible Attention exposes action | Not implementable without command eligibility contract |
| exact intended recipient | Missing pre-confirmation recipient projection contract |
| foreign-scope exclusion | Missing command authorization boundary |
| duplicate-safe repeated action | Missing re-notify occurrence/idempotency identity |
| Notification read does not resolve Attention | Existing concepts remain separate; no change made |
| source resolution removes Attention | Existing behavior preserved |
| single / bulk flows | Blocked |
| partial / no-recipient feedback | Missing per-target result contract |
| responsive browser QA | Not applicable because no safe action UI was added |

## Files Changed

- `docs/ops-1e-attention-actions-renotify-result.md`

## Explicit Non-Changes

- Attention persistence / owner / completion: not added
- Notification schema / type / source mapping: unchanged
- Notification read semantics: unchanged
- Announcement: unchanged
- Pre-shift confirmation semantics: unchanged
- DB / RLS / RPC / migrations: unchanged
- Auth / packages / polling / Realtime: unchanged
- Push / Email / LINE / SMS: not added
- remote: unchanged
- existing uncommitted work: preserved

## Resolved Blocker

The required narrow pre-confirmation Notification contract now exists and is connected without changing the frozen semantics.

`OPS-1E: COMPLETE`
