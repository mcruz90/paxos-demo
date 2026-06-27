"""
Check whether policy source URLs are reachable before fetching.

Usage:
    uv run python -m golden_set.check_url <url> [<url> ...]
    uv run python -m golden_set.check_url --anchor <id> [--anchor <id> ...]
    uv run python -m golden_set.check_url --all

Exit code 0 if all URLs return 2xx/3xx; non-zero if any fail.
"""

import sys
import argparse
import httpx

from golden_set.fetch import ANCHOR_SOURCES as ANCHORS

TIMEOUT = 15
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}


def check(url: str) -> tuple[int | None, str]:
    try:
        r = httpx.head(url, follow_redirects=True, timeout=TIMEOUT, headers=HEADERS)
        return r.status_code, r.headers.get("content-type", "")
    except httpx.TimeoutException:
        return None, "TIMEOUT"
    except httpx.RequestError as exc:
        return None, str(exc)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("urls", nargs="*", metavar="URL", help="One or more raw URLs to check")
    group.add_argument("--all", action="store_true", dest="all_anchors", help="Check all registered anchors")
    parser.add_argument("--anchor", action="append", dest="anchors", metavar="ID", help="Check a named anchor (repeatable)")
    args = parser.parse_args()

    targets: list[tuple[str, str]] = []

    if args.all_anchors:
        targets = [(aid, meta["url"]) for aid, meta in ANCHORS.items()]
    elif args.anchors:
        for aid in args.anchors:
            if aid not in ANCHORS:
                print(f"[ERROR] Unknown anchor: {aid}  (known: {', '.join(ANCHORS)})", file=sys.stderr)
                return 2
            targets.append((aid, ANCHORS[aid]["url"]))
    else:
        targets = [(url, url) for url in args.urls]

    if not targets:
        parser.print_help()
        return 0

    failed = 0
    for label, url in targets:
        status, ct = check(url)
        ok = status is not None and status < 400
        icon = "OK  " if ok else "FAIL"
        if not ok:
            failed += 1
        status_str = str(status) if status is not None else ct
        print(f"[{icon}] {status_str:>6}  {label}")
        if ok and ct:
            print(f"         content-type: {ct}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
