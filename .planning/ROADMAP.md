# Roadmap

## Completed Milestones

- **v1.0 UI Redesign** (2026-02-13) — 5 phases, 8 plans, 33 files changed, +1045/-391 lines → [archive](.planning/milestones/v1.0-ROADMAP.md)

## Current Milestone: v1.1 UI Polish

**Goal:** Fix bugs and refine UX issues identified during v1.0 review

- [ ] **Phase 6: Bug Fixes and UX Polish** - Resolve interaction bugs and add missing UX affordances across sidebar, map, and mobile

## Phase Details

### Phase 6: Bug Fixes and UX Polish
**Goal**: Every interaction works correctly on all breakpoints, and the UI guides users when no route is active
**Depends on**: Phase 5 (v1.0 complete)
**Requirements**: BUG-01, BUG-02, BUG-03, SB-01, SB-02, MAP-01
**Success Criteria** (what must be TRUE):
  1. User can click the info button in the TitleBar without the sidebar collapse toggle intercepting the click
  2. User who opens a shared deep link sees the correct travel mode (drive/bike/walk) pre-selected and the route rendered in the correct mode color
  3. User on a mobile device sees autocomplete suggestions fully visible above the bottom sheet when typing an address
  4. User who collapses the sidebar sees an icon rail showing the current travel mode with working tooltips, and can expand back to full sidebar
  5. User who loads the app with no route sees a contextual hint in the sidebar explaining how to get started
  6. Map zoom and navigation controls appear smoothly on page load without any flash, pop-in, or layout shift

**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 6. Bug Fixes and UX Polish | v1.1 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-13 after v1.1 roadmap creation*
