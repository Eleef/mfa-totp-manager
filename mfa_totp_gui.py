from __future__ import annotations

import json
from pathlib import Path
import tkinter as tk
from tkinter import messagebox, ttk

from mfa_totp import TOTPConfig, generate_totp, parse_mfa_input, seconds_remaining


LANGUAGES = ("zh-CN", "en-US")
DEFAULT_LANGUAGE = "zh-CN"
MAX_HISTORY_ITEMS = 10

I18N = {
    "zh-CN": {
        "window_title": "MFA TOTP 管理器",
        "language_label": "语言",
        "language_zh": "中文",
        "language_en": "English",
        "input_title": "MFA / TOTP 密钥",
        "load_button": "开始计算",
        "example_button": "填入示例",
        "copy_button": "复制验证码",
        "code_frame_title": "当前验证码",
        "countdown": "剩余时间: {seconds}s",
        "status_idle": "输入 Base32 secret 或 otpauth:// 链接。",
        "status_loaded": "配置已加载，验证码会自动刷新。",
        "status_input_error": "输入错误: {error}",
        "status_copied": "验证码已复制到剪贴板。",
        "status_history_deleted": "已删除选中的历史记录。",
        "status_history_cleared": "历史记录已清空。",
        "status_history_empty": "当前没有历史记录。",
        "status_history_save_failed": "历史记录保存失败，请检查目录写入权限。",
        "status_settings_save_failed": "语言设置保存失败，请检查目录写入权限。",
        "meta_not_loaded": "尚未加载配置",
        "meta_issuer": "发行方: {value}",
        "meta_account": "账号: {value}",
        "meta_algorithm": "算法: {value}",
        "meta_digits": "位数: {value}",
        "meta_period": "周期: {value}s",
        "history_title": "历史输入记录",
        "history_load_button": "加载选中项",
        "history_delete_button": "删除选中项",
        "history_clear_button": "清空历史",
        "tips_title": "提示:",
        "tips_body": (
            "1. 可以直接粘贴 Base32 secret。\n"
            "2. 也可以粘贴 Google Authenticator 导出的 otpauth://totp/... 链接。\n"
            "3. 本工具只在本地计算，不会联网。\n"
            "4. 最近输入会保存在程序目录下的 mfa_history.json。\n"
            "5. 语言偏好会保存在程序目录下的 mfa_settings.json。"
        ),
        "dialog_info_title": "提示",
        "dialog_confirm_title": "确认",
        "dialog_no_code": "当前没有可复制的验证码。",
        "dialog_select_history": "请先选择一条历史记录。",
        "dialog_clear_history": "确定要清空所有历史输入记录吗？",
    },
    "en-US": {
        "window_title": "MFA TOTP Manager",
        "language_label": "Language",
        "language_zh": "中文",
        "language_en": "English",
        "input_title": "MFA / TOTP Secret",
        "load_button": "Generate Code",
        "example_button": "Use Example",
        "copy_button": "Copy Code",
        "code_frame_title": "Current Code",
        "countdown": "Time remaining: {seconds}s",
        "status_idle": "Enter a Base32 secret or an otpauth:// URI.",
        "status_loaded": "Configuration loaded. The code will refresh automatically.",
        "status_input_error": "Input error: {error}",
        "status_copied": "The code has been copied to the clipboard.",
        "status_history_deleted": "The selected history item has been removed.",
        "status_history_cleared": "History has been cleared.",
        "status_history_empty": "There is no history yet.",
        "status_history_save_failed": "Failed to save history. Check directory write permissions.",
        "status_settings_save_failed": "Failed to save language settings. Check directory write permissions.",
        "meta_not_loaded": "No configuration loaded",
        "meta_issuer": "Issuer: {value}",
        "meta_account": "Account: {value}",
        "meta_algorithm": "Algorithm: {value}",
        "meta_digits": "Digits: {value}",
        "meta_period": "Period: {value}s",
        "history_title": "Input History",
        "history_load_button": "Load Selected",
        "history_delete_button": "Delete Selected",
        "history_clear_button": "Clear History",
        "tips_title": "Tips:",
        "tips_body": (
            "1. You can paste a raw Base32 secret directly.\n"
            "2. You can also paste an otpauth://totp/... URI exported by an authenticator app.\n"
            "3. All calculations happen locally and the app never connects to the network.\n"
            "4. Recent inputs are stored in mfa_history.json in the app directory.\n"
            "5. The language preference is stored in mfa_settings.json in the app directory."
        ),
        "dialog_info_title": "Notice",
        "dialog_confirm_title": "Confirm",
        "dialog_no_code": "There is no code to copy yet.",
        "dialog_select_history": "Select a history item first.",
        "dialog_clear_history": "Clear all saved input history?",
    },
}


class TOTPApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.config_data: TOTPConfig | None = None
        self._timer_id: str | None = None
        self.language = self._load_language_setting()
        self.history_items: list[str] = self._load_history()

        self.status_key = "status_idle"
        self.status_kwargs: dict[str, object] = {}
        self.meta_items: list[tuple[str, str]] = []

        self.input_var = tk.StringVar()
        self.language_var = tk.StringVar(value=self.language)
        self.status_var = tk.StringVar()
        self.meta_var = tk.StringVar()
        self.code_var = tk.StringVar(value="------")
        self.countdown_var = tk.StringVar()

        self.title(self._t("window_title"))
        self.geometry("680x650")
        self.minsize(680, 650)

        self._build_ui()
        self._set_status("status_idle")
        self._set_meta()
        self._set_countdown(None)
        self._apply_language()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        root = ttk.Frame(self, padding=16)
        root.pack(fill="both", expand=True)
        self.root = root

        top_bar = ttk.Frame(root)
        top_bar.pack(fill="x", pady=(0, 12))

        self.language_label = ttk.Label(top_bar)
        self.language_label.pack(side="left")

        self.language_toggle = ttk.Combobox(
            top_bar,
            state="readonly",
            width=12,
            values=LANGUAGES,
            textvariable=self.language_var,
        )
        self.language_toggle.pack(side="left", padx=(8, 0))
        self.language_toggle.bind("<<ComboboxSelected>>", self._on_language_change)

        self.input_title_label = ttk.Label(root, font=("Microsoft YaHei UI", 11, "bold"))
        self.input_title_label.pack(anchor="w")

        self._input_box = tk.Text(root, height=6, wrap="word", font=("Consolas", 10))
        self._input_box.pack(fill="x", pady=(8, 10))
        self._input_box.bind("<<Modified>>", lambda event: self._sync_text_widget(self._input_box))

        button_row = ttk.Frame(root)
        button_row.pack(fill="x", pady=(0, 12))

        self.load_button = ttk.Button(button_row, command=self.load_input)
        self.load_button.pack(side="left")

        self.example_button = ttk.Button(button_row, command=self.fill_example)
        self.example_button.pack(side="left", padx=8)

        self.copy_button = ttk.Button(button_row, command=self.copy_code)
        self.copy_button.pack(side="left")

        self.status_label = ttk.Label(root, textvariable=self.status_var, foreground="#1f4b99")
        self.status_label.pack(anchor="w")

        self.meta_label = ttk.Label(root, textvariable=self.meta_var, foreground="#555555", justify="left")
        self.meta_label.pack(anchor="w", pady=(8, 16))

        self.code_frame = ttk.LabelFrame(root, padding=16)
        self.code_frame.pack(fill="x")

        ttk.Label(
            self.code_frame,
            textvariable=self.code_var,
            font=("Consolas", 28, "bold"),
            anchor="center",
        ).pack(fill="x")

        ttk.Label(self.code_frame, textvariable=self.countdown_var, anchor="center").pack(fill="x", pady=(8, 0))

        self.progress = ttk.Progressbar(self.code_frame, maximum=100, value=0)
        self.progress.pack(fill="x", pady=(12, 0))

        self.history_frame = ttk.LabelFrame(root, padding=12)
        self.history_frame.pack(fill="both", expand=True, pady=(16, 0))

        history_buttons = ttk.Frame(self.history_frame)
        history_buttons.pack(fill="x", pady=(0, 8))

        self.history_load_button = ttk.Button(history_buttons, command=self.load_selected_history)
        self.history_load_button.pack(side="left")

        self.history_delete_button = ttk.Button(history_buttons, command=self.delete_selected_history)
        self.history_delete_button.pack(side="left", padx=8)

        self.history_clear_button = ttk.Button(history_buttons, command=self.clear_history)
        self.history_clear_button.pack(side="left")

        self.history_list = tk.Listbox(self.history_frame, height=9, font=("Consolas", 9))
        self.history_list.pack(fill="both", expand=True)
        self.history_list.bind("<Double-Button-1>", lambda event: self.load_selected_history())
        self._refresh_history_list()

        self.tips_label = ttk.Label(root, justify="left", foreground="#444444")
        self.tips_label.pack(anchor="w", pady=(16, 0))

    def _sync_text_widget(self, widget: tk.Text) -> None:
        if widget.edit_modified():
            self.input_var.set(widget.get("1.0", "end").strip())
            widget.edit_modified(False)

    def _t(self, key: str, **kwargs: object) -> str:
        template = I18N.get(self.language, I18N[DEFAULT_LANGUAGE]).get(key, key)
        return template.format(**kwargs)

    def _set_status(self, key: str, **kwargs: object) -> None:
        self.status_key = key
        self.status_kwargs = kwargs
        self.status_var.set(self._t(key, **kwargs))

    def _set_meta(self) -> None:
        if not self.meta_items:
            self.meta_var.set(self._t("meta_not_loaded"))
            return
        self.meta_var.set(" | ".join(self._t(key, value=value) for key, value in self.meta_items))

    def _set_countdown(self, seconds: int | None) -> None:
        if seconds is None:
            self.countdown_var.set(self._t("countdown", seconds="--"))
            return
        self.countdown_var.set(self._t("countdown", seconds=seconds))

    def _apply_language(self) -> None:
        self.title(self._t("window_title"))
        self.language_label.configure(text=self._t("language_label"))
        self.input_title_label.configure(text=self._t("input_title"))
        self.load_button.configure(text=self._t("load_button"))
        self.example_button.configure(text=self._t("example_button"))
        self.copy_button.configure(text=self._t("copy_button"))
        self.code_frame.configure(text=self._t("code_frame_title"))
        self.history_frame.configure(text=self._t("history_title"))
        self.history_load_button.configure(text=self._t("history_load_button"))
        self.history_delete_button.configure(text=self._t("history_delete_button"))
        self.history_clear_button.configure(text=self._t("history_clear_button"))
        self.tips_label.configure(text=f"{self._t('tips_title')}\n{self._t('tips_body')}")
        self._set_status(self.status_key, **self.status_kwargs)
        self._set_meta()
        if self.config_data is None:
            self._set_countdown(None)

    def _on_language_change(self, event: object | None = None) -> None:
        selected = self.language_var.get()
        if selected not in LANGUAGES:
            selected = DEFAULT_LANGUAGE
        self.language = selected
        self._save_language_setting()
        self._apply_language()

    def fill_example(self) -> None:
        example = "otpauth://totp/Demo:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Demo"
        self._input_box.delete("1.0", "end")
        self._input_box.insert("1.0", example)
        self.input_var.set(example)
        self.load_input()

    def load_input(self) -> None:
        raw = self._input_box.get("1.0", "end").strip()
        try:
            self.config_data = parse_mfa_input(raw)
        except ValueError as exc:
            self._cancel_timer()
            self.config_data = None
            self.meta_items = []
            self.code_var.set("------")
            self._set_countdown(None)
            self.progress.configure(value=0)
            self._set_status("status_input_error", error=str(exc))
            self._set_meta()
            return

        self._remember_history(raw)
        self.meta_items = []
        if self.config_data.issuer:
            self.meta_items.append(("meta_issuer", self.config_data.issuer))
        if self.config_data.account_name:
            self.meta_items.append(("meta_account", self.config_data.account_name))
        self.meta_items.append(("meta_algorithm", self.config_data.algorithm))
        self.meta_items.append(("meta_digits", str(self.config_data.digits)))
        self.meta_items.append(("meta_period", str(self.config_data.period)))

        self._set_status("status_loaded")
        self._set_meta()
        self._refresh_code()

    def _refresh_code(self) -> None:
        if self.config_data is None:
            return

        code = generate_totp(self.config_data)
        remaining = seconds_remaining(self.config_data)
        percent = ((self.config_data.period - remaining) / self.config_data.period) * 100

        self.code_var.set(code)
        self._set_countdown(remaining)
        self.progress.configure(value=percent)

        self._cancel_timer()
        self._timer_id = self.after(1000, self._refresh_code)

    def copy_code(self) -> None:
        code = self.code_var.get()
        if not code or code == "------":
            messagebox.showinfo(self._t("dialog_info_title"), self._t("dialog_no_code"))
            return
        self.clipboard_clear()
        self.clipboard_append(code)
        self._set_status("status_copied")

    def load_selected_history(self) -> None:
        selected = self.history_list.curselection()
        if not selected:
            messagebox.showinfo(self._t("dialog_info_title"), self._t("dialog_select_history"))
            return
        raw = self.history_items[selected[0]]
        self._input_box.delete("1.0", "end")
        self._input_box.insert("1.0", raw)
        self.input_var.set(raw)
        self.load_input()

    def delete_selected_history(self) -> None:
        selected = self.history_list.curselection()
        if not selected:
            messagebox.showinfo(self._t("dialog_info_title"), self._t("dialog_select_history"))
            return
        del self.history_items[selected[0]]
        self._save_history()
        self._refresh_history_list()
        self._set_status("status_history_deleted")

    def clear_history(self) -> None:
        if not self.history_items:
            self._set_status("status_history_empty")
            return
        confirmed = messagebox.askyesno(self._t("dialog_confirm_title"), self._t("dialog_clear_history"))
        if not confirmed:
            return
        self.history_items.clear()
        self._save_history()
        self._refresh_history_list()
        self._set_status("status_history_cleared")

    def _remember_history(self, raw: str) -> None:
        value = raw.strip()
        if not value:
            return
        if value in self.history_items:
            self.history_items.remove(value)
        self.history_items.insert(0, value)
        del self.history_items[MAX_HISTORY_ITEMS:]
        self._save_history()
        self._refresh_history_list()

    def _refresh_history_list(self) -> None:
        self.history_list.delete(0, tk.END)
        for item in self.history_items:
            self.history_list.insert(tk.END, self._format_history_preview(item))

    def _format_history_preview(self, raw: str) -> str:
        preview = raw.replace("\n", " ").strip()
        return preview if len(preview) <= 72 else f"{preview[:69]}..."

    def _load_history(self) -> list[str]:
        history_file = self._history_file()
        if not history_file.exists():
            return []
        try:
            data = json.loads(history_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []
        if not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, str) and item.strip()]

    def _save_history(self) -> None:
        try:
            self._history_file().write_text(
                json.dumps(self.history_items, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError:
            self._set_status("status_history_save_failed")

    def _load_language_setting(self) -> str:
        settings_file = self._settings_file()
        if not settings_file.exists():
            return DEFAULT_LANGUAGE
        try:
            data = json.loads(settings_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return DEFAULT_LANGUAGE
        if not isinstance(data, dict):
            return DEFAULT_LANGUAGE
        language = data.get("language", DEFAULT_LANGUAGE)
        return language if language in LANGUAGES else DEFAULT_LANGUAGE

    def _save_language_setting(self) -> None:
        try:
            self._settings_file().write_text(
                json.dumps({"language": self.language}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError:
            self._set_status("status_settings_save_failed")

    def _history_file(self) -> Path:
        return Path(__file__).with_name("mfa_history.json")

    def _settings_file(self) -> Path:
        return Path(__file__).with_name("mfa_settings.json")

    def _cancel_timer(self) -> None:
        if self._timer_id is not None:
            self.after_cancel(self._timer_id)
            self._timer_id = None

    def _on_close(self) -> None:
        self._cancel_timer()
        self.destroy()


def main() -> None:
    app = TOTPApp()
    app.mainloop()


if __name__ == "__main__":
    main()
