# Codex Env Sync

在 Windows 和 macOS 之间安全同步 Codex 设置，同时让每台设备继续使用自己的 Codex 登录账号。

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

建议把一台电脑作为主编辑设备，通常是 Windows PC：

```text
Windows PC：导出安全的 Codex 设置 -> commit -> push
MacBook：pull -> 安装安全的 Codex 设置 -> 用本机账号 codex login
```

## 项目结构

```text
codex-env-sync/
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

安装脚本会先备份原有同步目标：

- `~/.codex/skills.backup`
- `~/.codex/prompts.backup`
- `~/.codex/config.toml.backup`

`auth.json` 这类账号文件不会被触碰。每台设备都应该单独运行 `codex login`。

## 测试

运行：

```powershell
.\tests\run.ps1
```

测试会检查导出行为、安装备份、保留本机 auth、安全检查，以及在有 Bash 的环境下检查 shell 脚本语法。

## 开源协议

MIT

