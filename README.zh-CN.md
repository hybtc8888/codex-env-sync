# Codex Env Sync

在 Windows 和 macOS 之间同步你的 Codex 设置，同时不复制登录、session、token 或本机状态。

[English README](README.md)

## 为什么需要它

Codex 越用越顺手，往往不是因为某一个设置，而是因为你的 skills、prompts、默认配置和工作习惯慢慢沉淀下来了。换一台电脑、换一个账号、在 PC 和 MacBook 之间来回用时，最烦的事情就是重新整理这些配置。

Codex Env Sync 把这件事变成一个很短的流程：

- 连接一次 GitHub。
- 在已有配置的机器上上传。
- 在另一台机器上下载。
- 每台设备继续使用自己的 Codex 登录账号。

它追求的是“云同步一样方便，本地工具一样克制”。

## 好用在哪里

- **普通用户一键用**：不需要安装 Node.js、npm、Electron、Git 或构建工具。
- **PC 和 Mac 都能同步**：Windows 到 macOS、macOS 到 Windows、两台 Mac 之间都可以。
- **默认使用私有仓库**：自动创建或选择 `codex-env-sync-data` 私有仓库保存同步数据。
- **不会搬走账号**：Codex 登录文件、token、session、历史记录、缓存和本机状态都会被拦截。
- **GitHub App 授权**：不用手动复制很长的 GitHub Token。
- **过程看得见**：上传和下载会显示步骤、已用时间和文件计数。
- **中英文界面和文档**：适合自己用，也适合开源分享。

## 下载

从 [Releases](https://github.com/hybtc8888/codex-env-sync/releases) 下载最新版。

- Windows x64：适合大多数 Windows 电脑
- Windows arm64：适合 Windows on ARM 设备
- macOS arm64：适合 Apple Silicon Mac
- macOS x64：适合 Intel Mac

## 快速开始

1. 下载并打开桌面 App。
2. 点击 **连接 GitHub**，授权 `Codex Env Sync` GitHub App。
3. 在已有 Codex 配置的机器上点击 **上传**。
4. 在另一台机器打开本工具，连接同一个 GitHub 账号后点击 **下载**。

本工具会使用这个私有数据仓库：

```text
codex-env-sync-data
```

请把它和源码仓库 `codex-env-sync` 分开。如果 GitHub App 只安装到了源码仓库，Codex Env Sync 会拒绝把源码仓库当作个人同步数据仓库。

## 同步什么

Codex 默认把本地设置放在 `~/.codex`。本工具只同步适合跨设备共享的安全内容：

- `skills/`
- `prompts/`
- 清理后的 `config.toml`

它不会同步账号和本机状态：

- `auth.json`
- 登录 session
- token、API key、credential、secret
- `history.jsonl`
- 虚拟环境、缓存、报告、构建产物、备份文件

每台机器仍然应该单独运行 `codex login`。

## 安全原则

Codex Env Sync 使用白名单。文件会先导出到同步结构，经过安全检查后才提交到仓库。安装远端设置前会先备份本机已有目标：

- `~/.codex/skills.backup`
- `~/.codex/prompts.backup`
- `~/.codex/config.toml.backup`

GitHub App 授权只允许桌面 App 读写用户安装了该 App 的仓库。内置的 Client ID 不是密钥，桌面 App 里不会打包 Client Secret。

## 开发者 GitHub App

公开版桌面 App 使用：

```text
https://github.com/apps/codex-env-sync
```

推荐 GitHub App 设置：

- Device Flow：开启
- Webhook：关闭
- Repository permissions：
  - `Contents: Read and write`
  - `Administration: Read and write`（用于自动创建私有的 `codex-env-sync-data` 仓库）
- Account permissions：不需要
- Events：不需要
- Installation target：Any account

## 本地开发

```bash
npm install
npm start
```

本地打包：

```bash
npm run package:win:x64
npm run package:win:arm64
npm run package:mac
```

## CLI

```bash
codex-env-sync upload --dry-run
codex-env-sync download --dry-run
codex-env-sync upload --repo-url https://github.com/owner/repo.git --github-token TOKEN
codex-env-sync download --repo-url https://github.com/owner/repo.git --github-token TOKEN
```

## 测试

```powershell
.\tests\run.ps1
npm test
```

## 开源协议

MIT
