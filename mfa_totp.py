from __future__ import annotations

import base64
import hashlib
import hmac
import struct
import time
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, urlparse


_ALGORITHMS = {
    "SHA1": hashlib.sha1,
    "SHA256": hashlib.sha256,
    "SHA512": hashlib.sha512,
}


@dataclass(slots=True)
class TOTPConfig:
    secret: str
    digits: int = 6
    period: int = 30
    algorithm: str = "SHA1"
    issuer: str = ""
    account_name: str = ""


def normalize_base32_secret(secret: str) -> str:
    cleaned = "".join(secret.strip().replace("-", "").split()).upper()
    if not cleaned:
        raise ValueError("secret 不能为空。")
    padding = (-len(cleaned)) % 8
    return cleaned + ("=" * padding)


def decode_secret(secret: str) -> bytes:
    normalized = normalize_base32_secret(secret)
    try:
        return base64.b32decode(normalized, casefold=True)
    except Exception as exc:  # pragma: no cover - base64 raises multiple error types
        raise ValueError("secret 不是合法的 Base32 字符串。") from exc


def _require_single_value(params: dict[str, list[str]], key: str, default: str = "") -> str:
    values = params.get(key, [])
    return values[0] if values else default


def parse_mfa_input(raw: str) -> TOTPConfig:
    value = raw.strip()
    if not value:
        raise ValueError("请输入 Base32 secret 或 otpauth:// 链接。")

    if value.lower().startswith("otpauth://"):
        parsed = urlparse(value)
        if parsed.scheme.lower() != "otpauth" or parsed.netloc.lower() != "totp":
            raise ValueError("目前只支持 otpauth://totp/... 链接。")

        params = parse_qs(parsed.query)
        secret = _require_single_value(params, "secret")
        if not secret:
            raise ValueError("otpauth 链接缺少 secret 参数。")

        label = unquote(parsed.path.lstrip("/"))
        issuer = _require_single_value(params, "issuer")
        account_name = label
        if ":" in label:
            label_issuer, account_name = label.split(":", 1)
            label_issuer = label_issuer.strip()
            account_name = account_name.strip()
            if label_issuer and not issuer:
                issuer = label_issuer

        digits = int(_require_single_value(params, "digits", "6"))
        period = int(_require_single_value(params, "period", "30"))
        algorithm = _require_single_value(params, "algorithm", "SHA1").upper()
    else:
        secret = value
        digits = 6
        period = 30
        algorithm = "SHA1"
        issuer = ""
        account_name = ""

    if digits <= 0:
        raise ValueError("digits 必须大于 0。")
    if period <= 0:
        raise ValueError("period 必须大于 0。")
    if algorithm not in _ALGORITHMS:
        raise ValueError("只支持 SHA1、SHA256、SHA512。")

    decode_secret(secret)

    return TOTPConfig(
        secret=secret,
        digits=digits,
        period=period,
        algorithm=algorithm,
        issuer=issuer,
        account_name=account_name,
    )


def generate_totp(config: TOTPConfig, timestamp: int | float | None = None) -> str:
    now = int(time.time() if timestamp is None else timestamp)
    counter = now // config.period
    message = struct.pack(">Q", counter)
    key = decode_secret(config.secret)
    digest = hmac.new(key, message, _ALGORITHMS[config.algorithm]).digest()
    offset = digest[-1] & 0x0F
    binary = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    otp = binary % (10 ** config.digits)
    return f"{otp:0{config.digits}d}"


def seconds_remaining(config: TOTPConfig, timestamp: int | float | None = None) -> int:
    now = int(time.time() if timestamp is None else timestamp)
    elapsed = now % config.period
    remaining = config.period - elapsed
    return remaining if remaining != 0 else config.period
