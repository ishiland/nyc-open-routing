# Roadmap

## Completed Milestones

- **v1.0 UI Redesign** (2026-02-13) — 5 phases, 8 plans, 33 files changed, +1045/-391 lines → [archive](.planning/milestones/v1.0-ROADMAP.md)
- **v1.1 UI Polish** (2026-02-13) — 1 phase, 3 plans, 6 files changed, +88/-21 lines → [archive](.planning/milestones/v1.1-ROADMAP.md)
- **v2.0 Isochrone Reachability** (2026-02-14) — isochrone feature, restriction fix, layer ordering fix

## Current Milestone: v2.1 Departure Time

**Milestone Goal:** Users can specify a departure day and hour for traffic-aware routing and isochrones, with shareable deep links.

**Phase Numbering:**
- Integer phases (7, 8): Planned milestone work
- Decimal phases (7.1, 7.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 7: Departure Time Picker** - Compact day/hour picker with "Now" default, reset, and conditional visibility ✓ (2026-02-14)
- [ ] **Phase 8: API and URL Integration** - Wire departure time into route/isochrone API calls and URL query params

## Phase Details

### Phase 7: Departure Time Picker
**Goal**: User can select a departure day and hour from a compact picker that appears only when traffic routing is active
**Depends on**: Nothing (first phase of milestone)
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-06
**Success Criteria** (what must be TRUE):
  1. User sees a departure time picker in the sidebar when traffic toggle is enabled in drive mode
  2. Picker defaults to "Now" and displays "Leave at [day] [time]" when a custom departure is selected
  3. User can reset the picker back to "Now" with a single action (e.g., clear button)
  4. Picker is hidden when traffic toggle is off or when bike/walk mode is selected
**Plans:** 1 plan

Plans:
- [x] 07-01-PLAN.md — DepartureTimePicker component and sidebar wiring ✓

### Phase 8: API and URL Integration
**Goal**: Selected departure time flows through to API calls and persists in shareable URLs
**Depends on**: Phase 7
**Requirements**: TIME-04, TIME-05
**Success Criteria** (what must be TRUE):
  1. Route API calls include `hour` and `day_of_week` params matching the user's selected departure time
  2. Isochrone API calls include `hour` and `day_of_week` params matching the user's selected departure time
  3. Departure time is reflected in URL query params so the link can be shared and restored
  4. Opening a shared link with departure time params restores the picker to the correct day/hour
**Plans:** 1 plan

Plans:
- [ ] 08-01-PLAN.md — Verify pre-existing API and URL integration (no code changes)

## Progress

**Execution Order:** 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Departure Time Picker | 1/1 | ✓ Complete | 2026-02-14 |
| 8. API and URL Integration | 0/1 | Not started | - |

---
*Last updated: 2026-02-14 after phase 8 planning*
