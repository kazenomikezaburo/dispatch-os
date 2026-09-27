# OCV1-05 — Worker Journey Actions & Shift Experience Result

Status: **OCV1-05: COMPLETE**

実施日: 2026-09-27  
対象: local repository / local Supabase only

## 1. Result

OCV1-04Aのcanonical commandとOCV1-04BのTimeline / nextActionを通常Worker UIへ接続した。新しいjourney state、Timeline persistence、DB migrationは追加していない。

実装済み:

- Worker journey Server Action
- `起きました` / `出発しました` / `到着しました` CTA
- pending、double-submit防止、same-key retry
- canonical response後のHome/detail再読込
- Worker Homeから最高優先Assignmentのjourney actionを直接実行
- My Shiftsのcurrent/upcoming、past/completed、cancelled/terminal分類
- Shift detailの集合・準備 → Pre-shift → Timeline → formal Attendanceという情報順

## 2. Journey Server Action

`app/actions/worker-journey.ts`を追加し、既存`record_own_assignment_journey_event` RPCだけを呼ぶ薄い境界とした。

client input:

- `assignmentId`
- `journeyType` (`wake` / `departure` / `arrival` only)
- `idempotencyKey`

Worker ID、Branch、occurredAt、timeliness、state、planned timeは受け取らない。Server Action自身もWorker認証を行い、所有権、lifecycle、window、server time、supersede、idempotencyの最終判断はcanonical RPCへ委ねる。

controlled outcomeはWorker向け固定messageへ変換する。

- `RECORDED`
- `ALREADY_RECORDED`
- `NOT_OPEN`
- `NOT_REQUIRED`
- `SUPERSEDED`
- `CLOSED`
- `NOT_FOUND`
- `IDEMPOTENCY_CONFLICT`

DB errorや内部authorization情報は返さない。unknown resultだけをretryableとし、Homeと対象detailをrevalidateする。

## 3. CTA and retry behavior

`WorkerJourneyActionButton`はcanonical `timeline.nextAction`がWake / Departure / Arrivalかつ`actionable`または`overdue`の場合だけ表示される。React側にwindowやprecedence判定を複製していない。

- submit中は48pxのprimary buttonをdisable
- pending labelを表示
- component内のidempotency keyはunknown outcome時に保持
- definite response後だけkeyを破棄
- 成功response後は`router.refresh()`でcanonical Timelineを再取得
- controlled failureはcanonical messageを表示するため画面を保持
- optimistic journey stateは作らない

DetailではnextAction card内に1つだけ表示する。Homeではdeterministic ordering上の最高優先Assignmentだけに直接CTAを表示し、他Assignmentに競合するprimary CTAを作らない。

## 4. My Shifts

既存Home readerを最大50 Assignmentのbounded readへ拡張し、同じWorker-safe journey projectionを一括取得する。第二のAssignment lifecycleは追加していない。

表示分類:

- `current`: activeかつ`startsAt <= DB generatedAt < endsAt`
- `upcoming`: activeかつ開始前
- `past`: completedまたは終了時刻経過
- `terminal`: cancelled / absent / no-show、またはcancelled Shift

current/upcomingのprimary action順は既存`compareWorkerPrimaryActions`をそのまま使用する。past/terminalは新しい順に安定表示する。

## 5. Shift Detail

Workerが次を一画面で確認できるよう、既存authorized fieldsの表示を整理した。

- 勤務先・住所
- 集合時刻 (`meeting_at ?? starts_at` presentation)
- 集合案内・アクセス
- 仕事内容
- 服装・持ち物・食事
- 業務資料
- Pre-shift Confirmation
- current journey state / read-only Timeline / journey CTA
- formal Attendance
- Incident / Help Request
- 条件・報酬

Arrival CTAはjourney RPCだけを呼び、`start_work`を呼ばない。正式な勤務開始・終了は既存Attendance sectionに分離したままである。

## 6. Security boundaries

- Worker identityとownershipはserver/DB derived
- foreign Assignmentはcanonical RPCのsafe `NOT_FOUND`
- Workerはvoid/correct不可
- clientはoccurredAt/timelinessを指定不可
- journey UIからAttendance mutationを呼ばない
- direct journey table read/writeを追加していない
- service-role product pathなし
- Notification/page viewによるjourney自動記録なし

Supabaseの現行公式guidanceに沿い、既存RPCの`SECURITY DEFINER`、empty `search_path`、schema qualification、authenticated-only EXECUTEを再検証した。OCV1-05ではDB objectを変更していない。

## 7. Verification results

| Verification | Result |
|---|---|
| Journey experience UI/action contract | **13/13 PASS** |
| Journey state / Timeline / My Shifts rules | **26/26 PASS** |
| OCV1-04A canonical journey DB/RLS | **52/52 PASS** |
| OCV1-04B projection DB/RLS | **23/23 PASS** |
| Pre-shift RLS | **16/16 PASS** |
| Worker Pre-shift regression | **PASS** |
| Worker Attendance | **40/40 PASS** |
| Incident | **47/47 PASS** |
| Worker Application | **26/26 PASS** |
| Candidate Assignment | **31/31 PASS** |
| DB lint (`public,private`, warning fail) | **PASS — 0 issues** |
| local security advisor | **PASS — 0 issues** |
| focused ESLint | **PASS** |
| `npx tsc --noEmit` | **PASS** |
| production `next build` | **PASS** |
| `git diff --check` | **PASS** |
| Authenticated Chrome Worker flow | **PASS** |
| Responsive 1440x900 / 1280x900 / 390x844 | **PASS — overflow 0** |

DB suites cover normal/late Wake、Departure、missing Wake、Arrival、late Arrival、same-key replay、duplicate、already recorded、before-open、superseded、cancelled/terminal、foreign Assignment、ArrivalとAttendanceの分離、anon/service-role/direct DML denialを含む。

## 8. Authenticated browser QA

### Local Auth fixture

既存`auth-fixtures.ts`は固定actorのpasswordを更新する方式のため使用しなかった。`worker-journey-browser-fixture.mjs`から、既存integration fixtureと同じlocal-only service-role setup境界を使って専用Auth userを`auth.admin.createUser`で作成した。service-role keyはbrowser/product runtimeへ渡していない。

専用Auth userにactive Worker profile / Worker rowを紐づけ、既存seed Branch / Jobを参照する2件の専用Shift / Assignmentだけを作成した。既存Workerのpasswordと既存業務rowは変更していない。

### Worker flow

Chromeの通常UIで次を連続操作し、各操作後にserver-derived projectionを再取得した。

1. Pre-shift Confirmationを送信し、起床・出発予定がcanonical detailへ反映
2. Wakeを送信し、Timelineの起床が`完了`、nextActionがDepartureへ進行
3. Departureを送信し、Timelineの出発が`完了`、nextActionがArrivalへ進行
4. Worker Homeを開き、対象ShiftのnextActionが`到着を報告する`へ更新済みであることを確認
5. Arrivalをkeyboard Enterで送信し、Timelineの到着が`完了`、journey nextActionが終了

optimisticなjourney stateは表示せず、各完了時刻はcanonical refresh後のTimelineから確認した。DBでも対象Assignmentのrecorded eventは`wake` / `departure` / `arrival`の3件だけだった。

pending確認ではlocal DB containerを一時停止して応答待ちを作り、`起床を記録中…`、button disabled、height 48pxをChromeで確認後、直ちにDBを再開した。これにより同一画面からのduplicate submitが無効化されることを確認した。

### Controlled error defect and fix

stale画面のaction直前に専用Assignmentをterminal化するとcanonical RPCは`CLOSED`を返したが、従来は無条件revalidationでCTA componentがunmountされ、messageが見えなかった。

成功時だけHome/detailをrevalidate / refreshするよう最小修正した。再試験では`この勤務では現在報告できません。`が`role=alert`で表示され、DB mutationは発生しなかった。journey/Assignment contractは変更していない。

### Viewport matrix

| Viewport | horizontal overflow | primary CTA | Result |
|---|---:|---:|---|
| 1440x900 | 0px | 48px | PASS |
| 1280x900 | 0px | 48px | PASS |
| 390x844 | 0px | 48px | PASS |

390x844でArrivalをkeyboard Enterから実行できた。全viewportでconsole error / warning、React error、hydration errorは0件だった。

### Arrival / Attendance separation

Arrival完了後のDB確認:

- journey recorded: 3 (`wake`, `departure`, `arrival`)
- Attendance `start_work`: 0

ArrivalはAttendance mutationを発生させていない。

### Cleanup

専用journey / confirmation / Assignment / Shift / Worker / profile rowを削除し、専用Auth userも`auth.admin.deleteUser`で削除した。

- dedicated rows removed: 10
- dedicated Auth users removed: 1
- dedicated fixture remainder: **0**

## 9. Explicit non-changes

- schema / migration追加なし
- OCV1-04A journey command変更なし
- OCV1-04B state、Timeline、nextAction precedence変更なし
- Attendance contract変更なし
- Arrivalによる自動`start_work`なし
- Admin correction UI、Attention、Reminder、Notification、LINE、GPSなし
- automatic Arrival / Incidentなし
- package変更なし
- remote Supabase操作、commit、pushなし
- `.tmp-notif-2c-local.*`は編集対象にしていない

## 10. Completion decision

authenticated Worker browser flow、responsive matrix、Arrival / Attendance分離、cleanup、静的検証がすべて通過したため、`OCV1-05: COMPLETE`と判定する。
