from __future__ import annotations

import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from mfa_totp import TOTPConfig, generate_totp, parse_mfa_input, seconds_remaining
from mfa_totp_gui import DEFAULT_LANGUAGE, TOTPApp


class TOTPTests(unittest.TestCase):
    def test_rfc6238_sha1_vectors(self) -> None:
        secret = base64.b32encode(b"12345678901234567890").decode("ascii")
        config = TOTPConfig(secret=secret, digits=8, period=30, algorithm="SHA1")

        self.assertEqual(generate_totp(config, 59), "94287082")
        self.assertEqual(generate_totp(config, 1111111109), "07081804")

    def test_rfc6238_sha256_vectors(self) -> None:
        secret = base64.b32encode(b"12345678901234567890123456789012").decode("ascii")
        config = TOTPConfig(secret=secret, digits=8, period=30, algorithm="SHA256")

        self.assertEqual(generate_totp(config, 59), "46119246")
        self.assertEqual(generate_totp(config, 2000000000), "90698825")

    def test_rfc6238_sha512_vectors(self) -> None:
        secret = base64.b32encode(
            b"1234567890123456789012345678901234567890123456789012345678901234"
        ).decode("ascii")
        config = TOTPConfig(secret=secret, digits=8, period=30, algorithm="SHA512")

        self.assertEqual(generate_totp(config, 59), "90693936")
        self.assertEqual(generate_totp(config, 20000000000), "47863826")

    def test_parse_otpauth_uri(self) -> None:
        config = parse_mfa_input(
            "otpauth://totp/Demo:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Demo&algorithm=SHA256&digits=8&period=45"
        )

        self.assertEqual(config.issuer, "Demo")
        self.assertEqual(config.account_name, "alice@example.com")
        self.assertEqual(config.algorithm, "SHA256")
        self.assertEqual(config.digits, 8)
        self.assertEqual(config.period, 45)

    def test_seconds_remaining(self) -> None:
        config = TOTPConfig(secret="JBSWY3DPEHPK3PXP", period=30)
        self.assertEqual(seconds_remaining(config, 31), 29)

    def test_load_history_ignores_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            app = TOTPApp.__new__(TOTPApp)
            bad_file = Path(temp_dir) / "mfa_history.json"
            bad_file.write_text("{bad json", encoding="utf-8")
            with patch.object(type(app), "_history_file", return_value=bad_file):
                self.assertEqual(app._load_history(), [])

    def test_default_language_when_settings_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            app = TOTPApp.__new__(TOTPApp)
            settings_file = Path(temp_dir) / "mfa_settings.json"
            with patch.object(type(app), "_settings_file", return_value=settings_file):
                self.assertEqual(app._load_language_setting(), DEFAULT_LANGUAGE)

    def test_language_from_settings_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            app = TOTPApp.__new__(TOTPApp)
            settings_file = Path(temp_dir) / "mfa_settings.json"
            settings_file.write_text(json.dumps({"language": "en-US"}), encoding="utf-8")
            with patch.object(type(app), "_settings_file", return_value=settings_file):
                self.assertEqual(app._load_language_setting(), "en-US")

    def test_invalid_settings_fall_back_to_default_language(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            app = TOTPApp.__new__(TOTPApp)
            settings_file = Path(temp_dir) / "mfa_settings.json"
            settings_file.write_text("{bad json", encoding="utf-8")
            with patch.object(type(app), "_settings_file", return_value=settings_file):
                self.assertEqual(app._load_language_setting(), DEFAULT_LANGUAGE)

    def test_save_history_keeps_recent_limit(self) -> None:
        app = TOTPApp.__new__(TOTPApp)
        app.history_items = []
        app.status_key = "status_idle"
        app.status_kwargs = {}
        app._save_history = lambda: None
        app._refresh_history_list = lambda: None

        for index in range(12):
            app._remember_history(f"secret-{index}")

        self.assertEqual(len(app.history_items), 10)
        self.assertEqual(app.history_items[0], "secret-11")
        self.assertEqual(app.history_items[-1], "secret-2")


if __name__ == "__main__":
    unittest.main()
