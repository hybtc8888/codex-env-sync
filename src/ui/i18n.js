(function attachI18n(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CodexEnvSyncI18n = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function buildI18n() {
  const dictionaries = {
    en: {
      "app.lang": "English",
      "app.languageLabel": "Language",
      "hero.eyebrow": "Bidirectional Codex settings sync",
      "hero.title": "Codex Env Sync",
      "hero.lede": "Upload from this machine, download on another. Accounts stay local; settings travel safely.",
      "status.ready.title": "Ready",
      "status.ready.copy": "Choose upload or download after checking paths.",
      "labels.repoUrl": "GitHub repository URL",
      "labels.githubToken": "GitHub token",
      "labels.gitName": "Git name",
      "labels.gitEmail": "Git email",
      "labels.repoRoot": "Repository folder",
      "labels.codexHome": "Codex home",
      "labels.message": "Commit message",
      "labels.preview": "Preview only",
      "placeholders.repoUrl": "https://github.com/you/codex-env-sync.git...",
      "placeholders.githubToken": "Optional: enables sync without local Git...",
      "placeholders.gitName": "Your Git name...",
      "placeholders.gitEmail": "you@example.com...",
      "actions.setup.title": "Setup",
      "actions.setup.copy": "Bind repo and local Git identity",
      "actions.upload.title": "Upload",
      "actions.upload.copy": "Export safe settings, commit, push",
      "actions.download.title": "Download",
      "actions.download.copy": "Pull remote settings, install locally",
      "actions.check.title": "Check Safety",
      "actions.check.copy": "Scan before sharing or installing",
      "activity.title": "Activity",
      "activity.mode": "Two-way mode",
      "status.running.copy": "Keep this window open while the operation finishes.",
      "status.complete.copy": "Review the activity log for details.",
      "status.blocked.copy": "Fix the reported issue and try again.",
      "status.failed.copy": "Unexpected error. Review the activity log.",
      "log.started": "{label} started.",
      "state.running": "{label} running",
      "state.complete": "{label} complete",
      "state.blocked": "{label} blocked",
      "state.failed": "{label} failed",
      "action.setup": "Setup",
      "action.upload": "Upload",
      "action.download": "Download",
      "action.check": "Safety check"
    },
    "zh-CN": {
      "app.lang": "中文",
      "app.languageLabel": "语言",
      "hero.eyebrow": "双向同步 Codex 设置",
      "hero.title": "Codex Env Sync",
      "hero.lede": "这台机器可以上传，另一台机器可以下载。账号留在本机，设置安全流动。",
      "status.ready.title": "准备就绪",
      "status.ready.copy": "检查路径后，选择上传或下载。",
      "labels.repoUrl": "GitHub 仓库地址",
      "labels.githubToken": "GitHub token",
      "labels.gitName": "Git 名称",
      "labels.gitEmail": "Git 邮箱",
      "labels.repoRoot": "仓库文件夹",
      "labels.codexHome": "Codex 目录",
      "labels.message": "提交信息",
      "labels.preview": "仅预览",
      "placeholders.repoUrl": "https://github.com/you/codex-env-sync.git...",
      "placeholders.githubToken": "可选：无需本机 Git 即可同步...",
      "placeholders.gitName": "你的 Git 名称...",
      "placeholders.gitEmail": "you@example.com...",
      "actions.setup.title": "设置",
      "actions.setup.copy": "绑定仓库和本机 Git 身份",
      "actions.upload.title": "上传",
      "actions.upload.copy": "导出安全设置，提交并推送",
      "actions.download.title": "下载",
      "actions.download.copy": "拉取远端设置并安装到本机",
      "actions.check.title": "安全检查",
      "actions.check.copy": "分享或安装前扫描",
      "activity.title": "活动记录",
      "activity.mode": "双向模式",
      "status.running.copy": "操作进行中，请保持窗口打开。",
      "status.complete.copy": "详情请查看活动记录。",
      "status.blocked.copy": "修复报告的问题后再试。",
      "status.failed.copy": "出现意外错误，请查看活动记录。",
      "log.started": "{label} 已开始。",
      "state.running": "{label}进行中",
      "state.complete": "{label}完成",
      "state.blocked": "{label}被阻止",
      "state.failed": "{label}失败",
      "action.setup": "设置",
      "action.upload": "上传",
      "action.download": "下载",
      "action.check": "安全检查"
    }
  };

  function normalizeLanguage(language) {
    return language === "zh-CN" || language === "en" ? language : "en";
  }

  function createTranslator(language) {
    const lang = normalizeLanguage(language);
    return function translate(key, replacements = {}) {
      let value = dictionaries[lang][key] || dictionaries.en[key] || key;
      for (const [name, replacement] of Object.entries(replacements)) {
        value = value.replaceAll(`{${name}}`, replacement);
      }
      return value;
    };
  }

  return {
    createTranslator,
    dictionaries,
    normalizeLanguage
  };
});

