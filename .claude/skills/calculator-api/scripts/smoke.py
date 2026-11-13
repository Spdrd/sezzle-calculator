#!/usr/bin/env python3
"""End-to-end smoke test of the calculator REST API.

Usage: smoke.py [--base URL]    (default: $CALC_API_URL or http://localhost:8080)
Exits non-zero if any case fails or the server is unreachable.
"""
import json
import os
import sys
import urllib.error
import urllib.request

# (description, method, path, body, expected status, expected result or error code)
CASES = [
    ("health", "GET", "/api/health", None, 200, None),
    ("list operations", "GET", "/api/v1/operations", None, 200, None),
    ("add", "POST", "/api/v1/add", '{"operands":[2,3]}', 200, 5),
    ("subtract", "POST", "/api/v1/subtract", '{"operands":[2,3]}', 200, -1),
    ("multiply", "POST", "/api/v1/multiply", '{"operands":[2.5,4]}', 200, 10),
    ("divide", "POST", "/api/v1/divide", '{"operands":[1,8]}', 200, 0.125),
    ("power", "POST", "/api/v1/power", '{"operands":[2,10]}', 200, 1024),
    ("sqrt", "POST", "/api/v1/sqrt", '{"operands":[81]}', 200, 9),
    ("percentage", "POST", "/api/v1/percentage", '{"operands":[15,200]}', 200, 30),
    ("negative zero normalised", "POST", "/api/v1/multiply", '{"operands":[-5,0]}', 200, 0),
    ("division by zero", "POST", "/api/v1/divide", '{"operands":[1,0]}', 422, "division_by_zero"),
    ("zero to negative power", "POST", "/api/v1/power", '{"operands":[0,-1]}', 422, "division_by_zero"),
    ("negative sqrt", "POST", "/api/v1/sqrt", '{"operands":[-4]}', 422, "negative_sqrt"),
    ("undefined power", "POST", "/api/v1/power", '{"operands":[-8,0.5]}', 422, "undefined_result"),
    ("overflow", "POST", "/api/v1/power", '{"operands":[10,400]}', 422, "result_out_of_range"),
    ("wrong operand count", "POST", "/api/v1/sqrt", '{"operands":[1,2]}', 400, "invalid_operand_count"),
    ("missing operands", "POST", "/api/v1/add", "{}", 400, "invalid_operand_count"),
    ("null operand", "POST", "/api/v1/add", '{"operands":[null,2]}', 400, "invalid_operand"),
    ("string operand", "POST", "/api/v1/add", '{"operands":["1",2]}', 400, "invalid_operand"),
    ("out of float64 range", "POST", "/api/v1/add", '{"operands":[1e400,1]}', 400, "invalid_operand"),
    ("malformed JSON", "POST", "/api/v1/add", '{"operands":[1,2]', 400, "invalid_json"),
    ("unknown field", "POST", "/api/v1/add", '{"operands":[1,2],"x":1}', 400, "invalid_json"),
    ("body too large", "POST", "/api/v1/add", '{"operands":[' + "1," * 2000 + "1]}", 413, "body_too_large"),
    ("unknown operation", "POST", "/api/v1/modulo", '{"operands":[1,2]}', 404, "unknown_operation"),
    ("unknown route", "GET", "/api/v2/nothing", None, 404, "not_found"),
]


def call(base, method, path, body):
    data = None if body is None else body.encode("utf-8")
    req = urllib.request.Request(base.rstrip("/") + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        return err.code, err.read().decode("utf-8")


def check(status, text, want_status, want):
    if status != want_status:
        return f"status {status}, want {want_status}"
    try:
        payload = json.loads(text)
    except ValueError:
        return f"response is not JSON: {text[:80]!r}"
    if want is None:
        return None
    if isinstance(want, str):
        got = payload.get("error", {}).get("code")
        return None if got == want else f"code {got!r}, want {want!r}"
    got = payload.get("result")
    return None if isinstance(got, (int, float)) and abs(got - want) < 1e-12 else f"result {got!r}, want {want!r}"


def main(argv):
    base = os.environ.get("CALC_API_URL", "http://localhost:8080")
    if len(argv) == 2 and argv[0] == "--base":
        base = argv[1]
    elif argv:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    failures = 0
    width = max(len(c[0]) for c in CASES)
    for name, method, path, body, want_status, want in CASES:
        try:
            status, text = call(base, method, path, body)
        except urllib.error.URLError as err:
            print(f"connection error: cannot reach {base} ({err.reason}). Is the backend running?", file=sys.stderr)
            return 2
        problem = check(status, text, want_status, want)
        failures += problem is not None
        print(f"{'PASS' if problem is None else 'FAIL'}  {name:<{width}}  {method} {path}"
              + ("" if problem is None else f"  -> {problem}"))

    print(f"\n{len(CASES) - failures}/{len(CASES)} passed against {base}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
