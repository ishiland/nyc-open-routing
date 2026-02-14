# Roadmap

## Completed Milestones

- **v1.0 UI Redesign** (2026-02-13) — 5 phases, 8 plans, 33 files changed, +1045/-391 lines -> [archive](.planning/milestones/v1.0-ROADMAP.md)
- **v1.1 UI Polish** (2026-02-13) — 1 phase, 3 plans, 6 files changed, +88/-21 lines -> [archive](.planning/milestones/v1.1-ROADMAP.md)
- **v2.0 Isochrone Reachability** (2026-02-14) — isochrone feature, restriction fix, layer ordering fix
- **v2.1 Departure Time** (2026-02-14) — 2 phases, 2 plans, departure time picker + API/URL verification -> [archive](.planning/milestones/v2.1-ROADMAP.md)
- **v2.2 Edge Isochrones & Waypoints** (2026-02-14) — 4 phases, 8 plans, 24 files changed, +2881/-134 lines -> [archive](.planning/milestones/v2.2-ROADMAP.md)
- **v2.3 Ferry Route Fix** (2026-02-14) — 1 phase, 1 plan, 1 file changed, +175/-30 lines -> [archive](.planning/milestones/v2.3-ROADMAP.md)

---

## v3.0 Public Release (In Progress)

**Milestone Goal:** Prepare codebase for public release — clean code, clean repo, proper documentation.

- [x] **Phase 14: Code Quality Review** - Thorough KISS review of entire codebase, fix issues found
- [ ] **Phase 15: Repo Cleanup** - Remove junk files, untrack dist/, update .gitignore, update CI workflow
- [ ] **Phase 16: Documentation & Public Release** - README, LICENSE, CONTRIBUTING.md, clean docs/

## Phase Details

### Phase 14: Code Quality Review
**Goal**: Every module in the codebase is simple, correct, and easy to follow
**Depends on**: Nothing (first phase of v3.0)
**Requirements**: CODE-01, CODE-02
**Success Criteria** (what must be TRUE):
  1. No dead code remains — unused imports, unreachable branches, commented-out blocks, and orphaned functions are removed
  2. No misleading names — variables, functions, and files accurately describe what they do
  3. No unnecessary abstractions — every layer of indirection earns its keep; over-engineered patterns are simplified
  4. Control flow is straightforward — no tangled state, no surprising side effects, no logic that requires mental gymnastics to trace
  5. Existing tests still pass after all changes (zero regressions)
**Plans:** 2 plans

Plans:
- [x] 14-01-PLAN.md — Backend code quality review (api/ + data-importer/ + scripts/)
- [x] 14-02-PLAN.md — Frontend code quality review (client/src/)

### Phase 15: Repo Cleanup
**Goal**: Repository contains only files that belong in a public open-source project
**Depends on**: Phase 14
**Requirements**: CLEAN-01, CLEAN-02, CLEAN-03, CLEAN-04, CLEAN-05, CI-01
**Success Criteria** (what must be TRUE):
  1. No test/debug screenshots exist in the repo root or anywhere in tracked files
  2. `client/dist/` is in .gitignore and untracked — `git status` shows no dist/ files
  3. Internal dev artifacts (.planning/, CLAUDE.md, docs/ dev notes, .playwright-mcp/) are removed from the working tree via `git rm`
  4. .gitignore covers comprehensive patterns (OS files, editor configs, build outputs, env files, debug artifacts)
  5. GitHub Actions workflow runs successfully with current action versions and correct branch name
**Plans:** 1 plan

Plans:
- [ ] 15-01-PLAN.md — Remove junk files, untrack dist/ and dev artifacts, update .gitignore and CI workflow

### Phase 16: Documentation & Public Release
**Goal**: A new visitor to the GitHub repo can understand, run, and contribute to the project within minutes
**Depends on**: Phase 15
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. README.md at repo root includes hero screenshot, feature highlights with descriptions, tech stack badges, quick start guide (clone to running in under 5 commands), API endpoint documentation, and architecture overview
  2. MIT LICENSE file exists at repo root with correct year and attribution
  3. CONTRIBUTING.md exists with development setup instructions, code style guidelines (Python + TypeScript), and PR process
  4. `docs/` directory contains only public-facing documentation — no internal dev notes, research files, or planning artifacts
**Plans**: TBD

Plans:
- [ ] 16-01: TBD
- [ ] 16-02: TBD

## Progress

**Execution Order:** Phase 14 -> Phase 15 -> Phase 16

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 14. Code Quality Review | 2/2 | ✓ Complete | 2026-02-14 |
| 15. Repo Cleanup | 0/TBD | Not started | - |
| 16. Documentation & Public Release | 0/TBD | Not started | - |

---
*Last updated: 2026-02-14 after v3.0 roadmap creation*
