import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getWorkerActiveNav } from "../../components/worker/worker-nav-routes.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const [layout, shell, shifts, support, mypage] = await Promise.all([
  read("app/worker/layout.tsx"), read("components/worker/worker-shell.tsx"), read("app/worker/shifts/page.tsx"), read("app/worker/support/page.tsx"), read("app/worker/mypage/page.tsx"),
]);

test("all canonical and retained Worker routes have explicit active navigation", () => {
  assert.equal(getWorkerActiveNav("/worker"), "home");
  assert.equal(getWorkerActiveNav("/worker/recruitment/00000000-0000-0000-0000-000000000000"), "recruitment");
  assert.equal(getWorkerActiveNav("/worker/shifts"), "shifts");
  assert.equal(getWorkerActiveNav("/worker/assignments/00000000-0000-0000-0000-000000000000"), "shifts");
  assert.equal(getWorkerActiveNav("/worker/support"), "support");
  assert.equal(getWorkerActiveNav("/worker/announcements/example"), "support");
  assert.equal(getWorkerActiveNav("/worker/mypage"), "mypage");
  assert.equal(getWorkerActiveNav("/worker/availability"), "mypage");
  assert.equal(getWorkerActiveNav("/worker/settings/line"), "mypage");
  assert.equal(getWorkerActiveNav("/worker/notifications"), null);
  assert.equal(getWorkerActiveNav("/worker/notifications/example"), null);
  assert.equal(getWorkerActiveNav("/worker/unknown"), null);
});

test("Worker layout preserves server auth and unread projection", () => {
  assert.match(layout, /await requireWorker\(\)/);
  assert.match(layout, /getWorkerUnreadNotificationCount\(profile\.id\)/);
  assert.match(layout, /<WorkerShell/);
});

test("shared shell contains five canonical destinations and responsive geometry", () => {
  for (const href of ["/worker", "/worker/recruitment", "/worker/shifts", "/worker/support", "/worker/mypage"]) assert.match(shell, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
  assert.match(shell, /h-\[calc\(74px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(shell, /md:pl-60/);
  assert.match(shell, /md:h-\[72px\]/);
  assert.match(shell, /aria-current/);
});

test("new hubs reuse existing guarded Worker capabilities", () => {
  assert.match(shifts, /await requireWorker\(\)/);
  assert.match(shifts, /getWorkerAssignments\(profile\.id\)/);
  assert.match(shifts, /My Shifts/);
  assert.match(support, /await requireWorker\(\)/);
  assert.match(support, /\/worker\/announcements/);
  assert.match(support, /\/worker\/shifts/);
  assert.match(mypage, /await requireWorker\(\)/);
  assert.match(mypage, /\/worker\/availability/);
  assert.match(mypage, /\/worker\/settings\/line/);
  assert.match(mypage, /action=\{logout\}/);
});
