# Phase 5: Accessibility Audit - Research

**Researched:** 2026-02-13
**Domain:** WCAG 2.1 Level AA compliance, color contrast, keyboard navigation, ARIA patterns, focus management
**Confidence:** HIGH

## Summary

This phase audits the existing codebase against WCAG 2.1 Level AA requirements (A11Y-01 through A11Y-04). The codebase already has substantial accessibility infrastructure established in Phases 1-4: the theme defines 44px minimum touch targets on all interactive components, focus-visible outlines (3px solid MTA Blue) on Button/IconButton/ToggleButton/ListItemButton, SkipLink for keyboard users, semantic landmarks (`<nav>`, `<main>`, `<aside>`), ARIA attributes on most interactive elements (aria-label, aria-labelledby, role attributes), and a screen-reader live region for route calculation status. However, there are specific gaps that need closing.

The audit identifies **concrete issues** that must be fixed and **tests that must be written** to verify compliance. The primary gap categories are: (1) missing ARIA labels on Switch components (TrafficToggle, FerryToggle), (2) a walk-mode color contrast concern when used as white text on an orange background in the TravelModeSelect selected state, (3) missing focus management when sidebar collapses/expands and when bottom sheet snap point changes, (4) the ZoomToRouteButton Fab missing an explicit aria-label, (5) the InfoModal button missing accessible text, and (6) the BottomSheet drag handle needing keyboard support for snap-point cycling.

**Primary recommendation:** Fix the identified ARIA gaps and color contrast issues in components, add focus management for sidebar collapse/bottom sheet transitions, then write automated accessibility tests using `vitest-axe` (axe-core integration for Vitest) alongside manual `getByRole`/`getByLabelText` assertions to verify compliance.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@testing-library/react` | ^14.1.2 | Component rendering + accessible queries | Already installed; `getByRole`, `getByLabelText` are the primary a11y test queries |
| `@testing-library/user-event` | ^14.5.2 | Simulates keyboard/mouse interactions | Already installed; `tab()`, `keyboard()` for focus flow testing |
| `vitest` | ^1.2.0 | Test runner | Already installed; jsdom environment compatible with axe-core |

### Supporting (new install required)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest-axe` | ^0.1.0 | axe-core matchers for Vitest (`toHaveNoViolations`) | Every component-level a11y test; automated WCAG rule checking |
| `axe-core` | ^4.10 | Accessibility rules engine (peer dep of vitest-axe) | Transitive dependency; configure WCAG 2.1 AA rule tags |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vitest-axe` | `jest-axe` | jest-axe has type conflicts with Vitest; vitest-axe is a direct fork that resolves this |
| `vitest-axe` | `@sa11y/vitest` | Salesforce's a11y matcher; less community adoption than axe-core-based tools |
| Automated tests only | Manual audit with browser devtools | Automated catches structural issues; manual needed for visual contrast and keyboard flow. Use both. |

### Installation
```bash
cd client && npm install --save-dev vitest-axe
```

Note: `axe-core` is a dependency of `vitest-axe` and will be installed automatically.

## Architecture Patterns

### Test File Organization
```
client/src/
  __tests__/
    accessibility/
      a11y.setup.ts            # vitest-axe matcher registration + axe config
      contrast-audit.test.tsx   # A11Y-01: Color contrast verification
      keyboard-nav.test.tsx     # A11Y-02: Keyboard navigation + focus indicators
      aria-labels.test.tsx      # A11Y-03: ARIA labels on all interactive elements
      focus-management.test.tsx # A11Y-04: Focus management on layout transitions
```

Alternative: co-locate a11y tests with components (e.g., `TravelModeSelect.a11y.test.tsx`). The dedicated directory approach is recommended for this audit phase because it maps 1:1 to requirements A11Y-01 through A11Y-04 and makes the audit scope explicit.

### Pattern 1: vitest-axe Setup and Usage
**What:** Register axe-core matchers with Vitest, configure for WCAG 2.1 AA rules, run against rendered components.
**When to use:** Every component a11y test.
**Example:**
```typescript
// a11y.setup.ts
import { configureAxe, toHaveNoViolations } from "vitest-axe"
import { expect } from "vitest"

expect.extend(toHaveNoViolations)

// Configure axe for WCAG 2.1 AA (exclude color-contrast -- not reliable in jsdom)
export const axeConfig = configureAxe({
  rules: {
    "color-contrast": { enabled: false }, // jsdom cannot compute visual contrast
  },
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  },
})
```

```typescript
// Example test
import { render } from "@testing-library/react"
import { axe } from "vitest-axe"
import { TravelModeSelect } from "../components/controls/TravelModeSelect"
// ...wrap in context providers

it("has no accessibility violations", async () => {
  const { container } = render(<TravelModeSelect />) // wrapped in providers
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

### Pattern 2: Keyboard Navigation Testing
**What:** Use `@testing-library/user-event` to simulate Tab key navigation and verify focus order and visibility.
**When to use:** Testing A11Y-02 requirements -- all controls navigable via keyboard.
**Example:**
```typescript
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

it("allows keyboard navigation through controls", async () => {
  const user = userEvent.setup()
  render(<Sidebar />) // wrapped in providers

  // Tab through controls and verify focus
  await user.tab()
  expect(screen.getByLabelText("From")).toHaveFocus()

  await user.tab()
  // ... next focusable element
})
```

### Pattern 3: ARIA Label Assertions
**What:** Use `getByRole` with `name` option to verify accessible names are present and correct.
**When to use:** Testing A11Y-03 requirements.
**Example:**
```typescript
it("all interactive elements have accessible names", () => {
  render(<ButtonControls />) // wrapped in providers

  // Buttons are findable by their accessible name
  expect(screen.getByRole("button", { name: /calculate route/i })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument()
})
```

### Pattern 4: Focus Management After Layout Changes
**What:** Verify that focus is not lost when sidebar collapses or bottom sheet changes snap point.
**When to use:** Testing A11Y-04 requirements.
**Example:**
```typescript
it("moves focus to expand button when sidebar collapses", async () => {
  const user = userEvent.setup()
  render(<AdaptiveLayout sidebar={<Sidebar />} map={<div />} />)

  const collapseBtn = screen.getByRole("button", { name: /collapse sidebar/i })
  await user.click(collapseBtn)

  // Focus should move to the expand button (same element, different label)
  expect(screen.getByRole("button", { name: /expand sidebar/i })).toHaveFocus()
})
```

### Anti-Patterns to Avoid
- **Testing color contrast in jsdom:** axe-core's `color-contrast` rule does not work in jsdom because jsdom does not compute styles/layout. Disable it in automated tests; verify contrast manually or with dedicated contrast ratio assertions against the theme constants.
- **Testing `focus-visible` styles in jsdom:** CSS pseudo-class `focus-visible` is not applied in jsdom. Test that focus *moves* correctly and that the theme defines the styles; visual verification of the ring requires a browser.
- **Relying solely on automated tests:** axe-core catches ~30-57% of accessibility issues. Manual keyboard walk-through and screen reader testing are essential complements.
- **Testing implementation details instead of user experience:** Use `getByRole`, `getByLabelText`, not `getByTestId` or DOM structure queries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG rule checking | Custom ARIA validation logic | `vitest-axe` (wraps axe-core) | axe-core has 100+ rules maintained by Deque; hand-rolling misses edge cases |
| Contrast ratio calculation | Manual luminance math | Hardcoded verified ratios from Phase 1 research | Phase 1 already computed all ratios; just assert the known values |
| Accessible autocomplete pattern | Custom ARIA combobox | Existing pattern in Search.tsx (aria-autocomplete, aria-controls, aria-activedescendant) | Already implemented correctly; just verify via tests |
| Screen reader announcements | Custom DOM manipulation | `aria-live="polite"` + `role="status"` (already in ButtonControls) | Standard ARIA pattern; already present |
| Focus trap for modal | Custom focus loop | MUI Modal's built-in focus management | MUI Modal/Dialog automatically traps focus |

**Key insight:** Most WCAG structural requirements are already handled by MUI components (proper ARIA roles, keyboard handlers, focus management in Modal/Drawer). The audit is primarily about verifying those built-in behaviors are not overridden, filling gaps in custom components, and adding explicit labels where MUI cannot infer them.

## Common Pitfalls

### Pitfall 1: axe-core Color Contrast False Positives/Negatives in jsdom
**What goes wrong:** Running axe-core's `color-contrast` rule in jsdom reports false results because jsdom does not perform CSS layout/painting.
**Why it happens:** axe-core needs computed styles from a real rendering engine; jsdom fakes `getComputedStyle`.
**How to avoid:** Disable the `color-contrast` rule in vitest-axe config. Instead, verify contrast by asserting the actual hex values from the theme against known WCAG-compliant ratios.
**Warning signs:** Tests that pass in jsdom but fail when checked visually, or vice versa.

### Pitfall 2: Walk Mode White-on-Orange Contrast Failure
**What goes wrong:** TravelModeSelect uses `color: "#fff !important"` on the selected ToggleButton. When walk mode is selected, this puts white text on `#E65100` (walk orange). The contrast ratio is 3.79:1, which FAILS WCAG AA for normal text (requires 4.5:1) but PASSES for large text (3:1) and graphical elements (3:1).
**Why it happens:** The MUI ToggleButton selected state applies MODE_COLORS as background with forced white foreground.
**How to avoid:** Two options: (a) Use black text on walk-mode orange instead of white (black on #E65100 = 5.53:1, passes AA), or (b) darken the walk orange to #C43E00 or similar (5.56:1 vs white). Option (a) is simplest -- set `contrastText` dynamically per mode.
**Warning signs:** White text on orange buttons that looks washed out.

### Pitfall 3: Missing aria-label on Switch Components
**What goes wrong:** Screen readers announce the Switch as just "switch" without describing what it toggles.
**Why it happens:** MUI Switch does not auto-derive an accessible name from adjacent Typography text. The `<label>` association is implicit (via visual layout) but not programmatic.
**How to avoid:** Add `inputProps={{ 'aria-label': 'Enable traffic routing' }}` to TrafficToggle Switch and `inputProps={{ 'aria-label': 'Avoid ferries' }}` to FerryToggle Switch. Or wrap with `<FormControlLabel>` which auto-associates the label.
**Warning signs:** axe-core `label` rule violation on Switch elements.

### Pitfall 4: Focus Loss on Sidebar Collapse
**What goes wrong:** When the sidebar collapses (width shrinks to 56px with `overflow: hidden`), any focused element inside the sidebar becomes hidden. The browser may move focus to `<body>`, losing the user's position.
**Why it happens:** `overflow: hidden` on the aside element hides content but doesn't programmatically move focus.
**How to avoid:** After collapse transition completes, move focus to the expand button (which remains visible in the collapsed state). After expand, move focus to the first interactive element inside the sidebar.
**Warning signs:** Pressing Tab after collapsing sidebar jumps to an unexpected element.

### Pitfall 5: BottomSheet Drag Handle Not Keyboard Accessible
**What goes wrong:** The bottom sheet drag handle has `role="button"` and `tabIndex={0}` but no `onKeyDown` handler. Keyboard users can focus it but cannot cycle snap points.
**Why it happens:** Drag gestures were implemented for touch only (onTouchStart/onTouchEnd/onMouseDown/onMouseUp).
**How to avoid:** Add `onKeyDown` handler: ArrowUp increases snap point, ArrowDown decreases, Enter/Space toggles between min and max. This is the standard keyboard equivalent for a slider-like control.
**Warning signs:** Keyboard user can tab to the drag handle but nothing happens when pressing keys.

### Pitfall 6: InfoModal Button Missing Accessible Text
**What goes wrong:** The InfoModal open button renders only an `<InfoOutlined />` icon inside a `<Button>` with no text and no `aria-label`.
**Why it happens:** The button has `sx={{ color: "white" }}` but no accessibility attributes.
**How to avoid:** Add `aria-label="About NYC Open Routing"` to the Button in InfoModal.
**Warning signs:** Screen reader announces "button" with no description.

### Pitfall 7: ZoomToRouteButton Fab Missing aria-label
**What goes wrong:** The Fab in ZoomToRouteButton has no `aria-label`. Screen readers see "button" with no description.
**Why it happens:** The Tooltip provides visual text but does not create a programmatic label on the Fab element.
**How to avoid:** Add `aria-label="Zoom to route"` to the Fab.
**Warning signs:** axe-core `button-name` violation.

### Pitfall 8: Swap Button Touch Target Below 44px
**What goes wrong:** The swap addresses IconButton in Sidebar has `minWidth: 32, minHeight: 32`, below the 44px WCAG minimum.
**Why it happens:** The `size="small"` prop and explicit `minWidth/minHeight: 32` override the theme's 44px default.
**How to avoid:** Change to `minWidth: 44, minHeight: 44` or remove the explicit overrides to inherit the theme default.
**Warning signs:** Tap target too small for motor-impaired users on touch devices.

## Code Examples

### vitest-axe Setup File
```typescript
// client/src/__tests__/accessibility/a11y.setup.ts
import "vitest-axe/extend-expect"
import { configureAxe } from "vitest-axe"

// Configure axe for WCAG 2.1 AA
// color-contrast disabled because jsdom does not compute visual styles
export const a11yAxe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  },
})
```

### Fix: Switch ARIA Labels
```typescript
// TrafficToggle.tsx - add inputProps for accessible name
<Switch
  size="small"
  checked={useTraffic}
  onChange={e => setUseTraffic(e.target.checked)}
  color="primary"
  inputProps={{ "aria-label": "Enable traffic routing" }}
/>

// FerryToggle.tsx - add inputProps for accessible name
<Switch
  size="small"
  checked={avoidFerries}
  onChange={e => setAvoidFerries(e.target.checked)}
  color="primary"
  inputProps={{ "aria-label": "Avoid ferries" }}
/>
```

### Fix: Walk Mode Contrast in TravelModeSelect
```typescript
// TravelModeSelect.tsx - use dynamic contrast text
// Option A: black text on walk orange
const getContrastText = (mode: TravelMode): string => {
  return mode === "walk" ? "#000" : "#fff"
}

// In sx:
"& .Mui-selected": {
  bgcolor: MODE_COLORS[mode] + " !important",
  color: getContrastText(mode) + " !important",
}
```

### Fix: Focus Management on Sidebar Collapse
```typescript
// AdaptiveLayout.tsx - manage focus after collapse transition
const expandBtnRef = useRef<HTMLButtonElement>(null)

const handleToggle = () => {
  setIsCollapsed(prev => {
    const willCollapse = !prev
    // After transition completes, move focus
    setTimeout(() => {
      if (willCollapse) {
        expandBtnRef.current?.focus()
      } else {
        // Focus first input in sidebar after expand
        const firstInput = document.querySelector<HTMLInputElement>(
          'aside [id^="auto-suggest-Start-"]'
        )
        firstInput?.focus()
      }
    }, 260) // slightly after 250ms transition
    return willCollapse
  })
}
```

### Fix: BottomSheet Keyboard Support
```typescript
// BottomSheet.tsx - add keyboard handler to drag handle
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      const nextSnap = getNextSnapPoint(snapPoint, "up")
      setSnapPoint(nextSnap)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      const nextSnap = getNextSnapPoint(snapPoint, "down")
      setSnapPoint(nextSnap)
      if (snapPoint === BOTTOM_SHEET_SNAP_POINTS[0] && onClose) {
        onClose()
      }
    }
  },
  [snapPoint, onClose]
)

// On the drag handle Box:
<Box
  onKeyDown={handleKeyDown}
  role="slider"
  aria-label="Resize bottom sheet"
  aria-valuemin={BOTTOM_SHEET_SNAP_POINTS[0] * 100}
  aria-valuemax={BOTTOM_SHEET_SNAP_POINTS[BOTTOM_SHEET_SNAP_POINTS.length - 1] * 100}
  aria-valuenow={Math.round(snapPoint * 100)}
  aria-valuetext={`${Math.round(snapPoint * 100)} percent`}
  tabIndex={0}
>
```

### Fix: InfoModal Button Accessible Name
```typescript
// InfoModal.tsx
<Button
  onClick={handleOpen}
  aria-label="About NYC Open Routing"
  sx={{ color: "white" }}
>
  <InfoOutlined sx={{ mr: 1 }} />
</Button>
```

### Fix: ZoomToRouteButton aria-label
```typescript
// ZoomToRouteButton.tsx
<Fab
  color="primary"
  size="small"
  onClick={handleZoomToRoute}
  aria-label="Zoom to route"
  sx={{ ... }}
>
```

### Fix: Swap Button Touch Target
```typescript
// Sidebar.tsx - increase swap button to 44px minimum
<IconButton
  onClick={swapAddresses}
  disabled={!canSwap}
  size="small"
  aria-label="Swap start and end addresses"
  sx={{
    transform: "rotate(90deg)",
    bgcolor: "action.hover",
    transition: "all 0.2s ease-in-out",
    minWidth: 44,  // was 32
    minHeight: 44,  // was 32
    // ... rest unchanged
  }}
>
```

## Identified Issues Inventory

### A11Y-01: Color Contrast Issues
| Component | Issue | Current Ratio | Required | Fix |
|-----------|-------|--------------|----------|-----|
| TravelModeSelect (walk selected) | White (#fff) on walk orange (#E65100) | 3.79:1 | 4.5:1 (normal text) | Use black text for walk mode or darken orange |
| RouteSummaryCard Traffic chip | `borderColor: MODE_COLORS[mode]` on white bg with thin border | Varies by mode | 3:1 (graphical) | Walk orange border at 3.79:1 passes 3:1; OK |
| Map start/end markers | Green #22c55e / Red #ef4444 with white text overlays | ~3.2:1 / ~4.0:1 | 3:1 (graphical) | Both pass graphical 3:1; acceptable |

### A11Y-02: Keyboard Navigation Gaps
| Component | Issue | Fix |
|-----------|-------|-----|
| BottomSheet drag handle | Has tabIndex=0 but no onKeyDown handler | Add ArrowUp/ArrowDown keyboard support |
| Sidebar collapse/expand | No focus management after transition | Move focus programmatically after collapse/expand |

### A11Y-03: Missing ARIA Labels
| Component | Element | Issue | Fix |
|-----------|---------|-------|-----|
| TrafficToggle | Switch | No aria-label or label association | Add `inputProps={{ "aria-label": "Enable traffic routing" }}` |
| FerryToggle | Switch | No aria-label or label association | Add `inputProps={{ "aria-label": "Avoid ferries" }}` |
| InfoModal | Open button | Icon-only button with no accessible name | Add `aria-label="About NYC Open Routing"` |
| ZoomToRouteButton | Fab | No aria-label | Add `aria-label="Zoom to route"` |
| RouteList items | ListItemButton | No aria-label describing the turn instruction | Add `aria-label` with turn instruction text |
| TimeSelector Slider | Slider | No aria-label | Add `aria-label="Hour of day"` |

### A11Y-04: Focus Management Gaps
| Scenario | Issue | Fix |
|----------|-------|-----|
| Sidebar collapse | Focus lost when content becomes hidden via overflow:hidden | Move focus to expand button after transition |
| Sidebar expand | No focus movement after expand | Move focus to first input (start address) after transition |
| BottomSheet snap change | No announcement of new state | Add aria-live region or use aria-valuenow on slider role |

## Existing Accessibility Strengths

The codebase has strong accessibility foundations that do NOT need changes:

| Feature | Where | Status |
|---------|-------|--------|
| Skip link | SkipLink.tsx | Present, targets #main-content |
| Semantic landmarks | AdaptiveLayout: `<nav>`, `<main>`, `<aside>` with aria-labels | Correct |
| 44px touch targets | Theme overrides: MuiButton, MuiIconButton, MuiListItemButton, MuiToggleButton | Correct (except swap button) |
| Focus-visible outlines | Theme: 3px solid MTA Blue, 2px offset on Button, IconButton, ToggleButton, ListItemButton | Correct |
| Autocomplete ARIA | Search.tsx: aria-autocomplete, aria-controls, aria-activedescendant, aria-expanded | Correct pattern |
| Listbox ARIA | SuggestionDropdown: role=listbox, role=option, aria-selected | Correct pattern |
| Live region | ButtonControls: role=status, aria-live=polite for "Calculating route..." | Correct |
| Focus return after clear | ButtonControls: setTimeout focus to start input after clear | Correct |
| Modal ARIA | InfoModal: aria-labelledby, aria-describedby on Modal | Correct |
| Error boundary | ErrorFallback: role=alert | Correct |
| Loading states | LoadingSpinner: role=status, aria-live=polite, aria-label | Correct |
| HTML lang attribute | index.html: `<html lang="en">` | Correct |
| Form labels | Search: TextField with label prop ("From" / "To") | Correct |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `jest-axe` for accessibility testing | `vitest-axe` for Vitest projects | 2023 | Direct fork with Vitest type compatibility |
| Manual ARIA auditing only | Automated axe-core + manual audit | Ongoing | Catches ~30-57% of issues automatically; manual still needed |
| `aria-role` + custom keyboard handlers | MUI components with built-in a11y | MUI v5+ | MUI handles most ARIA roles and keyboard patterns natively |
| `tabIndex` everywhere | `:focus-visible` CSS pseudo-class | Browser support 2022+ | Browsers now distinguish keyboard vs mouse focus natively |
| WCAG 2.0 AA | WCAG 2.1 AA | 2018 | Added mobile-focused criteria: reflow (1.3.4), text spacing (1.4.12), pointer gestures (2.5.1), target size (2.5.5) |

**Important clarification on focus indicator contrast:** The phase description specifies "3px outline, 3:1 contrast" for focus indicators. WCAG 2.1 AA (SC 2.4.7 Focus Visible) requires only that focus is *visible* -- no specific contrast ratio. The 3:1 contrast requirement for focus indicators comes from WCAG 2.2 SC 2.4.13 (Focus Appearance, Level AAA). The current implementation (3px solid MTA Blue #0039A6 at 9.83:1 vs white) far exceeds any contrast requirement and is excellent. The 3:1 against adjacent colors is met.

## Open Questions

1. **Walk mode contrast fix approach**
   - What we know: White text on #E65100 fails AA normal text (3.79:1). Black text on #E65100 passes (5.53:1). Darkening to #C43E00 gives white text 5.56:1 (passes).
   - What's unclear: Whether changing walk-mode selected button text to black (different from drive/bike which use white) is acceptable from a design consistency standpoint.
   - Recommendation: Use black text for walk mode. MUI's `contrastText` system already handles this for palette colors. The visual inconsistency is minimal and the accessibility gain is clear.

2. **ListItemButton turn-by-turn instructions**
   - What we know: Each ListItemButton in RouteList shows a turn instruction text via ListItemText. Screen readers can read the text content.
   - What's unclear: Whether the implicit accessible name from ListItemText is sufficient or if explicit aria-label is needed.
   - Recommendation: ListItemText already provides accessible text content. No additional aria-label needed unless the text is visually truncated (it uses `noWrap` which does truncate). Consider adding `aria-label` with the full untruncated text for screen readers.

3. **MapLibre GL map canvas accessibility**
   - What we know: The map canvas (`<canvas>`) is inherently not accessible to screen readers. MapControls (zoom buttons) provide keyboard-accessible map interaction. The map div has no ARIA labeling itself.
   - What's unclear: Whether additional ARIA description on the map container would be beneficial.
   - Recommendation: The `<main>` landmark with `aria-label="Interactive map"` is sufficient. The canvas element itself cannot be made accessible. The zoom buttons and route information in the sidebar provide equivalent access to the routing information.

## Sources

### Primary (HIGH confidence)
- `/dequelabs/axe-core` (Context7) - axe-core API, WCAG tag configuration, jsdom limitations (color-contrast disabled)
- `/websites/testing-library` (Context7) - getByRole priority, getByLabelText for forms, accessible query best practices
- [W3C WCAG 2.1 Specification](https://www.w3.org/TR/WCAG21/) - SC 1.4.3 (contrast minimum), SC 1.4.11 (non-text contrast), SC 2.4.7 (focus visible), SC 4.1.2 (name/role/value)
- [WebAIM Contrast and Color Accessibility](https://webaim.org/articles/contrast/) - Contrast ratio requirements explanation
- [vitest-axe GitHub](https://github.com/chaance/vitest-axe) - Setup, API, jsdom requirement (not happy-dom), `toHaveNoViolations` matcher
- Codebase audit (direct file inspection) - All component files in `client/src/components/`, theme.ts, constants.ts, existing tests

### Secondary (MEDIUM confidence)
- [W3C Understanding SC 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html) - Focus visible has no specific contrast requirement in WCAG 2.1 (3:1 is WCAG 2.2 AAA)
- [W3C Understanding SC 2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) - The 3:1 focus indicator contrast is WCAG 2.2 Level AAA, not WCAG 2.1 AA
- [MUI ToggleButton Accessibility Issue #17203](https://github.com/mui/material-ui/issues/17203) - MUI ToggleButtonGroup accessibility patterns
- Phase 1 Research (`.planning/phases/01-design-system-foundation/01-RESEARCH.md`) - Verified contrast ratios for MTA colors

### Tertiary (LOW confidence)
- None. All findings verified against source code and official specifications.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - vitest-axe is the standard axe-core integration for Vitest; verified via npm and GitHub
- Architecture: HIGH - Test patterns from Testing Library and axe-core official docs; verified via Context7
- Pitfalls: HIGH - All issues identified by direct inspection of source files; contrast ratios from Phase 1 research
- Code examples: HIGH - All fixes are minimal, targeted changes verified against MUI and ARIA specifications

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable -- WCAG spec and axe-core change slowly)
