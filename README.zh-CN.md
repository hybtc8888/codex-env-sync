# Codex Env Sync

几分钟内同步你的 Windows PC 和 Mac 上的 Codex 设置，同时不复制登录、session、token 或本机状态。

[English README](README.md)

## 先下载哪个版本

从 [Releases](https://github.com/hybtc8888/codex-env-sync/releases/tag/v0.4.6) 下载最新版。

| 你的设备 | 下载这个文件 |
| --- | --- |
| 大多数 Intel / AMD Windows 电脑 | `Codex.Env.Sync.*-x64.exe` 或 `Codex.Env.Sync.*-x64.zip` |
| Windows on ARM 设备，比如 Snapdragon 笔记本 | `Codex.Env.Sync.*-arm64.exe` 或 `Codex.Env.Sync.*-arm64.zip` |
| Apple Silicon Mac，比如 M1/M2/M3/M4 MacBook、Mac mini、iMac | `Codex.Env.Sync-*-arm64.dmg` |
| 较老的 Intel Mac | `Codex.Env.Sync-*.dmg` |

不确定 Windows 版本时，优先选 **x64**。不确定现代 MacBook 版本时，优先选 **macOS arm64**。

## 为什么需要它

Codex 越用越顺手，往往不是因为某一个设置，而是因为你的 skills、prompts、默认配置和工作习惯慢慢沉淀下来了。换一台电脑、换一个账号、在 PC 和 MacBook 之间来回用时，最烦的事情不该是翻隐藏目录、猜哪些文件能复制、再手动重建一遍工作流。

Codex Env Sync 把你的本地 Codex 环境变成一套可以随身走、但不带走账号的工具箱：

- 连接一次 GitHub。
- 在已有配置的机器上上传。
- 在另一台机器上下载。
- 每台设备继续使用自己的 Codex 登录账号。

它拿到了云同步最舒服的部分，同时把危险的账号凭据、session、token 全部挡在同步路径之外。设置跟你走，账号留本机。

## 为什么它很爽

- **它是真正的桌面 App，不是一堆脚本**：点击、授权、上传、下载。普通用户不需要安装 Git、Node.js、npm、Electron 或任何构建工具。
- **跨平台就是它的主场**：Windows 到 macOS、macOS 到 Windows、Mac 到 Mac、PC 到 PC 都可以。你的设置不再被某一台机器绑住。
- **默认放进你的私有 GitHub 仓库**：自动创建或选择 `codex-env-sync-data` 私有仓库，数据在你自己的 GitHub 账号里。
- **从设计上隔离账号**：Codex 登录文件、token、session、历史记录、缓存和本机状态都会在进入 GitHub 前被拦截。
- **GitHub App 授权**：不需要让普通用户手动复制又长又吓人的 GitHub Token。
- **同步过程看得见**：上传和下载会显示步骤、已用时间、文件计数、重试提示和完成弹窗。
- **专为两台电脑来回切换的人设计**：哪台机器配置最新，就在哪台上传；另一台下载后继续干活。
- **中英文界面和文档**：自己用顺手，开源分享也体面。

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
