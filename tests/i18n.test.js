const assert = require("node:assert/strict");
const test = require("node:test");

const { createTranslator, dictionaries, normalizeLanguage } = require("../src/ui/i18n");

test("normalizeLanguage falls back to English for unknown languages", () => {
  assert.equal(normalizeLanguage("zh-CN"), "zh-CN");
  assert.equal(normalizeLanguage("en"), "en");
  assert.equal(normalizeLanguage("fr"), "en");
  assert.equal(normalizeLanguage(undefined), "en");
});

test("createTranslator returns English and Chinese copy", () => {
  const en = createTranslator("en");
  const zh = createTranslator("zh-CN");

  assert.equal(en("actions.upload.title"), "Upload");
  assert.equal(zh("actions.upload.title"), "上传");
  assert.equal(en("status.ready.title"), "Ready");
  assert.equal(zh("status.ready.title"), "准备就绪");
  assert.equal(en("actions.connect.title"), "Connect GitHub");
  assert.equal(zh("actions.connect.title"), "连接 GitHub");
  assert.equal(en("hero.title"), "Codex Env Sync");
  assert.equal(zh("hero.title"), "Codex Env Sync");
});

test("every English key exists in Chinese dictionary", () => {
  const missing = Object.keys(dictionaries.en).filter((key) => !(key in dictionaries["zh-CN"]));

  assert.deepEqual(missing, []);
});
