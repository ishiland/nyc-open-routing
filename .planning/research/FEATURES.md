# Feature Research

**Domain:** Multi-modal routing/mapping apps with transit-inspired UI
**Researched:** 2026-02-12
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Responsive sidebar (240-300px expanded, 48-64px collapsed)** | Standard pattern in modern mapping apps; users expect content in 30% of viewport on desktop | LOW | CSS Grid preferred in 2026; use `grid-template-areas` for semantic layout |
| **Turn-by-turn directions list** | Core navigation expectation; users need step-by-step guidance | LOW | Current implementation exists; needs visual polish |
| **Route summary card (distance, duration, ETA)** | Users expect to see high-level metrics before committing to route | LOW | Already implemented; consider visual hierarchy improvements |
| **Current step highlighting with next step preview** | Navigation pattern seen in Google Maps, Apple Maps; reduces cognitive load | MEDIUM | Requires state management for "active step" during navigation |
| **Touch-friendly controls (44x44px minimum, 8px spacing)** | iOS/Android HIG standards; below this size creates usability issues | LOW | Audit existing controls for size compliance |
| **Visual hierarchy (typography, color, spacing)** | Users rely on visual cues to distinguish primary/secondary info | LOW | Align with MTA-inspired design system |
| **Loading states and error handling** | Users expect feedback during async operations; silence feels broken | LOW | Existing but may need visual consistency |
| **Accessible color contrast (4.5:1 text, 3:1 graphics)** | WCAG 2.1 Level AA required by 2026 for public entities | MEDIUM | Audit current color palette against WCAG standards |
| **Screen reader support (ARIA labels, semantic HTML)** | Screen readers must perceive routing information and controls | MEDIUM | Test with VoiceOver/TalkBack; add missing ARIA attributes |
| **Keyboard navigation (no keyboard traps)** | WCAG 2.1 SC 2.1.1 requirement; users must operate without mouse | MEDIUM | Ensure all interactive elements reachable via Tab |
| **Real-time map + controls coexistence** | Two interaction patterns (map panning vs object selection) must not conflict | MEDIUM | Avoid z-index battles; clear modal states |
| **Mobile-optimized layout** | 60%+ of mapping app usage is mobile; desktop-only UX loses users | MEDIUM | Bottom sheet pattern is standard on iOS/Android |
| **Geolocation/current location** | Users expect "Where am I?" functionality in any map app | LOW | Already implemented via hooks; ensure permission handling is clear |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable for competitive positioning.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **MTA transit-inspired visual identity** | Unique aesthetic tied to NYC; builds local credibility vs generic map UX | MEDIUM | Use Helvetica, MTA Pantone colors, bold line markers; see Vignelli 1970 standards manual |
| **Compact, polished route cards** | Cleaner presentation than Google Maps' utilitarian cards; shows design attention | LOW | Focus on card spacing, border radius, internal structure (gap, padding) |
| **Mode-specific turn restrictions** | Differentiates from consumer maps; reflects real-world routing complexity | HIGH | Backend already supports; expose in UI as "bike-safe route" or "no-turn avoidance" |
| **Static traffic awareness toggle** | Pragmatic approach vs real-time traffic (which requires expensive APIs) | LOW | Already implemented; surface value in UI ("Avoid high-traffic streets") |
| **Ferry routing integration** | Unique to NYC context; Citymapper tracks ferries but Google Maps often ignores | MEDIUM | Backend support exists; needs UI affordance (ferry icon, route segments) |
| **Turn icons with accessibility** | Icon + text reduces cognitive load; shape + color differentiation aids colorblind users | LOW | Already implemented; ensure contrast and ARIA labels |
| **Route step focusing on map** | Click step → map highlights segment; spatial + list context together | MEDIUM | Requires MapLibre layer styling + click handlers |
| **Bottom sheet on mobile (non-modal)** | Google Maps pattern; allows map interaction while viewing route details | HIGH | React implementation requires gesture handling, snap points, drag physics |
| **Adaptive layout (desktop sidebar ↔ mobile bottom sheet)** | Seamless experience across devices without duplicate code | MEDIUM | Conditional rendering based on viewport; existing `AdaptiveLayout` component |
| **Progressive disclosure in route cards** | Show summary → expand for turn-by-turn; reduces visual clutter | MEDIUM | Collapsible sections with smooth transitions |
| **Smart defaults (drive in AM, bike in PM)** | Reduces clicks for repeat users; shows contextual intelligence | LOW | Client-side logic based on time of day |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems or are deliberately excluded.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time traffic data** | Users expect live congestion like Google Maps | Requires expensive APIs (Google Traffic, TomTom); cost prohibitive for POC | Static traffic factors from NYC DOT data; toggle for "avoid high-traffic streets" |
| **Turn-by-turn voice navigation** | Users think "routing app = voice guidance" | Requires background location, audio handling, distraction-free UI; scope creep for POC | Clear visual directions designed for pre-trip review, not in-car use |
| **Route customization (avoid highways, tolls)** | Power users want control | Adds UI complexity; pgRouting cost customization is non-trivial; diminishing returns | Mode selection + traffic toggle covers 80% of use cases |
| **Multi-stop routing (waypoints)** | Delivery drivers, tour planning | Exponentially harder routing problem; UX complexity (reordering, optimizing) | Single origin-destination; suggest multiple searches |
| **Offline maps** | "I want to use it on the subway" | 100+ MB downloads; cache management; NYC coverage = ~500 MB compressed | Assume connectivity; focus on fast load times instead |
| **Real-time everything (live bus positions, etc.)** | "Citymapper has it" | Requires MTA BusTime API integration; maintenance burden; feature creep | Focus on static routing excellence; defer real-time to production product |
| **Hamburger menu navigation** | "Put settings in a menu" | 2026 UI pitfall; hides critical controls; mobile users expect bottom tabs or visible controls | Persistent controls in sidebar/bottom sheet; settings in modal if needed |
| **Excessive animations** | "Make it feel dynamic" | Slows perceived performance; accessibility issue for motion-sensitive users | Subtle transitions (200-300ms); respect `prefers-reduced-motion` |
| **"AI-powered" route suggestions** | "Use AI to predict where I'm going" | Buzzword-driven feature; privacy concerns; no user value without usage history | Simple, transparent routing based on explicit user input |

## Feature Dependencies

```
Responsive Sidebar
    └──requires──> Adaptive Layout
                      └──requires──> useResponsive hook

Bottom Sheet (mobile)
    └──requires──> Adaptive Layout
    └──requires──> Gesture handling library (e.g., react-spring)
    └──requires──> Snap points logic

Route Step Focusing
    └──requires──> MapLibre layer styling
    └──requires──> Click handlers on route list
    └──enhances──> Turn-by-turn directions

Current Step Highlighting
    └──requires──> Navigation state management
    └──enhances──> Route Step Focusing

Screen Reader Support
    └──requires──> Semantic HTML
    └──requires──> ARIA labels
    └──conflicts──> Overly complex animations (cognitive load)

MTA Visual Identity
    └──requires──> Design system (colors, typography, spacing)
    └──enhances──> Route cards, turn icons, map styling

Ferry Routing
    └──requires──> Backend ferry network integration (done)
    └──requires──> UI affordances (icon, toggle, legend)
    └──enhances──> Multi-modal routing

Traffic Toggle
    └──requires──> Backend traffic data (done)
    └──requires──> API parameter `use_traffic`
    └──conflicts──> Real-time traffic (choose static OR real-time, not both)
```

### Dependency Notes

- **Adaptive Layout is foundational**: Desktop sidebar and mobile bottom sheet both depend on this; prioritize early.
- **Accessibility features cluster together**: Semantic HTML → ARIA labels → keyboard navigation → screen reader testing forms a logical progression.
- **MTA visual identity enhances multiple features**: Route cards, icons, map theming all benefit from consistent design system; define design tokens early.
- **Backend features already exist**: Traffic, ferry, mode-specific restrictions are implemented; UI just needs to surface them.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the transit-inspired redesign concept.

- [x] **Responsive sidebar (desktop)** — Table stakes; users expect sidebar on large screens
- [x] **Turn-by-turn directions list** — Core navigation feature; already exists, needs polish
- [x] **Route summary card** — High-level metrics; already exists, needs visual redesign
- [x] **MTA-inspired visual identity** — Differentiator; validates design direction
- [x] **Polished route cards** — Differentiator; shows design attention vs generic UX
- [x] **Turn icons with colors** — Low-hanging fruit; improves scannability
- [x] **Travel mode selector** — Already exists; needs visual alignment with MTA theme
- [x] **Traffic toggle** — Already exists; surface value more clearly
- [x] **Touch-friendly controls (44x44px)** — Table stakes for mobile; audit existing controls
- [x] **Basic accessibility (contrast, labels)** — WCAG compliance is non-negotiable for 2026
- [ ] **Mobile bottom sheet (basic)** — Table stakes for mobile UX; non-modal pattern preferred
- [ ] **Route step focusing on map** — Differentiator; connects list + map context

### Add After Validation (v1.x)

Features to add once core redesign is validated and feedback collected.

- [ ] **Progressive disclosure in cards** — Reduces clutter; add after card design is stable
- [ ] **Current step highlighting** — Navigation enhancement; requires state management
- [ ] **Ferry routing UI** — Backend exists; add UI affordances after core UX is solid
- [ ] **Advanced accessibility** — Full keyboard nav, screen reader optimization, motion preferences
- [ ] **Smart defaults (time-based mode)** — Nice-to-have intelligence; easy to add later
- [ ] **Geolocation button in mobile sheet** — Convenience feature; add after bottom sheet is stable

### Future Consideration (v2+)

Features to defer until product-market fit is established and scope expands beyond POC.

- [ ] **Advanced bottom sheet (snap points, gestures)** — High complexity; polish after basic version works
- [ ] **Offline maps** — Massive scope; not viable for POC
- [ ] **Multi-stop routing** — Algorithmic complexity; separate project
- [ ] **Voice navigation** — Scope creep; requires product pivot
- [ ] **Real-time traffic integration** — Cost prohibitive; static traffic is pragmatic

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Responsive sidebar | HIGH | LOW | P1 |
| MTA visual identity | HIGH | MEDIUM | P1 |
| Polished route cards | MEDIUM | LOW | P1 |
| Turn icons + colors | MEDIUM | LOW | P1 |
| Touch-friendly controls | HIGH | LOW | P1 |
| Basic accessibility (WCAG AA) | HIGH | MEDIUM | P1 |
| Mobile bottom sheet (basic) | HIGH | MEDIUM | P1 |
| Route step focusing | MEDIUM | MEDIUM | P1 |
| Traffic toggle (polish) | LOW | LOW | P2 |
| Ferry routing UI | LOW | MEDIUM | P2 |
| Progressive disclosure | MEDIUM | MEDIUM | P2 |
| Current step highlighting | MEDIUM | MEDIUM | P2 |
| Advanced accessibility | HIGH | HIGH | P2 |
| Smart defaults | LOW | LOW | P3 |
| Advanced bottom sheet | MEDIUM | HIGH | P3 |
| Multi-stop routing | LOW | HIGH | P3 |
| Offline maps | LOW | HIGH | P3 |
| Voice navigation | LOW | HIGH | P3 |

**Priority key:**
- **P1**: Must have for launch (redesign validation)
- **P2**: Should have, add when possible (polish + usability)
- **P3**: Nice to have, future consideration (scope expansion)

## Competitor Feature Analysis

| Feature | Google Maps | Apple Maps | Citymapper | Our Approach |
|---------|-------------|------------|------------|--------------|
| **Sidebar design** | Desktop: persistent sidebar; Mobile: bottom sheet | iOS: bottom sheet only | Mobile-first bottom sheet | Desktop sidebar + mobile bottom sheet (adaptive) |
| **Turn-by-turn UI** | Current step + next step in card; lane guidance | Current step in floating nav bar | Current step + next 2 steps | Current step + icon + distance; MTA visual style |
| **Visual design** | Neutral grays, blue accents, traffic colors (green/yellow/red) | White UI (day), dark UI (night); bold icons for POIs | Transit-inspired colors, bold route lines | **MTA Pantone colors, Helvetica, bold line markers** |
| **Route cards** | Utilitarian; distance/duration in header | Minimalist; ETA prominent | Compact cards with emoji icons | **Polished cards with MTA-inspired spacing + colors** |
| **Multi-modal routing** | Drive, bike, walk, transit (real-time) | Drive, bike, walk, transit | **Transit-first; ferries, trams, everything** | Drive, bike, walk + ferry (static data, no real-time) |
| **Traffic** | Real-time traffic overlay; color-coded | Real-time traffic; incidents shown | Real-time transit delays | **Static traffic factors; toggle for "avoid high-traffic"** |
| **Offline maps** | Download regions (100+ MB) | Download regions | No offline mode | **No offline; focus on fast load times** |
| **Accessibility** | Screen reader support, wheelchair-accessible transit | Screen reader, wheelchair routes | Limited accessibility | **WCAG 2.1 AA compliance; screen reader + keyboard nav** |
| **Mobile UX** | Non-modal bottom sheet; swipe to expand | Non-modal bottom sheet | Bottom sheet with snap points | **Non-modal bottom sheet; adaptive layout** |
| **Route sharing** | Share via URL, SMS, email | Share via iMessage, AirDrop | Share via URL | Defer to v2+ |
| **Saved routes/favorites** | Saved places; starred locations | Favorites, collections | Saved routes, "Get Me Home" | Defer to v2+ |

## Design Pattern Insights from Research

### Modern Mapping App Patterns (2026)

1. **Bottom sheet is the standard on mobile**: Google Maps, Apple Maps, and transit apps use non-modal bottom sheets that allow map interaction while viewing details. Modal sheets are only for settings or destructive actions.

2. **3-5 primary destinations in navigation**: Cognitive load research shows users can scan 3-5 choices; more requires scrolling and degrades UX. iOS users expect bottom tabs; Android follows Material bottom navigation.

3. **Visual hierarchy over information density**: Google Maps uses bold colors for important icons (red destination pin, highway markers) and subdued colors for less critical info. MTA uses shape + color for accessibility (triangle = warning, diamond = severe).

4. **Container queries > media queries in 2026**: Components should respond to parent container, not just viewport. Sidebar width should drive internal layout, not screen width.

5. **Touch targets are non-negotiable**: 44x44px minimum (iOS HIG); 48x48px preferred (Material Design). 8px spacing between targets prevents mis-taps.

6. **Accessibility is table stakes**: WCAG 2.1 Level AA is legally required for public entities by April 2026. Screen readers, keyboard navigation, 4.5:1 contrast are baseline, not nice-to-haves.

7. **Transit apps prioritize clarity over features**: Citymapper users praise it for "consistently more reliable" tube directions vs Google/Apple. Focus on doing fewer things well.

### MTA Design System Insights

- **Helvetica typography**: Replaced Standard Medium in 1989; still the system typeface. Clean, readable, iconic.
- **10 Pantone spot colors** for subway lines: Precise color system for line identification; accessible color + number system.
- **Modernist graphics from 1970 Vignelli standards**: Stark, logical, thorough analysis of system; still influences signage today.
- **Shape + color for accessibility**: Different icon shapes (triangle, diamond) for colorblind users; not just red/yellow.

### Anti-Patterns to Avoid

- **Hinting instead of acting**: Don't bounce UI to suggest swipe; just open the panel when user taps.
- **Conflicting interaction patterns**: Map panning vs object selection must be clearly separated (modal states, z-index management).
- **Information overload without hierarchy**: Users can't tell what's important; cluster markers, simplify at low zoom.
- **Performance as afterthought**: Beautiful but slow map = bad UX; load hundreds of markers → use clustering.
- **Hamburger menus in 2026**: Hides critical controls; users expect visible controls or bottom tabs.
- **Excessive animations**: Slows perceived performance; violates `prefers-reduced-motion`.

## Sources

### Map UI Design Patterns
- [Map UI Patterns](https://www.mapuipatterns.com/) — Comprehensive pattern library for mapping interfaces
- [Map UI Design: Best Practices (Eleken)](https://www.eleken.co/blog-posts/map-ui-design) — Design principles and examples
- [Map UI Layouts and Design Tips (UXPin)](https://www.uxpin.com/studio/blog/map-ui/) — Layout patterns and interaction design

### Transit & MTA Design
- [MYmta Redesign (WMC)](https://www.wallacemaxwellcotton.com/mta-app) — Case study of MTA app redesign
- [MTA's New Transit App Design (Fast Company)](https://www.fastcompany.com/90938540/the-mtas-transit-app-was-a-nightmare-to-use-the-new-app-promises-to-be-better) — User-centric redesign insights
- [MTA Pantone Colors (6sqft)](https://www.6sqft.com/did-you-know-the-mta-uses-pantone-colors-to-distinguish-train-lines/) — MTA color system
- [Vignelli's Design Influence (Medium)](https://medium.com/nightingale/how-vignellis-design-still-influences-nyc-s-subway-maps-today-63159e8845c9) — 1970 standards manual legacy

### Responsive Design & Sidebars
- [Sidebar Design Best Practices (UX Planet)](https://uxplanet.org/best-ux-practices-for-designing-a-sidebar-9174ee0ecaa2) — Width, layout, hierarchy
- [Sidebar UI Design (Mobbin)](https://mobbin.com/glossary/sidebar) — Design variants and examples
- [CSS Fixed Sidebars 2026 Best Practices](https://copyprogramming.com/howto/css-fixed-left-and-right-sidebar-css) — CSS Grid, container queries

### Mobile Patterns & Bottom Sheets
- [Bottom Sheets: Definition and UX Guidelines (Nielsen Norman Group)](https://www.nngroup.com/articles/bottom-sheet/) — Modal vs non-modal patterns
- [Bottom Sheets vs Fullscreen Modals (Design for Native)](https://designfornative.com/bottom-sheets-vs-fullscreen-modals/) — When to use each
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) — Bottom tabs, navigation patterns
- [UI Changes in iOS 26 (Design for Native)](https://designfornative.com/ui-changes-in-ios-26-thats-not-about-liquid-glass/) — Toolbar updates, modal behavior

### Route Cards & Turn-by-Turn UI
- [Route Directions Pattern (Map UI Patterns)](https://mapuipatterns.com/route-directions/) — Current step, next step, lane guidance
- [Navigation Template (Android Developers)](https://developer.android.com/design/ui/cars/guides/templates/navigation-template) — Routing state design
- [Cards Design Pattern (UI Patterns)](https://ui-patterns.com/patterns/cards) — Flexible layouts, internal structure

### Accessibility
- [Accessible Indoor Navigation 2026 ADA Compliance](https://navigine.com/blog/accessible-indoor-navigation-the-2026-guide-to-compliance-and-universal-design/) — WCAG framework for maps
- [Is Google Maps Accessible? (Accessible Web)](https://accessibleweb.com/question-answer/is-google-maps-accessible/) — Screen reader support, keyboard nav
- [Interactive Maps and Accessibility (BOIA)](https://www.boia.org/blog/interactive-maps-and-accessibility-4-tips) — WCAG 2.1 requirements
- [Mobile App Accessibility Guide 2026](https://www.accessibilitychecker.org/guides/mobile-apps-accessibility/) — Screen readers, contrast, touch targets

### Competitor Analysis
- [Google Maps vs Apple Maps 2026 (Holafly)](https://esim.holafly.com/reviews/google-maps-vs-apple-maps/) — Feature comparison
- [Google Maps vs Apple Maps Feature by Feature (Appmus)](https://appmus.com/vs/google-maps-vs-apple-maps) — Street View, privacy, navigation
- [Citymapper Review (FlightDeck)](https://www.pilotplans.com/blog/citymapper-review) — Transit-first approach
- [Google Maps vs Citymapper (Android Police)](https://www.androidpolice.com/google-maps-vs-citymapper/) — Public transit comparison

### Anti-Patterns & Pitfalls
- [UX Antipatterns: Hinting Instead of Acting](https://michaelboeke.com/posts/ux-antipatterns-hinting-instead-of-acting/) — Interaction design failures
- [7 UI Pitfalls Mobile App Developers Should Avoid 2026](https://www.webpronews.com/7-ui-pitfalls-mobile-app-developers-should-avoid-in-2026/) — Hamburger menus, excessive animations, accessibility oversights

### Feature Expectations & Trends
- [Must-Have Mobile App Features Users Expect 2026](https://www.dotcominfoway.com/blog/must-have-mobile-app-features-users-will-expect-in-2026/) — AI personalization, security, technical stability
- [App Trends 2026 (Mindster)](https://mindster.com/mindster-blogs/app-trends-2026/) — Intelligence, privacy, accessibility
- [Map App Market Growth (Industry Research)](https://www.industryresearch.biz/market-reports/map-app-market-107642) — CAGR 14.89% through 2035

### Offline & Advanced Features
- [Offline Maps in Mobile Apps (Glance)](https://thisisglance.com/learning-centre/whats-the-best-way-to-handle-offline-maps-in-mobile-apps) — Technical approaches, compression
- [Best Offline Maps Apps 2026 (AppsHunter)](https://appshunter.io/ios/topics/offline-maps) — Organic Maps, HERE WeGo
- [Route Sharing Features (On The Go Map)](https://onthegomap.com/) — Public URLs, read-only sharing
- [Multi-Stop Route Planners 2026 (Upper)](https://www.upperinc.com/blog/best-multi-stop-route-planner-app/) — Waypoint management, optimization

---
*Feature research for: NYC Open Routing UI Redesign (Transit-Inspired)*
*Researched: 2026-02-12*
