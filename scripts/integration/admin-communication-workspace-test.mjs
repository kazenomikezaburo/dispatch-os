import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [incidents, announcements, workspace, tabs, tabStyles, masterWorkspace, breadcrumb, nav, drawer, announcementDetail, announcementActions, announcementStatus, newPage, detailPage] = await Promise.all([
  read("app/admin/incidents/page.tsx"),
  read("app/admin/announcements/page.tsx"),
  read("components/admin/communication/communication-workspace-header.tsx"),
  read("components/admin/admin-section-tabs.tsx"),
  read("components/admin/admin-navigation-tab-styles.ts"),
  read("components/admin/masters/master-workspace-header.tsx"),
  read("components/admin/admin-breadcrumb.tsx"),
  read("components/admin/admin-nav.ts"),
  read("components/admin/incidents/incident-drawer.tsx"),
  read("components/admin/announcements/announcement-detail.tsx"),
  read("components/admin/announcements/announcement-actions.tsx"),
  read("components/admin/announcements/announcement-status-badge.tsx"),
  read("app/admin/announcements/new/page.tsx"),
  read("app/admin/announcements/[announcementId]/page.tsx"),
]);

assert.match(workspace, /title="連絡"/);
assert.match(workspace, /現場からの問い合わせと管理者からのお知らせを管理します/);
assert.match(workspace, /href: "\/admin\/incidents"/);
assert.match(workspace, /href: "\/admin\/announcements"/);
assert.match(tabs, /usePathname/);
assert.match(tabs, /pathname === item\.href/);
assert.match(tabs, /aria-current/);
assert.match(tabStyles, /min-h-11/);
assert.match(tabs, /overflow-x-auto/);
assert.match(tabStyles, /after:h-0\.5/);
assert.match(masterWorkspace, /AdminSectionTabs/);
assert.match(incidents, /CommunicationWorkspaceHeader/);
assert.match(announcements, /CommunicationWorkspaceHeader/);
assert.match(incidents, /ヘルプリクエスト一覧/);
assert.match(announcements, /お知らせ一覧/);
assert.doesNotMatch(incidents, /お知らせを作成/);
assert.match(announcements, /href="\/admin\/announcements\/new"/);
assert.match(announcements, /お知らせを作成/);
assert.match(incidents, /IncidentDrawer/);
assert.match(incidents, /未対応/);
assert.match(incidents, /対応中/);
assert.match(incidents, /解決済み/);
assert.match(drawer, /acknowledgeOperationalIncident/);
assert.match(drawer, /resolveOperationalIncident/);
assert.match(announcementStatus, /draft/);
assert.match(announcementStatus, /published/);
assert.match(announcementStatus, /archived/);
assert.match(announcementDetail, /state==="draft"\?<Link/);
assert.doesNotMatch(announcementDetail, /state==="published"\?<Link/);
assert.match(announcementActions, /state==="published"&&<button/);
assert.doesNotMatch(announcementActions, /state==="archived"&&/);
assert.match(breadcrumb, /label: "連絡"/);
assert.match(breadcrumb, /label: "ヘルプリクエスト"/);
assert.match(breadcrumb, /label: "お知らせ"/);
assert.match(newPage, /label:"連絡"/);
assert.match(detailPage, /label:"連絡"/);
assert.match(nav, /label: "連絡"/);
assert.doesNotMatch(workspace, /\/worker/);
assert.doesNotMatch(incidents, /AnnouncementList|AnnouncementForm/);
assert.doesNotMatch(announcements, /IncidentList|IncidentDrawer/);

console.log("Admin communication workspace: PASS (40 assertions)");
