# Codex Env Sync

在 Windows 和 macOS 之间安全同步 Codex 设置，同时让每台设备继续使用自己的 Codex 登录账号。

[English README](README.md)

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

## 桌面 App

大多数用户不需要安装 Node.js、npm、Electron、Git 或构建工具。直接从 [Releases](https://github.com/hybtc8888/codex-env-sync/releases) 下载 Windows `.exe` 或 macOS `.dmg`。

主流程很短：

1. 在 GitHub 创建一个私有仓库：`codex-env-sync-data`。
2. 把 `Codex Env Sync` GitHub App 安装到这个私有数据仓库。
3. 在桌面 App 里点击 **连接 GitHub**。
4. 在一台电脑点击 **上传**。
5. 在另一台电脑点击 **下载**。

GitHub App 授权的作用，是让桌面 App 只读写用于同步设置的仓库。这样用户不需要配置本机 Git，也不用手动创建 token，PC 和 Mac 都可以一键上传或下载。访问 token 只在当前 App 窗口使用，不会写入仓库。

默认情况下，本工具会优先寻找这个用户数据仓库：

```text
codex-env-sync-data
```

请把它和源码仓库 `codex-env-sync` 分开。如果 App 只安装到了源码仓库，桌面 App 会拒绝同步，并提示你选择私有数据仓库。

高级设置里仍然保留手动仓库地址、token、Git 身份、仓库文件夹、Codex 目录、提交信息和仅预览模式。

## 开发者 GitHub App

公开版桌面 App 使用这个 GitHub App：

```text
https://github.com/apps/codex-env-sync
```

内置的 Client ID 不是密钥，可以公开。不要把 Client Secret 打进桌面 App。

推荐 GitHub App 设置：

- Device Flow：开启
- Webhook：关闭
- Repository permissions：
  - `Contents: Read and write`
  - `Administration: Read and write`（只用于自动创建私有的 `codex-env-sync-data` 仓库）
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
npm run package:win
npm run package:mac
```

## CLI

```bash
codex-env-sync upload --dry-run
codex-env-sync download --dry-run
codex-env-sync upload --repo-url https://github.com/owner/repo.git --github-token TOKEN
codex-env-sync download --repo-url https://github.com/owner/repo.git --github-token TOKEN
```

## 安全原则

实现使用白名单，只复制 `skills`、`prompts` 和清理后的 `config.toml`。

安装远端设置前会先备份本机已有目标：

- `~/.codex/skills.backup`
- `~/.codex/prompts.backup`
- `~/.codex/config.toml.backup`

每台机器仍然应该单独运行 `codex login`。

## 测试

```powershell
.\tests\run.ps1
npm test
```

## 开源协议

MIT
