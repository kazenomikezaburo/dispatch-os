import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [clients, workplaces, workspace, sectionTabs, tabStyles, breadcrumb, nav, editor, drawer, setup, clientActions, workplaceActions] = await Promise.all([
  read("app/admin/clients/page.tsx"),
  read("app/admin/workplaces/page.tsx"),
  read("components/admin/masters/master-workspace-header.tsx"),
  read("components/admin/admin-section-tabs.tsx"),
  read("components/admin/admin-navigation-tab-styles.ts"),
  read("components/admin/admin-breadcrumb.tsx"),
  read("components/admin/admin-nav.ts"),
  read("components/admin/masters/master-editor.tsx"),
  read("components/admin/drawer.tsx"),
  read("components/admin/projects/setup/project-setup-form.tsx"),
  read("app/actions/clients.ts"),
  read("app/actions/workplaces.ts"),
]);

assert.match(workspace, /title="マスタ"/);
assert.match(workspace, /案件で利用する取引先を管理します/);
assert.match(workspace, /勤務先・会場は案件から管理します/);
assert.doesNotMatch(workspace, /href: "\/admin\/workplaces"/);
assert.match(sectionTabs, /usePathname/);
assert.match(sectionTabs, /pathname === item\.href/);
assert.match(sectionTabs, /aria-current/);
assert.match(sectionTabs, /<nav/);
assert.match(tabStyles, /min-h-11/);
assert.match(sectionTabs, /overflow-x-auto/);
assert.match(tabStyles, /after:h-0\.5/);
assert.match(clients, /MasterWorkspaceHeader/);
assert.match(workplaces, /MasterWorkspaceHeader/);
assert.match(clients, /取引先一覧/);
assert.match(workplaces, /勤務先一覧/);
assert.match(clients, /MasterEditor kind="client"/);
assert.match(workplaces, /MasterEditor kind="workplace"/);
assert.match(clients, /MasterFilters path="\/admin\/clients"/);
assert.match(workplaces, /MasterFilters path="\/admin\/workplaces"/);
assert.match(clients, /MasterList kind="client"/);
assert.match(workplaces, /MasterList kind="workplace"/);
assert.match(clients, /AdminEmptyState/);
assert.match(workplaces, /AdminEmptyState/);
assert.match(breadcrumb, /label: "マスタ"/);
assert.match(breadcrumb, /label: "取引先"/);
assert.match(breadcrumb, /label: "勤務先"/);
assert.match(nav, /label: "マスタ"/);
assert.match(editor, /Drawer/);
assert.match(editor, /saveClient/);
assert.match(editor, /saveWorkplace/);
assert.match(drawer, /Escape/);
assert.match(setup, /saveClient/);
assert.match(setup, /saveWorkplace/);
assert.match(clientActions, /clientSchema\.safeParse/);
assert.match(workplaceActions, /workplaceSchema\.safeParse/);
assert.doesNotMatch(workspace, /\/worker/);

console.log("Admin master workspace: PASS (36 assertions)");
