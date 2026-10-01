import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const visibleFiles = [
  "app/layout.tsx",
  "app/login/page.tsx",
  "components/admin/admin-header.tsx",
  "components/admin/admin-mobile-sidebar.tsx",
  "components/admin/admin-sidebar.tsx",
  "components/worker/worker-shell.tsx",
];
const legacyBrand = /Dispatch OS|DispatchOS|ShiftOps|Shift Ops|派遣業務OS/;

test("primary user-visible brand surfaces use OpsCue", async () => {
  for (const path of visibleFiles) {
    const source = await read(path);
    assert.match(source, /OpsCue/, `${path} should contain OpsCue`);
    assert.doesNotMatch(source, legacyBrand, `${path} should not contain a legacy product name`);
  }
});

test("root metadata uses the approved product copy", async () => {
  const layout = await read("app/layout.tsx");
  assert.match(layout, /title: "OpsCue"/);
  assert.match(layout, /description: "募集から、現場が無事に終わるまで。"/);
});

test("login presents the approved product name and tagline", async () => {
  const login = await read("app/login/page.tsx");
  assert.match(login, />OpsCue</);
  assert.match(login, /募集から、現場が無事に終わるまで。/);
});
