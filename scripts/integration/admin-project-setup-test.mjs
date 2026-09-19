import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [page, setup, projectActions, jobActions, clientActions, workplaceActions, projectSchema, jobSchema] = await Promise.all([
  read("app/admin/projects/new/page.tsx"),
  read("components/admin/projects/setup/project-setup-form.tsx"),
  read("app/actions/projects.ts"),
  read("app/actions/jobs.ts"),
  read("app/actions/clients.ts"),
  read("app/actions/workplaces.ts"),
  read("lib/admin/projects/project-form-schema.ts"),
  read("lib/admin/projects/job-form-schema.ts"),
]);

assert.match(page, /新規案件セットアップ/);
assert.match(page, /ProjectSetupForm/);
assert.match(page, /initialWorkplaces/);
assert.match(setup, /1\. 案件情報/);
assert.match(setup, /2\. 取引先/);
assert.match(setup, /3\. 業務/);
assert.match(setup, /4\. 勤務先/);
assert.match(setup, /5\. 作成内容の確認/);
assert.match(setup, /clientMode/);
assert.match(setup, /workplaceMode/);
assert.match(setup, /既存から選択/);
assert.match(setup, /新しい取引先を登録/);
assert.match(setup, /新しい勤務先を登録/);
assert.match(setup, /saveClient/);
assert.match(setup, /saveWorkplace/);
assert.match(setup, /createProjectInline/);
assert.match(setup, /createJobInline/);
assert.match(setup, /createdProjectId/);
assert.match(setup, /業務だけを再試行/);
assert.match(setup, /初期業務は任意/);
assert.match(setup, /シフトは作成されません/);
assert.match(setup, /router\.push\(`\/admin\/projects\/\$\{projectId\}`\)/);
assert.match(setup, /aria-invalid/);
assert.match(setup, /requestAnimationFrame/);
assert.match(setup, /min-h-11/);
assert.doesNotMatch(setup, /\/worker/);
assert.match(projectActions, /createProjectCore/);
assert.match(projectActions, /createProjectInline/);
assert.match(jobActions, /createJobInline/);
assert.match(clientActions, /clientSchema\.safeParse/);
assert.match(workplaceActions, /workplaceSchema\.safeParse/);
assert.match(projectSchema, /projectFormSchema/);
assert.match(jobSchema, /jobFormSchema/);
assert.doesNotMatch(setup, /createShift|saveShift|bulkCreateShift/);
assert.match(page, /\/admin\/projects/);

console.log("Admin unified project setup: PASS (35 assertions)");
