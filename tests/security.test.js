const assert = require("node:assert/strict");
const test = require("node:test");

const { isAllowedExternalUrl } = require("../src/core/external-url");

test("isAllowedExternalUrl allows GitHub HTTPS URLs", () => {
  assert.equal(isAllowedExternalUrl("https://github.com/hybtc8888/codex-env-sync"), true);
  assert.equal(isAllowedExternalUrl("https://github.com/apps/codex-env-sync"), true);
});

test("isAllowedExternalUrl rejects non-GitHub and unsafe schemes", () => {
  assert.equal(isAllowedExternalUrl("https://example.com"), false);
  assert.equal(isAllowedExternalUrl("http://github.com/hybtc8888/codex-env-sync"), false);
  assert.equal(isAllowedExternalUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedExternalUrl("file:///C:/Windows/System32/calc.exe"), false);
  assert.equal(isAllowedExternalUrl("not a url"), false);
});
