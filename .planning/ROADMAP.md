# Roadmap

## Completed Milestones

- **v1.0 UI Redesign** (2026-02-13) — 5 phases, 8 plans, 33 files changed, +1045/-391 lines -> [archive](.planning/milestones/v1.0-ROADMAP.md)
- **v1.1 UI Polish** (2026-02-13) — 1 phase, 3 plans, 6 files changed, +88/-21 lines -> [archive](.planning/milestones/v1.1-ROADMAP.md)
- **v2.0 Isochrone Reachability** (2026-02-14) — isochrone feature, restriction fix, layer ordering fix
- **v2.1 Departure Time** (2026-02-14) — 2 phases, 2 plans, departure time picker + API/URL verification -> [archive](.planning/milestones/v2.1-ROADMAP.md)
- **v2.2 Edge Isochrones & Waypoints** (2026-02-14) — 4 phases, 8 plans, 24 files changed, +2881/-134 lines -> [archive](.planning/milestones/v2.2-ROADMAP.md)
- **v2.3 Ferry Route Fix** (2026-02-14) — 1 phase, 1 plan, 1 file changed, +175/-30 lines -> [archive](.planning/milestones/v2.3-ROADMAP.md)
- **v3.0 Public Release** (2026-02-14) — 3 phases, 4 plans, 141 files changed, +529/-21,141 lines -> [archive](.planning/milestones/v3.0-ROADMAP.md)
- **v4.0 Live Traffic** (2026-02-15) — 3 phases, 6 plans, 27 files changed, +3156/-239 lines -> [archive](.planning/milestones/v4.0-ROADMAP.md)
- **v4.1 GitHub Polish** (2026-02-15) — 3 phases, 6 plans, 24 files changed, +1494/-4110 lines -> [archive](.planning/milestones/v4.1-ROADMAP.md)

---

## v4.2 Developer Experience

**Milestone Goal:** Remove leftover cruft and add developer onboarding tools so a new contributor can clone, build, and understand the architecture quickly.

### Phases

- [ ] **Phase 23: Repo Cleanup** - Remove duplicate Dockerfiles, stale artifacts, and fix outdated references
- [ ] **Phase 24: Developer Onboarding** - Top-level Makefile and architecture documentation

### Phase Details

#### Phase 23: Repo Cleanup
**Goal**: The repo contains only files that are actively used, with no stale references pointing to things that don't exist
**Depends on**: Nothing (first phase of v4.2)
**Requirements**: CLN-01, CLN-02, CLN-03, CLN-04
**Success Criteria** (what must be TRUE):
  1. `docs/traffic-audit-report.md` no longer exists in the repo
  2. `client/Dockerfile` and `api/Dockerfile` no longer exist in the repo
  3. `docker-compose.yml` contains no comments referencing non-existent files
  4. All services still build and start successfully with `docker-compose up`
**Plans**: TBD

Plans:
- [ ] 23-01: Remove stale files and fix references

#### Phase 24: Developer Onboarding
**Goal**: A new contributor can build/test/lint the entire project with simple make commands and understand the system architecture from a single document
**Depends on**: Phase 23 (clean repo before documenting)
**Requirements**: DX-01, DOC-01
**Success Criteria** (what must be TRUE):
  1. Running `make build` from the repo root builds all Docker services
  2. Running `make test` from the repo root runs both API and client test suites
  3. Running `make lint` from the repo root lints both API and client code
  4. `docs/ARCHITECTURE.md` exists and covers data flow, import pipeline, routing algorithm, and key SQL functions
  5. `docs/ARCHITECTURE.md` is 1-2 pages (concise, not exhaustive)
**Plans**: TBD

Plans:
- [ ] 24-01: Create top-level Makefile
- [ ] 24-02: Write architecture documentation

### Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 23. Repo Cleanup | v4.2 | 0/1 | Not started | - |
| 24. Developer Onboarding | v4.2 | 0/2 | Not started | - |

---

*Last updated: 2026-02-15 after v4.2 roadmap created*
