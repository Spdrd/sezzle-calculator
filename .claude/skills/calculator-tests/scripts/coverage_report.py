#!/usr/bin/env python3
"""Run backend and frontend tests with coverage and rewrite docs/coverage.md.

Usage: coverage_report.py    (run from anywhere inside the repository)
Exits non-zero if either test suite fails.
"""
import datetime
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[4]
BACKEND, FRONTEND = ROOT / "backend", ROOT / "frontend"
MODULE_PREFIX = "github.com/Spdrd/sezzle-calculator/backend/"
ANSI = re.compile(r"\x1b\[[0-9;]*m")


def run(cmd, cwd):
    exe = shutil.which(cmd[0])
    if exe is None:
        sys.exit(f"error: '{cmd[0]}' not found on PATH")
    proc = subprocess.run([exe, *cmd[1:]], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return proc.returncode, ANSI.sub("", proc.stdout + proc.stderr)


def main():
    go_rc, go_test = run(["go", "test", "-count=1", "-coverprofile=coverage.out", "./..."], BACKEND)
    go_func = ""
    if go_rc == 0:
        _, go_func = run(["go", "tool", "cover", "-func=coverage.out"], BACKEND)
        run(["go", "tool", "cover", "-html=coverage.out", "-o", "coverage.html"], BACKEND)
        go_func = go_func.replace(MODULE_PREFIX, "")

    fe_rc, fe_out = run(["npx", "vitest", "run", "--coverage"], FRONTEND)
    fe_lines = [l for l in fe_out.splitlines() if "|" in l or re.match(r"\s*(Test Files|Tests)\s", l)]

    report = [
        "# Coverage report",
        "",
        f"Generated {datetime.date.today().isoformat()} by `.claude/skills/calculator-tests/scripts/coverage_report.py`.",
        "",
        "## Backend (`go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out`)",
        "",
        "```",
        go_test.strip(),
        "",
        go_func.strip(),
        "```",
        "",
        "`main.go` is process wiring (env config, signal handling) and is intentionally not unit tested.",
        "",
        "## Frontend (`npm run coverage`)",
        "",
        "```",
        *fe_lines,
        "```",
        "",
    ]
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "coverage.md").write_text("\n".join(report), encoding="utf-8")

    go_total = next((l.split()[-1] for l in go_func.splitlines() if l.startswith("total:")), "n/a")
    fe_total = next((l for l in fe_lines if l.startswith("All files")), "All files | n/a")
    fe_tests = next((l.strip() for l in fe_lines if l.strip().startswith("Tests")), "Tests n/a")
    print(f"backend : {'ok' if go_rc == 0 else 'FAILED'}  total statements {go_total}")
    print(f"frontend: {'ok' if fe_rc == 0 else 'FAILED'}  {fe_tests}  | {' '.join(fe_total.split())}")
    print(f"wrote {ROOT / 'docs' / 'coverage.md'}")
    if go_rc != 0:
        print("\n--- go test output ---\n" + go_test)
    if fe_rc != 0:
        print("\n--- vitest output ---\n" + fe_out[-4000:])
    return 0 if go_rc == 0 and fe_rc == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
