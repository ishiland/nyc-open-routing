# Requirements: NYC Open Routing

**Defined:** 2026-02-14
**Core Value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable

## v3.0 Requirements

Requirements for public release preparation. Each maps to roadmap phases.

### Code Quality

- [ ] **CODE-01**: Codebase reviewed for KISS principles — dead code removed, unnecessary abstractions simplified, confusing patterns clarified
- [ ] **CODE-02**: Logic is correct and easy to follow — no misleading names, tangled state, or over-engineered solutions

### Repo Cleanup

- [ ] **CLEAN-01**: All test/debug screenshots removed from repo root (15+ PNG/JPEG files)
- [ ] **CLEAN-02**: `client/dist/` untracked from git and added to .gitignore
- [ ] **CLEAN-03**: Internal dev artifacts removed from git history (.planning/, CLAUDE.md, docs/ dev notes, .playwright-mcp/)
- [ ] **CLEAN-04**: .gitignore updated with comprehensive patterns
- [ ] **CLEAN-05**: Junk files removed (todo.md, lion meta.md, ROUTING_ANALYSIS.md)

### Documentation

- [ ] **DOCS-01**: Professional README with hero screenshot, feature highlights, tech stack badges, quick start guide, API documentation, architecture overview
- [ ] **DOCS-02**: MIT LICENSE file at repo root
- [ ] **DOCS-03**: CONTRIBUTING.md with development setup, code style guidelines, and PR process
- [ ] **DOCS-04**: `docs/` directory cleaned — internal dev notes removed

### CI/CD

- [ ] **CI-01**: GitHub Actions workflow updated to current action versions and correct branch name

## Future Requirements

- Partial edge clipping via ST_LineSubstring for edges crossing time boundaries
- Continuous color gradient for edge-based isochrones
- Waypoint reorder via drag-and-drop
- URL deep links with waypoint coordinates
- Multiple route suggestions
- Click on map to select location
- Live DOT traffic feed

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live demo deployment | Beyond repo cleanup scope, separate infrastructure concern |
| Animated GIF/video demo | Screenshot sufficient for initial release |
| GitHub Pages documentation site | README + CONTRIBUTING sufficient for project scope |
| Rewriting git history (interactive rebase) | Too destructive; git rm + .gitignore achieves the goal |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CODE-01 | Phase 14 | Pending |
| CODE-02 | Phase 14 | Pending |
| CLEAN-01 | Phase 15 | Pending |
| CLEAN-02 | Phase 15 | Pending |
| CLEAN-03 | Phase 15 | Pending |
| CLEAN-04 | Phase 15 | Pending |
| CLEAN-05 | Phase 15 | Pending |
| CI-01 | Phase 15 | Pending |
| DOCS-01 | Phase 16 | Pending |
| DOCS-02 | Phase 16 | Pending |
| DOCS-03 | Phase 16 | Pending |
| DOCS-04 | Phase 16 | Pending |

**Coverage:**
- v3.0 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after roadmap creation*
