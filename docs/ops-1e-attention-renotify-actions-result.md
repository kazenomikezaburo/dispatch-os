# OPS-1E.1 — Attention Re-notify Actions Result

## Status

- `OPS-1E.1: COMPLETE`
- `OPS-1E: COMPLETE`

## Executive Summary

Attention Centerのderived `pre_confirmation_overdue`だけに、既存NOTIF-2A〜2C contractを使うsingle / bounded bulk再通知を接続した。UIは候補の選択と結果表示だけを担当し、eligibility、scope、recipient、cooldown、idempotency、projectionは既存DB commandを正本とする。

新しいNotification type、schema、RPC、Attention persistenceは追加していない。

## Canonical Flow

```text
derived pre_confirmation_overdue
→ explicit Admin UI action + one idempotency key
→ authenticated Server Action
→ send_pre_confirmation_reminder(s)
→ DB-side eligibility / scope / recipient derivation
→ pre_confirmation_reminder projection
→ Worker Inbox
→ safe resolver
→ /worker/assignments/{assignment_id}
```

Notificationを既読にしてもAttentionは解消されない。pre-shift confirmation submissionなど、元のsource conditionが解消された次回readでのみAttentionが消える。

## Eligibility and Selection

- checkboxと`再通知`は `pre_confirmation_overdue` にだけ表示する。
- 他のAttention typeは既存canonical actionのみを保持する。
- UI上限とServer Action validationはいずれも50件。
- UI表示は安全な既存Attention read modelからの「通知候補」件数であり、配信先の確定を意味しない。
- Server ActionはAssignment IDとidempotency keyだけを受け取り、recipient、Worker、Branch、Attention state、文面、authorization hintを受け取らない。

## Idempotency and Double-submit

- explicit UI actionごとに `crypto.randomUUID()` を1つ生成する。
- 同じ対象snapshotの不確実な通信結果ではkeyを保持し、同一操作のretryをDB replayへ収束させる。
- terminal result後の新しい明示操作は新しいkeyとなり、既存15分cooldown contractに従う。
- React pending中はsingle、bulk、selectionを無効化し、同一画面操作の二重submitを防ぐ。

## Result Feedback

既存RPCのper-target outcomeを変更せず、以下を明示する。

- `projected`: 通知を作成
- `not_eligible`: 対象外
- `no_recipient` / `inactive_recipient`: 通知先なし
- `rate_limited`: 再通知間隔内
- `unavailable`: 対象を確認できません

aggregate `complete`、`partial`、`no_action`、`no_recipient` も区別する。成功表示はアプリ内Notification rowの作成結果に限定し、外部配信完了とは表示しない。

## Security

- `requireAdmin()`でServer Actionを再認証する。
- Manager own-Branch / System Admin organization scopeは既存RPCが再検証する。
- foreign / nonexistent targetは既存`unavailable`へ収束する。
- recipientはAssignment → Worker → active ProfileからDB側で導出する。
- direct Notification insert、service role browser path、RLS変更はない。
- per-target UI resultからNotification IDや内部occurrence IDを公開しない。

## Refresh

成功後に以下をrevalidateし、client router refreshを行う。

- `/admin/attention`
- `/admin`
- `/worker`
- `/worker/notifications`

## Browser Verification

Local authenticated System Admin / Workerで確認した。

- single: 1件projected
- fresh single inside cooldown: `rate_limited`
- two-item bulk: projected 1 + rate-limited 1 のpartial結果
- only two `pre_confirmation_overdue` rows exposed selection / re-notify; five day-of rows did not
- Worker bell: unread 2
- Worker Inbox: label `勤務前確認`、controlled title / summary、未読2件
- explicit open: mark-read、bell 2 → 1
- safe resolver CTA: canonical Assignment detailへ遷移
- read後もAdmin Attentionのpre-confirmation countは2件のまま
- 1440x900: horizontal overflow 0
- 1280x900: horizontal overflow 0
- 390x844: horizontal overflow 0、mobile card action usable
- browser application / React / hydration errors: 0
- server error / exception / hydration log: 0

## Verification

- Admin Attention re-notify focused suite: `14/14 PASS`
- pre-confirmation reminder projection: `27/27 PASS`
- Worker Notification Inbox UI: `24/24 PASS`
- Incident Notification regression: `40/40 PASS`
- Announcement Notification regression: `30/30 PASS`
- Attention Center rules: `16 assertions PASS`
- focused ESLint: PASS
- `npx tsc --noEmit`: PASS
- `git diff --check`: PASS

The DB suite additionally covers same-key replay, idempotency conflict, concurrent commands, cooldown, no/inactive recipient, no-longer-eligible, foreign Manager scope, System Admin cross-Branch, bounded bulk, rollback, resolver isolation, and Notification-read independence.

## Fixture Cleanup

Browser QAで生成したexact IDsだけをtransaction内で削除した。

- Reminder Notifications: 0 remaining
- Reminder occurrences: 0 remaining
- Reminder commands: 0 remaining
- existing seed / product fixture: preserved

## Files Changed

- `app/actions/attention-reminders.ts`
- `components/admin/attention/attention-queue.tsx`
- `scripts/integration/admin-attention-renotify-actions-test.mjs`
- `docs/ops-1e-attention-renotify-actions-result.md`
- `docs/ops-1e-attention-actions-renotify-result.md`

## Explicit Non-Changes

- NOTIF-2A contract: unchanged
- Notification schema / RPC / RLS: unchanged in OPS-1E.1
- Attention source rules / persistence / manual completion: unchanged
- pre-shift confirmation semantics: unchanged
- Incident / Announcement semantics: unchanged
- Auth architecture / packages: unchanged
- Push / Email / LINE / SMS: not added
- polling / Realtime / scheduled reminder: not added
- remote: unchanged
- commit / push: 0
- existing uncommitted work: preserved

## Remaining Blocker

None.

`OPS-1E.1: COMPLETE`

`OPS-1E: COMPLETE`
