# STAFF-2G.4 Assignment Decision & Placement Handoff Result

## Status

`STAFF-2G.4: COMPLETE`

Candidate Picker の Worker 選択を write から分離したまま、明示的な Assignment decision、既存 canonical command、canonical Placement plan 再読、既存 Placement editor への handoff を接続した。

## Canonical Flow

```text
Worker selection (client state only)
→ explicit Assignment action
→ ensure_candidate_assignment
→ canonical Assignment create / reuse
→ server-side canonical PlacementPlan refresh
→ Assignment ID membership confirmation
→ existing Placement editor
```

Placement plan は自動保存しない。Placement editor の `save_shift_placement_plan` validation、version、idempotency、Assignment scope validationは変更していない。

## Assignment Decision Read

Candidate listのcanonical eligibility RPC結果へ、同じserver read内のbounded `shift_applications` queryを一括で合成した。clientはApplication lifecycleを推測しない。

- target Shift Assignmentあり: `existing_assignment`
- Applicationなし: `direct_admin_available`
- accepted: `accepted_application_available`
- applied: `application_decision_required`
- rejected: `application_rejected`
- withdrawn: `application_withdrawn`

この値はpresentation専用。execution時は`ensure_candidate_assignment`がApplication、eligibility、capacity、scopeを再評価する。

## Server Action

`ensureCandidateAssignment`を追加した。

clientから受け取る値は`shiftId`、`workerId`、closed `assignmentPath`、`idempotencyKey`のみ。Branch、role、Application ID、Assignment ID、eligibility、capacity、provenance、reason codeは受け取らない。

- active Adminを再認証する。
- canonical `ensure_candidate_assignment` RPCのみを実行する。
- controlled outcomeをserver-controlled messageへ変換する。
- success後に`getPlacementPlan(shiftId)`を再実行する。
- returned Assignment IDがcanonical plan内にある場合だけhandoff成功を返す。
- membershipを確認できなければPlacementへ進まず、再読を要求する。

## Idempotency and Pending

- explicit actionごとにUUIDを生成する。
- pending中はCandidate変更、再送、Drawer closeをdisableする。
- network/unknown resultは同じkeyを保持し、再試行する。
- controlled terminal result後の新しい明示操作は新しいkeyを使う。
- optimistic Assignment rowやsynthetic Assignment IDは作らない。

## UI Outcomes

- existing Assignment: `配置へ進む`
- no Application: `このシフトにアサインして配置へ進む`
- accepted Application: `承認済み応募からアサインして配置へ進む`
- applied: Application decision required message
- rejected / withdrawn: implicit overrideを行わないmessage
- capacity / shift state / unavailable / idempotency conflict: controlled feedback
- not eligible: current server blocking reasonsを表示
- stale Candidate facts: command結果をcurrent stateとして表示

## Placement Handoff

成功時URLはserver resultのcanonical Assignment IDだけから生成する。Shift detail Server Componentはrefresh後の`placementPlan.assignments`にそのIDが存在する場合だけ`PlacementEditor`へ渡す。

Worker IDをAssignment IDとして渡さず、client stateへAssignmentを注入せず、Placement saveを自動実行しない。

## Security

- Manager own-Branch / System Admin organization scopeは既存RPCで維持。
- Worker / anon denial、foreign/missing safe unavailableを維持。
- private receipt、Auth Profile ID、credential、authorization internalsはUIへ返さない。
- direct Assignment table insert、service role product path、RLS変更は追加していない。
- schema / migration変更なし。

## Browser Verification

local Supabase、通常のSystem Admin session、専用fixtureで確認した。

- Worker選択のみでAssignment作成なし: PASS
- applied Applicationのdecision required表示: PASS
- no Application → explicit `direct_admin`: PASS
- accepted Application → explicit `accepted_application`: PASS
- existing target Assignmentの独立表示/reuse action: PASS
- canonical Assignment IDでPlacement editor open: PASS
- refreshed plan内の対象Assignment強調表示: PASS
- Placement plan / revision自動作成: 0 / 0
- Placement save未実行: PASS
- Escape close / trigger focus restore: PASS
- 1440x900 overflow: 0
- 1280x900 overflow: 0
- 390x844 overflow: 0
- browser warning/error: 0
- server application exception: 0

DB evidence:

- direct Admin Assignment: `source = manager`
- accepted Application Assignment: `source = application`
- existing Assignment: reused
- all three: canonical `assigned`

## Verification

- STAFF-2G.4 handoff contract: `13/13 PASS`
- STAFF-2G.2 candidate Assignment command: `31/31 PASS`
- STAFF-2G.3 Candidate read model: `15/15 PASS`
- Placement rules: `39/39 PASS`
- focused ESLint: PASS
- `npx tsc --noEmit`: PASS
- production build: PASS
- local DB lint: warning/error `0`
- `git diff --check`: PASS
- STAFF-2G.4 fixture cleanup: `0`

Supplemental legacy `assignment-integrity-test.ts` was attempted but its own fixed `ASSIGN-1` staff code collided with pre-existing local fixture data before assertions began. Those pre-existing rows were preserved. The canonical STAFF-2G.2 Assignment suite, including Application lifecycle, authorization, capacity, concurrency, rollback, and cleanup, passed `31/31`.

## Files Changed

- `app/actions/candidate-assignments.ts`
- `app/admin/shifts/[shiftId]/page.tsx`
- `components/admin/placement/candidate-picker-drawer.tsx`
- `lib/admin/staff/candidate-picker-types.ts`
- `lib/admin/staff/get-shift-candidates.ts`
- `scripts/integration/staff-candidate-assignment-handoff-test.ts`
- `docs/staff-2g-4-assignment-placement-handoff-result.md`

## Explicit Non-Changes

- Candidate selection remains read/local state only
- Assignment/Application domain semantics unchanged
- Placement save validation unchanged
- no automatic Placement save
- no rejected/withdrawn override
- no capacity override
- no ranking / AI / Open Shift
- DB schema / RLS / RPC unchanged
- packages / Auth architecture unchanged
- remote Supabase unchanged
- commit / push not performed
- existing staged / unstaged / untracked work preserved

`STAFF-2G.4: COMPLETE`
