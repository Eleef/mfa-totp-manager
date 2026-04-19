# MFA TOTP Manager

本项目是一个轻量、本地优先的 MFA / TOTP 计算器，使用 Python 标准库和 `Tkinter` 构建桌面 GUI。它支持直接输入 Base32 密钥或 `otpauth://totp/...` URI，实时刷新验证码，并保存最近输入历史与界面语言偏好。

MFA TOTP Manager is a lightweight, local-first MFA / TOTP calculator built with the Python standard library and `Tkinter`. It accepts raw Base32 secrets or `otpauth://totp/...` URIs, refreshes codes in real time, and stores recent input history together with the UI language preference.

## 项目简介 / Overview

- 纯本地计算，不依赖网络服务。
- GUI 基于 `Tkinter`，支持 Windows、macOS、Linux 源码运行。
- 提供中英双语界面，并可即时切换语言。
- 保留最近 10 条输入历史，便于重复查看常用账号。

- Runs fully locally with no network dependency.
- Uses `Tkinter` for the GUI and supports source execution on Windows, macOS, and Linux.
- Includes bilingual Chinese / English UI with instant switching.
- Keeps the 10 most recent inputs for quick reuse.

## 功能特性 / Features

- 支持输入 Base32 secret。
- 支持解析 `otpauth://totp/...` URI。
- 支持 `SHA1`、`SHA256`、`SHA512`。
- 自动显示当前验证码与剩余有效时间。
- 一键复制验证码到剪贴板。
- 保存输入历史到 `mfa_history.json`。
- 保存语言偏好到 `mfa_settings.json`。

- Accepts raw Base32 secrets.
- Parses `otpauth://totp/...` URIs.
- Supports `SHA1`, `SHA256`, and `SHA512`.
- Shows the current code and remaining lifetime automatically.
- Copies the current code to the clipboard.
- Stores recent input history in `mfa_history.json`.
- Stores the selected UI language in `mfa_settings.json`.

## 截图占位 / Screenshots

- 可在此处添加中文界面截图。
- 可在此处添加英文界面截图。

- Add a screenshot of the Chinese UI here.
- Add a screenshot of the English UI here.

## 快速开始 / Quick Start

```bash
git clone <your-repo-url>
cd mfa-totp-manager
python mfa_totp_gui.py
```

## 运行要求 / Requirements

- Python 3.11 或更高版本。
- Python 安装中包含 Tk / Tcl 支持。
- 桌面环境可用，能够启动 `Tkinter` 窗口。

- Python 3.11 or newer.
- Python must include Tk / Tcl support.
- A desktop environment is required to open a `Tkinter` window.

## 使用方式 / Usage

1. 启动应用：`python mfa_totp_gui.py`
2. 粘贴 Base32 密钥，或粘贴 `otpauth://totp/...` URI。
3. 点击“开始计算 / Generate Code”。
4. 查看实时验证码、倒计时和解析后的账户信息。
5. 如需切换界面语言，在窗口顶部选择 `zh-CN` 或 `en-US`。

1. Start the app with `python mfa_totp_gui.py`.
2. Paste a Base32 secret or an `otpauth://totp/...` URI.
3. Click `Generate Code`.
4. Read the live code, countdown, and parsed account metadata.
5. Switch the UI language at the top of the window with `zh-CN` or `en-US`.

## 历史记录与本地文件 / Local Files

- `mfa_history.json`
  - 保存最近 10 条输入记录。
  - 不应提交到版本库。
- `mfa_settings.json`
  - 保存当前界面语言，例如 `{"language": "en-US"}`。
  - 不应提交到版本库。

- `mfa_history.json`
  - Stores the latest 10 inputs.
  - Should not be committed.
- `mfa_settings.json`
  - Stores the selected UI language, for example `{"language": "en-US"}`.
  - Should not be committed.

## 跨平台说明 / Platform Support

- `Tkinter` 是 Python 标准 GUI 库，通常可用于 Windows、macOS、Linux。
- 本项目当前按“源码运行跨平台”设计，不在仓库中附带预编译安装包。
- 不同平台的 Python 发行版对 Tk 的打包方式不同；如果 GUI 无法启动，优先检查本机 Python 是否包含 Tk 支持。

- `Tkinter` is Python’s standard GUI toolkit and is generally available on Windows, macOS, and Linux.
- This project currently targets cross-platform source execution instead of shipping prebuilt installers.
- Tk packaging differs by Python distribution; if the GUI does not start, verify that your Python installation includes Tk support.

## 打包说明 / Packaging Notes

- 本轮不提供现成安装包，推荐后续按目标平台分别构建。
- Windows: 推荐 `PyInstaller`
- macOS: 推荐 `PyInstaller` 或 `Briefcase`
- Linux: 推荐 `PyInstaller`

- This release does not ship installers. Build packages separately for each target platform.
- Windows: `PyInstaller` is recommended.
- macOS: `PyInstaller` or `Briefcase` is recommended.
- Linux: `PyInstaller` is recommended.

示例命令 / Example command:

```bash
pyinstaller --onefile --windowed mfa_totp_gui.py
```

注意 / Notes:

- 跨平台桌面打包通常需要在目标系统本机或对应 CI 环境分别构建。
- 不承诺“一次构建，生成所有平台产物”。

- Cross-platform desktop packaging usually needs to run on each target OS or in an equivalent CI environment.
- A single build is not expected to produce binaries for every platform.

## 测试 / Tests

```bash
python -m unittest discover -s tests
```

测试覆盖：

- RFC 6238 TOTP 测试向量
- `otpauth://` 解析
- 倒计时计算
- 历史记录文件异常回退
- 语言设置默认值、读取与异常回退

Test coverage includes:

- RFC 6238 TOTP vectors
- `otpauth://` parsing
- Countdown calculation
- History file fallback behavior
- Language settings defaults, loading, and invalid-file fallback

## 安全说明 / Security Notes

- 所有验证码计算都在本地完成，不会将密钥上传到远程服务。
- 历史记录文件会保存你输入过的密钥或 URI。若设备是多人共用，请按需清理 `mfa_history.json`。
- 本项目当前未对本地历史文件做额外加密；如果你要面向更高安全等级场景使用，需要补充加密存储方案。

- All codes are generated locally and secrets are not sent to remote services.
- The history file stores the secrets or URIs you entered. If the device is shared, clear `mfa_history.json` when needed.
- The local history file is not encrypted in this version. Add encrypted storage before using it in higher-security environments.

## Roadmap

- 增加 `LICENSE` 和最小 GitHub 发布流程。
- 增加自动化构建与多平台打包说明。
- 增加导入二维码或截图解析能力。
- 评估是否需要本地加密存储与主密码保护。

- Add a `LICENSE` and a minimal GitHub release workflow.
- Add automated build guidance and multi-platform packaging docs.
- Add QR import or screenshot parsing support.
- Evaluate local encrypted storage with a master password.
