import assert from "node:assert/strict";
import fs from "node:fs";

const read=(path)=>fs.readFileSync(path,"utf8");let passed=0;function pass(name,value){assert.ok(value,name);passed+=1;console.log(`PASS ${name}`);}
const helper=read("lib/worker/announcements/get-worker-announcements.ts");const list=read("components/worker/announcements/worker-announcement-list.tsx");const detail=read("components/worker/announcements/worker-announcement-detail.tsx");const listPage=read("app/worker/announcements/page.tsx");const detailPage=read("app/worker/announcements/[announcementId]/page.tsx");const layout=read("app/worker/layout.tsx");
pass("list uses canonical Worker RPC",helper.includes('rpc("list_worker_announcements"'));
pass("detail uses canonical Worker RPC",helper.includes('rpc("get_worker_announcement"'));
pass("read helper contains no direct Announcement select",!helper.includes('.from("announcements")')&&!helper.includes("announcement_recipients"));
pass("list page uses Worker guard",listPage.includes("requireWorker()"));pass("detail page uses Worker guard",detailPage.includes("requireWorker()"));
pass("stable cursor keeps published time and id",helper.includes("p_cursor_published_at")&&helper.includes("p_cursor_id"));pass("page is bounded to twenty",helper.includes("const PAGE_SIZE = 20")&&helper.includes("PAGE_SIZE+1"));
pass("empty state is Announcement-specific",list.includes("現在のお知らせはありません"));pass("importance has icon and text",read("components/worker/announcements/worker-announcement-importance.tsx").includes("AlertTriangle")&&list.includes("WorkerAnnouncementImportance"));
pass("published date uses semantic time",list.includes("<time")&&detail.includes("<time"));pass("detail renders plain text",detail.includes("whitespace-pre-wrap")&&!detail.includes("dangerouslySetInnerHTML"));pass("long content can wrap",detail.includes("break-words")&&list.includes("break-words"));
pass("safe unavailable wording is shared",(detailPage.match(/return unavailable\(\)/g)||[]).length>=2);pass("detail validates direct UUID",detailPage.includes("uuidSchema.safeParse"));pass("recipient internals are absent",![list,detail,listPage,detailPage].join("\n").includes("recipient"));
pass("Announcement does not mark read",![helper,listPage,detailPage].join("\n").includes("read_at"));pass("Announcement has no unread badge",!list.includes("未読")&&!detail.includes("未読"));
pass("navigation separates Announcement and Notification",layout.includes('href="/worker/announcements"')&&layout.includes('`通知、未読${unreadCount}件`'));
pass("Notification integration is absent",![helper,listPage,detailPage].join("\n").includes("notification"));pass("responsive max width is bounded",listPage.includes("max-w-3xl")&&detail.includes("max-w-3xl"));pass("targets are at least forty-four pixels",list.includes("min-h-24")&&detail.includes("min-h-11"));pass("generic retry state is present",listPage.includes("再読み込み")&&detailPage.includes("再読み込み"));
console.log(`Worker Announcement UI: ${passed}/${passed} passed`);
