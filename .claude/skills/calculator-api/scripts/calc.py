#!/usr/bin/env python3
"""Minimal client for the calculator REST API (standard library only).

Usage:
  calc.py [--base URL] health
  calc.py [--base URL] ops
  calc.py [--base URL] <operation> <operand> [operand ...]
  calc.py [--base URL] raw <operation> '<json body>'

Exit codes: 0 = 2xx response, 1 = API returned an error, 2 = connection/usage error.
"""
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_BASE = os.environ.get("CALC_API_URL", "http://localhost:8080")


def request(base, method, path, body=None):
    data = None if body is None else body.encode("utf-8")
    req = urllib.request.Request(base.rstrip("/") + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8")


def show(status, text):
    try:
        text = json.dumps(json.loads(text), ensure_ascii=False)
    except ValueError:
        pass
    print(f"HTTP {status}")
    print(text.strip())
    return 0 if 200 <= status < 300 else 1


def usage(msg=None):
    if msg:
        print(f"error: {msg}", file=sys.stderr)
    print(__doc__.strip(), file=sys.stderr)
    return 2


def main(argv):
    base = DEFAULT_BASE
    # Parse --base by hand so negative operands like "-5" are not taken as flags.
    if len(argv) >= 2 and argv[0] == "--base":
        base, argv = argv[1], argv[2:]
    if not argv:
        return usage()

    cmd, args = argv[0], argv[1:]
    try:
        if cmd == "health":
            return show(*request(base, "GET", "/api/health"))
        if cmd == "ops":
            return show(*request(base, "GET", "/api/v1/operations"))
        if cmd == "raw":
            if len(args) != 2:
                return usage("raw needs <operation> '<json body>'")
            return show(*request(base, "POST", f"/api/v1/{args[0]}", args[1]))
        try:
            operands = [float(a) for a in args]
        except ValueError:
            return usage(f"operands must be numbers, got {args!r} (use 'raw' to send arbitrary JSON)")
        # Send integers as integers so the echoed request reads naturally.
        operands = [int(v) if v.is_integer() and abs(v) < 2**53 else v for v in operands]
        return show(*request(base, "POST", f"/api/v1/{cmd}", json.dumps({"operands": operands})))
    except urllib.error.URLError as err:
        print(f"connection error: cannot reach {base} ({err.reason}). Is the backend running?", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
