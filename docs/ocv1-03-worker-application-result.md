# OCV1-03 — Worker Application & Withdrawal Result

`OCV1-03: COMPLETE`

## Delivered

- Connected Worker recruitment detail to the existing canonical `shift_applications` lifecycle.
- Added only `none -> applied` and `applied -> withdrawn`.
- Added authenticated Worker Server Actions whose client input is limited to `shiftId` and `idempotencyKey`.
- Added active `応募する` and `応募を取り下げる` controls with pending disablement, duplicate-submit protection, controlled feedback, and canonical projection refresh after success.
- Preserved non-mutating presentation for `accepted`, `rejected`, `withdrawn`, `capacity_full`, `deadline_passed`, and `not_eligible`.

## Canonical command boundary

Migration `20260926175812_ocv1_worker_application_commands.sql` adds:

- `public.apply_to_own_shift(uuid, uuid)`;
- `public.withdraw_own_shift_application(uuid, uuid)`;
- private actor-scoped idempotency/audit receipts in `private.worker_application_command_receipts`.

The receipt table is not a second Application model. It stores only command identity and stable command results; `public.shift_applications` remains the sole lifecycle source.

Both RPCs are `SECURITY DEFINER` with an empty `search_path`, schema-qualified objects, explicit `authenticated` execution, and revoked `PUBLIC`, `anon`, and `service_role` execution. They derive actor, Worker, Branch, Application state, timestamps, and all authorization facts server-side.

The legacy Worker direct INSERT policy was removed because it did not enforce the frozen deadline, Assignment-capacity, own-Assignment, or eligibility gates. Admin review SELECT/UPDATE policies remain unchanged. No Worker UPDATE policy was added.

## Apply semantics

At command execution the database locks and revalidates:

- authenticated active Worker identity derived from `auth.uid()`;
- Worker and Shift Project Branch equality;
- Project and Shift `recruiting` state and pre-start publication;
- effective application deadline;
- absence of an active own Assignment;
- absence/current state of the canonical Application row;
- current structured Skill/Qualification facts;
- current Worker status, Availability, and cross-Shift Assignment conflict facts;
- current active Assignment capacity.

A successful command inserts exactly one `shift_applications` row with server-derived Worker, `status = applied`, and server timestamps.

Application never changes, holds, or reserves Shift capacity. Concurrent eligible Workers can both become `applied` for one remaining Assignment slot. The existing canonical Assignment command remains the only final capacity serializer.

## Withdrawal and terminal states

- Only an own `applied` row may transition to `withdrawn`.
- Retry of the same withdrawal replays its stable result.
- A different key after withdrawal converges to `already_withdrawn`.
- `accepted` and `rejected` are never silently changed.
- `withdrawn` and `rejected` cannot reapply.
- Worker cannot create an Assignment or modify review fields.

## Idempotency

- Same actor/key/Shift/operation replays the original result.
- Reusing a key for a different Shift or operation returns `IDEMPOTENCY_CONFLICT`.
- A different apply key after an existing `applied` row converges to `existing_applied`.
- The unique `(shift_slot_id, worker_id)` constraint remains the final duplicate-row guard.
- An unexpected transaction failure rolls back both the Application mutation and receipt.

The client retains the same generated key while a result is unknown/retryable. It clears the key only after a definite response and refreshes the Server Component projection instead of inventing Application state optimistically.

## DB / RLS verification

Dedicated local OCV1-03 command suite: **26/26 PASS**.

Covered:

- successful apply and exactly one canonical row;
- same-key replay and different-key duplicate apply;
- concurrent Workers applying for the last remaining slot;
- eligibility change before submit;
- deadline passed and capacity full before submit;
- already assigned and foreign Branch denial;
- successful, replayed, and duplicate withdrawal;
- accepted/rejected withdrawal denial and withdrawn reapply denial;
- terminal state preservation;
- Admin review visibility;
- accepted Application to existing canonical Assignment command;
- no Application capacity reservation;
- Worker direct table mutation denial;
- anonymous denial and no Manager Worker-command authority;
- cross-operation idempotency conflict;
- dedicated fixture cleanup.

`npx supabase db lint --local --schema public,private --level warning`: **PASS, no schema errors**.

`npx supabase db advisors --local --type security`: **PASS, no issues**.

## Authenticated browser verification

Chrome verified the real Worker flow:

```text
Recruitment detail
  -> 応募する
  -> 応募中... (disabled)
  -> canonical 応募済み
  -> controlled success feedback
  -> 応募を取り下げる
  -> 取下げ中... (disabled)
  -> canonical 取下げ済み
  -> controlled success feedback
```

| Surface | 1440 × 900 | 1280 × 900 | 390 × 844 |
| --- | --- | --- | --- |
| Recruitment detail with active CTA | PASS, overflow 0 | PASS, overflow 0 | PASS, overflow 0 |

- CTA height: 44px at all three widths.
- Keyboard focus reaches the active application control.
- `not_eligible`, `deadline_passed`, `capacity_full`, `accepted`, `rejected`, and `withdrawn` displayed with zero mutation buttons.
- Console, React, and hydration errors: **0**.

## Regression and build results

| Check | Result |
| --- | --- |
| OCV1-02B Worker recruitment discovery | PASS, 26/26 |
| Availability / Work Conditions | PASS, 41/41 |
| STAFF-2F Candidate Eligibility | PASS, 22/22 |
| Candidate Assignment command | PASS, 31/31 |
| Structured Job requirements | PASS, 33/33 |
| Focused ESLint | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS; 31 static pages generated |
| `git diff --check` | PASS |

Dedicated OCV1-03 fixtures and receipts remaining after verification: **0**.

## Explicit non-changes

- No new Application status or second Application table.
- No rejected/withdrawn reapply or accepted withdrawal.
- No Worker Assignment creation.
- No capacity reservation, hold, decrement, or first-come allocation.
- No change to Admin Application review decisions or canonical Assignment capacity serialization.
- No Notification, LINE, ranking, or AI behavior.
- No package or font changes.
- No `db reset`, `db push`, `--linked`, or remote Supabase mutation.
- No commit or push.
- `.tmp-notif-2c-local.*` was not touched.
