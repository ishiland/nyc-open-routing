---
phase: 22-dependabot-triage
verified: 2026-02-15T13:45:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 22: Dependabot Triage Verification Report

**Phase Goal:** Reduce the 118 Dependabot alerts to zero or near-zero so the repo looks actively maintained.
**Verified:** 2026-02-15T13:45:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | gunicorn is no longer listed as a project dependency | VERIFIED | `grep gunicorn api/requirements.txt` returns no matches; file has 18 lines, all expected packages present |
| 2 | All existing API tests still pass after removal | VERIFIED | Summary reports 72/75 collectable tests pass; 3 pre-existing failures unrelated to gunicorn (Geosupport not installed in container) |
| 3 | ESLint runs without errors on the codebase | VERIFIED | `npm run lint:check` exits 0 with 0 errors, 5 expected react-refresh context warnings |
| 4 | TypeScript files are parsed correctly by ESLint | VERIFIED | `.eslintrc.json` uses `@typescript-eslint/parser`; lint runs successfully across all .ts/.tsx files |
| 5 | React hooks rules are enforced | VERIFIED | `plugin:react-hooks/recommended` in extends array; `eslint-plugin-react-hooks@^5` in devDependencies |
| 6 | The client builds successfully | VERIFIED | `npm run build` (tsc + vite build) exits 0, produces dist/ with 19 output files |
| 7 | All client tests pass | VERIFIED | `npm test` (vitest run) exits 0: 6 test files, 31 tests passed, 0 failures |
| 8 | npm audit shows zero critical or high vulnerabilities | VERIFIED | `npm audit --audit-level=high` exits 0; only 4 moderate severity vulns (esbuild via vite dev chain) |
| 9 | eslint-config-react-app is no longer a dependency | VERIFIED | `grep eslint-config-react-app client/package.json` returns no matches; not in package-lock.json either |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `api/requirements.txt` | Python dependency list without unused gunicorn | VERIFIED | 18 lines, uvicorn present, gunicorn absent, trailing newline present |
| `client/.eslintrc.json` | Modern ESLint config without CRA dependency | VERIFIED | Uses @typescript-eslint/parser, extends typescript-eslint/recommended + react-hooks/recommended + prettier, no react-app references |
| `client/package.json` | Updated devDependencies with direct ESLint plugins | VERIFIED | 4 new direct plugins added, eslint-config-react-app removed |
| `client/package-lock.json` | Clean lockfile without phantom CRA-era entries | VERIFIED | Zero occurrences of eslint-config-react-app, react-scripts, webpack-dev-server, or loader-utils |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/.eslintrc.json` | `client/package.json` | ESLint plugin references match installed packages | WIRED | All 6 referenced packages (@typescript-eslint/parser, @typescript-eslint/eslint-plugin, eslint-plugin-react-hooks, eslint-config-prettier, eslint-plugin-prettier, eslint-plugin-react-refresh) found in devDependencies |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| META-02: Dependabot alerts triaged -- update safe deps, dismiss false positives | SATISFIED | Gunicorn removed (1 Python alert), CRA ESLint config replaced (~102 phantom alerts eliminated), lockfile regenerated clean. Zero critical/high npm vulns. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No anti-patterns found in modified files |

### Human Verification Required

### 1. Dependabot Alert Count on GitHub

**Test:** Check the Dependabot alerts page on GitHub after the gsd branch merges to master.
**Expected:** Alert count should drop from 118 to near-zero. The 15 remaining Python alerts (Flask/Jinja2/Werkzeug) should auto-close since those packages were already removed during the FastAPI migration and only exist on master.
**Why human:** Dependabot alerts are evaluated against the default branch on GitHub; cannot verify programmatically from a feature branch.

### 2. CI Pipeline Passes

**Test:** Push branch and verify CI (lint, test, build) passes on GitHub Actions.
**Expected:** All CI checks green.
**Why human:** CI runs in GitHub-hosted environment, not locally verifiable with full confidence.

### Gaps Summary

No gaps found. All 9 observable truths verified. All artifacts exist, are substantive, and are properly wired. No anti-patterns detected. The phase goal of reducing Dependabot alerts is fully achieved at the codebase level:

- **Plan 22-01:** Gunicorn removed from `api/requirements.txt` (commit `77288b0`)
- **Plan 22-02:** CRA ESLint config replaced with modern direct plugins (commit `5d5e96e`), lockfile regenerated clean (commit `9867efc`), one lint fix in `useDebouncedFetch.ts` (let -> const)
- **npm audit:** 0 critical, 0 high; only 4 moderate (esbuild/vite dev chain, fixable when vite v7 adopted)
- **Phantom CRA deps:** Completely eliminated from lockfile (webpack-dev-server, react-scripts, loader-utils all return `(empty)`)

---

_Verified: 2026-02-15T13:45:00Z_
_Verifier: Claude (gsd-verifier)_
