# Roadmap: NYC Open Routing UI Redesign

## Overview

Transform the NYC Open Routing app from functional-but-dated to polished-and-NYC-native. The redesign applies a transit-inspired visual identity (MTA colors, bold typography, compact spacing) while ensuring tablet/mobile responsiveness and accessibility compliance. The journey follows a theme-first architecture: establish design tokens and component overrides (Phase 1), stabilize responsive layout with gesture conflict resolution (Phase 2), polish sidebar and map controls (Phase 3), polish route display components (Phase 4), then verify accessibility compliance (Phase 5).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Design System Foundation** - MTA-inspired theme with MUI overrides
- [x] **Phase 2: Responsive Layout System** - Polished adaptive layout with gesture conflict resolution
- [x] **Phase 3: Sidebar Redesign** - Compact sidebar with transit-inspired controls
- [ ] **Phase 4: Route Display Polish** - Polished route cards and turn-by-turn with transit aesthetic
- [ ] **Phase 5: Accessibility Audit** - WCAG 2.1 Level AA compliance verification

## Phase Details

### Phase 1: Design System Foundation
**Goal**: Establish transit-inspired theme tokens and component overrides that all subsequent phases will consume
**Depends on**: Nothing (first phase)
**Requirements**: DS-01, DS-02, DS-03, DS-04, DS-05
**Success Criteria** (what must be TRUE):
  1. App uses MTA-inspired color palette (MTA blue #0039A6 primary, red #EE352E secondary, orange #FF6319 accent) across all components
  2. App uses Inter font family with bold weights and tight type scale throughout interface
  3. All interactive elements have compact spacing (tighter than default MUI)
  4. Travel modes display distinct color accents (drive=MTA blue, bike=green, walk=orange)
  5. All components share consistent border radius, elevation, and shape tokens
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — MTA design tokens, Inter font, compact spacing, mode colors, component overrides

### Phase 2: Responsive Layout System
**Goal**: Deliver polished adaptive layout with tablet/mobile optimization and gesture conflict resolution
**Depends on**: Phase 1 (theme tokens for breakpoints, spacing, z-index)
**Requirements**: RS-01, RS-02, RS-03, RS-04, RS-05, SB-05, SB-06, MC-03
**Success Criteria** (what must be TRUE):
  1. Tablet layout uses narrower sidebar or overlay panel that doesn't dominate screen
  2. Mobile layout uses bottom sheet with snap points (collapsed/half/full)
  3. All interactive elements have minimum 44px touch targets on mobile/tablet
  4. Bottom sheet supports swipe gestures to expand/collapse without triggering map pan
  5. Map remains interactive behind/around bottom sheet on mobile
  6. Desktop sidebar collapses/expands smoothly to maximize map space
  7. Map attribution and controls don't clash with sidebar/bottom sheet
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Consolidate width constants, fix viewport units (100dvh), harden bottom sheet gesture isolation
- [x] 02-02-PLAN.md — Desktop sidebar collapse/expand with CSS transition, responsive map control positioning

### Phase 3: Sidebar Redesign
**Goal**: Compact, transit-inspired sidebar with polished search, mode selector, and map controls
**Depends on**: Phase 1 (theme tokens), Phase 2 (responsive layout)
**Requirements**: SB-01, SB-02, SB-03, SB-04, MC-01, MC-02
**Success Criteria** (what must be TRUE):
  1. Sidebar uses significantly less vertical space than current layout
  2. Search inputs styled with transit-inspired design (compact height, bold labels, MTA colors)
  3. Travel mode selector is compact and visually integrated (not stacked buttons)
  4. Traffic and ferry toggles are visually compact and integrated into sidebar flow
  5. Zoom controls styled to match transit theme
  6. Geolocation button styled with transit theme
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Compact mode selector (ToggleButtonGroup), inline toggles, tighter TitleBar and ControlsContainer
- [x] 03-02-PLAN.md — Compact search inputs (size="small"), tighter Sidebar spacing, transit-themed MapControls

### Phase 4: Route Display Polish
**Goal**: Polished route cards and turn-by-turn directions with transit aesthetic
**Depends on**: Phase 1 (theme tokens), Phase 2 (responsive layout)
**Requirements**: RD-01, RD-02, RD-03, RD-04
**Success Criteria** (what must be TRUE):
  1. Route summary cards show time, distance, and mode with polished visual hierarchy
  2. Turn-by-turn list has clean visual hierarchy with properly sized step icons
  3. Route cards use mode-specific color accents (drive=blue, bike=green, walk=orange)
  4. Clicking a turn-by-turn step zooms the map to that location
**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md — Mode-specific color accents, active step highlighting, zoom cap, selectedStreet reset

### Phase 5: Accessibility Audit
**Goal**: Verify WCAG 2.1 Level AA compliance across all redesigned components
**Depends on**: Phases 1, 2, 3, 4 (all components and layouts implemented)
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04
**Success Criteria** (what must be TRUE):
  1. All color combinations meet WCAG AA contrast ratio (4.5:1 text, 3:1 graphics)
  2. All controls navigable via keyboard with visible focus indicators (3px outline, 3:1 contrast)
  3. All interactive elements have appropriate ARIA labels for screen readers
  4. Focus management works correctly when sidebar collapses and bottom sheet snaps
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Design System Foundation | 1/1 | Complete | 2026-02-13 |
| 2. Responsive Layout System | 2/2 | Complete | 2026-02-13 |
| 3. Sidebar Redesign | 2/2 | Complete | 2026-02-13 |
| 4. Route Display Polish | 0/1 | Not started | - |
| 5. Accessibility Audit | 0/TBD | Not started | - |

---
*Created: 2026-02-12*
*Last updated: 2026-02-13 after completing Phase 3*
