# Milestones

## v1.0 UI Redesign (Shipped: 2026-02-13)

**Phases completed:** 5 phases, 8 plans | 33 files changed, +1045/-391 lines | 6,546 LOC TypeScript
**Git range:** ed1696b..9e78c3b (15 feat commits)

**Key accomplishments:**
- MTA transit-inspired design system: #0039A6 blue primary, Inter font, 6px spacing base, mode-specific colors
- Responsive layout: collapsible desktop sidebar (400px→56px), tablet 340px, mobile bottom sheet with gesture isolation
- Compact sidebar: ToggleButtonGroup mode selector, inline toggles, size="small" search inputs, transit-themed MapControls
- Route display polish: MODE_COLORS[mode] dynamic accents on cards/icons/chips, active step highlighting, maxZoom cap
- WCAG 2.1 AA compliance: contrast fixes, ARIA labels on all controls, keyboard navigation, focus management, 18 a11y tests

---

