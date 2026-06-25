"""HTTP fetch + text extraction for public payer PA criteria documents.

Only fetches from ALLOWED_DOMAINS. Enforces a 5 MB size cap before any
fitz/HTMLParser call — per CLAUDE.md untrusted-document size/type-limit rule.
"""

from __future__ import annotations

import hashlib
import html
from html.parser import HTMLParser
from urllib.parse import urlparse

import fitz
import httpx

_ALLOWED_DOMAINS: frozenset[str] = frozenset({
    "static.cigna.com",
    "www.uhcprovider.com",
    "www.aetna.com",
})

_DEFAULT_MAX_BYTES: int = 5 * 1024 * 1024  # 5 MB


def fetch_raw(
    url: str,
    timeout: int = 30,
    max_bytes: int = _DEFAULT_MAX_BYTES,
) -> tuple[bytes, str]:
    """Fetch URL bytes; validate domain and size, return (raw_bytes, sha256_hex).

    Raises:
        ValueError: domain not in allowlist, or Content-Length / body exceeds max_bytes.
        httpx.TimeoutException: request timed out.
        httpx.HTTPStatusError: non-2xx response.
    """
    host = urlparse(url).netloc
    if host not in _ALLOWED_DOMAINS:
        raise ValueError(
            f"Domain '{host}' is not in the allowed list: {sorted(_ALLOWED_DOMAINS)}"
        )

    resp = httpx.get(url, timeout=timeout, follow_redirects=True)
    resp.raise_for_status()

    # Check Content-Length header before reading body to fail fast on large files.
    cl_str = resp.headers.get("content-length", "")
    if cl_str.isdigit() and int(cl_str) > max_bytes:
        raise ValueError(
            f"Content-Length {cl_str} exceeds max_bytes={max_bytes} for {url}"
        )

    raw = resp.content
    if len(raw) > max_bytes:
        raise ValueError(
            f"Response body {len(raw)} bytes exceeds max_bytes={max_bytes} for {url}"
        )

    sha256 = hashlib.sha256(raw).hexdigest()
    return raw, sha256


def extract_pdf_text(raw_bytes: bytes) -> str:
    """Extract plain text from a PDF via pymupdf/fitz."""
    doc = fitz.open(stream=raw_bytes, filetype="pdf")
    pages = [page.get_text() for page in doc]
    doc.close()
    return "\n".join(pages)


class _TagStripper(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self._parts.append(data)

    def get_text(self) -> str:
        return " ".join(p.strip() for p in self._parts if p.strip())


def extract_html_text(raw_bytes: bytes) -> str:
    """Strip HTML tags via stdlib HTMLParser and return visible text."""
    markup = raw_bytes.decode("utf-8", errors="replace")
    stripper = _TagStripper()
    stripper.feed(markup)
    return html.unescape(stripper.get_text())


def fetch_and_extract(
    url: str,
    timeout: int = 30,
    max_bytes: int = _DEFAULT_MAX_BYTES,
) -> tuple[str, str]:
    """Fetch URL, extract text by format, return (text, sha256_hex).

    Format is determined by URL extension; falls back to PDF-then-HTML on ambiguity.
    """
    raw, sha256 = fetch_raw(url, timeout=timeout, max_bytes=max_bytes)
    lower = url.lower()
    if lower.endswith(".html") or lower.endswith(".htm"):
        text = extract_html_text(raw)
    elif lower.endswith(".pdf"):
        text = extract_pdf_text(raw)
    else:
        try:
            text = extract_pdf_text(raw)
        except Exception:
            text = extract_html_text(raw)
    return text, sha256
