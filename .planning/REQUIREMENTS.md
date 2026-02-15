# Requirements: NYC Open Routing

**Defined:** 2026-02-15
**Core Value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable

## v4.2 Requirements

Requirements for developer experience polish. Clean up cruft, improve onboarding for contributors.

### Cleanup

- [x] **CLN-01**: Remove `docs/traffic-audit-report.md` (internal dev artifact, not useful to contributors)
- [x] **CLN-02**: Remove duplicate `client/Dockerfile` (identical to `docker/dev/client.Dockerfile`, unused by docker-compose)
- [x] **CLN-03**: Remove duplicate `api/Dockerfile` (near-identical to `docker/dev/api.Dockerfile`, unused by docker-compose)
- [x] **CLN-04**: Fix stale docker-compose.yml comment referencing non-existent `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`

### Developer Tooling

- [x] **DX-01**: Top-level Makefile with commands for build, up, down, test, lint, format, import, db shell, and logs

### Documentation

- [x] **DOC-01**: Brief `docs/ARCHITECTURE.md` covering data flow, import pipeline, routing algorithm, and key SQL functions (1-2 pages)

## Future Requirements

None — this is a cleanup milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Production Dockerfile optimization | No production deployment planned |
| CI/CD pipeline changes | CI already working from v3.0 |
| .env documentation page | README Quick Start + .env.example sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLN-01 | Phase 23 | Complete |
| CLN-02 | Phase 23 | Complete |
| CLN-03 | Phase 23 | Complete |
| CLN-04 | Phase 23 | Complete |
| DX-01 | Phase 24 | Complete |
| DOC-01 | Phase 24 | Complete |

**Coverage:**
- v4.2 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after roadmap created*
