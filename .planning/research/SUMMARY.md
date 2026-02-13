# Project Research Summary

**Project:** NYC Open Routing - Transit-Inspired UI Redesign
**Domain:** Multi-modal routing/mapping application (React + MUI + MapLibre GL)
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

NYC Open Routing is a proof-of-concept multi-modal routing application built with React 18, MUI 7, and MapLibre GL. The UI redesign aims to apply a transit-inspired visual identity based on NYC's MTA design system while improving responsive behavior, accessibility, and polish. Research shows that mapping applications of this type should use centralized theming (MUI's global overrides pattern), maintain strict separation between map and UI interaction zones, and optimize React Context to prevent cascade re-renders during map interactions.

The recommended approach is a **phased theme-first redesign**: establish design tokens and component overrides before touching layout or custom components. This prevents rework and ensures consistency. The stack is already optimal — no new libraries needed beyond what's installed (MUI 7 with Emotion, tss-react for complex styles). Use Emotion keyframes for animations rather than external animation libraries; the transit UI needs simple, functional transitions (slide, fade, expand), not physics-based effects.

Key risks include MUI theme override specificity conflicts, MapLibre z-index battles with React overlays, and Context API performance collapse from excessive re-renders. These are mitigated by: (1) investigating default CSS specificity before writing overrides, (2) establishing a z-index scale early (map=0, UI=100s, modals=1300+), and (3) splitting contexts by update frequency (high-frequency map state separated from low-frequency route data). Real device testing is critical for mobile bottom sheet interactions — gesture conflicts between map panning and sheet dragging manifest differently on iOS vs Android.

## Key Findings

### Recommended Stack

Research confirms the current stack is well-chosen for this domain. MUI 7 provides excellent theming with CSS variables, Emotion is performance-optimized and React 18-ready, and tss-react gives type-safe styling for complex components. No additional libraries are needed.

**Core technologies:**
- **MUI 7.3.2** (Material UI): Component library with centralized theming via `createTheme()` and `styleOverrides` — already integrated, high source reputation (30.7k stars)
- **Emotion 11.x** (@emotion/react + @emotion/styled): CSS-in-JS engine, faster than styled-components, GPU-accelerated keyframes for animations — already installed, React Concurrent Mode ready
- **tss-react 4.x**: Type-safe makeStyles-style API powered by Emotion — already installed, useful for multi-class components with theme access
- **Inter font** (Google Fonts): Primary UI font with superior screen legibility, 414B annual requests, designed for UIs with tall x-height — add via CDN or npm
- **Official MTA Pantone colors**: Subway line colors as design tokens (e.g., `#0039A6` MTA Blue for primary, `#EE352E` Red for secondary, `#FF6319` Orange for accents)

**Key decision:** Use Emotion keyframes for all animations. DO NOT install framer-motion or react-spring — overkill for transit UI's simple transitions, adds bundle size unnecessarily.

### Expected Features

Mapping applications have well-established table stakes. Users expect responsive layouts, turn-by-turn directions, touch-friendly controls (44x44px minimum), and accessibility compliance (WCAG 2.1 Level AA). The current implementation has many foundational features but needs visual polish and mobile optimization.

**Must have (table stakes):**
- Responsive sidebar (desktop: 400px, tablet: 340px) and mobile bottom sheet — **partially implemented, needs polish**
- Turn-by-turn directions list with current step highlighting — **implemented, needs visual redesign**
- Route summary card (distance, duration, ETA) — **implemented, needs transit-inspired styling**
- Touch-friendly controls (44x44px minimum, 8px spacing) — **current theme complies, audit needed**
- Accessible color contrast (4.5:1 text, 3:1 graphics) — **WCAG compliance required, needs verification**
- Screen reader support and keyboard navigation — **partial implementation, needs enhancement**
- Mobile-optimized layout with bottom sheet pattern — **implemented, needs gesture conflict resolution**

**Should have (competitive):**
- MTA transit-inspired visual identity — **differentiator, core value proposition of redesign**
- Compact, polished route cards with clear hierarchy — **differentiator, shows design attention**
- Mode-specific turn restrictions surfaced in UI — **backend implemented, needs UI affordance**
- Static traffic awareness toggle (pragmatic vs expensive real-time APIs) — **implemented, needs value surfacing**
- Ferry routing integration (NYC-specific) — **backend implemented, needs UI affordances**
- Route step focusing on map (click step → highlight segment) — **not implemented, valuable addition**

**Defer (v2+):**
- Real-time traffic data (cost-prohibitive for POC; static traffic factors sufficient)
- Turn-by-turn voice navigation (scope creep; focus on pre-trip visual review)
- Multi-stop routing (algorithmic complexity, UX burden)
- Offline maps (100+ MB downloads, cache management complexity)
- Route customization (avoid highways/tolls — diminishing returns, adds UI complexity)

### Architecture Approach

The existing architecture is sound: Context API for state management (RoutingContext, MapInstanceContext, MessageContext), React hooks for behavior (useRouteFetch, useGeoJsonLayer, useMapZoom), and AdaptiveLayout for responsive switching. The redesign requires a **theme-first approach** — define all visual styling in a centralized theme file via MUI's `createTheme()` and `components.styleOverrides`.

**Major components:**
1. **Theme Foundation Layer** — Design tokens (palette, typography, spacing, shape) extended with custom properties (transit colors, map colors)
2. **Component Override Layer** — Global MUI component styles (Card, List, Tabs, Button) with transit aesthetic (border-left accents, compact padding, bold typography)
3. **Responsive Layer** — Breakpoint-specific overrides (mobile tighter spacing, desktop expanded controls) coordinated with AdaptiveLayout
4. **Custom Component Layer** — RouteSummaryCard, RouteList, TravelModeSelect updated to use new theme tokens

**Key patterns:**
- **Centralized theming (global overrides)** is recommended over component wrapping — single source of truth, automatic propagation, easier maintenance
- **sx prop hierarchy**: Prefer `sx` prop for styling (most optimized), use `tss-react makeStyles` for complex multi-class components, avoid `styled()` unless truly needed
- **Context separation by update frequency**: High-frequency map state (store as ref, not state), medium-frequency route data (current RoutingContext), low-frequency theme/preferences (separate if added)
- **MapLibre integration**: Map colors reference theme tokens (theme.map namespace), control buttons use MuiIconButton overrides, overlays positioned via theme-based CSS

**Architecture sequence:**
1. Define theme tokens (palette, typography, spacing)
2. Apply global component overrides (MuiCard, MuiList, MuiTabs)
3. Add responsive breakpoint overrides
4. Update custom components to consume theme

### Critical Pitfalls

Research identified 7 critical pitfalls specific to MUI + MapLibre + React mapping applications. The top pitfalls are theme specificity conflicts, z-index battles, and Context performance issues.

1. **MUI Theme Override Specificity Conflicts** — Custom styles fail to apply because MUI's state selectors (`.Mui-focused`, `.Mui-disabled`) have higher specificity than theme overrides. **Avoidance:** Investigate default slot structure before writing overrides, match specificity when targeting states, enable `modularCssLayers` for cascade control.

2. **MapLibre z-index Conflicts with React UI Overlays** — Sidebars, bottom sheets, modals render behind MapLibre canvas or get clipped. Map interactions interfere with UI gestures. **Avoidance:** Establish z-index scale early (map=0, UI=100-199, modals=1300+), use MUI Portal for overlays, implement "gutter space" pattern for gesture zones.

3. **React Context Performance Collapse** — Map interactions (60fps) trigger cascade re-renders in unrelated UI components, degrading to 20-30fps. **Avoidance:** Split contexts by update frequency, store map instance as ref (not state), use React.memo + useMemo/useCallback, profile with React DevTools.

4. **CSS Variables Theme Migration Breaking Existing Styles** — Enabling `cssVariables: true` changes theme structure from nested objects to CSS custom properties, breaking type declarations and color references. **Avoidance:** Migrate incrementally, create parallel theme file, run official codemods, update TypeScript module augmentation for both Theme and ThemeOptions interfaces.

5. **MapLibre Event Handler Memory Leaks** — Map event handlers (`.on()`) accumulate on each component mount without cleanup, causing memory growth and crashes. **Avoidance:** ALWAYS return cleanup function from useEffect when registering map listeners: `return () => map.off('move', handler)`, use `map.once()` for one-time listeners.

6. **Mobile Bottom Sheet Gesture Ambiguity** — Swipe-up to view route details triggers map pan instead. Touch events propagate from bottom sheet to MapLibre canvas. **Avoidance:** Use `disableDiscovery` prop on SwipeableDrawer, implement gutter space pattern (opaque background full width), drag handle minimum 44x44px, test on real devices.

7. **Keyboard Navigation Focus Traps** — Keyboard users tab into map but cannot tab out. Custom controls lack ARIA labels. Bottom sheet doesn't trap/restore focus properly. **Avoidance:** Add `role="button"`, `aria-label`, `tabIndex={0}`, `onKeyDown` handlers to custom controls, implement focus trap in modals, test with keyboard-only navigation.

## Implications for Roadmap

Based on research, a **4-phase architecture-driven approach** is recommended. The phases follow the natural dependency order discovered in research: theme foundation → responsive layout → component polish → accessibility audit.

### Phase 1: Design System Foundation
**Rationale:** Theme tokens must exist before components can consume them. MUI's global override pattern requires centralized theme definition. Establishing design tokens early prevents rework and ensures consistency across all phases.

**Delivers:** Complete transit-inspired theme with MUI overrides
- MTA-inspired color palette (subway line colors as design tokens)
- Typography scale (Inter font, compact sizing, bold weights for transit aesthetic)
- Global component overrides (Card, List, Tabs, Button)
- Custom theme extensions (map colors, transit colors)
- TypeScript module augmentation for custom properties

**Addresses (from FEATURES.md):**
- MTA visual identity (differentiator)
- Touch-friendly controls (44x44px minimum via MuiButton overrides)
- Accessible color contrast (WCAG 4.5:1 text, 3:1 graphics)

**Avoids (from PITFALLS.md):**
- Theme override specificity conflicts (investigate before writing overrides)
- CSS Variables migration breaking styles (test in isolation before rollout)
- Context performance issues (define context separation strategy early)

**Research flag:** Standard patterns — MUI theming is well-documented. Skip phase research.

### Phase 2: Responsive Layout System
**Rationale:** Responsive layout depends on theme tokens (breakpoints, spacing). Desktop sidebar and mobile bottom sheet must share component styles via theme. Z-index conflicts and gesture ambiguity are resolved at the layout level, not per-component.

**Delivers:** Polished adaptive layout with gesture conflict resolution
- Review/refine AdaptiveLayout component (currently functional but needs polish)
- Establish z-index scale (map=0, UI=100-199, modals=1300+)
- Resolve mobile bottom sheet gesture conflicts (disableDiscovery, gutter space)
- Responsive breakpoint overrides in theme (mobile: tighter spacing, desktop: expanded controls)
- MapLibre control overlay positioning via theme

**Addresses (from FEATURES.md):**
- Responsive sidebar (desktop 400px, tablet 340px, mobile bottom sheet)
- Mobile-optimized layout (bottom sheet pattern)
- Real-time map + controls coexistence (z-index management)

**Avoids (from PITFALLS.md):**
- MapLibre z-index conflicts (z-index scale, MUI Portal usage)
- Bottom sheet gesture ambiguity (real device testing, gutter space)
- MapLibre event handler memory leaks (cleanup pattern enforcement)

**Research flag:** Needs phase research — Mobile gesture handling is device-specific and requires testing patterns. Consider `/gsd:research-phase` for bottom sheet interaction patterns.

### Phase 3: Component Polish
**Rationale:** Components depend on theme foundation (Phase 1) and responsive layout (Phase 2). With theme and layout stable, focus shifts to visual polish and data presentation. This is where the transit-inspired aesthetic becomes tangible.

**Delivers:** Polished route cards and directions with transit aesthetic
- RouteSummaryCard redesign (border-left accent, transit-style badge, stats grid)
- RouteList redesign (step number badges like transit stops, compact ListItemButton)
- TravelModeSelect visual alignment with MTA theme (prominent indicator, bold typography)
- Turn icons with color + shape differentiation (accessibility)
- Progressive disclosure in route cards (expand/collapse with smooth transitions)
- Route step focusing on map (click step → highlight segment)

**Addresses (from FEATURES.md):**
- Polished route cards (differentiator)
- Turn-by-turn directions list (table stakes, visual redesign)
- Route summary card (table stakes, transit-inspired styling)
- Route step focusing (differentiator, connects list + map context)
- Current step highlighting (navigation enhancement)

**Avoids (from PITFALLS.md):**
- Inline styles everywhere (use theme overrides as foundation, sx prop for exceptions)
- Creating styled components inside render (move definitions outside)
- Not memoizing expensive computations (useMemo for GeoJSON transformations)

**Research flag:** Standard patterns — Route card design and turn-by-turn UI are well-documented in mapping apps. Skip phase research.

### Phase 4: Accessibility Audit
**Rationale:** Accessibility verification must happen after all components and layouts are implemented. WCAG compliance is table stakes for 2026 public entity applications. Phase 4 is not "add accessibility" (that happens throughout) but "verify nothing broke."

**Delivers:** WCAG 2.1 Level AA compliance verified
- Screen reader testing (VoiceOver, TalkBack) with route calculation workflow
- Keyboard navigation audit (Tab through interface, verify no traps, test Escape key)
- Focus indicator verification (3px outline, 3:1 contrast minimum)
- Color contrast audit (automated + manual verification)
- Touch target audit (all interactive elements ≥ 44x44px)
- Motion preferences testing (`prefers-reduced-motion` respected)

**Addresses (from FEATURES.md):**
- Screen reader support (table stakes)
- Keyboard navigation (table stakes)
- Accessible color contrast (table stakes)
- Visual hierarchy (typography, color, spacing)

**Avoids (from PITFALLS.md):**
- Keyboard navigation focus traps (WCAG 2.1.2 No Keyboard Trap)
- Overriding accessibility features (maintain focus indicators, touch targets)
- Insufficient contrast (WCAG 2.1 Level AA requirements)

**Research flag:** Standard patterns — WCAG 2.1 testing procedures are well-documented. Use automated tools (axe DevTools, Lighthouse) + manual testing. Skip phase research.

### Phase Ordering Rationale

- **Phase 1 must come first** because all subsequent phases depend on theme tokens. Writing components before theme exists leads to hardcoded values that require refactoring.
- **Phase 2 follows Phase 1** because responsive overrides are theme-based (breakpoints, spacing). Layout must be stable before polishing components.
- **Phase 3 depends on Phases 1+2** because component redesigns consume theme tokens and responsive layout structure. Polish is the last visual layer.
- **Phase 4 is verification, not implementation** — accessibility is addressed throughout (Phase 1 contrast, Phase 2 keyboard nav, Phase 3 ARIA labels), but audit confirms nothing broke during integration.

**Dependency chain:**
```
Phase 1 (Theme) → Phase 2 (Layout) → Phase 3 (Components) → Phase 4 (Verify)
       ↓                ↓                    ↓
   All phases          All phases       All phases
```

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2 (Responsive Layout)** — Mobile bottom sheet gesture handling is device-specific (iOS vs Android behavior differs). Real device testing patterns and `disableDiscovery` prop configuration may benefit from targeted research if issues arise.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Design System)** — MUI 7 theming is exceptionally well-documented with official examples. Stack research already covered specificity and CSS variables migration.
- **Phase 3 (Component Polish)** — Route card design and turn-by-turn UI are established patterns in mapping applications (Google Maps, Apple Maps, Citymapper). Feature research already identified design patterns.
- **Phase 4 (Accessibility)** — WCAG 2.1 testing procedures are standardized. Use automated tools (axe, Lighthouse) + manual keyboard/screen reader testing. No novel domain-specific accessibility challenges.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | MUI 7 + Emotion + tss-react verified via official docs (Context7 /websites/v6_mui_material-ui) and project package.json. No new libraries needed. Inter font from Google Fonts (414B annual requests). MTA colors from official data sources. |
| Features | HIGH | Mapping app patterns well-established via competitor analysis (Google Maps, Apple Maps, Citymapper). Table stakes vs differentiators clearly distinguished. MVP already has foundational features (responsive layout, route calculation, search). |
| Architecture | HIGH | MUI theming architecture from official docs + community best practices (wrapping vs global overrides comparison). Transit UI patterns from transportation app UX research. Context performance patterns from React optimization guides. |
| Pitfalls | HIGH | All 7 critical pitfalls sourced from official MUI docs, MapLibre/deck.gl discussions, React performance guides, and WCAG specifications. Context performance and theme specificity issues well-documented in community. |

**Overall confidence:** HIGH

Research covered all four dimensions with authoritative sources. Stack is already optimal (no speculative library additions). Architecture patterns are well-documented in both MUI and transit UI domains. Pitfalls are specific, actionable, and sourced from official documentation or credible technical discussions.

### Gaps to Address

**Typography fine-tuning:** Inter font recommended but Roboto is acceptable alternative (used in NYC Subway countdown clocks). Decision should be made during Phase 1 based on visual testing. Both are Google Fonts with excellent screen legibility.

**Dark mode support:** Research covered dark mode implementation (CSS variables, `useColorScheme()` hook) but project currently light mode only. If dark mode is added later, transit colors must maintain high contrast in both modes. Defer to post-MVP unless explicitly requested.

**Real-time features:** Backend supports ferry routing and static traffic factors, but real-time transit (MTA BusTime API) is explicitly out of scope. UI should surface existing backend features (ferry toggle, traffic toggle) prominently but not imply real-time updates.

**Bottom sheet snap points:** Current implementation uses 40/60/90% snap points. Research validates this approach (summary/directions/controls). If user feedback suggests different percentages, adjust during Phase 2 based on real device testing.

**MapLibre v5 specifics:** Research used generic MapLibre GL patterns. Project uses MapLibre v5 with ESNext build target (no transpilation). Verify event handler cleanup patterns work identically in v5 vs earlier versions during Phase 2 implementation.

## Sources

### Primary (HIGH confidence)
- **Context7: /websites/v6_mui_material-ui** — MUI 7 theming, component overrides, CSS variables, breakpoints
- **Context7: /visgl/react-map-gl** — MapLibre event handler cleanup patterns, React integration
- **MUI Material UI v7.3.2 Documentation** (GitHub) — Official theme customization, style overrides, responsive breakpoints
- **Emotion Documentation** (GitHub) — Keyframes, styled components, performance best practices
- **MapLibre GL JS Documentation** — Event system, map instance management
- **MTA Colors Official Data** (GitHub: jsvine/mta-colors) — Subway line Pantone/hex color specifications
- **WCAG 2.1 Specification** — Accessibility requirements (Level AA compliance)

### Secondary (MEDIUM confidence)
- Map UI Patterns (mapuipatterns.com) — Comprehensive pattern library for mapping interfaces
- Nielsen Norman Group — Bottom sheet UX guidelines, modal vs non-modal patterns
- LogRocket Blog — React Context performance optimization, bottom sheet UX design
- Transportation App UI/UX Research (Fuselabs, AltexSoft, STX Next) — Transit-specific design patterns
- Google Fonts Inter Specimen (rsms.me/inter) — Typography specifications, usage data
- MTA Graphics Standards Manual (1970 Vignelli) — Historical design guide, Helvetica usage

### Tertiary (LOW confidence)
- 2026 Design Trends Articles (UX Pilot, Contentsquare) — General web app design patterns, context-aware UIs
- App Market Research (Industry Research, AppsHunter) — Map app market growth trends, offline map apps

---
*Research completed: 2026-02-12*
*Ready for roadmap: yes*
