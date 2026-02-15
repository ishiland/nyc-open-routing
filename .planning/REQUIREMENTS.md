# Requirements: NYC Open Routing

**Defined:** 2026-02-15
**Core Value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable

## v4.2 Requirements

Requirements for developer experience polish. Clean up cruft, improve onboarding for contributors.

### Cleanup

- [ ] **CLN-01**: Remove `docs/traffic-audit-report.md` (internal dev artifact, not useful to contributors)
- [ ] **CLN-02**: Remove duplicate `client/Dockerfile` (identical to `docker/dev/client.Dockerfile`, unused by docker-compose)
- [ ] **CLN-03**: Remove duplicate `api/Dockerfile` (near-identical to `docker/dev/api.Dockerfile`, unused by docker-compose)
- [ ] **CLN-04**: Fix stale docker-compose.yml comment referencing non-existent `docs/PERFORMANCE_OPTIMIZATION_PLAN.md`

### Developer Tooling

- [ ] **DX-01**: Top-level Makefile with commands for build, up, down, test, lint, format, import, db shell, and logs

### Documentation

- [ ] **DOC-01**: Brief `docs/ARCHITECTURE.md` covering data flow, import pipeline, routing algorithm, and key SQL functions (1-2 pages)

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
| CLN-01 | TBD | Pending |
| CLN-02 | TBD | Pending |
| CLN-03 | TBD | Pending |
| CLN-04 | TBD | Pending |
| DX-01 | TBD | Pending |
| DOC-01 | TBD | Pending |

**Coverage:**
- v4.2 requirements: 6 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 6

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after initial definition*
