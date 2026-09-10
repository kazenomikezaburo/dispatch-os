import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatWorkerUnreadCount } from "../../lib/worker/notifications/worker-notification-types.ts";

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`PASS ${name}`); }

const readModel = await readFile(new URL("../../lib/worker/notifications/get-worker-notifications.ts", import.meta.url), "utf8");
const action = await readFile(new URL("../../app/actions/worker-notifications.ts", import.meta.url), "utf8");
const inbox = await readFile(new URL("../../components/worker/notifications/worker-notification-inbox.tsx", import.meta.url), "utf8");
const layout = await readFile(new URL("../../app/worker/layout.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../../app/worker/notifications/page.tsx", import.meta.url), "utf8");

test("unread count keeps zero display value", () => assert.equal(formatWorkerUnreadCount(0), "0"));
test("unread count displays exact positive value", () => assert.equal(formatWorkerUnreadCount(12), "12"));
test("unread count caps display above 99", () => assert.equal(formatWorkerUnreadCount(100), "99+"));
test("read model is recipient scoped", () => assert.match(readModel, /\.eq\("recipient_profile_id", profileId\)/));
test("unread count uses exact head query", () => { assert.match(readModel, /count: "exact", head: true/); assert.match(readModel, /\.is\("read_at", null\)/); });
test("list has stable created-at and id ordering", () => { assert.match(readModel, /\.order\("created_at", \{ ascending: false \}\)/); assert.match(readModel, /\.order\("id", \{ ascending: false \}\)/); });
test("list uses a bounded keyset page", () => { assert.match(readModel, /PAGE_SIZE \+ 1/); assert.match(readModel, /created_at\.lt/); assert.match(readModel, /id\.lt/); });
test("read model never reads incident internals", () => { assert.doesNotMatch(readModel, /operational_incident/); assert.doesNotMatch(readModel, /source_incident_event_id/); });
test("open validates id and authenticates Worker", () => { assert.match(action, /uuidSchema\.safeParse/); assert.match(action, /await requireWorker\(\)/); });
test("explicit open uses existing mark-read RPC", () => assert.match(action, /\.rpc\("mark_in_app_notification_read"/));
test("source CTA uses type-specific safe resolver RPCs", () => { assert.match(action, /resolve_in_app_notification_source_context/); assert.match(action, /resolve_announcement_notification_source_context/); });
test("action contains no direct notification DML", () => assert.doesNotMatch(action, /\.insert\(|\.update\(|\.delete\(/));
test("action exposes no incident or event identifiers", () => assert.doesNotMatch(action, /incidentId|eventId|source_incident/));
test("list render itself does not mark read", () => assert.equal((inbox.match(/openWorkerNotification\(/g) ?? []).length, 1));
test("detail uses an accessible native dialog", () => { assert.match(inbox, /<dialog/); assert.match(inbox, /aria-labelledby="worker-notification-detail-title"/); assert.match(inbox, /trapDialogFocus/); });
test("read state is expressed with text", () => { assert.match(inbox, /"既読" : "未読"/); assert.match(inbox, /aria-label=\{`\$\{notification\.readAt/); });
test("safe unavailable creates no source URL", () => assert.match(inbox, /sourceId \? .*href=\{sourceKind === "announcement"/s));
test("safe unavailable message hides internal reason", () => { assert.match(inbox, /関連する勤務情報は現在表示できません/); assert.doesNotMatch(inbox, /deleted|ownership|event missing|source invalid/i); });
test("Announcement notification has a type label and canonical CTA", () => { assert.match(inbox, /announcement_published: "お知らせ"/); assert.match(inbox, /`\/worker\/announcements\/\$\{sourceId\}`/); });
test("shell entry has an accessible unread badge label", () => { assert.match(layout, /href="\/worker\/notifications"/); assert.match(layout, /通知、未読\$\{unreadCount\}件/); assert.match(layout, /href="\/worker\/announcements" aria-label="お知らせ"/); });
test("zero unread hides the visual badge", () => assert.match(layout, /unreadCount > 0 && <span/));
test("route remains server guarded", () => assert.match(page, /await requireWorker\(\)/));
test("empty state is present", () => assert.match(inbox, /新しい通知はありません/));

console.log(`\nWorker Notification Inbox UI rules: ${passed}/${passed} passed`);
