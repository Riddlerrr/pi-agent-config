import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";
import register from "./index.ts";

const home = mkdtempSync(join(tmpdir(), "pi-router-"));
process.on("exit", () => rmSync(home, { recursive: true, force: true }));
process.env.HOME = home;
const dir = join(home, ".pi", "agent");
mkdirSync(dir, { recursive: true });
const file = join(dir, "hindsight.env");
writeFileSync(file, "export HINDSIGHT_API_DECISION_MODEL_API_KEY='file-token'\n", { mode: 0o600 });
let expectedToken = "test-token";
let reply = '{"answers":{"lane":{"choice":"deep"}}}';
process.env.HINDSIGHT_API_DECISION_MODEL_API_KEY = "test-token";
const remote = mock.method(globalThis, "fetch", async (url, opts) => {
  assert.equal(url, "https://decide.test/v1/systemone");
  assert.equal(opts.method, "POST");
  assert.equal(opts.redirect, "error");
  assert.equal(opts.headers.Authorization, "Bearer " + expectedToken);
  assert.ok(JSON.parse(opts.body).state.length <= 4000);
  assert.equal(JSON.parse(opts.body).questions.lane.criteria.deep.includes("Planning a feature"), true);
  if (reply === null) throw Error("offline");
  return new Response(reply, { status: reply === "unauthorized" ? 401 : 200 });
});
let route, preview, notice;
register({ registerVirtualModel: m => route = m.route, registerCommand: (_, c) => preview = c.handler });
const ctx = { modelRegistry: { find: (provider, id) => ({ provider, id }) }, ui: { notify: msg => notice = msg } };
const messages = [{ role: "user", content: [{ type: "text", text: "Translate this" }] }];
const result = await route({ reason: "user", messages }, ctx);
assert.equal(result.model.id, "gpt-6.2-astra");
await preview("x".repeat(5000), ctx);
assert.match(notice, /^hs-decide-1-flash: deep/);
await preview("fast: diagnose a timeout", ctx);
assert.match(notice, /gpt-6-luna · low$/);
await preview("deep: translate this", ctx);
assert.match(notice, /gpt-6.2-astra · high$/);
for (const [reason, key] of [["retry", "failed"], ["continuation", "previous"]]) {
  assert.deepEqual(await route({ reason, [key]: result, messages }, ctx), result);
}
assert.equal((await route({ reason: "direct", messages }, ctx)).model.id, "gpt-6.2-sol");
assert.equal(remote.mock.callCount(), 2);
for (reply of [null, "unauthorized", "invalid JSON", '{"answers":{"lane":{"choice":"other"}}}']) {
  await preview("Add pagination", ctx);
  assert.match(notice, /^local fallback: default → gpt-6.2-sol · xhigh$/);
}
reply = null;
for (const prompt of ["Plan a feature for bulk export", "Plan a bugfix for empty exports", "Analyze bulk export requirements before we implement it"]) {
  await preview(prompt, ctx);
  assert.match(notice, /^local fallback: .* → gpt-6.2-astra · high$/);
}
await preview("Fix the empty export bug", ctx);
assert.match(notice, /gpt-6.2-sol · xhigh$/);
expectedToken = "file-token";
reply = '{"answers":{"lane":{"choice":"deep"}}}';
process.env.HINDSIGHT_API_DECISION_MODEL_API_KEY = "";
await preview("Add pagination", ctx);
assert.match(notice, /^hs-decide-1-flash: deep/);
delete process.env.HINDSIGHT_API_DECISION_MODEL_API_KEY;
await preview("Add pagination", ctx);
assert.match(notice, /^hs-decide-1-flash: deep/);
rmSync(file);
const before = remote.mock.callCount();
await preview("Add pagination", ctx);
assert.match(notice, /local fallback: default \(no decision token\)/);
assert.equal(before, remote.mock.callCount());
mock.restoreAll();
