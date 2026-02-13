# Architecture Research: NYC Open Routing UI Redesign

**Domain:** React 18 + MUI 7 + MapLibre GL mapping application
**Researched:** 2026-02-12
**Confidence:** HIGH

## Executive Summary

NYC Open Routing is a React-based multi-modal routing application with an existing component architecture built on Context API state management, MUI 7 theming, and MapLibre GL mapping. The UI redesign requires a layered architecture that separates theme tokens, component overrides, and responsive layout logic while maintaining the existing data flow patterns.

**Key architectural finding:** MUI 7's design token system supports two primary customization strategies: global overrides (centralized theme tokens) and component wrapping (scoped design system). For a comprehensive redesign, **global overrides provide the best balance** of consistency, maintainability, and rapid iteration.

## Current Architecture Analysis

### Existing System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│  Desktop (905px+)          │  Tablet (600-904px)  │  Mobile (<600px) │
│  ┌──────────┐              │  ┌────────┐          │  ┌──────────┐    │
│  │ Sidebar  │  Map         │  │Sidebar │  Map     │  │   Map    │    │
│  │ (400px)  │              │  │(340px) │          │  │FullScr   │    │
│  │          │              │  │        │          │  └──────────┘    │
│  │ Search   │              │  │ Search │          │  ┌──────────┐    │
│  │ Modes    │              │  │ Modes  │          │  │ Bottom   │    │
│  │ Route    │              │  │ Route  │          │  │ Sheet    │    │
│  └──────────┘              │  └────────┘          │  └──────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                         STATE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │RoutingContext   │  │MessageContext│  │MapInstanceContext│    │
│  │ • addresses     │  │ • messages   │  │ • map instance   │    │
│  │ • route         │  │ • display    │  │ • setMap         │    │
│  │ • mode          │  └──────────────┘  └──────────────────┘    │
│  │ • traffic/ferry │                                             │
│  └─────────────────┘                                             │
├─────────────────────────────────────────────────────────────────┤
│                         RENDERING LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                     MapLibre GL                          │    │
│  │  (Vector tiles, WebGL rendering, GeoJSON layers)         │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Current File |
|-----------|---------------|-------------------|--------------|
| **App** | Error boundaries, lazy loading, provider tree | All contexts | App.tsx |
| **AdaptiveLayout** | Responsive layout switching (sidebar vs bottom sheet) | useResponsive hook | layouts/AdaptiveLayout.tsx |
| **RoutingContext** | Route state, addresses, mode, traffic/ferry toggles | All route-dependent components | contexts/RoutingContext.tsx |
| **MapInstanceContext** | Shared MapLibre GL map instance | MapLibreGLMap, map controls | contexts/MapInstanceContext.tsx |
| **Sidebar** | Desktop/tablet controls container | ControlsContainer, Search, ButtonControls, RouteList | Sidebar.tsx |
| **BottomSheet** | Mobile swipeable drawer (40/60/90% snap points) | Same content as Sidebar | mobile/BottomSheet.tsx |
| **MapLibreGLMap** | Map rendering, GeoJSON layers, zoom controls | MapInstanceContext, RoutingContext | MapLibreGLMap.tsx |
| **TravelModeSelect** | Mode tabs (drive/bike/walk) | RoutingContext.setMode | controls/TravelModeSelect.tsx |
| **Search** | Address autocomplete with Geosupport API | RoutingContext.setAddress | controls/Search.tsx |
| **RouteList** | Turn-by-turn directions list | RoutingContext.route, selectedStreet | controls/RouteList.tsx |
| **RouteSummaryCard** | Route metadata (distance, time, arrival) | RoutingContext.route, mode, useTraffic | controls/RouteSummaryCard.tsx |

### Data Flow

**Route Calculation Flow:**
```
User Input (Search)
    ↓
RoutingContext.setAddress()
    ↓
ButtonControls.fetchRoute() (auto-triggers on mode/traffic change)
    ↓
useRouteFetch hook → API /route endpoint
    ↓
RoutingContext.setRoute()
    ↓
MapLibreGLMap (GeoJSON layers) + RouteList (directions)
```

**Responsive Layout Flow:**
```
Window Resize Event
    ↓
useResponsive() hook (MUI breakpoints)
    ↓
AdaptiveLayout determines layout:
  • isMobile → BottomSheet + Full Map
  • isTablet → 340px Sidebar + Map
  • isDesktop → 400px Sidebar + Map
```

**Map Interaction Flow:**
```
Route Selected
    ↓
RoutingContext.route features
    ↓
useGeoJsonLayer hook (custom)
    ↓
MapLibre GL addLayer/setData
    ↓
Auto-zoom to extent (useMapZoom hook)
```

## Recommended Theme Architecture

### Design Token Hierarchy

MUI 7 theme structure (centralized in `theme.ts`):

```
Theme
├── Palette (Colors)
│   ├── primary (brand)
│   ├── secondary (accent)
│   ├── error/warning/info/success (status)
│   ├── background (paper, default)
│   ├── text (primary, secondary, disabled)
│   └── action (hover, selected, disabled)
├── Typography
│   ├── fontFamily
│   ├── fontSize (base: 16px to prevent iOS zoom)
│   └── variants (h1-h6, body1/body2, caption, button)
├── Spacing
│   ├── Base unit (8px default)
│   └── spacing(n) function returns n*8px
├── Breakpoints
│   ├── xs: 0 (mobile)
│   ├── sm: 600 (tablet portrait)
│   ├── md: 905 (tablet landscape)
│   ├── lg: 1240 (desktop)
│   └── xl: 1440 (large desktop)
├── Shape
│   └── borderRadius (4px default)
├── Components (styleOverrides)
│   ├── MuiButton
│   ├── MuiCard
│   ├── MuiList
│   └── [other components]
└── Custom Extensions
    └── map (startPoint, endPoint, route colors)
```

### Theme Layers (Build Order)

**1. Foundation Layer** (theme tokens)
- Palette: transit-inspired colors (NYC subway palette, high-contrast)
- Typography: compact scale with improved readability
- Spacing: tighter spacing for dense layouts
- Shape: consistent border radius (8-12px for transit aesthetic)

**2. Component Override Layer** (global styles)
- Card: compact padding, consistent shadows, subtle borders
- List: dense variant with improved touch targets
- Tabs: compact mode selector (current TravelModeSelect pattern)
- Button: minimum 44px touch target (current WCAG compliance)
- Paper: consistent elevation system

**3. Responsive Layer** (breakpoint-specific overrides)
- Mobile: 100% width components, bottom sheet patterns
- Tablet: 340px sidebar, collapsible controls
- Desktop: 400px sidebar, expanded controls

**4. Custom Component Layer** (app-specific)
- RouteSummaryCard: prominent route metadata
- TurnIcon: direction indicators
- MapControls: overlay positioning

## Transit-Inspired Theme Architecture

### Color Palette Strategy

Based on NYC MTA visual language:

```typescript
const transitTheme = createTheme({
  palette: {
    primary: {
      main: '#0039A6',      // MTA Blue (subway routes)
      light: '#4A7FC1',
      dark: '#002870',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#FCCC0A',      // Yellow (warning/caution)
      light: '#FFE566',
      dark: '#C7A000',
      contrastText: '#000000',
    },
    background: {
      default: '#F5F5F5',   // Light gray (station tile)
      paper: '#FFFFFF',
    },
    success: {
      main: '#00933C',      // Green (4,5,6 lines)
    },
    error: {
      main: '#EE352E',      // Red (1,2,3 lines)
    },
    info: {
      main: '#0039A6',      // Blue
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.60)',
    },
  },
});
```

### Component-Specific Overrides

**Card Components (Route Cards, Summary):**
```typescript
components: {
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        borderLeft: '4px solid',  // Accent stripe (current pattern)
        padding: theme.spacing(2),
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    },
  },
}
```

**List Components (Turn-by-Turn Directions):**
```typescript
MuiList: {
  defaultProps: {
    dense: true,  // Compact layout
  },
  styleOverrides: {
    root: {
      padding: 0,
    },
  },
},
MuiListItemButton: {
  styleOverrides: {
    root: {
      minHeight: 56,  // Larger than default for touch
      paddingLeft: theme.spacing(2),
      '&:hover': {
        backgroundColor: 'rgba(0, 57, 166, 0.04)',
      },
    },
  },
},
```

**Tab Components (Mode Selector):**
```typescript
MuiTabs: {
  styleOverrides: {
    root: {
      minHeight: 64,
      borderBottom: '2px solid',
      borderColor: theme.palette.divider,
    },
    indicator: {
      height: 4,  // Prominent selection indicator
      backgroundColor: theme.palette.primary.main,
    },
  },
},
MuiTab: {
  styleOverrides: {
    root: {
      minHeight: 64,
      fontWeight: 600,
      textTransform: 'uppercase',
      fontSize: '0.875rem',
      letterSpacing: '0.5px',
    },
  },
},
```

## Responsive Layout Patterns

### Breakpoint Strategy

Current breakpoints (maintain for compatibility):
- **xs: 0-599px** → Mobile (BottomSheet)
- **sm: 600-904px** → Tablet (340px sidebar)
- **md: 905px+** → Desktop (400px sidebar)

### Adaptive Layout Pattern

**Current Implementation (keep):**
```tsx
// AdaptiveLayout.tsx pattern
const { isMobile, isTabletOrBelow } = useResponsive();

if (isMobile) {
  return <BottomSheet>{controls}</BottomSheet> + <Map fullscreen />;
}

return (
  <Sidebar width={isTabletOrBelow ? 340 : 400}>
    {controls}
  </Sidebar>
  + <Map />
);
```

**Theme-level responsive overrides:**
```typescript
components: {
  MuiCard: {
    styleOverrides: {
      root: {
        padding: theme.spacing(2),
        [theme.breakpoints.down('sm')]: {
          padding: theme.spacing(1.5),  // Tighter on mobile
          borderRadius: 8,
        },
      },
    },
  },
  MuiTypography: {
    styleOverrides: {
      h6: {
        fontSize: '1.125rem',
        [theme.breakpoints.down('sm')]: {
          fontSize: '1rem',  // Smaller headings on mobile
        },
      },
    },
  },
}
```

### Bottom Sheet Integration

**Current snap points (maintain):**
- 40% → Route summary (RouteSummaryCard)
- 60% → Turn-by-turn (RouteList)
- 90% → Full controls (Search + all controls)

**Theme consideration:** Bottom sheet content should use same components as sidebar, but with responsive padding/sizing via breakpoints.

## Build Order Recommendations

### Phase 1: Theme Foundation (Start Here)
**Why first:** Establishes visual language, prevents rework
**Components:** None yet, just tokens
**Tasks:**
1. Define transit-inspired palette in `theme.ts`
2. Set typography scale (compact, readable)
3. Configure spacing system (8px base)
4. Define shape (borderRadius: 12px)
5. Extend theme interface for custom tokens (e.g., map colors)

**Output:** New `theme.ts` with full token system

### Phase 2: Component Overrides (Second)
**Why second:** Applies theme tokens globally to all MUI components
**Dependencies:** Phase 1 tokens
**Tasks:**
1. MuiCard overrides (border-left accent, shadows, padding)
2. MuiList/MuiListItem overrides (dense, hover states)
3. MuiTabs/MuiTab overrides (mode selector styling)
4. MuiButton overrides (maintain 44px touch target)
5. Typography variants (h6 for card headers, body2 for metadata)

**Output:** Updated `theme.ts` with `components.styleOverrides`

### Phase 3: Responsive Refinements (Third)
**Why third:** Builds on theme tokens, applies breakpoint logic
**Dependencies:** Phase 1 + 2
**Tasks:**
1. Breakpoint-specific component overrides (spacing, sizing)
2. AdaptiveLayout review (ensure breakpoints align with theme)
3. useResponsive hook consistency check
4. Mobile-specific overrides (bottom sheet content)

**Output:** Responsive overrides in `theme.ts`, potential AdaptiveLayout tweaks

### Phase 4: Custom Components (Fourth)
**Why last:** Depends on theme foundation being stable
**Dependencies:** Phase 1-3
**Tasks:**
1. Update RouteSummaryCard with new theme tokens
2. Update RouteList with new list styles
3. Update TravelModeSelect with new tab styles
4. Create new components if needed (route cards, transit-style badges)

**Output:** Updated component files using new theme

### Alternative: Incremental Approach

If full redesign is too risky, build incrementally:
1. **Theme tokens only** → Deploy, test in production
2. **Card overrides** → Deploy, test RouteSummaryCard changes
3. **List overrides** → Deploy, test RouteList changes
4. **Tab overrides** → Deploy, test mode selector
5. **Responsive** → Deploy, test on real devices

## Architectural Patterns

### Pattern 1: Centralized Theming (Global Overrides)

**What:** Define all visual styling in a single theme file via `createTheme()` and `styleOverrides`
**When to use:** Comprehensive redesign where consistency matters
**Trade-offs:**
- ✅ Single source of truth, easy to maintain
- ✅ Automatic propagation to all components
- ✅ No component-level duplication
- ❌ Less flexibility for one-off component variations
- ❌ Large theme file can become complex

**Example:**
```typescript
// theme.ts
const theme = createTheme({
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});
```

### Pattern 2: Component Wrapping (Scoped Design System)

**What:** Create wrapped versions of MUI components with custom styles
**When to use:** Need component-specific variations or future design system library
**Trade-offs:**
- ✅ Full control over component API
- ✅ Easy to create design system package
- ✅ Better for component variations
- ❌ More files to maintain
- ❌ Must manually wrap every component

**Example:**
```typescript
// components/design-system/TransitCard.tsx
export const TransitCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  borderLeft: `4px solid ${theme.palette.primary.main}`,
}));
```

**Recommendation:** Use **Pattern 1 (Global Overrides)** for this redesign. NYC Open Routing has a small component set and needs consistency more than flexibility.

### Pattern 3: Responsive Container Queries (Future)

**What:** Use CSS container queries instead of viewport breakpoints
**When to use:** Components need to adapt based on parent width, not viewport
**Trade-offs:**
- ✅ More modular, component-based responsive design
- ✅ Sidebar resizing wouldn't trigger layout shifts
- ❌ Browser support still maturing (2026)
- ❌ MUI doesn't have first-class support yet

**Note:** MUI 7 uses viewport breakpoints. Stick with current approach.

## Integration with MapLibre GL

### Map-UI Coordination

**Current pattern (maintain):**
- Map instance stored in MapInstanceContext
- GeoJSON layers managed by useGeoJsonLayer hook
- Zoom controlled by useMapZoom hook
- UI overlays positioned with CSS (MapControls, ZoomToRouteButton)

**Theme integration points:**
- Map colors should reference theme.map tokens (startPoint, endPoint, route)
- Map control buttons should use MuiIconButton overrides
- Route line colors can adapt to theme palette (primary.main)

**Example theme extension:**
```typescript
// Extend theme for map colors
declare module '@mui/material/styles' {
  interface Theme {
    map: {
      startPoint: { color: string };
      endPoint: { color: string };
      route: { color: string; width: number };
    };
  }
}

const theme = createTheme({
  map: {
    startPoint: { color: theme.palette.success.main },  // Green
    endPoint: { color: theme.palette.error.main },      // Red
    route: { color: theme.palette.primary.main, width: 5 },
  },
});
```

### Overlay Component Positioning

**Current CSS pattern (inline styles in MapLibreGLMap.tsx):**
```typescript
const styles: React.CSSProperties = {
  height: "100vh",
  flex: 1,
};
```

**Recommended: Theme-based positioning:**
```typescript
// In theme.ts
components: {
  // Custom map overlay component
  MuiBox: {
    variants: [
      {
        props: { className: 'map-overlay' },
        style: {
          position: 'absolute',
          top: theme.spacing(2),
          right: theme.spacing(2),
          zIndex: 1000,
        },
      },
    ],
  },
}
```

## Component Structure Recommendations

### Sidebar Redesign

**Current structure (Sidebar.tsx):**
```
Sidebar (400px)
  ├── TitleBar (AppBar)
  ├── ControlsContainer
  │   ├── TravelModeSelect (Tabs)
  │   ├── TrafficToggle
  │   ├── FerryToggle
  │   └── Children:
  │       ├── Search (Start)
  │       ├── SwapButton
  │       ├── Search (End)
  │       ├── ButtonControls (Get Directions, Clear, Share)
  │       └── RouteList (RouteSummaryCard + turn-by-turn)
  └── Message (toast)
```

**Recommended: Maintain structure, apply theme:**
- TitleBar: Use theme.palette.primary for AppBar
- Search cards: Apply MuiCard overrides (border-left accent)
- Mode tabs: Apply MuiTabs overrides (prominent indicator)
- Route cards: Apply transit-inspired styling

**New component boundaries:**
```
Sidebar
  ├── TitleBar (themed AppBar)
  ├── ModeSelector (themed Tabs) ← rename TravelModeSelect
  ├── OptionsPanel (Traffic/Ferry toggles) ← group toggles
  ├── SearchPanel (Start/End + Swap) ← Card with border-left
  ├── ActionPanel (Buttons) ← Card or ButtonGroup
  └── RoutePanel (Summary + Directions) ← Card with sections
```

### Route Card Component

**Current: RouteSummaryCard.tsx**
- Displays distance, time, arrival
- Mode icon + label
- Traffic chip (conditional)

**Redesign with transit aesthetic:**
```tsx
<Card
  sx={{
    borderLeft: 4,
    borderColor: 'primary.main',  // Transit accent stripe
    borderRadius: 3,  // 12px
    boxShadow: 2,
  }}
>
  <CardContent sx={{ p: 2 }}>  {/* Compact padding */}
    {/* Mode badge (circle icon like subway bullets) */}
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
        <DirectionsCar />
      </Avatar>
      <Typography variant="h6" fontWeight={600}>
        Driving Route
      </Typography>
      {useTraffic && <Chip label="Live Traffic" size="small" />}
    </Box>

    {/* Stats grid (2 columns) */}
    <Grid container spacing={2} sx={{ mt: 2 }}>
      <Grid item xs={6}>
        <Stack>
          <Typography variant="caption" color="text.secondary">
            Distance
          </Typography>
          <Typography variant="h5" fontWeight={600}>
            {distance}
          </Typography>
        </Stack>
      </Grid>
      <Grid item xs={6}>
        <Stack>
          <Typography variant="caption" color="text.secondary">
            Duration
          </Typography>
          <Typography variant="h5" fontWeight={600}>
            {duration}
          </Typography>
        </Stack>
      </Grid>
    </Grid>

    {/* Arrival */}
    <Divider sx={{ my: 2 }} />
    <Typography variant="body2" color="text.secondary">
      Arrive by <strong>{arrivalTime}</strong>
    </Typography>
  </CardContent>
</Card>
```

### Directions List Component

**Current: RouteList.tsx**
- List with ListItemButton per turn
- TurnIcon + street name + distance
- Dividers between items

**Redesign with compact transit aesthetic:**
```tsx
<List dense disablePadding>
  <ListSubheader sx={{ bgcolor: 'background.paper', fontWeight: 600 }}>
    Turn-by-Turn Directions
  </ListSubheader>
  {features.map((street, idx) => (
    <ListItemButton
      key={idx}
      sx={{
        minHeight: 56,
        px: 2,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {/* Step number badge (like transit stops) */}
      <Avatar
        sx={{
          width: 32,
          height: 32,
          bgcolor: 'primary.main',
          fontSize: '0.875rem',
          mr: 2,
        }}
      >
        {idx + 1}
      </Avatar>

      {/* Turn instruction */}
      <ListItemText
        primary={street.turn_instruction}
        secondary={formatDistance(street.distance)}
        primaryTypographyProps={{ fontWeight: 500 }}
        secondaryTypographyProps={{ variant: 'caption' }}
      />

      {/* Turn icon */}
      <TurnIcon type={street.turn_type} color="action" />
    </ListItemButton>
  ))}
</List>
```

## Scalability Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current architecture sufficient. Single theme file, Context API state management, no performance issues. |
| 1k-10k users | Consider code splitting theme by route (lazy load theme modules). MapLibre GL already GPU-accelerated, no changes needed. |
| 10k+ users | If theme becomes complex (>500 lines), split into modules (`theme/palette.ts`, `theme/components.ts`, `theme/typography.ts`). Consider theme caching in localStorage. |

**Current bottleneck:** None. Theme performance is negligible compared to map rendering.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Inline Styles Everywhere

**What people do:** Use `sx` prop or inline styles for all styling instead of theme overrides
**Why it's wrong:** Duplicates styles across components, no single source of truth, harder to maintain
**Do this instead:** Define common patterns in theme `components.styleOverrides`, use `sx` only for one-off exceptions

**Bad:**
```tsx
<Card sx={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
<Card sx={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
<Card sx={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
```

**Good:**
```tsx
// theme.ts
components: {
  MuiCard: {
    styleOverrides: {
      root: { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
    },
  },
}

// Component
<Card>  {/* Automatically styled */}
```

### Anti-Pattern 2: Viewport Breakpoints in Component Logic

**What people do:** Hardcode pixel values in component logic instead of using theme breakpoints
**Why it's wrong:** Breakpoints become out of sync, responsive behavior inconsistent
**Do this instead:** Use `useResponsive()` hook or `theme.breakpoints` in `sx` prop

**Bad:**
```tsx
const isMobile = window.innerWidth < 600;  // Magic number!
```

**Good:**
```tsx
const { isMobile } = useResponsive();  // Uses theme breakpoints
```

### Anti-Pattern 3: Mixing Theme Systems

**What people do:** Use both MUI theme AND separate CSS/SCSS files for styling
**Why it's wrong:** Inconsistent design tokens, colors/spacing out of sync
**Do this instead:** All styling through MUI theme system (via `sx`, `styled`, or `styleOverrides`)

**Bad:**
```css
/* styles.css */
.my-card {
  border-radius: 12px;  /* Not from theme! */
  padding: 16px;        /* Not from theme.spacing()! */
}
```

**Good:**
```tsx
<Card sx={{ borderRadius: 3, p: 2 }}>  {/* Uses theme tokens */}
```

### Anti-Pattern 4: Overriding Accessibility Features

**What people do:** Remove focus indicators or reduce touch target sizes for aesthetics
**Why it's wrong:** Breaks accessibility, current app has WCAG-compliant 44px touch targets
**Do this instead:** Maintain `minHeight: 44px` on buttons/tabs, keep focus indicators (already in current theme)

**Current (good):**
```typescript
// theme.ts
MuiButton: {
  styleOverrides: {
    root: {
      minHeight: 44,  // WCAG minimum
      '&:focus-visible': {
        outline: '3px solid',
        outlineColor: theme.palette.primary.main,
      },
    },
  },
}
```

## Sources

### High Confidence (Context7 + Official Docs)

**MUI 7 Theme Architecture:**
- [MUI Material UI v7.3.2 - Component Style Overrides](https://github.com/mui/material-ui/blob/v7.3.2/docs/data/material/customization/css-layers/css-layers.md)
- [MUI Material UI v7.3.2 - Breakpoints](https://github.com/mui/material-ui/blob/v7.3.2/docs/data/material/customization/breakpoints/breakpoints.md)
- [MUI Material UI v7.3.2 - Spacing System](https://github.com/mui/material-ui/blob/v7.3.2/packages/mui-codemod/README.md)
- [Creating a MUI Design System: Wrapping vs. Global Overrides](https://blog.bitsrc.io/creating-a-mui-design-system-wrapping-vs-global-overrides-31800117dbd7)
- [Advanced Guide to Building a Fully Customizable Design System with Material-UI](https://medium.com/@theNewGenCoder/advanced-guide-to-building-a-fully-customizable-design-system-with-material-ui-mui-335f850d79b9)

**Transit UI Patterns:**
- [Transportation App UI/UX Design Best Practices](https://fuselabcreative.com/transportation-app-ui-ux-design-best-practices/)
- [Best Mobile UX Design Practices for Public Transportation Apps](https://www.altexsoft.com/blog/best-mobile-user-experience-design-practices-for-public-transportation-apps/)
- [Transit Pass Mobile UI/UX Design](https://www.stxnext.com/blog/ui-ux-public-transportation-app)

**MapLibre GL:**
- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre React Integration Example](https://github.com/andyfrith/maplibre-reactjs)

### Medium Confidence (WebSearch Verified)

**2026 Design Trends:**
- [9 Mobile App Design Trends for 2026](https://uxpilot.ai/blogs/mobile-app-design-trends) - Adaptive UIs, context-aware patterns
- [10 Types of Web App Design Patterns for 2026](https://contentsquare.com/guides/web-app-design/patterns/) - Split-screen, card patterns
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) - Bottom sheet patterns

---

*Architecture research for: NYC Open Routing UI Redesign*
*Researched: 2026-02-12*
*Confidence: HIGH*
