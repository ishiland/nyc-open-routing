# Pitfalls Research

**Domain:** Mapping/Routing App UI Redesign (React + MUI + MapLibre GL)
**Researched:** 2026-02-12
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: MUI Theme Override Specificity Conflicts

**What goes wrong:**
Redesigned styles fail to apply because MUI's component state selectors (`.Mui-focused`, `.Mui-disabled`, `.Mui-selected`) have higher CSS specificity than custom theme overrides. Styles appear in rendered CSS but produce no visible change.

**Why it happens:**
MUI applies state styles (hover, focus, disabled) with elevated specificity by design. When customizing themes, developers target base component slots without matching the specificity level of state selectors, causing overrides to be ignored by the cascade.

**How to avoid:**
- **Phase 1 (Design System)**: Investigate default slot structure BEFORE writing overrides
- Use browser DevTools to identify where styles are initially applied
- Match specificity when targeting state selectors (e.g., use nested selectors: `& .Mui-focused`)
- Enable `modularCssLayers` in theme config for cascade layer control (MUI v6+)
- Document specificity requirements in design system

**Warning signs:**
- Styles visible in DevTools but not affecting appearance
- Inconsistent styling between default and hover/focus states
- Theme overrides work on some components but not others

**Phase to address:**
Phase 1: Design System Foundation

**Source confidence:** HIGH
- [3 Common Pitfalls of Theme Customization with Material UI](https://www.dmcinfo.com/blog/17372/3-common-pitfalls-of-theme-customization-with-material-ui/)
- [CSS Layers - Material UI](https://mui.com/material-ui/customization/css-layers/)
- [Themed components - Material UI](https://mui.com/material-ui/customization/theme-components/)

---

### Pitfall 2: MapLibre GL z-index Conflicts with React UI Overlays

**What goes wrong:**
Custom React UI elements (sidebars, bottom sheets, modals, tooltips) render behind the MapLibre GL canvas or get clipped by map container overflow. Map interactions interfere with UI gestures (swipe-to-close vs. pan-map).

**Why it happens:**
MapLibre GL creates a WebGL canvas with specific stacking context. React portals, MUI modals, and bottom sheets may render in different stacking contexts. Map event listeners can capture touch/mouse events before React components receive them, causing gesture conflicts.

**How to avoid:**
- **Phase 2 (Responsive Layout)**: Establish z-index scale in CSS custom properties
- Reserve z-index ranges: Map (0), UI overlays (100-199), Modals (1300+ per MUI defaults)
- Use MUI's Portal component for overlays to escape map's stacking context
- Implement "gutter space" pattern: leave map-free zones at screen edges for scroll gestures
- Set `maplibregl.Map` options: `touchPitch: false`, `touchZoomRotate: 'center'`
- For bottom sheets: use `disableDiscovery` prop to prevent map gesture interference
- Verify map markers/popups have z-index ≥ 2 when using overlay libraries (deck.gl, custom)

**Warning signs:**
- Sidebar visible in DOM inspector but not on screen
- Bottom sheet swipe gestures trigger map panning
- Modal backdrop obscures content but modal itself is behind map
- Map controls render behind custom UI elements

**Phase to address:**
Phase 2: Responsive Layout System

**Source confidence:** HIGH
- [Maplibre popup rendering below the map - deck.gl Discussion](https://github.com/visgl/deck.gl/discussions/9132)
- [6 Mistakes to Avoid When Designing Maps for Apps](https://www.iotforall.com/designing-maps-interface-for-apps)
- MUI Portal documentation (via Context7)

---

### Pitfall 3: React Context Performance Collapse in Map Apps

**What goes wrong:**
Smooth 60fps map interactions degrade to 20-30fps. Every map pan/zoom triggers re-renders in unrelated UI components (search autocomplete, route list, travel mode selector). Performance degrades linearly with component count.

**Why it happens:**
Context API updates trigger re-renders in ALL consuming components, regardless of which value changed. Map state (viewport, zoom, features) updates 60+ times/second during user interaction. Putting map instance, route data, and UI state in a single context causes cascade re-renders.

**How to avoid:**
- **Phase 1 (Design System)**: Split contexts by update frequency
  - **Low-frequency**: Theme, authentication, preferences (rarely change)
  - **Medium-frequency**: Route data, search results, travel mode (user actions)
  - **High-frequency**: Map instance only (never mutate, use ref pattern)
- Use `React.memo` + `useMemo`/`useCallback` for child components consuming context
- For MapLibre instance: Store in context as ref, not state (avoids re-renders)
- Implement selector pattern for granular subscriptions (or use Zustand for complex state)
- Avoid creating components inside render functions (remount penalty)
- Profile with React DevTools Profiler to identify cascade re-render trees

**Warning signs:**
- Frame drops during map panning (check Performance tab: scripting time > 16ms)
- Unrelated UI components re-rendering when map moves (React DevTools Profiler)
- useEffect dependency arrays include entire context objects
- 30-60% increase in scripting time vs. baseline performance

**Phase to address:**
Phase 1: Design System Foundation + Phase 3: State Optimization

**Source confidence:** HIGH
- [How to Handle React Context Performance Issues](https://oneuptime.com/blog/post/2026-01-24-react-context-performance-issues/view)
- [Optimizing React Context for Performance](https://www.tenxdeveloper.com/blog/optimizing-react-context-performance)
- [Pitfalls of overusing React Context](https://blog.logrocket.com/pitfalls-of-overusing-react-context/)

---

### Pitfall 4: CSS Variables Theme Migration Breaking Existing Styles

**What goes wrong:**
Enabling `cssVariables: true` in MUI theme causes existing custom styles to break. Colors render incorrectly, component spacing changes, breakpoints behave differently. Type errors proliferate in TypeScript files using custom theme properties.

**Why it happens:**
CSS variables mode fundamentally changes theme structure from nested objects to flattened CSS custom properties. Migration requires replacing `palette.mode` conditionals with new `colorSchemes` API. Module augmentation for custom theme properties must update both `Theme` and `ThemeOptions` interfaces. Specificity rules change when `modularCssLayers` is enabled.

**How to avoid:**
- **Phase 1 (Design System)**: Migrate incrementally, not all-at-once
- Create parallel theme file with CSS variables, test in isolation
- Update custom property type declarations: extend both `Theme` AND `ThemeOptions` interfaces
- Replace `theme.palette.mode` checks with `theme.applyStyles()` utility
- Run official codemods: `npx @mui/codemod@latest v6.0.0/theme-v6 <path>`
- Test theme in Storybook/isolated environment before app-wide rollout
- Document breaking changes in design system README
- Enable `cssVariables: true` AFTER verifying existing custom styles work

**Warning signs:**
- TypeScript errors: "Property 'map' does not exist on type 'Theme'"
- Colors render as `undefined` in styled components
- Dark mode toggle stops working after CSS variables enabled
- Custom theme properties accessible in `createTheme()` but not in components

**Phase to address:**
Phase 1: Design System Foundation

**Source confidence:** HIGH
- [Migrating to CSS theme variables - Material UI](https://mui.com/material-ui/experimental-api/css-theme-variables/migration/)
- [Breaking changes in v5 - Material UI](https://mui.com/material-ui/migration/v5-style-changes/)
- [Extending the theme in Material UI with TypeScript](https://www.bergqvist.it/blog/2020/6/26/extending-theme-material-ui-with-typescript/)

---

### Pitfall 5: MapLibre Event Handler Memory Leaks in React

**What goes wrong:**
Map performance degrades over time. Browser DevTools shows growing memory usage. Map event handlers fire multiple times per interaction. App crashes after route changes or component unmounts.

**Why it happens:**
MapLibre event handlers (`.on()`) are not automatically cleaned up when React components unmount. Each component mount attaches new listeners without removing old ones. `useEffect` hooks that register map listeners without return cleanup functions accumulate handlers. Map instance persists across component lifecycles in context/ref, but handlers are component-scoped.

**How to avoid:**
- **Phase 2 (Responsive Layout)**: Enforce cleanup pattern in all map event hooks
- ALWAYS return cleanup function from `useEffect` when registering map listeners:
  ```tsx
  useEffect(() => {
    if (!map) return
    const handler = () => { /* ... */ }
    map.on('move', handler)
    return () => map.off('move', handler)  // CRITICAL
  }, [map])
  ```
- Use `map.once()` for one-time listeners (auto-cleanup)
- Store handlers in refs for stable identity: `const handlerRef = useRef(handler)`
- Prefer `react-map-gl` wrapper components (handle cleanup internally)
- Profile memory with Chrome DevTools: Take heap snapshots before/after route changes
- Check map listener count: `map.listens('move')` should return reasonable values

**Warning signs:**
- Memory usage grows after navigating between routes
- Map event handlers fire 2x, 3x, 4x times (multiplying on each mount)
- Console warnings: "Cannot remove listener, map already destroyed"
- Browser tab crashes after extended use

**Phase to address:**
Phase 2: Responsive Layout System + Phase 3: State Optimization

**Source confidence:** MEDIUM
- [MapView Error: Unsupported event type - MapLibre React Native](https://github.com/maplibre/maplibre-react-native/issues/1165)
- [Event System - MapLibre GL JS](https://deepwiki.com/maplibre/maplibre-gl-js/2.3-event-system)
- react-map-gl Context7 documentation (cleanup patterns)

---

### Pitfall 6: Mobile Bottom Sheet Gesture Ambiguity

**What goes wrong:**
Users swipe up to view route details but map pans instead. Bottom sheet drag handle doesn't respond. Scrolling directions list triggers map zoom. Users unable to access content "hidden" below visible area.

**Why it happens:**
Touch events propagate from bottom sheet through to MapLibre canvas. Both components compete for the same gestures (vertical swipe, pinch, drag). Without clear visual/spatial boundaries, users don't know which area controls which interaction. Insufficient drag handle size falls below WCAG minimum touch target (44x44px).

**How to avoid:**
- **Phase 2 (Responsive Layout)**: Design clear interaction zones
- Implement "gutter space" pattern: Bottom sheet has opaque background extending full width
- Drag handle: minimum 44x44px touch target (WCAG 2.5.5)
- MUI SwipeableDrawer: use `disableDiscovery` prop to prevent map gesture interference
- Bottom sheet content: use `overflow: auto` on content container, NOT on drawer itself
- Visual affordance: Show drag handle + "Swipe up" hint on first use (localStorage flag)
- Disable map interactions when bottom sheet is expanded >60% (optional)
- Test on real devices: Gesture conflicts manifest differently on iOS vs Android

**Warning signs:**
- User complaints about "can't scroll directions"
- Bottom sheet difficult to drag (small touch target)
- Map pans when user intends to expand bottom sheet
- Content clipped with no scroll indicator visible

**Phase to address:**
Phase 2: Responsive Layout System

**Source confidence:** HIGH
- [How to design bottom sheets for optimized user experience](https://blog.logrocket.com/ux-design/bottom-sheets-optimized-ux/)
- [Bottom Sheets: Definition and UX Guidelines - NN/G](https://www.nngroup.com/articles/bottom-sheet/)
- [6 Mistakes to Avoid When Designing Maps](https://www.iotforall.com/designing-maps-interface-for-apps)

---

### Pitfall 7: Keyboard Navigation Focus Traps in Map UI

**What goes wrong:**
Keyboard users tab into map but cannot tab out. Focus disappears when interacting with map controls. Screen reader announces incorrect element labels. Modal dialogs trap focus permanently.

**Why it happens:**
MapLibre canvas is not keyboard-navigable by default. Custom map controls render without ARIA labels or keyboard handlers. Bottom sheet/modal components don't implement proper focus management (trap focus when open, restore focus on close). Tab order doesn't match visual layout due to absolute positioning.

**How to avoid:**
- **Phase 2 (Responsive Layout)**: Implement WCAG 2.1.2 (No Keyboard Trap) from start
- Map controls: Add `role="button"`, `aria-label`, `tabIndex={0}`, `onKeyDown` handlers
- Bottom sheet: Trap focus intentionally INSIDE sheet when expanded, restore to trigger on close
- Skip link: Provide "Skip to map" and "Skip to controls" (existing implementation ✓)
- Test with keyboard only: Tab through entire interface, verify escape routes
- Focus indicators: Minimum 3px outline, 3:1 contrast (WCAG 2.4.11 - AA)
- MUI components: Verify focus styles not overridden by theme
- Modal/Drawer: Use MUI's built-in focus management, test Escape key

**Warning signs:**
- Tab key navigates to map, Shift+Tab doesn't return focus
- Focus indicator invisible on custom components
- Screen reader announces "button" with no label
- Modal closes but focus disappears (not restored to trigger element)

**Phase to address:**
Phase 2: Responsive Layout System + Phase 4: Accessibility Audit

**Source confidence:** HIGH
- [WCAG 2.1.2 No Keyboard Trap - 2025 Guide](https://testparty.ai/blog/wcag-2-1-2-no-keyboard-trap-2025-guide)
- [Accessible Modals & Dialogs Example 2025](https://www.thewcag.com/examples/modals-dialogs)
- [WCAG 2.4.11 Focus Not Obscured - 2025 Guide](https://testparty.ai/blog/wcag-2-4-11-focus-not-obscured-minimum-2025-guide)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single context for all state | Fast initial setup, less boilerplate | Cascade re-renders destroy performance at scale | Never - split contexts from start |
| Inline styles instead of theme | Quick visual tweaks | Inconsistent design, no dark mode support | MVP prototyping only, refactor before production |
| Copy-paste MUI examples without cleanup | Rapid feature delivery | Event handler leaks, memory bloat, crashes | Never - understand lifecycle before using |
| Skip `React.memo` on expensive components | Simpler code, fewer hooks | Unnecessary re-renders, map lag | Early prototyping, add before performance testing |
| Hardcode breakpoints instead of theme | No type definitions needed | Maintenance nightmare, responsive bugs | Never - theme breakpoints prevent drift |
| Disable MUI Portal for z-index "fix" | UI renders on top | Breaks focus management, modal behavior | Never - fix z-index scale instead |
| Use `!important` to override MUI styles | Overrides work immediately | Cascade chaos, unmaintainable CSS | Never - investigate specificity properly |
| Store map instance in state vs. ref | Feels more "React-like" | Re-renders entire tree on map mutation | Never - map is imperative, use ref |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **MapLibre + MUI Theme** | Using hardcoded colors in map style | Extract map colors to theme.map namespace, sync with MUI palette |
| **react-map-gl + Context** | Storing map instance in context state | Store map ref in context (`.current`), never mutate context value |
| **MUI Drawer + MapLibre** | Drawer transitions trigger map resize bugs | Use `Map` prop `onResize` or call `map.resize()` after Drawer animation completes |
| **MUI CssBaseline + MapLibre CSS** | Global CSS resets break map controls | Load MapLibre CSS AFTER CssBaseline, use CSS layers for isolation |
| **Custom MUI theme + TypeScript** | Module augmentation in separate file not recognized | Import component in same file as augmentation OR use ambient declaration file |
| **Bottom Sheet + Map Pan** | Touch events propagate to map | Use `touchAction: 'pan-y'` CSS on bottom sheet, `disableDiscovery` on SwipeableDrawer |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Rendering route GeoJSON inline** | Smooth at first | Use `useMemo` for GeoJSON transformation, profile with large routes | >500 segments (~10+ mile routes) |
| **Not memoizing map paint objects** | Works initially | Memoize with `useMemo`, prevent object identity changes | Every map style toggle or route update |
| **Creating styled components inside render** | Component works | Move styled component definition outside functional component | Causes full remount on parent re-render |
| **useEffect with entire context as dependency** | Functional but laggy | Use context selectors or split contexts | >5 context consumers in tree |
| **Not lazy loading Sidebar/Map** | App loads fine locally | Code-split with `React.lazy()`, suspend heavy components | Production bundle >500KB |
| **Uncontrolled MUI form components** | Fast initial render | Use `value` + `onChange` for predictable state, debounce autocomplete | Autocomplete search with >100 results |
| **Synchronous map layer updates** | Appears to work | Batch map operations, use `map.once('idle')` for stability | Adding >10 layers or sources |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Exposing Mapbox API key in client bundle** | Key theft, usage quota abuse | Use MapLibre GL (open source, no API key) or secure Mapbox key with URL restrictions |
| **No rate limiting on geocoding API** | DOS via autocomplete spam | Implement debounce (300ms) + client-side caching + server-side rate limit |
| **Rendering user input in map popups without sanitization** | XSS via malicious address strings | Sanitize with DOMPurify or use `textContent` instead of `innerHTML` |
| **Custom map tiles without CORS headers** | Mixed content warnings, tile load failures | Serve tiles with proper CORS headers, use HTTPS |
| **Storing route history in localStorage without encryption** | PII exposure (home/work addresses) | Use sessionStorage for ephemeral data, encrypt if persisting user locations |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Sidebar width >400px on tablet** | Map unusably small, can't see route | Use `isTabletOrBelow ? 340px : 400px` (existing ✓) |
| **No loading state during route calculation** | App feels frozen, users click repeatedly | Show skeleton UI or spinner with "Calculating route..." message |
| **Route results appear without map zoom** | User can't see full route, must zoom manually | Auto-fit bounds to route on update (existing ✓) |
| **Ambiguous travel mode icons (bike/walk)** | Users select wrong mode | Use labels + icons, highlight selected mode with color + border |
| **Bottom sheet snap points at 33%, 66%, 100%** | Users want quick access to directions | Use 40% (summary), 60% (directions), 90% (controls) (existing ✓) |
| **No "empty state" for route list** | Blank panel confuses users | Show "Enter origin and destination to get started" with illustration |
| **Traffic toggle hidden in settings** | Users don't discover traffic-aware routing | Prominent toggle near travel mode selector (existing ✓) |
| **Turn-by-turn text too small on mobile** | Unreadable while navigating | Minimum 16px font size, 1.5 line-height (WCAG 1.4.4) |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Bottom Sheet**: Tested on real iOS (Safari) and Android (Chrome) devices, not just DevTools responsive mode
- [ ] **MUI Theme**: Verified dark mode works for ALL custom components, not just default MUI palette
- [ ] **Map Controls**: Keyboard accessible (Tab, Enter, Escape) and screen reader announces labels correctly
- [ ] **Route Calculation**: Error handling for "no route found", "server timeout", "invalid coordinates"
- [ ] **Responsive Layout**: Tested portrait AND landscape orientations on mobile/tablet
- [ ] **Focus Management**: Verified focus restoration after modal/drawer close, not just trap-on-open
- [ ] **TypeScript Types**: Custom theme properties work in `styled()` AND `sx` prop, not just `createTheme()`
- [ ] **Performance**: Profiled with React DevTools Profiler under realistic load (10+ route calculations, map interactions)
- [ ] **Touch Targets**: Verified ALL interactive elements meet 44x44px minimum (WCAG 2.5.5), including map controls
- [ ] **Loading States**: Spinners/skeletons for route calculation, geocoding, AND map tile loading
- [ ] **Map Event Cleanup**: Memory profiling confirms no listener leaks after route changes/unmounts
- [ ] **CSS Specificity**: Theme overrides work for hover/focus/disabled states, not just default state

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Context performance collapse** | MEDIUM | 1. Profile with React DevTools to identify hot components. 2. Split offending context into multiple contexts by update frequency. 3. Wrap components in `React.memo()`. 4. Consider Zustand migration if context splitting insufficient. |
| **Theme override specificity conflicts** | LOW | 1. Inspect element in DevTools to find actual selector. 2. Match specificity in theme override (nest selectors). 3. Enable `modularCssLayers` for cascade control. 4. Document specificity in design system for future. |
| **MapLibre event handler memory leak** | LOW | 1. Add cleanup function to all `useEffect` hooks registering map listeners. 2. Use `map.once()` for one-time events. 3. Profile memory before/after to verify fix. |
| **z-index overlay conflicts** | LOW | 1. Audit z-index values across app, establish scale (map=0, UI=100s, modals=1300+). 2. Use MUI Portal for problematic components. 3. Test stacking contexts with DevTools 3D view. |
| **CSS variables theme migration breaks app** | HIGH | 1. Revert `cssVariables: true` immediately. 2. Create parallel theme file, test in isolation. 3. Run official codemods. 4. Migrate incrementally (one component category at a time). 5. Update TypeScript types (Theme + ThemeOptions). |
| **Bottom sheet gesture conflicts** | MEDIUM | 1. Add `touchAction: 'pan-y'` CSS to bottom sheet. 2. Use `disableDiscovery` on SwipeableDrawer. 3. Increase drag handle size to 44x44px. 4. Test on real devices (simulator insufficient). |
| **Keyboard focus trap** | MEDIUM | 1. Add `tabIndex`, `onKeyDown`, `aria-label` to custom controls. 2. Implement focus trap in modals/drawers (MUI handles this). 3. Test with keyboard-only navigation. 4. Add visible focus indicators (3px, 3:1 contrast). |
| **Mobile performance degradation** | MEDIUM | 1. Profile with Chrome DevTools Performance tab (60fps target). 2. Lazy load Sidebar/Map with `React.lazy()`. 3. Memoize expensive computations (`useMemo`). 4. Split contexts by update frequency. 5. Enable React Strict Mode to catch issues early. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| MUI theme override specificity | Phase 1: Design System | Theme overrides work in Storybook for all component states (default, hover, focus, disabled) |
| MapLibre z-index conflicts | Phase 2: Responsive Layout | z-index scale documented, all overlays render correctly, no clipping |
| React Context performance | Phase 1 + Phase 3: State Optimization | React DevTools Profiler shows <5 re-renders per user interaction, 60fps during map pan |
| CSS Variables migration breaks styles | Phase 1: Design System | Parallel theme file tested in isolation, TypeScript types pass, existing styles unaffected |
| MapLibre event handler leaks | Phase 2 + Phase 3: Implementation | Chrome DevTools heap snapshots show stable memory after 10+ route changes |
| Bottom sheet gesture conflicts | Phase 2: Responsive Layout | Real device testing (iOS + Android): swipe-to-expand doesn't pan map, scrolling works |
| Keyboard focus traps | Phase 2 + Phase 4: Accessibility | Keyboard-only navigation completes full workflow, focus indicators visible, WCAG 2.1.2 pass |
| Mobile performance degradation | Phase 3: State Optimization | Performance tab shows <16ms scripting time, Lighthouse score >90, no jank during interaction |

## Sources

### MUI Theme & Styling
- [3 Common Pitfalls of Theme Customization with Material UI | DMC, Inc.](https://www.dmcinfo.com/blog/17372/3-common-pitfalls-of-theme-customization-with-material-ui/)
- [CSS Layers - Material UI](https://mui.com/material-ui/customization/css-layers/)
- [Themed components - Material UI](https://mui.com/material-ui/customization/theme-components/)
- [Migrating to CSS theme variables - Material UI](https://mui.com/material-ui/experimental-api/css-theme-variables/migration/)
- [Breaking changes in v5 - Material UI](https://mui.com/material-ui/migration/v5-style-changes/)
- [Extending the theme in Material UI with TypeScript](https://www.bergqvist.it/blog/2020/6/26/extending-theme-material-ui-with-typescript/)
- Context7: /websites/v6_mui_material-ui (HIGH confidence)

### MapLibre GL & React Integration
- [Maplibre popup rendering below the map - deck.gl Discussion](https://github.com/visgl/deck.gl/discussions/9132)
- [MapView Error: Unsupported event type - MapLibre React Native](https://github.com/maplibre/maplibre-react-native/issues/1165)
- [Event System - MapLibre GL JS](https://deepwiki.com/maplibre/maplibre-gl-js/2.3-event-system)
- Context7: /visgl/react-map-gl (HIGH confidence - event handler cleanup patterns)

### React Performance & Context
- [How to Handle React Context Performance Issues](https://oneuptime.com/blog/post/2026-01-24-react-context-performance-issues/view)
- [Optimizing React Context for Performance](https://www.tenxdeveloper.com/blog/optimizing-react-context-performance)
- [Pitfalls of overusing React Context](https://blog.logrocket.com/pitfalls-of-overusing-react-context/)
- [React 19 Compiler in 2025: Why useMemo/useCallback Are Dead](https://isitdev.com/react-19-compiler-usememo-usecallback-dead-2025/)
- [Improve React Performance With useMemo And useCallback](https://www.debugbear.com/blog/react-usememo-usecallback)

### Mapping App UX & Mobile Design
- [6 Mistakes to Avoid When Designing Maps for Apps](https://www.iotforall.com/designing-maps-interface-for-apps)
- [How to design bottom sheets for optimized user experience](https://blog.logrocket.com/ux-design/bottom-sheets-optimized-ux/)
- [Bottom Sheets: Definition and UX Guidelines - NN/G](https://www.nngroup.com/articles/bottom-sheet/)
- [Map UI Design: Best Practices](https://www.eleken.co/blog-posts/map-ui-design)

### Accessibility & WCAG
- [WCAG 2.1.2 No Keyboard Trap - 2025 Guide](https://testparty.ai/blog/wcag-2-1-2-no-keyboard-trap-2025-guide)
- [Accessible Modals & Dialogs Example 2025](https://www.thewcag.com/examples/modals-dialogs)
- [WCAG 2.4.11 Focus Not Obscured - 2025 Guide](https://testparty.ai/blog/wcag-2-4-11-focus-not-obscured-minimum-2025-guide)
- [WCAG 2.1.1 Keyboard Accessibility Explained](https://www.uxpin.com/studio/blog/wcag-211-keyboard-accessibility-explained/)

---
*Pitfalls research for: NYC Open Routing UI Redesign*
*Researched: 2026-02-12*
*Confidence: HIGH (Context7 + Official Docs + Multiple Credible Sources)*
