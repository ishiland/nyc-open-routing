# Phase 2: Responsive Layout System - Research

**Researched:** 2026-02-12
**Domain:** Responsive web layout, mobile bottom sheet, gesture handling, CSS transitions
**Confidence:** HIGH

## Summary

Phase 2 transforms the existing AdaptiveLayout/BottomSheet/Sidebar components into a polished responsive system. The codebase already has substantial scaffolding: `AdaptiveLayout.tsx` switches between mobile bottom sheet and desktop sidebar, `BottomSheet.tsx` uses MUI's `SwipeableDrawer` with custom snap point logic, and `useResponsive.ts` provides breakpoint detection. The primary work is fixing width inconsistencies, adding desktop sidebar collapse/expand, hardening the bottom sheet gesture handling so it doesn't conflict with the map, and ensuring map attribution/controls don't clash with the sidebar or bottom sheet.

No new libraries are needed. The existing stack (MUI v7 SwipeableDrawer, Emotion CSS, MUI useMediaQuery, CSS transitions) covers all requirements. The constraint "no new animation libraries -- Emotion keyframes + CSS transitions only" means all animations use CSS `transition` properties on width/height/transform. The project already has constants for breakpoints, snap points, z-index values, and touch targets -- these just need consolidation and consistent use.

**Primary recommendation:** Fix the hardcoded width inconsistency (400px in Sidebar/ControlsContainer vs 340px/330px/280px elsewhere), add a collapsible sidebar mechanism for desktop, harden BottomSheet gesture isolation from the map, and adjust map control/attribution positioning to avoid clashes.

## Standard Stack

### Core (already installed -- no additions needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mui/material | ^7.0.1 | SwipeableDrawer, useMediaQuery, transitions | Already in use; provides SwipeableDrawer with bottom anchor, `disableDiscovery`, `hideBackdrop` |
| @emotion/react | ^11.14.0 | CSS-in-JS, keyframes | Already in use; `keyframes` from Emotion for any needed animation |
| maplibre-gl | ^5.3.0 | Map with attribution/navigation controls | Already in use; `addControl()` with position param to reposition controls |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mui/icons-material | ^7.0.1 | Icons for collapse/expand toggle | ChevronLeft, ChevronRight, Menu icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom snap-point logic | react-spring bottom-sheet libraries | Adds dependency; current custom logic in `responsive.ts` is simple and works |
| CSS transitions | framer-motion | Explicitly excluded by prior decision ("no new animation libraries") |
| Custom gesture handling | @use-gesture/react | Adds dependency; MUI SwipeableDrawer + `touch-action` CSS handles the use case |

**Installation:** None required. All libraries already present.

## Architecture Patterns

### Current File Structure (relevant files)
```
client/src/
  components/
    layouts/
      AdaptiveLayout.tsx    # Switches mobile/tablet/desktop layouts
    mobile/
      BottomSheet.tsx        # SwipeableDrawer-based bottom sheet
    Sidebar.tsx              # Desktop sidebar content wrapper
    ControlsContainer.tsx    # Paper wrapper with title/tabs/toggles
    MapLibreGLMap.tsx         # Map component with controls
    controls/
      MapControls.tsx        # Zoom FABs (top-right, z-index:1000)
      ZoomToRouteButton.tsx  # Route FAB (bottom-right, z-index:1000)
  hooks/
    useResponsive.ts         # Breakpoint detection hook
  utils/
    constants.ts             # SIDEBAR_WIDTH_PX, BOTTOM_SHEET_*, BREAKPOINTS
    responsive.ts            # Bottom sheet height/snap calculations
    theme.ts                 # MUI theme with breakpoints
```

### Pattern 1: Centralized Width Constants (Fix Inconsistency)
**What:** Sidebar width is hardcoded in 4 places with 3 different values (330px in constants, 340px in AdaptiveLayout, 400px in Sidebar + ControlsContainer). Consolidate to constants and consume everywhere.
**When to use:** Any component that references sidebar width.
**Current state of inconsistency:**
```
constants.ts:        SIDEBAR_WIDTH_PX = 330, SIDEBAR_WIDTH_TABLET_PX = 280
AdaptiveLayout.tsx:  isTabletOrBelow ? "340px" : "400px"
ControlsContainer.tsx: width: 400
Sidebar.tsx:         width: "400px"
```
**Fix:** Update constants to match actual desired widths, import everywhere.

### Pattern 2: CSS Transition for Sidebar Collapse (SB-05, SB-06)
**What:** Desktop sidebar collapse/expand using CSS `transition` on width, with a toggle button.
**When to use:** Desktop breakpoint (md+).
**Example:**
```typescript
// Sidebar container with CSS transition
<aside
  style={{
    width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH_PX : SIDEBAR_WIDTH_PX,
    transition: 'width 250ms ease-in-out',
    overflow: 'hidden',
    flexShrink: 0,
  }}
>
```
Key considerations:
- Map must call `map.resize()` after transition ends (use `transitionend` event or setTimeout matching duration)
- Collapsed state shows only a narrow strip with expand button
- `SIDEBAR_COLLAPSED_WIDTH_PX` should be ~56px (enough for a 44px touch target + padding)

### Pattern 3: SwipeableDrawer Bottom Sheet with Map Isolation (RS-02, RS-04, RS-05)
**What:** Bottom sheet that supports swipe gestures without interfering with map pan/zoom.
**When to use:** Mobile breakpoint (below sm/600px).
**Key props for MUI SwipeableDrawer:**
```typescript
<SwipeableDrawer
  anchor="bottom"
  open={open}
  onClose={handleClose}
  onOpen={handleOpen}
  disableDiscovery       // Prevents edge-swipe conflict (esp. iOS back gesture)
  disableSwipeToOpen     // Don't auto-open from edge; we handle it
  hideBackdrop           // No backdrop overlay -- map stays interactive
  ModalProps={{
    keepMounted: true,     // Better perf on mobile
    BackdropProps: { invisible: true },
  }}
  sx={{
    '& .MuiDrawer-paper': {
      height: `${snapPoint * 100}%`,
      pointerEvents: 'auto',  // Sheet captures events
    },
  }}
/>
```

**Gesture isolation strategy:**
1. `touch-action: pan-y` on drag handle only -- vertical swipe captured
2. `touch-action: none` on drag handle to prevent browser scroll
3. Map area keeps default touch-action (pan/pinch-zoom)
4. `hideBackdrop` or invisible backdrop so map receives touch events around the sheet
5. `disableDiscovery` to prevent iOS swipe-back conflict

### Pattern 4: Dynamic Viewport Units for Mobile (dvh)
**What:** Use `100dvh` instead of `100vh` for mobile layouts to handle browser chrome (address bar).
**When to use:** Any full-height mobile layout.
**Browser support:** All modern browsers (Chrome 94+, Firefox 101+, Safari 15.4+).
**Example:**
```typescript
style={{ height: '100dvh' }}  // or as fallback:
style={{ height: '100dvh', minHeight: '-webkit-fill-available' }}
```
**Note:** The current codebase uses `100vh` everywhere. This causes the bottom sheet and map to extend behind the mobile browser address bar on first load. Switch to `100dvh` with `100vh` fallback.

### Pattern 5: Map Control Repositioning (MC-03)
**What:** Reposition MapLibre attribution and custom controls to avoid clashing with sidebar/bottom sheet.
**When to use:** Always -- controls must not be hidden behind UI panels.
**Strategy:**
- MapLibre default attribution is bottom-left (may clash with sidebar on desktop)
- Custom zoom controls are top-right absolute-positioned (z-index:1000)
- ZoomToRouteButton is bottom-right absolute-positioned
- On mobile, bottom-right controls must account for bottom sheet height at collapsed snap point (40% of viewport)
- Use responsive padding/margin adjustments rather than repositioning controls
- MapLibre `addControl(control, 'top-right')` positions controls within the map container, so sidebar push doesn't overlap them

### Anti-Patterns to Avoid
- **Hardcoded widths scattered across files:** Use constants from a single source of truth
- **Using `display: none` for collapsed sidebar:** Causes layout jump; use `width: 0` or a narrow collapsed width with `overflow: hidden` and CSS transition
- **Calling `map.resize()` during transition:** Causes janky rendering; call it once after transition completes
- **Using `position: fixed` for bottom sheet on mobile:** MUI SwipeableDrawer handles positioning; don't fight it
- **Nesting scrollable containers:** Bottom sheet content scroll + page scroll = janky; ensure only one scroll context is active (the sheet content)
- **Using `stopPropagation()` on touch events:** Can break gesture chains; prefer `touch-action` CSS and `preventDefault()` selectively

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom sheet drawer | Custom div with transforms | MUI SwipeableDrawer (already used) | Handles ARIA, keyboard, swipe detection, backdrop, portal |
| Breakpoint detection | `window.matchMedia` listeners | MUI `useMediaQuery` + `useResponsive` hook (already exists) | SSR-safe, theme-integrated, auto-cleanup |
| Smooth transitions | requestAnimationFrame loops | CSS `transition` property | GPU-accelerated, declarative, no JS overhead |
| Touch gesture detection | Custom touchstart/touchmove/touchend | MUI SwipeableDrawer gestures + `touch-action` CSS | Handles velocity, direction, thresholds natively |
| Viewport height on mobile | JavaScript innerHeight polling | CSS `dvh` units | No JS, no layout thrashing, handles browser chrome |

**Key insight:** The existing codebase already has BottomSheet with snap points, AdaptiveLayout with breakpoint branching, and useResponsive for detection. The work is consolidation and hardening, not building from scratch.

## Common Pitfalls

### Pitfall 1: Map Doesn't Resize When Sidebar Width Changes
**What goes wrong:** After sidebar collapse/expand animation, map has wrong dimensions -- tiles don't fill the container, click coordinates are offset.
**Why it happens:** MapLibre GL caches container dimensions. When the flex container changes, the canvas doesn't automatically resize.
**How to avoid:** Call `map.resize()` AFTER the CSS transition completes. Listen for `transitionend` event on the sidebar element, or use `setTimeout` matching the transition duration (e.g., 250ms).
**Warning signs:** White gap between map and sidebar edge, or map extends behind sidebar.

### Pitfall 2: Bottom Sheet Swipe Triggers Map Pan
**What goes wrong:** User tries to drag the bottom sheet up/down, but the map underneath also pans.
**Why it happens:** Touch events propagate from the bottom sheet drag handle to the map canvas below.
**How to avoid:**
1. Set `touch-action: none` on the drag handle element
2. Use `hideBackdrop` on SwipeableDrawer so map gets events AROUND the sheet, but not THROUGH it
3. The `MuiDrawer-paper` element inherently captures events within its bounds
4. `disableDiscovery` prevents edge-swipe conflicts
**Warning signs:** Map moves when trying to expand the bottom sheet.

### Pitfall 3: 100vh on Mobile Extends Behind Browser Chrome
**What goes wrong:** Bottom of the page is hidden behind the mobile browser's address bar / navigation bar.
**Why it happens:** `100vh` on mobile browsers equals the maximum viewport height (when browser chrome is hidden), not the visible viewport.
**How to avoid:** Use `100dvh` with `100vh` as fallback. The current codebase uses `100vh` in AdaptiveLayout, Sidebar, ControlsContainer, and MapLibreGLMap.
**Warning signs:** Bottom sheet or map controls cut off at the bottom on mobile Safari or Chrome.

### Pitfall 4: Width Transition Causes Content Reflow
**What goes wrong:** During sidebar collapse animation, text wraps/unwraps creating a janky effect.
**Why it happens:** Text reflows at intermediate widths during the CSS transition.
**How to avoid:** Use `overflow: hidden` on the sidebar during transition. Content should not reflow -- it clips. Optionally use `white-space: nowrap` on key elements during transition.
**Warning signs:** Text jumping around during sidebar collapse/expand.

### Pitfall 5: Z-Index Wars Between Bottom Sheet, Dropdown, and Map Controls
**What goes wrong:** Suggestion dropdown appears behind the bottom sheet, or map controls appear above everything.
**Why it happens:** Multiple z-index values scattered across components without a clear hierarchy.
**Current z-index values in codebase:**
- Suggestion dropdown: 101 (`DROPDOWN_Z_INDEX`)
- Overlay: 999 (`OVERLAY_Z_INDEX`)
- Map controls (zoom, route): 1000 (hardcoded in components)
- Bottom sheet: 1200 (`BOTTOM_SHEET_Z_INDEX`)
- Dismissible banner: 1200 (hardcoded)
- Skip link: 9999 (hardcoded)
- MUI default modal: 1300, drawer: 1200, appbar: 1100
**How to avoid:** Centralize z-index values in constants. Establish a clear stacking order: map controls < sidebar < bottom sheet < dropdowns-within-sheet < modals.
**Warning signs:** Elements appearing behind or in front of wrong layers.

### Pitfall 6: iOS Safari Bounce Scroll in Bottom Sheet
**What goes wrong:** Overscrolling the bottom sheet content causes the entire page to bounce (elastic scroll).
**Why it happens:** iOS Safari's rubber-band scrolling propagates beyond the scrollable container.
**How to avoid:** Set `overscroll-behavior: contain` on the bottom sheet content container. This is CSS-only and well-supported.
**Warning signs:** Whole page moves when scrolling past the end of route directions in the bottom sheet.

## Code Examples

### Collapsible Sidebar with CSS Transition
```typescript
// Source: Pattern derived from MUI Drawer docs + codebase analysis
// In AdaptiveLayout.tsx or a new DesktopSidebar wrapper

const SIDEBAR_COLLAPSED_PX = 56 // Enough for 44px button + 6px padding each side

const [isCollapsed, setIsCollapsed] = useState(false)
const { map } = useContext(MapInstanceContext)

const handleTransitionEnd = useCallback(() => {
  // Resize map after sidebar transition completes
  map?.resize()
}, [map])

return (
  <aside
    onTransitionEnd={handleTransitionEnd}
    style={{
      width: isCollapsed ? SIDEBAR_COLLAPSED_PX : SIDEBAR_WIDTH_PX,
      transition: 'width 250ms ease-in-out',
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
    }}
  >
    {/* Toggle button - always visible */}
    <IconButton
      onClick={() => setIsCollapsed(prev => !prev)}
      aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
    >
      {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
    </IconButton>

    {/* Content - clips during transition */}
    <div style={{ width: SIDEBAR_WIDTH_PX, minWidth: SIDEBAR_WIDTH_PX }}>
      {sidebar}
    </div>
  </aside>
)
```

### Bottom Sheet with Proper Gesture Isolation
```typescript
// Source: Derived from current BottomSheet.tsx + MUI SwipeableDrawer docs
<SwipeableDrawer
  anchor="bottom"
  open={open}
  onClose={onClose}
  onOpen={onOpen}
  disableDiscovery
  disableSwipeToOpen={false}
  hideBackdrop  // Map stays interactive
  ModalProps={{
    keepMounted: true,
    // Prevent backdrop from blocking map interaction
    slotProps: {
      backdrop: { invisible: true },
    },
  }}
  sx={{
    // Let pointer events pass through to map
    pointerEvents: 'none',
    '& .MuiDrawer-paper': {
      pointerEvents: 'auto',  // Re-enable on the actual sheet
      height: `${snapPoint * 100}%`,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overscrollBehavior: 'contain',  // Prevent iOS bounce
    },
  }}
>
  {/* Drag handle with isolated touch */}
  <Box
    sx={{
      touchAction: 'none',  // Prevent browser handling
      cursor: 'grab',
    }}
    onTouchStart={handleDragStart}
    onTouchEnd={handleDragEnd}
  >
    {/* drag indicator bar */}
  </Box>
  <Box sx={{ overflow: 'auto', overscrollBehavior: 'contain' }}>
    {children}
  </Box>
</SwipeableDrawer>
```

### Responsive Map Control Positioning
```typescript
// Source: MapLibre GL JS docs for addControl positioning
// In MapControls.tsx - adjust position based on layout

const { isMobile } = useResponsive()

// Adjust bottom padding to account for bottom sheet collapsed height
const bottomOffset = isMobile ? `calc(40vh + 16px)` : 24

return (
  <>
    {/* Zoom controls - top right, safe from sidebar */}
    <Box sx={{
      position: 'absolute',
      top: 24,
      right: 24,
      zIndex: theme.zIndex?.fab || 1050,
    }}>
      {/* zoom buttons */}
    </Box>

    {/* Route button - bottom right, above bottom sheet on mobile */}
    <Box sx={{
      position: 'absolute',
      bottom: bottomOffset,
      right: 24,
      zIndex: theme.zIndex?.fab || 1050,
      transition: 'bottom 250ms ease-in-out',
    }}>
      {/* zoom to route FAB */}
    </Box>
  </>
)
```

### Viewport Height Fix
```typescript
// Source: web.dev viewport units article
// Replace 100vh with 100dvh throughout

// Before (current):
style={{ height: '100vh' }}

// After:
style={{ height: '100dvh' }}
// CSS fallback for older browsers not needed -- dvh supported in all
// browsers the project targets (maplibre-gl v5 requires modern browsers)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `100vh` for full-height mobile | `100dvh` (dynamic viewport) | 2022 (Safari 15.4, Chrome 108) | Fixes mobile browser chrome overlap |
| JS-based resize listeners | CSS Container Queries | 2023+ | Not needed here -- MUI useMediaQuery is sufficient for viewport-based layout |
| MUI v4 `BackdropProps` | MUI v7 `slotProps.backdrop` | MUI v6 (2024) | Deprecated prop migration |
| MUI v4 `SlideProps` | MUI v7 `slotProps.transition` | MUI v6 (2024) | Deprecated prop migration |
| `overscroll-behavior` polyfills | Native CSS `overscroll-behavior` | 2019+ (all modern browsers) | No polyfill needed |

**Deprecated/outdated in codebase:**
- `ModalProps.BackdropProps` usage in BottomSheet.tsx should use `ModalProps.slotProps.backdrop` instead (MUI v7 migration)

## Open Questions

1. **Collapsed sidebar content**
   - What we know: Sidebar collapses to a narrow strip. Toggle button is needed.
   - What's unclear: Should collapsed state show icons for key actions (search, mode select) or just the expand button?
   - Recommendation: Start with expand button only. Adding icons to collapsed state is scope creep for Phase 2 -- can be added later.

2. **Bottom sheet initial snap point**
   - What we know: Current snap points are [0.4, 0.6, 0.9]. The initial snap is 0.4 (40%).
   - What's unclear: Should there be a fully-collapsed state (just the drag handle visible, ~5-10% height) as a fourth snap point?
   - Recommendation: The requirements say "collapsed/half/full" which maps to 3 snap points. Current [0.4, 0.6, 0.9] is reasonable. A minimal collapsed state (~0.15) could be added as the "collapsed" point if the 40% feels too large. Decide during implementation.

3. **Tablet layout: narrow sidebar vs overlay panel**
   - What we know: RS-01 says "narrower sidebar or overlay panel."
   - What's unclear: The current implementation uses a narrower sidebar (340px on tablet). Should this become an overlay that floats over the map?
   - Recommendation: Keep the narrower sidebar approach (simpler, already partially implemented). An overlay adds complexity (backdrop, dismiss-on-click-outside, z-index management) with minimal UX benefit at tablet widths (600-904px).

4. **Map attribution on mobile**
   - What we know: MapLibre default attribution is bottom-left. On mobile, the bottom sheet covers the bottom of the screen.
   - What's unclear: Whether the current NYC tile style includes custom attribution requirements.
   - Recommendation: Reposition attribution to top-left on mobile using MapLibre's control positioning API, or add a small padding to keep it visible above the collapsed bottom sheet.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 15+ files read directly from `/Users/ishiland/Code/nyc-open-routing/client/src/`
- MUI v7 docs via Context7 (`/mui/material-ui/v7.2.0`) - SwipeableDrawer props, useMediaQuery, breakpoints, Drawer backdrop migration
- MapLibre GL JS docs via Context7 (`/maplibre/maplibre-gl-js`) - addControl positioning, NavigationControl

### Secondary (MEDIUM confidence)
- [MDN touch-action docs](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) - pan-y, none values for gesture isolation
- [web.dev viewport units](https://web.dev/blog/viewport-units) - dvh/svh/lvh specification and browser support
- [MUI GitHub Issue #24097](https://github.com/mui/material-ui/issues/24097) - SwipeableDrawer snap points (confirmed: not built-in, custom logic needed)
- [MUI GitHub Issue #10051](https://github.com/mui/material-ui/issues/10051) - Collapse horizontal orientation for width transitions
- [MapLibre Attribution Issue #1255](https://github.com/maplibre/maplibre-gl-js/issues/1255) - Repositioning attribution to avoid UI overlap

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; all capabilities confirmed in existing deps via Context7
- Architecture: HIGH - Patterns derived from direct codebase analysis of 15+ files plus official docs
- Pitfalls: HIGH - Each pitfall verified against known MUI/MapLibre behavior and current codebase state

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (stable domain, no fast-moving dependencies)
