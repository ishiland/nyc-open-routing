# Requirements: NYC Open Routing UI Redesign

**Defined:** 2026-02-12
**Core Value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable

## v1 Requirements

Requirements for the UI redesign. Each maps to roadmap phases.

### Design System

- [ ] **DS-01**: App uses MTA-inspired color palette (primary blue #0039A6, secondary red #EE352E, accent orange #FF6319) as theme foundation
- [ ] **DS-02**: App uses Inter font family with bold weights and tight type scale for transit aesthetic
- [ ] **DS-03**: App uses compact spacing tokens throughout (tighter than default MUI spacing)
- [ ] **DS-04**: Travel modes have distinct color accents (drive=MTA blue, bike=green, walk=orange)
- [ ] **DS-05**: Consistent border radius, elevation, and shape tokens across all components

### Sidebar

- [ ] **SB-01**: Sidebar uses significantly less vertical space than current layout
- [ ] **SB-02**: Search inputs styled with transit-inspired design (compact height, bold labels, MTA colors)
- [ ] **SB-03**: Travel mode selector is compact and visually integrated (not stacked buttons)
- [ ] **SB-04**: Traffic and ferry toggles are visually compact and integrated into sidebar flow
- [ ] **SB-05**: Sidebar can collapse on desktop to maximize map space
- [ ] **SB-06**: Sidebar controls have smooth expand/collapse animations

### Route Display

- [ ] **RD-01**: Route summary cards show time, distance, and mode with polished visual hierarchy
- [ ] **RD-02**: Turn-by-turn list has clean visual hierarchy with properly sized step icons
- [ ] **RD-03**: Route cards use mode-specific color accents (drive=blue, bike=green, walk=orange)
- [ ] **RD-04**: Clicking a turn-by-turn step zooms the map to that location

### Responsive

- [ ] **RS-01**: Tablet layout uses narrower sidebar or overlay panel that doesn't dominate the screen
- [ ] **RS-02**: Mobile layout uses bottom sheet with snap points (collapsed/half/full)
- [ ] **RS-03**: All interactive elements have minimum 44px touch targets on mobile/tablet
- [ ] **RS-04**: Bottom sheet supports swipe gestures to expand/collapse
- [ ] **RS-05**: Map remains interactive behind/around the bottom sheet on mobile

### Map Controls

- [ ] **MC-01**: Zoom controls styled to match transit theme
- [ ] **MC-02**: Geolocation button styled with transit theme
- [ ] **MC-03**: Map attribution and controls don't clash with sidebar/bottom sheet

### Accessibility

- [ ] **A11Y-01**: All color combinations meet WCAG AA contrast ratio (4.5:1 minimum)
- [ ] **A11Y-02**: All controls navigable via keyboard with visible focus indicators
- [ ] **A11Y-03**: All interactive elements have appropriate ARIA labels for screen readers
- [ ] **A11Y-04**: Focus management works correctly when sidebar collapses/bottom sheet snaps

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Visual Enhancements

- **VE-01**: Dark mode theme variant
- **VE-02**: Transit-inspired loading animations (subway-style progress)
- **VE-03**: Custom map tile styling to match transit theme

### Advanced Mobile

- **AM-01**: Haptic feedback on bottom sheet snap points (native apps only)
- **AM-02**: PWA support with install prompt
- **AM-03**: Offline-capable route display

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend/API changes | Frontend-only redesign, routing logic untouched |
| New routing modes (transit, etc.) | UI redesign, not feature expansion |
| Real-time traffic visualization | Cost/complexity, static traffic factors sufficient for POC |
| User accounts / authentication | POC stays anonymous |
| Custom MapLibre basemap style | Map tiles stay as-is, only UI chrome changes |
| Animation libraries (framer-motion, react-spring) | Emotion keyframes + CSS transitions sufficient, no new deps |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 1 | Pending |
| DS-02 | Phase 1 | Pending |
| DS-03 | Phase 1 | Pending |
| DS-04 | Phase 1 | Pending |
| DS-05 | Phase 1 | Pending |
| SB-01 | Phase 3 | Pending |
| SB-02 | Phase 3 | Pending |
| SB-03 | Phase 3 | Pending |
| SB-04 | Phase 3 | Pending |
| SB-05 | Phase 2 | Pending |
| SB-06 | Phase 2 | Pending |
| RD-01 | Phase 4 | Pending |
| RD-02 | Phase 4 | Pending |
| RD-03 | Phase 4 | Pending |
| RD-04 | Phase 4 | Pending |
| RS-01 | Phase 2 | Pending |
| RS-02 | Phase 2 | Pending |
| RS-03 | Phase 2 | Pending |
| RS-04 | Phase 2 | Pending |
| RS-05 | Phase 2 | Pending |
| MC-01 | Phase 3 | Pending |
| MC-02 | Phase 3 | Pending |
| MC-03 | Phase 2 | Pending |
| A11Y-01 | Phase 5 | Pending |
| A11Y-02 | Phase 5 | Pending |
| A11Y-03 | Phase 5 | Pending |
| A11Y-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-02-12*
*Last updated: 2026-02-12 after roadmap creation with 100% coverage*
