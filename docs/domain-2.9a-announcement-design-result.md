# DOMAIN-2.9A Announcement Domain Design & Freeze

## Executive Summary

**DOMAIN-2.9A: COMPLETE**  
**DB-2.9B: READY**

Announcementを、管理者が作成し、公開時に確定したWorker audienceへ共有する、現在の単一組織が所有する独立content aggregateとしてFreezeする。Announcementはtitle/body、importance、target intent、draft/published/archived lifecycleを所有するsource of truthである。Notificationはpublish後にrecipientごとに生成されるattention projectionであり、Announcement本文・公開状態・対象集合の正本ではない。

MVPは即時公開のみ。draftだけ編集可能、published contentとrecipient snapshotはimmutable、archivedはterminal。対象は`organization_active_workers`（System Adminのみ）または`branch_active_workers`（認可branchのManager/System Admin）の二種類に限定する。特定Worker、Assignment、Shift、Project、Job、Workplace targetingは後続候補であり、2.9 MVPには含めない。

## Existing Architecture Audit

### Repository / Local PostgreSQL

- Local DB catalogにAnnouncement/Broadcastのproduct table、view、RPCは存在しない。該当名の関数はPostgreSQL/Supabase内部の`pg_catalog.broadcast`と`realtime.broadcast_changes`だけであり、product Announcementではない。
- Admin navigationには「お知らせ」「通知」のfuture placeholderがあるがroute/actionはない。
- Workerの`/worker/notifications`はIncident acknowledged/resolved専用のrecipient Inboxとして実装済み。「お知らせ」という日本語labelはNotification UI labelであり、Announcement aggregateの存在を意味しない。
- 現在のrole正本は`profiles.account_type = worker | manager | system_admin`。Manager scopeは`manager_branch_access`、Worker scopeは`workers.branch_id`。organization/tenant tableはなく、現在のdeployment全体が一つの組織境界である。
- `requireAdmin`はManagerとSystem Adminを通す。個別commandでは必ずaccount type、active状態、Manager branch accessをDBで再検証する必要がある。
- optimistic concurrencyの既存規約はinteger `version` + `expected_version`、stable `VERSION_CONFLICT`。Incident/Placement commandはidempotency keyとDB transactionを使う。
- Notification v1はIncident Event FKに固定され、typeも`incident_acknowledged | incident_resolved`だけ。Announcement sourceはそのまま格納できない。

### Existing Domain Decisions

`notification-announcement-boundary-discovery-v1`は、Announcementをtitle/body/target/publish lifecycleを持つ独立source aggregate、Notificationをevent由来のrecipient projectionと定義済みである。Notification readはsource acknowledgementではなくattention stateであり、Announcementも同じ境界を継承する。

## Figma Audit

File `Pmb52CO7UgsQDA5tvoqUjF` をread-onlyで監査した。FigmaはUI intentでありDomain SOTではない。

| Node | Intent | Extracted concepts | Classification |
| --- | --- | --- | --- |
| `338:85` Quick / Announcements | Worker support hub entry | お知らせ、未読件数 | Notification入口として一部implemented。Announcement専用ではない |
| `229:37` Worker announcement detail | Worker detail | title、body、important、publish date、deadline、target、sender、CTA | Figma-only。Backend未実装と明記 |
| `339:251` お知らせ | Worker guidance card | 募集/勤務への確認先 | Figma-only guidance。Announcement content modelではない |
| `117:2` Announcement Create | Admin authoring | category、title、body、preview、all/condition target、pin、badge、Push、LINE、schedule、expiration、draft | Planned/Figma-only。MVP採用はtitle/body/importance、draft、audience preview、publish nowのみ |
| `117:233` Announcement Edit | Published editing | published edit、target edit、period edit、channel、閲覧数、unpublish | Figma-only。MVPのpublished immutableと衝突するため採用しない |
| `119:2` Announcement list | Admin list | published/reserved/draft/ended、search、category、target、period、view rate、pin | Planned/Figma-only。MVPはdraft/published/archivedとbasic listのみ |
| `116:2` Broadcast create | Multi-channel broadcast | Shift/workplace/position filters、LINE/App、schedule、template、personalization | 別Broadcast/External Delivery domain。2.9非対象 |
| `118:2` Delivery history | Cross-channel analytics | sent/failure/read rate/follow-up | 別Delivery/Analytics domain。2.9非対象 |

Figmaにattachment/image galleryは見当たらない。senderは表示されるが、Domainでは個人ownerではなくaudit actor。read/unread、閲覧率、pin、category、expiration、schedule、Push/LINEはMVPから除外または限定した。

## Domain Definition

> Announcement is an organization-owned, administrator-authored, publishable plain-text information aggregate whose audience is resolved and frozen at publication for authorized Worker accounts.

含まないもの: Incident Notification、Help Request、chat、direct message、task Assignment、system alert、email、Push、LINE、audit event、delivery attempt。

### Announcement vs Notification

| Property | Announcement | Notification |
| --- | --- | --- |
| Role | source content / source of truth | recipient attention projection |
| Authorship | Manager / System Admin command | trusted projection only |
| Content | full title/body、importance | short safe title/summary snapshot |
| Audience | publish時に解決・固定した集合 | 一recipient account |
| Lifecycle | draft → published → archived | unread → read |
| Read | MVPでは持たない | first `read_at` |
| Failure | publish factを保持 | retry/reconciliation可能 |

## Ownership and Organization Boundary

- Canonical ownerは現在のDispatch OS deploymentに対応するorganization。author個人所有ではない。
- 現schemaにorganization tableはないため、rootへ架空の`organization_id`は追加しない。DB-2.9Bでは現在のsingle-organization invariantを明記する。
- `scope_type=organization`はdeployment全体、`scope_type=branch`は一つの`branches.id`をoperational authorization boundaryとして持つ。
- `created_by`等はactor audit FKでありownership判定に使用しない。actor profile削除時は`SET NULL`でもAnnouncementは残る。
- 将来multi-tenant化する場合は、全business table共通のorganization boundaryを先に設計する。Announcementだけに先行tenant IDを発明しない。

## Lifecycle

States: `draft | published | archived`。

```text
create_draft → draft
draft --update_draft--> draft
draft --publish--> published
draft --delete_draft--> physically removed
published --archive--> archived
archived → terminal
```

### State Transition Matrix

| From | Command | To | Allowed | Effect |
| --- | --- | --- | --- | --- |
| none | create draft | draft | yes | server actor/scope/version 1 |
| draft | update draft | draft | yes | content/target intent edit、version +1 |
| draft | publish | published | yes | validate、snapshot recipients、published metadata、version +1 atomically |
| draft | archive | — | no | delete draftを使う |
| draft | delete draft | removed | yes | narrow commandのみ、recipient/publish factなし |
| published | update content/target | — | no | published immutable |
| published | publish | — | no/replay only | same idempotency keyだけoriginal success replay |
| published | archive | archived | yes | archived metadata、version +1 |
| published | delete | — | no | audit/source integrityを保持 |
| archived | edit/publish/unarchive/delete | — | no | terminal |

## Publication Contract

`publish_announcement(announcement_id, expected_version, idempotency_key)`はcanonical Domain command。

同じDB transactionで以下を成立させる。

1. active authenticated Manager/System Adminとscope authorizationを検証。
2. row lock、state=`draft`、expected versionを検証。
3. normalized non-empty title/body、valid importance、valid target intentを検証。
4. server-side canonical relationsからactive Worker + active Worker profileのaudienceを解決。
5. audience 0件なら`EMPTY_AUDIENCE`で全rollback。
6. immutable recipient snapshotを一括生成。
7. state=`published`、`published_at=now()`、`published_by=auth.uid()`、version +1を設定。
8. canonical publication resultを返す。

`published_at`はserver-generated、publish時に一度だけ設定し、archiveでも変更しない。client timestamp、client actor、client recipient countを信用しない。publish nowだけでありscheduled publishはない。

## Editing Policy

- draft: title/body/importance/target intentを編集可能。incomplete draft保存を許すが、title/bodyはfield maximumと文字normalizationには従う。publish validationは別。
- published: title/body/importance/target/recipient snapshotを全てimmutable。誤り訂正は新Announcementを作成し、必要なら旧Announcementをarchiveする。
- archived: 全field immutable、terminal。unarchive/re-publishなし。
- UI上の「更新」や「非公開」をpublished editへ流用しない。

## Target Model

### MVP Target Types

1. `organization_active_workers`: 現在のsingle organization内の全active Worker。System Adminだけが指定可能。
2. `branch_active_workers`: 一つのbranchに所属する全active Worker。System Adminまたはそのbranchへのaccessを持つManagerが指定可能。

特定Workers、Shift、Assignment、Workplace、Project、Job、role/tag/任意条件はMVP対象外。配列やJSONへrecipient IDを保存しない。

### Snapshot Decision

publish時snapshotを採用する。対象判定はpublish transaction内でcanonical `workers.branch_id/status`、`workers.auth_profile_id`、`profiles.account_type/is_active`から行う。recipient rowはpublish後にINSERT/UPDATE/DELETE不可。

- `worker_id`は誰を対象にしたかのbusiness snapshot identity。
- `recipient_profile_id`は公開時のin-app account identity。Worker read/RLSとNotification projectionに使う。
- unique `(announcement_id, worker_id)` と `(announcement_id, recipient_profile_id)` を要求する。
- auth profile未連携、inactive/suspended Worker、inactive/non-worker profileはresolved audienceから除外する。
- resolved audience 0件はpublish不可。
- publish後のAssignment/branch移動でsnapshotは変えない。

### Worker Activation / Deactivation

recipient snapshotは履歴として残る。runtimeではWorkerとprofileがactiveであることを再検証するため、inactive/suspended中はread不可。元のprofile/Workerがactiveへ戻れば、Announcementがpublishedの間は再びread可能。archivedなら復帰後も不可。別accountへ再linkされた場合、古いsnapshot profileを新accountへ自動移管しない。

## Authorization

### Admin Command Matrix

| Command | Manager | System Admin |
| --- | --- | --- |
| create branch draft | accessible branchのみ | any active branch |
| create organization draft | no | yes |
| read/list draft/published/archived | accessible branch scopeのみ。organization scopeはno | all |
| update draft | accessible branch + expected version | all + expected version |
| publish | accessible branch only | all scopes |
| archive | accessible branch only | all scopes |
| delete draft | accessible branch only | all scopes |

Actor本人がcreatorかどうかは判定に使わない。inactive profileは全command不可。foreign scope UUIDは存在を漏らさず`NOT_FOUND`。

### Worker Read Matrix

| Operation | Worker |
| --- | --- |
| list | active profile/Workerかつpublishedかつown immutable recipient rowのみ |
| get by UUID | 同じ条件。foreign/nonexistent/draft/archivedは同じnot-found結果 |
| read draft/archived | no |
| create/update/publish/archive/delete | no direct privilege、no RPC authority |
| read another recipient row | no |

client-side filteringはauthorizationではない。table GRANTとRLS、またはnarrow read RPCのDB predicateで保証する。

## Content Model

- `title`: plain text、trimmed、1–120 chars at publish。
- `body`: plain text、line breaks preserved、trimmed、1–5000 chars at publish。
- `importance`: `normal | important`。safety/urgent operational informationをtext labelとsemantic treatmentで示すbinary field。mandatory acknowledgementやpriority queueは意味しない。
- `category`: MVPではなし。Figma labelsはtaxonomyが未確立で、色分けだけのenumを作らない。
- `summary`: Announcement SOTには保存しない。Notification projectionがbodyからserver-sideで安全な最大240 charsのplain-text summaryを決定する。
- `sender display`: current actor lookupまたはpublished audit actorから表示可能だが、display name snapshotはMVP source fieldに持たない。

### Body / Link Safety

plain textのみ。raw HTML、Markdown、embedを保存/renderしない。UIは改行をtextとして表示する。URLをlink化する場合はUI Phaseで`http`/`https` absolute URLだけを安全に認識し、externalはnew tab + `rel="noopener noreferrer"`。任意scheme、HTML、scriptは不可。

Attachments、image、rich editor、reaction、comment、threadは対象外。

## Read Semantics

MVPはAnnouncement固有のread receiptを持たない。

- Notification `read_at` = recipientがattention itemを明示openした最初の時刻。
- Announcement detail view = content read analyticsではなく、DBへreceiptを書かない。
- Worker Announcement listは独自の未読badgeを持たない。
- Notification InboxからAnnouncementを開く場合、既存Notification openでmark-readし、その後authorized sourceへ遷移する。
- Figmaの閲覧人数/率、未読者再通知、mandatory readはFigma-onlyかつnon-goal。

これによりNotification readとAnnouncement readという二重状態を作らない。

## Archive / Delete

### Archive

- publishedからのみ実行可能。`archived_at`、`archived_by`、versionをserver-sideで設定。
- Worker list/detailから即時非表示。direct UUIDもnot found扱い。
- Admin historyでは保持・閲覧可能。
- recipient snapshot、title/body、published metadataは保持。
- 既存Notification itemはrecipient attention historyとして残し、read stateも保持する。
- Notification source resolverはarchived sourceを`source_available=false`として扱い、CTAをdisabledにする。NotificationへAnnouncement pathを固定保存しない。

### Delete

- physical DELETEは未公開draftにだけnarrow commandで許可。
- published/archived physical DELETEは通常product operationとして禁止。
- draft delete前提はstate=draft、expected version一致、recipient 0、published_at null。
- compliance/account deletionは別policy/phase。

## Notification Integration

### Compatibility Audit

| Existing Notification aspect | Assessment | Reason / extension |
| --- | --- | --- |
| recipient/read/pagination | Reusable as-is | profile recipient、first read、created_at/id keysetは共通 |
| title/summary snapshot | Reusable as-is | limits 120/240、plain controlled copy |
| notification type constraint | Requires narrow extension | `announcement_published`追加が必要 |
| source representation/FK | Incompatible as-is | current non-null Incident Event FKだけではAnnouncementを表現不可 |
| unique constraint | Requires narrow extension | Announcement recipient source uniquenessが必要 |
| source resolver | Requires separate narrow resolver | Incident resolverへAnnouncement joinを混在させない |
| projection receipts/reconciliation | Requires Announcement-specific primitive | current functionはIncident Event限定 |
| Inbox read model | Reusable with type-aware presentation | read stateは変更不要 |

DB-2.9Bで既存Incident Notificationを壊すpolymorphic nullable-column乱立は行わない。推奨はAnnouncement publicationを入力にする専用projection source mapping/receiptを追加し、Notification itemの共通envelopeへ最小統合すること。具体的なNotification schema extension migrationはINT-2.9Eで、DB-2.9BのAnnouncement source schema確定後に設計・実施する。

### Delivery Semantics

```text
canonical Announcement publication + immutable recipients commit
  → separate idempotent Notification projection
  → one Notification per frozen recipient
```

- publication成功をNotification失敗でrollbackしない。
- at-least-once processing + DB uniqueでobservable Notificationをeffectively-onceにする。
- source keyはimmutable publication identity。MVPは一Announcement一publishなのでAnnouncement IDを使用可能。
- projectionはclient recipientを受け取らず、immutable recipient rowsを列挙する。
- receiptは `(announcement_id, recipient_profile_id)` をcanonical duplicate keyとし、terminal skipを必要に応じて記録する。
- missing receipt/Notificationをbounded reconciliationで再検出できる。
- archiveは既存Notificationを削除せず、reconciliation済みreceiptも変更しない。
- Notification snapshotはimportance label、Announcement title、server-derived short summaryだけ。full bodyやtarget detailsをコピーしない。

## Source Navigation

Canonical Worker routes:

```text
/worker/announcements
/worker/announcements/[announcementId]
```

deep linkとrefresh/共有URLのauthorizationを保証するためdetail routeを持つ。Drawerを採用してもURLはcanonical detail routeと同期する。

Admin routes候補:

```text
/admin/announcements
/admin/announcements/new
/admin/announcements/[announcementId]
```

draft editorはdetail内またはDrawerに統合可能であり、UI Phaseで不要routeを減らしてよい。

Notification source解決は新しい `resolve_announcement_notification_source_context(notification_id)` 相当のnarrow resolverとする。own Notification → expected type/source mapping → published Announcement → own immutable recipient → current active Worker/profileを全てDBで検証し、成功時だけannouncement IDを返す。Incident用 `resolve_in_app_notification_source_context` へAnnouncement分岐を詰め込まない。foreign/nonexistent/draft/archivedは同じsafe unavailable result。

## Concurrency and Idempotency

- Root `version bigint`、new draft=1、各成功mutationで+1。
- update/publish/archive/deleteは`expected_version`必須。silent last-write-wins禁止。
- mutating commandは`idempotency_key`を受け、actor+command keyをDBでlock/receipt化する既存patternを踏襲。同key同requestはoriginal result replay、同key異requestは`IDEMPOTENCY_CONFLICT`。
- publish race: row lock後、v3の一commandだけがpublished v4とrecipient snapshotを作る。競合する別keyは`VERSION_CONFLICT`または`STATE_CONFLICT`。recipient uniqueにより二重snapshotなし。
- publish/edit race: 先にlockした一方だけがv3から成功。後続はversion conflict。
- publish/archive race: archiveはpublished preconditionなのでdraftと同時には成功しない。publish commit後にv4を読んだ明示archiveだけが可能。
- archive race:一commandだけがarchivedへ進み、retryはoriginal result replay、別keyはconflict。

## Stable Error Contract

| Code | Meaning |
| --- | --- |
| `INVALID_INPUT` | malformed/blank/limit-invalid input |
| `NOT_FOUND` | nonexistent、foreign scope、unauthorized row。existence non-disclosure |
| `FORBIDDEN` | known caller role cannot perform command where row existence is not involved |
| `VERSION_CONFLICT` | authorized current row exists but expected version stale。current version may be returned only to authorized Admin |
| `STATE_CONFLICT` | command invalid for current lifecycle state |
| `EMPTY_AUDIENCE` | authorized draft audience resolves to zero |
| `IDEMPOTENCY_CONFLICT` | same actor/key with different normalized request |

raw SQL、policy名、foreign organization/branch/Worker existenceをclientへ返さない。

## Audit Requirements

Root fields: `created_at/by`、`updated_at/by`、`published_at/by`、`archived_at/by`、`version`。actor FKは`ON DELETE SET NULL`。published/archived timestampはactor pairと整合するcheck constraintを持つ。

MVPではfull content revision history tableを必須にしない。published contentがimmutableなため、canonical published snapshotはroot自身で保持できる。command idempotency/auditのprivate receiptがrequest snapshotを持つ場合もData APIへ公開しない。draft edit履歴・diffはLater。

## Conceptual DB Model

### `public.announcements`

Purpose: source contentとlifecycle。

- PK `id uuid`。
- `state draft|published|archived`、`version bigint >= 1`。
- `scope_type organization|branch`、branch scope時だけ`branch_id` non-null。
- `title text`、`body text`、`importance normal|important`。
- audit fields above。
- immutable after publish: content、importance、scope、branch、published fields。
- constraints: normalized strings/limits、state/timestamp actor shape、scope/branch shape。
- RLS enabled。Admin SELECTのみscope-authorized。Worker direct SELECTはrecipient joinを伴うpolicyまたはsafe read functionに限定。authenticated direct DML grantなし。

### `public.announcement_recipients`

Purpose: publish時のimmutable audience snapshotとWorker read authorization。

- PK `id uuid`。
- FK `announcement_id`、`worker_id`、`recipient_profile_id`。
- `created_at` = publication transaction server time。
- unique `(announcement_id, worker_id)`、unique `(announcement_id, recipient_profile_id)`。
- published announcementだけに存在し、runtime client direct DMLなし。
- Worker SELECTはown profileかつcurrent active Worker/profile、source publishedのみ。Admin SELECTはsource scope authorized。
- source published/archivedはphysical delete不可。draftにはrecipient rowを作らない。

### `private.announcement_command_receipts`（必要最小限）

Purpose: mutation replay、same-key conflict、normalized request/result snapshot。Data API非公開、runtime table grantなし。公開RPCだけがactor/scope/stateを検証して使用する。

Announcement-specific Notification projection receipt/stateはINT-2.9E責務。DB-2.9Bでは後続scanが可能な`published_at,id`とrecipient identityを保証する。

## Proposed Commands

| Command | Caller | Input | Preconditions / transaction | Output |
| --- | --- | --- | --- | --- |
| `create_announcement_draft` | Manager/System Admin | scope、branch、optional draft content、importance、idempotency key | active actor、scope auth。一root insert | ok、id、version、replayed |
| `update_announcement_draft` | Manager/System Admin | id、expected version、title/body/importance/scope、key | authorized draft lock、no recipients。root update | ok、version、replayed |
| `publish_announcement` | Manager/System Admin | id、expected version、key | authorized draft、valid content、audience >0。root+recipient snapshot atomic | ok、id、published_at、recipient_count、version、replayed |
| `archive_announcement` | Manager/System Admin | id、expected version、key | authorized published。metadata update only | ok、archived_at、version、replayed |
| `delete_announcement_draft` | Manager/System Admin | id、expected version、key | authorized draft、never published、recipient 0 | ok、deleted、replayed where receipt permits |

すべてactor/time/audienceをserver-side導出し、SECURITY DEFINERが必要ならowner/search path/schema qualification/auth check/branch check/PUBLIC・anon revoke/authenticated narrow grantを明示する。UIからdirect INSERT/UPDATE/DELETEしない。

## Proposed Reads and Pagination

### Admin

- list: authorized scopeのみ。state filter、stable `(coalesce(published_at,created_at) DESC,id DESC)` cursor。UIでdraft/published/archivedを区別。
- detail: root、scope/audience count、audit fields。recipient identity listは初期UI要件にしない。
- MVP search: titleのbounded case-insensitive substringだけ任意で許容。body full-text search、FTS index、Project名検索はLater。

### Worker

- list: own recipient snapshot + state=published + current active accountだけ。`published_at DESC,id DESC` keyset、bounded page。
- detail: listと同じpredicateをUUID direct accessにも適用。title/body/importance/published_atだけを返し、target internals/actor IDs/recipient countを返さない。
- archived/draft/foreign/nonexistentはsame unavailable/not-found contract。

## Proposed Indexes

Query contractから次だけを要求する。

1. `announcements(state, published_at DESC, id DESC)` — System Admin/admin lifecycle listとreconciliation source scan。
2. `announcements(branch_id, state, published_at DESC, id DESC)` where branch scope — Manager list。
3. unique `announcement_recipients(announcement_id, worker_id)`。
4. unique `announcement_recipients(announcement_id, recipient_profile_id)`。
5. `announcement_recipients(recipient_profile_id, announcement_id)` — Worker ownership join。

本文FTS、category、importance単独、unused target typesのindexは追加しない。

## Conceptual RLS Matrix

| Actor | Draft | Published admin read | Published Worker read | Archived | Mutate |
| --- | --- | --- | --- | --- | --- |
| anon | no | no | no | no | no |
| Worker | no | no | own frozen recipient + active account only | no | no |
| Manager | accessible branch only | accessible branch only | n/a | accessible branch history | RPC commands only |
| System Admin | all | all | n/a | all history | RPC commands only |

`TO authenticated`だけに依存しない。table GRANTとRLSを別々に設計し、direct writesをgrantしない。recipient tableもWorkerが他recipientを列挙できないようRLSを持つ。

## Threat Model

| Threat | Mitigation |
| --- | --- |
| Worker guesses Announcement UUID | own recipient + published + active predicates、foreign/nonexistent同応答 |
| Worker guesses recipient UUID | own `recipient_profile_id` RLS、他row 0件 |
| Manager crosses branch | DB derives actor access; foreign branch/source `NOT_FOUND` |
| client forges organization/branch | organizationはcurrent deployment、branchはcommandでaccess検証 |
| client forges recipient IDs/count | publish command derives full set; no recipient input |
| stale update/publish | row lock + expected version |
| double publish | state precondition、idempotency receipt、recipient unique |
| publish/archive race | state/version lock ordering。archive requires published version |
| target mutation after publish | recipient table immutable、direct DMLなし |
| inactive/deleted Worker | snapshot retained、runtime active check、profile unlink not remapped |
| missing Notification projection | canonical publish retained、bounded reconciliation |
| duplicate Notification | source+recipient DB unique + receipt |
| archived source from old Notification | Notification remains、resolver returns unavailable、CTA disabled |
| draft leakage via Notification | projection scans committed published source/recipient only |
| raw body XSS | plain text storage/render、no raw HTML/Markdown |
| actor deletion | audit FK SET NULL、organization-owned source retained |
| service role leakage | product path禁止、clientへ渡さない |

## Domain Decision Table

| Topic | Decision | Reason |
| --- | --- | --- |
| Definition | Admin-authored organization-owned publishable content aggregate | NotificationとSOTを分離 |
| Ownership | current single organization; branch is operational scope | author deletionで消えず既存modelに一致 |
| Lifecycle | draft → published → archived | 最小明確。archived terminal |
| Publish command | explicit atomic RPC | UI direct status update禁止 |
| Published editing | immutable | viewed content/audience/auditを固定 |
| Target types | organization active workers / branch active workers | Figma needとcurrent authorizationの最小交点 |
| Target snapshot | publish-time immutable recipients | auditとNotificationを一致 |
| Worker authorization | published + own recipient + active runtime identity | IDOR/inactive access防止 |
| Body format | plain text、1–5000 | XSS/renderer complexity回避 |
| Category | none | stable taxonomyなし |
| Importance | normal / important | operational prominenceを最小表現 |
| Read semantics | Notification readのみ | 二重read状態を回避 |
| Archive | Workerから非表示、Admin history保持、terminal | source/audit保持 |
| Delete | draft only physical delete | published source/Notification dangling防止 |
| Concurrency | bigint version + expected version + idempotency key | existing convention、race safety |
| Notification relationship | derived separate transaction | source成功をdelivery failureでrollbackしない |
| Notification retry | at-least-once + unique + reconciliation | effectively-once item |
| Source navigation | separate Announcement resolver + canonical detail route | Incident resolverの責務を維持 |
| Scheduling | no、publish now only | scheduler/timezone/retryを回避 |
| Expiration | no、manual archive | archiveとの二重状態回避 |
| Empty audience | reject | meaningless publicationを防止 |
| Re-publish | no | recipient/read/published_at semanticsを固定 |

## UI Handoffs

### UI-2.9C Admin

draft/published/archived list、draft create/edit、scope selector、resolved audience count preview、plain-text preview、publish confirm、archive confirm、version conflict refreshを提供する。published editorを表示しない。schedule/category/pin/channels/expiration/view rateは表示しない。

### UI-2.9D Worker

Announcement list/detailをNotification Inboxと別責務で提供。importanceをtext + icon等で表し色だけに依存しない。published dateを表示。direct detail routeでもauthorization。archived/unavailableは安全な表示。独自未読状態なし。

### INT-2.9E

publish → frozen recipients → idempotent Notification projection → Inbox → separate resolver → authorized Announcementを検証する。retry、concurrency、missing projection recovery、archive後unavailable、existing Incident notifications無回帰を必須とする。

## Handoff to DB-2.9B

DB-2.9Bは次を実装・検証する。

1. `announcements`、`announcement_recipients`、private command receiptと上記constraints/indexes。
2. five narrow commands、stable error/replay/version/state contract。
3. publish root + recipient snapshotの単一transaction。
4. Manager branch/System Admin/Worker/anonのGRANT・RLS・IDOR tests。
5. Worker active/inactive、profile unlink、branch move後snapshot、zero audience、publish/edit/archive race tests。
6. published content/recipient immutabilityとdraft-only delete。
7. DB lint/advisors、Local-only integration suite。
8. INT-2.9Eがscanできるstable `published_at,id`およびrecipient keys。

DB-2.9BではNotification schemaを同時に一般化しない。Announcement source persistence/commands/reads/securityを先に完成させ、Notification narrow extensionはINT-2.9Eで行う。

## Explicit Non-Goals

Email、LINE、SMS、Web/native Push、preferences、scheduled publish、recurrence、expiration、attachments、rich text/Markdown/HTML、comments、reactions、chat、direct message、specific Worker/Shift/Assignment/Project/Job/Workplace targets、pin、analytics/read receipt、mandatory acknowledgement、re-notify、Arrival、Emergency、Realtime、polling、Broadcast、Delivery History。

## Open Questions

Blocking open question: none。specific target types、multi-tenant organization table、draft revision history、external channelsは将来phaseで新しいevidenceがある場合に再設計する。

## Files Changed

- `docs/domain-2.9a-announcement-design-result.md` only。

No migration、table、RLS、RPC、Auth、app/component、package、remote、commit/push changes。

**DOMAIN-2.9A: COMPLETE**  
**DB-2.9B: READY**
