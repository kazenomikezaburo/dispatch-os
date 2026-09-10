# Phase UI-2.9C Admin Announcement Management UI Result

## Status

`UI-2.9C: COMPLETE`

DB-2.9B の固定済み Announcement contract を変更せず、Admin のお知らせ一覧、下書き作成・編集、公開、アーカイブ、下書き削除を実装した。

## Routes

- `/admin/announcements`: 状態フィルター付き一覧、空状態、20件単位の keyset pagination
- `/admin/announcements/new`: 下書き作成
- `/admin/announcements/[announcementId]`: 詳細、状態別操作、`?edit=1` の下書き編集

## Implemented

- List: `all / draft / published / archived`、canonical `list_admin_announcements`、作成日時とIDによる安定cursor、タイトルを主要navigationに使用
- Draft create/edit: タイトル・本文を空のまま保存可能、120/5000文字制限、通常/重要、表示preview、二重送信抑止と同一内容のidempotency key再利用
- Audience: Managerは所属拠点固定、System Adminは全Workerまたは有効拠点を選択。事前人数を推測せずscope textを表示し、人数は公開時にDB確定
- Publish: canonical `publish_announcement`、対象・重要度・公開後の不変性を確認dialogに表示
- Archive: canonical `archive_announcement`、Workerから非表示になることを確認dialogに表示
- Delete draft: canonical `delete_announcement_draft`、draftのみ表示、不可逆操作の確認dialog
- Conflict handling: `VERSION_CONFLICT` / `STATE_CONFLICT` は再読込導線、`EMPTY_AUDIENCE` は安全なvalidation、`NOT_FOUND` は非開示、`FORBIDDEN` / `IDEMPOTENCY_CONFLICT` / generic errorをraw DB errorなしで表示
- Published/archived: 内容・対象とも読み取り専用。公開後編集、unpublishは実装していない
- Security: 全route/actionでserver-side Admin guard、read/mutationはcanonical RPCのみ、UIからのdirect table mutationなし

## Figma Comparison

- `117:2` create: タイトル、本文、重要度、対象、preview、下書き保存をadapt/implement。category、pin、badge、LINE、Push、schedule、expiry、予約公開はdomain外としてomit
- `117:233` edit: draft編集の構成をadapt。published editing、対象変更、未読/閲覧数、unpublishは固定contractに従い意図的にomit
- `119:2` list: 状態、タイトル、対象、公開/アーカイブ日時をadapt/implement。検索、category、analytics、pin、channelはomit

## Browser QA

- Manager: login、一覧、所属拠点固定、未入力draft保存、編集、公開確認、公開、公開後read-only、archive、archive後read-onlyを実ChromeでPASS。organization scopeは非表示
- System Admin: login、organization draft作成・公開、organization/branch切替とbranch一覧を実ChromeでPASS
- Conflict: 同じdraftを2つのChrome contextで開き、先行更新後のstale更新に安全なVERSION_CONFLICTと再読込導線を確認
- Delete: temporary draftを実Chromeで削除し、一覧から消えることを確認。published/archivedには削除optionなし
- Responsive: mobile-first stacking、`sm`/`xl`切替、list overflow、form/textarea、scope selector、dialog、detailの幅制約を390x844、1280、1440x900相当で確認。実Chrome desktop screenshotでも横幅・情報密度・sticky previewを確認
- Accessibility: 44px target、label、error association、heading、非色依存の重要表示、native dialog、focus trap、Escape close、focus restore、button/link semanticsを確認
- Console/hydration: application error 0、React warning 0、hydration warning 0（DevTools/HMR infoのみ）

実操作で、既存fixture UUIDをZodのstrict version checkが拒否する問題と、複数dialog間でARIA IDが重複する問題を発見した。既存共通`uuidSchema`の利用と`useId`による一意ID化だけを行い、再検証した。

## Tests

- Admin Announcement UI: 28/28 PASS
- Announcement persistence/security: 50/50 PASS
- Operational Incident: 47/47 PASS
- Worker In-app Notification: 40/40 PASS
- Notification Source Context: 18/18 PASS
- Worker Notification Inbox UI: 22/22 PASS
- Admin existing UI alignment: 24/24 PASS
- Admin Incident UI: 19/19 PASS
- Day-of rules: 17/17 PASS
- Day-of fixture matrix: 12/12 PASS
- Attendance UI rules: PASS
- Placement editor rules: 13/13 PASS
- Placement rules: 39/39 PASS

## Static Verification

- TypeScript: PASS (`npm run build`)
- focused ESLint: PASS
- production build: PASS (Next.js 16.3.1, Announcement 3 routes included)
- `git diff --check`: PASS（既存ファイルのLF/CRLF warningのみ）

## Fixture Cleanup

- Browser temporary draft: UIから削除し一覧消失を確認
- Browser/RPC QA用のdraft、published、archived root、recipient、command receipt: UUID限定cleanup後 `0 / 0 / 0`
- existing seed data: unchanged

## Changed Scope

- Admin navigation、Announcement route/actions/components、Admin data access/schema/types、専用UI test、本result document
- UI実装上の修正は既存共通UUID validator利用とdialog ARIA ID一意化のみ

## Explicitly Unchanged

- DB schema / migrations / RLS / GRANT / RPC contract
- Worker Announcement UI
- Notification type / projection / resolver / reconciliation
- Auth、packages、remote
- commit / push: 0
- 既存のstaged、unstaged、untracked作業は保持

## Remaining Blocker

none

