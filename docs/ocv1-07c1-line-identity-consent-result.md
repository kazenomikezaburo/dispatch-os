# OCV1-07C1 LINE Identity, Consent & Safe Entry Result

**OCV1-07C1: PROVIDER VERIFICATION BLOCKED**

## 1. Result

OCV1-07C0の凍結契約に従い、LINE push deliveryを追加せず、次を実装した。

- privateなWorker↔LINE identity link
- 10分・単一使用のstate / nonce linking transaction
- authenticated Worker起点のLINE Login initiate / callback
- Worker本人のlink status projection、unlink、Reminder consent
- raw body署名検証を行う`follow` / `unfollow` webhook
- `/worker/notifications/[notificationId]`の本人限定safe entry
- 10分・署名付きHttpOnly・単一使用のlogin continuation
- mobile-first Worker LINE設定画面

実LINE Provider資格情報と同一Provider配下のLINE Login / Messaging API channelがこの環境にないため、実Providerでのauthorization code exchange、OIDC ID token検証、friendship API、実LINE webhook受信は未検証である。契約のDone条件に従い、本Phaseを`COMPLETE`にはしていない。

## 2. Persistence and command boundary

追加したprivate persistenceは次のとおり。

| Object | Purpose | Runtime exposure |
|---|---|---|
| `private.worker_line_links` | live Provider-scoped LINE destination、availability、明示consent、enablement watermark | table grantなし、RLS enabled |
| `private.worker_line_link_transactions` | hashed state / nonce、10分expiry、consume / cancel | table grantなし、RLS enabled |
| `private.line_webhook_receipts` | `webhookEventId` replay防止、type/timestamp/outcomeのみ | table grantなし、RLS enabled |
| `private.worker_notification_continuation_receipts` | login continuationの一回使用receipt | table grantなし、RLS enabled |
| `private.line_runtime_configuration` | trusted route用内部secretのSHA-256 hashだけ | table grantなし、RLS enabled |

LINE user IDは`private.worker_line_links`だけに保存する。Notification、URL、browser response、Admin surface、webhook receipt、continuation、ログにはコピーしない。access token、refresh token、ID token、LINE profileは一切永続化しない。

Worker commandはすべて`auth.uid()`からactive Workerを導出する。Manager / System Admin / anonはWorker linkを開始・所有できない。callback / webhook mutationは通常browser credentialだけでは成功せず、ホスティング環境の`OPSCUE_LINE_INTERNAL_SECRET`とprivate設定に登録したそのSHA-256 hashの一致を追加で要求する。`service_role` product runtimeは追加していない。

inactive profile / Workerへの遷移はlinkを`suspended`にしconsentをOFFにする。再active化は自動再enableしない。Worker hard deleteはlive linkと未完了transactionを削除する。

## 3. Linking and provider boundary

`startOwnLineLink`はactive Worker sessionを要求し、random state / nonceを生成してhashだけをDBへ保存する。同一Workerの以前の未完了transactionはcancelされる。signed HttpOnly cookieにはcallbackで必要なraw state / nonceとexpiryだけを10分保持する。

authorization requestは次に固定した。

- `response_type=code`
- `scope=openid profile`
- `bot_prompt=aggressive`
- configured exact callback URI
- random `state` / `nonce`

callbackは同じactive Worker session、signed cookie、state、DB transactionを要求する。server-side code exchange後、LINE verify endpointでsignature / `iss` / `aud` / `exp` / `nonce`を検証し、verified `sub`だけをidentityとして採用する。friendship statusはserver-side APIから取得する。provider tokenは返却・保存しない。DB uniquenessにより1 Worker 1 destination、1 Provider-scoped LINE user 1 Workerを強制し、collisionは所有者を開示しない。

必要なserver-only環境設定:

- `OPSCUE_APP_ORIGIN`
- `LINE_LOGIN_CHANNEL_ID`
- `LINE_LOGIN_CHANNEL_SECRET`
- `LINE_MESSAGING_CHANNEL_SECRET`
- `OPSCUE_LINE_INTERNAL_SECRET`
- `OPSCUE_CONTINUATION_SECRET`

いずれも`NEXT_PUBLIC_*`ではない。deploy時にはrandomな`OPSCUE_LINE_INTERNAL_SECRET`のSHA-256 hashだけを`private.line_runtime_configuration`のsingletonへ安全な管理SQLで設定する。raw secretとProvider credentialはホスティングの暗号化secret storeだけに置く。

## 4. Consent and unlink

- link / re-linkは必ず`external_reminders_enabled=false`、`enabled_at=null`から始まる。
- enableはactive Workerかつ`linked_available`だけ許可する。
- enable server timeをwatermarkとして保持し、同じenable retryでは更新しない。
- disableは即時でwatermarkを消す。
- followはavailabilityだけを回復し、自動enableしない。
- unfollowは`linked_unavailable`にしてconsentを即時OFFにする。
- unlinkはlive destinationを削除するが、in-app Notification、read state、Journey、Attendance、Attentionは変更しない。

C2はenqueue / claim時にこのlive link、availability、consent、enablement watermarkを再検証できる。C1ではdelivery row、attempt、push、retry dispatcherを作成していない。

## 5. Webhook

`POST /api/line/webhook`は最大256 KiBのraw bodyを読み、JSON parseやmutationより先に`x-line-signature`をMessaging channel secretでHMAC-SHA256検証する。

- empty `events`: 204
- signed `follow` / `unfollow`: bounded eventをtrusted commandへ渡す
- duplicate `webhookEventId`: stable replay
- older/equal provider timestamp: receiptは残すがlive stateを上書きしない
- signed unsupported event: contentを保存せずignore、204
- invalid signature: 401、mutationなし

WebhookからWorker command、Notification read、Journey、Attendanceを呼ばない。

## 6. Safe Notification entry and login continuation

`/worker/notifications/[opaqueNotificationId]`は通常のWorker session / RLSを通し、本人recipient Notificationだけを読み、既存type-specific source resolverを使用する。sourceが消失・非公開ならcontrolled unavailableを表示する。foreign UUIDとmissing UUIDは同一の非開示表示になる。

未認証entryはProxyでexact path `/worker/notifications/{UUID}`だけを受理し、10分expiry・HMAC署名・HttpOnly・SameSite=Lax cookieへNotification IDとrandom nonceだけを保持する。login後、authenticated Worker commandがrecipientを再認可し、nonce hashのunique receiptを作って一回使用にする。absolute、protocol-relative、query-based return URL、escaped pathは保持しない。無効・期限切れ・replayは`/worker/notifications`相当の通常遷移へ収束する。

## 7. Verification

### Focused DB / security

`scripts/integration/worker-line-identity-consent-test.mjs`: **44/44 PASS**。

確認内容:

- active / inactive / Manager / System Admin / anon boundary
- state mismatch、nonce mismatch、expiry、callback replay
- internal trusted secret fail-closed
- successful link、default disabled、status redaction
- one active transaction、re-link、cross-Worker LINE collision
- enable / disable / stable watermark / unavailable denial
- follow / unfollow / duplicate / stale ordering / no silent re-enable
- own / foreign / missing / expired / replayed continuation
- private table direct read/write denial、RLS、token/profile column absence
- unlink retry、Journey / Attendance / Notification read non-mutation
- dedicated fixture cleanup 0

`scripts/integration/worker-line-boundary-source-test.mjs`: **17/17 PASS**。raw-before-parse、signature-before-RPC、OIDC verify fields、friendship API、exact deep-link allowlist、HttpOnly 10分cookie、secret非公開、push absenceを確認した。

実Route Handlerへのlocal HTTP verification:

| Case | Result |
|---|---:|
| invalid signature | 401 |
| empty signed event array | 204 |
| unsupported signed event | 204 / mutationなし |
| signed follow | 204 / `linked_available` |
| same `webhookEventId` replay | 204 / duplicate receiptなし |
| signed unfollow | 204 / `linked_unavailable`, consent false |
| stale signed follow after unfollow | 204 / newer unavailable state維持 |

HTTP専用link / receipt / private hash fixture remainder: **0**。

### Authenticated browser

既存integration fixtureと同じlocal-only Auth admin conventionで専用temporary Auth user、active profile / Worker、Announcement / recipient / Notificationを作成した。既存business Workerのpasswordやrowは変更していない。

- 未認証のdirect Notification URL → login → 同じ本人Notificationへcontinuation: PASS
- Notification title / safe summary / existing Announcement resolver CTA: PASS
- foreign Notification / missing Notification: 同一safe unavailable表示
- `/worker/settings/line`: unlinked、consent OFF、安全説明を表示
- unavailable consent action: pending duplicate-disable表示 → controlled error
- keyboard Tab focus: visible outline、primary controlへ到達
- browser console warning/error: 0
- React / hydration error: 0

| Viewport | Horizontal overflow | Minimum button height |
|---|---:|---:|
| 1440x900 | 0 | 44px |
| 1280x900 | 0 | 44px |
| 390x844 | 0 | 44px |

専用Auth / Worker / Announcement / Notification / continuation fixture remainder: **0**。

### Regression

| Suite | Result |
|---|---:|
| In-app Notification | 40/40 PASS |
| Notification source context | 18/18 PASS |
| Pre-confirmation reminder | 27/27 PASS |
| OCV1-07A reminder scheduler | 28/28 PASS |
| OCV1-07B scheduler invocation | 22/22 PASS |
| Worker journey projection | 23/23 PASS |
| Worker Notification inbox UI | 25/25 PASS |

### Static / build

| Check | Result |
|---|---:|
| focused ESLint | PASS, 0 errors/warnings |
| `npx tsc --noEmit` | PASS |
| production build | PASS |
| local DB lint (`public,private`, fail on warning) | PASS, no schema errors |
| focused local security audit | PASS, new private tables RLS enabled / runtime grants 0 / hardened functions |
| `git diff --check` and cached diff check | PASS |

## 8. Provider-dependent blocker

この環境には以下がない。

- 同一LINE Provider配下で紐付けたLINE Login channelとMessaging API channel
- registered production/local callback URI
- real LINE Login channel secret
- real Messaging API channel secret
- Worker test LINE accountとOfficial Account friendship
- LINE Developers Consoleから到達可能なwebhook URL

したがって、real authorization redirect、authorization code exchange、LINE-issued ID token、real friendship status、LINEからのsigned follow / unfollow deliveryは証明できない。これらをprovider環境で通した後にだけ`OCV1-07C1: COMPLETE`へ更新する。

## 9. Explicit non-changes

- LINE push deliveryなし
- delivery outbox / attempt / retry / dispatcherなし
- LINE chat / LIFF / rich menuなし
- Notification authority / reminder timing / cooldown変更なし
- Assignment / Journey / Attendance / Incident / Attention mutationなし
- Admin linking / destination entryなし
- Notification read state変更なし
- service-role browser/product runtimeなし
- package変更なし
- remote Supabase / remote LINE resource変更なし
- commit / pushなし
