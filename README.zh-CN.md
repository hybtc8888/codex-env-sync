# Codex Env Sync

在 Windows 和 macOS 之间安全同步 Codex 设置，同时让每台设备继续使用自己的 Codex 登录账号。你可以使用桌面 App、CLI package，或者保留透明可审计的脚本方式。

[English README](README.md)

## 这个工具做什么

Codex 默认把本地设置放在 `~/.codex`。这里面有些内容适合跨设备同步，有些内容属于账号身份或本机状态。这个项目只同步安全内容：

- `skills/`
- `prompts/`
- `config.toml`，并且会移除本机路径相关的 `[projects.*]` 配置块

它不会同步：

- `auth.json`
- 登录 session
- token、API key、credential、secret
- `history.jsonl`
- 虚拟环境、缓存、报告、构建产物、备份文件

## 推荐工作流

这个工具支持双向同步。任意一台电脑都可以上传最新的安全 Codex 设置，另一台电脑可以下载并安装。

```text
电脑 A：上传安全的 Codex 设置 -> commit -> push
电脑 B：下载远端设置 -> 安装到本机 -> 保留本机 codex login
```

为了避免冲突，建议遵守一个简单规则：在哪台机器改了设置，就先从那台机器上传；另一台机器修改前先下载。

## 项目结构

```text
codex-env-sync/
├── src/
│   ├── core/
│   ├── ui/
│   ├── cli.js
│   └── electron-main.js
├── scripts/
│   ├── windows/
│   │   ├── export-codex-settings.ps1
│   │   ├── install-codex-settings.ps1
│   │   └── check-codex-sync-safety.ps1
│   └── macos/
│       └── install-codex-settings.sh
├── synced/
│   ├── config/
│   ├── skills/
│   └── prompts/
├── examples/
├── tests/
└── README.zh-CN.md
```

## 桌面 App

大多数用户不需要安装 Node.js、npm、Electron 或构建工具。直接从 [Releases](https://github.com/hybtc8888/codex-env-sync/releases) 下载最新的 Windows `.exe` 或 macOS `.dmg` 即可，安装包内置运行时。

桌面 App 提供四个大按钮：

- **Setup**：绑定 GitHub 仓库地址和本机 Git 身份。
- **Upload**：导出安全设置，运行安全检查，提交 `synced/`，然后 push。
- **Download**：拉取远端变更，把 `synced/` 安装到本机 Codex 目录。
- **Check Safety**：分享或安装前扫描仓库。

有两种同步模式：

- **本机 Git 模式**：填写仓库地址、Git 名称、Git 邮箱，然后点一次 **Setup**。这个模式要求机器已安装 Git。
- **GitHub API 模式**：填写仓库地址和 GitHub token，然后直接点 **Upload** 或 **Download**。这个模式不要求本机安装 Git。token 只在当前 App 窗口使用，不会写入仓库。

从源码运行：

```bash
npm install
npm start
```

本地打包：

```bash
npm run package:win
npm run package:mac
```

推送类似 `v0.3.0` 的版本 tag 后，`.github/workflows/release.yml` 会构建发布包。发布流程会构建 Windows、macOS arm64 和 macOS x64 资源。

## CLI Package

GitHub Packages 主要面向开发者，通常需要为 GitHub npm registry 配置认证。发布到 GitHub Packages 后，用户可以这样运行：

```bash
npm install -g @hybtc8888/codex-env-sync --registry=https://npm.pkg.github.com
codex-env-sync upload
codex-env-sync download
codex-env-sync check
```

常用参数：

```bash
codex-env-sync upload --dry-run
codex-env-sync download --dry-run
codex-env-sync upload --repo /path/to/codex-env-sync --codex-home ~/.codex
codex-env-sync upload --repo-url https://github.com/owner/repo.git --github-token TOKEN
codex-env-sync download --repo-url https://github.com/owner/repo.git --github-token TOKEN
```

## Windows：导出设置

先预览，不改文件：

```powershell
.\scripts\windows\export-codex-settings.ps1 -DryRun
```

确认后导出：

```powershell
.\scripts\windows\export-codex-settings.ps1
.\scripts\windows\check-codex-sync-safety.ps1
git add synced
git commit -m "sync codex settings"
git push
```

## Windows：安装设置

先预览，不覆盖文件：

```powershell
.\scripts\windows\install-codex-settings.ps1 -DryRun
```

确认后安装：

```powershell
.\scripts\windows\install-codex-settings.ps1
codex login
```

## macOS：安装设置

先预览，不覆盖文件：

```bash
DRY_RUN=1 ./scripts/macos/install-codex-settings.sh
```

确认后安装：

```bash
./scripts/macos/install-codex-settings.sh
codex login
```

## 自定义 Codex Home

如果你的 Codex 目录不是 `~/.codex`，可以设置 `CODEX_HOME`。

Windows：

```powershell
$env:CODEX_HOME = "D:\codex-home"
.\scripts\windows\export-codex-settings.ps1
```

macOS：

```bash
CODEX_HOME="$HOME/.codex-work" ./scripts/macos/install-codex-settings.sh
```

## 安全原则

脚本使用白名单方式，只复制 `skills`、`prompts` 和清理后的 `config.toml`。

导出 `config.toml` 时会阻断 `api_key`、`token`、`secret`、`password`、`credential` 等账号相关字段。

安装脚本会先备份原有同步目标：

- `~/.codex/skills.backup`
- `~/.codex/prompts.backup`
- `~/.codex/config.toml.backup`

`auth.json` 这类账号文件不会被触碰。每台设备都应该单独运行 `codex login`。

桌面 App 在 GitHub API 模式下可以不依赖本机 Git，但每台机器仍然需要单独安装 Codex。

## 测试

运行：

```powershell
.\tests\run.ps1
npm test
```

测试会检查导出行为、安装备份、保留本机 auth、安全检查、共享 Node 核心逻辑，以及在有 Bash 的环境下检查 shell 脚本语法。

## 开源协议

MIT
