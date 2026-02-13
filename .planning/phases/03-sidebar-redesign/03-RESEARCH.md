# Phase 3: Sidebar Redesign - Research

**Researched:** 2026-02-12
**Domain:** MUI v7 component styling, compact sidebar layout, transit-inspired UI patterns
**Confidence:** HIGH

## Summary

Phase 3 transforms the existing sidebar from a vertically-spread layout into a compact, transit-inspired panel. The current sidebar stacks six vertical sections (TitleBar ~48px, TravelModeSelect ~64px, TrafficToggle/FerryToggle ~40px each, padding ~32px, Search inputs + swap button ~200px, ButtonControls ~60px) consuming roughly 450-500px before any route results appear. The goal is to reduce this by consolidating the travel mode selector, compacting search inputs, and integrating toggles inline -- all while preserving the 44px touch targets and MTA color identity established in Phase 1.

The redesign uses exclusively MUI v7 components already in the project (ToggleButtonGroup replaces Tabs for travel mode, TextField size="small" for compact search, inline Switch chips for toggles). No new dependencies are needed. The map controls (MapControls.tsx, ZoomToRouteButton.tsx) receive transit-themed styling via `sx` overrides using existing theme tokens.

**Primary recommendation:** Restructure ControlsContainer.tsx and Sidebar.tsx to flatten the vertical hierarchy -- replace the AppBar+Tabs travel mode selector with a compact ToggleButtonGroup, move toggles inline with the mode selector, use size="small" TextFields, and tighten all spacing using the existing 6px base.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mui/material | ^7.0.1 | All UI components | Already installed, provides ToggleButtonGroup, TextField, Switch, Fab, IconButton |
| @mui/icons-material | ^7.0.1 | Mode icons, control icons | Already installed, provides DirectionsCar/Bike/Walk, Traffic, Boat, Add/Remove, MyLocation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @emotion/styled | ^11.14.0 | styled() API for complex component customization | When sx prop becomes unwieldy (e.g., StyledToggleButtonGroup with class selectors) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ToggleButtonGroup (for mode selector) | Tabs (current) | ToggleButtonGroup is more compact (~44px vs ~64px), better for icon+label in a row, visually integrates as a "pill" selector. Tabs feel more like navigation. ToggleButtonGroup is the right semantic choice for exclusive mode selection. |
| TextField size="small" | Custom InputBase | size="small" is simpler and sufficient. Custom InputBase only needed if radical layout changes are required, which they are not. |
| Inline Switch toggles | Chip with onClick | Switch is more semantically correct for boolean toggles. Chip could work but confuses "filter" vs "toggle" semantics. |

**Installation:**
No new packages needed. All components are available in the existing @mui/material and @mui/icons-material packages.

## Architecture Patterns

### Current Component Hierarchy (Before)
```
Sidebar.tsx
  ControlsContainer.tsx (wrapper)
    Paper (full height)
      TitleBar                    ~48px  (AppBar + dense Toolbar)
      TravelModeSelect            ~64px  (AppBar + fullWidth Tabs with icons+labels)
      TrafficToggle               ~40px  (conditional, drive only)
      FerryToggle                 ~40px  (conditional, bike/walk only)
      Box (padding: 2 = 12px)
        children:
          Stack spacing={2}
            Card (boxShadow:1)
              Box (p:2 = 12px)
                Stack spacing={1}
                  Search "Start"    ~56px (outlined TextField)
                  SwapButton        ~44px (centered IconButton)
                  Search "End"      ~56px (outlined TextField)
            ButtonControls          ~44px (Get Directions + Clear + Share)
            RouteList               (variable)
  Message
```

### Target Component Hierarchy (After)
```
Sidebar.tsx
  ControlsContainer.tsx (wrapper, restructured)
    Paper (full height)
      TitleBar                    ~40px  (compact, reduced padding)
      Box (compact controls area)
        TravelModeSelect          ~44px  (ToggleButtonGroup, horizontal)
        OptionsRow                ~32px  (inline: traffic switch OR ferry switch)
      Box (search + actions area, padding tightened)
        Search "Start"            ~40px  (size="small" TextField)
        SwapButton                ~32px  (smaller, inline)
        Search "End"              ~40px  (size="small" TextField)
        ButtonControls            ~44px  (Get Directions + Clear + Share)
      RouteList                   (variable, scrollable)
  Message
```

### Pattern 1: ToggleButtonGroup for Travel Mode
**What:** Replace AppBar+Tabs with a compact ToggleButtonGroup
**When to use:** Exclusive single-selection between 3 travel modes
**Key details:**
- Use `exclusive` prop for single selection
- Use `size="small"` for compact height
- Apply `fullWidth` via sx styling (flexGrow on children)
- Apply mode-specific color on selected button using MODE_COLORS from theme.ts
- Maintain 44px minHeight on each ToggleButton for touch targets
```typescript
// Source: Context7 MUI ToggleButtonGroup docs + codebase analysis
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import ToggleButton from "@mui/material/ToggleButton"
import { MODE_COLORS } from "../../utils/theme"

<ToggleButtonGroup
  value={mode}
  exclusive
  onChange={(_, newMode) => newMode && setMode(newMode)}
  aria-label="Travel mode"
  fullWidth
  size="small"
  sx={{ minHeight: 44 }}
>
  <ToggleButton value="drive" aria-label="Driving directions" sx={{ minHeight: 44 }}>
    <DirectionsCar sx={{ mr: 0.5 }} fontSize="small" />
    Drive
  </ToggleButton>
  {/* ... bike, walk */}
</ToggleButtonGroup>
```

### Pattern 2: Compact TextField with size="small"
**What:** Use MUI's built-in size="small" prop to reduce input height
**When to use:** Search inputs where vertical space is premium
**Key details:**
- `size="small"` reduces outlined TextField from ~56px to ~40px
- MUST keep `fontSize: 16` on the `<input>` element to prevent iOS zoom (existing theme override handles this)
- Bold label styling via `InputLabelProps` sx
- MTA Blue focus color via existing primary theme
```typescript
// Source: Context7 MUI TextField docs
<TextField
  fullWidth
  size="small"
  label={type === "Start" ? "From" : "To"}
  // ... existing props preserved
/>
```

### Pattern 3: Inline Toggle Row
**What:** Combine TrafficToggle and FerryToggle into a compact inline row
**When to use:** When toggles should not take full-width separate rows
**Key details:**
- Use a single Box with flexbox row layout
- Compact Switch with icon + label inline
- Only one toggle visible at a time (traffic for drive, ferry for bike/walk)
- Keep the toggle below the mode selector, not in the search card
```typescript
<Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.5 }}>
  <Switch size="small" checked={useTraffic} onChange={...} />
  <TrafficIcon fontSize="small" sx={{ color: "primary.main" }} />
  <Typography variant="caption" fontWeight={500}>Traffic</Typography>
</Box>
```

### Pattern 4: Transit-Themed Map Controls
**What:** Style Fab buttons to match MTA transit identity
**When to use:** Zoom controls and geolocation button overlaid on map
**Key details:**
- Use theme primary color for active/hover states
- White background with MTA Blue icon on default state
- Consistent border-radius from theme (6px)
- Keep existing absolute positioning and z-index from Phase 2
```typescript
<Fab
  size="small"
  onClick={handleZoomIn}
  aria-label="Zoom in"
  sx={{
    bgcolor: "background.paper",
    color: "primary.main",
    boxShadow: 2,
    borderRadius: theme => theme.shape.borderRadius + "px",
    "&:hover": { bgcolor: "primary.main", color: "primary.contrastText" },
    minWidth: 44,
    minHeight: 44,
  }}
>
```

### Anti-Patterns to Avoid
- **Removing TitleBar entirely:** The title bar provides app identity and houses the info modal. Compact it, don't remove it. Reduce padding from 16px to 8-12px.
- **Using Tabs when ToggleButtonGroup exists:** Tabs suggest page navigation, not mode selection. ToggleButtonGroup is the correct MUI semantic for exclusive choice within a single view.
- **Custom CSS for TextField height reduction:** Use MUI's `size="small"` prop, not manual padding/height hacks. The theme already has a fontSize:16 override for inputs.
- **Breaking the existing Search test:** The Search.test.tsx tests for `getByPlaceholderText("Enter NYC address")`. The placeholder text is actually set via `placeholder="e.g., 350 5th Ave, Manhattan or 260 Broadway"` in Search.tsx and the test expects `"Enter NYC address"`. This test is already inconsistent -- the placeholder was changed but the test was not updated. Any changes to label or placeholder text must update the test.
- **Moving MapControls into the sidebar:** MapControls (zoom buttons) are positioned absolutely over the map in MapLibreGLMap.tsx. They must stay there. Only their visual styling changes, not their location in the component tree.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compact input fields | Manual padding/margin hacks | `TextField size="small"` | MUI handles all internal spacing, label positioning, and focus states automatically |
| Exclusive button group | Custom radio-like buttons | `ToggleButtonGroup exclusive` | Built-in keyboard navigation, ARIA roles, selection state management |
| Boolean toggles | Checkbox with custom styling | `Switch size="small"` | Platform-native toggle semantics, accessibility built-in |
| Touch target compliance | Manually adding padding to every button | Theme-level `MuiIconButton` and `MuiToggleButton` styleOverrides | Single source of truth for minHeight/minWidth 44px |

**Key insight:** MUI v7 provides size variants ("small", "medium") on nearly every component. Use them instead of manually adjusting padding, margin, and height. The theme's spacing(6) base already provides tighter-than-default layout.

## Common Pitfalls

### Pitfall 1: iOS Zoom on Small Inputs
**What goes wrong:** Using `size="small"` on TextField reduces internal input font size below 16px, triggering iOS Safari auto-zoom on focus.
**Why it happens:** iOS Safari zooms any input with font-size < 16px when focused.
**How to avoid:** The existing theme override in `theme.ts` line 181 (`MuiTextField.styleOverrides.root: { "& input": { fontSize: 16 } }`) already prevents this. Verify this override still applies after changes. Do NOT add a competing fontSize to individual TextField sx props.
**Warning signs:** Test on iOS or simulator. If the page zooms when tapping a search input, the fontSize override was lost.

### Pitfall 2: ToggleButtonGroup onChange Returns null on Deselect
**What goes wrong:** When `exclusive` is true and user clicks the already-selected button, onChange fires with `newValue = null`.
**Why it happens:** MUI ToggleButtonGroup allows deselection by default.
**How to avoid:** Guard the onChange handler: `onChange={(_, val) => val && setMode(val)}`. The `val &&` check prevents deselection.
**Warning signs:** Travel mode becomes "none" / undefined after clicking the active mode button.

### Pitfall 3: Breaking Existing Search Test
**What goes wrong:** Search.test.tsx queries for a placeholder text that doesn't match the actual component.
**Why it happens:** The test was written with an old placeholder ("Enter NYC address") but Search.tsx uses a different placeholder string.
**How to avoid:** When modifying Search.tsx, also update Search.test.tsx to match the actual label/placeholder text. Use `getByLabelText` instead of `getByPlaceholderText` for more resilient tests.
**Warning signs:** Test failure after label text changes.

### Pitfall 4: Swap Button Losing Vertical Centering
**What goes wrong:** The swap button (SwapVert icon) between search inputs becomes misaligned after changing TextField sizes or spacing.
**Why it happens:** The swap button uses `display: "flex", justifyContent: "center"` but its parent Stack spacing changes.
**How to avoid:** Keep the swap button as a sibling of the two Search components in the same Stack. Reduce its size and padding but don't change the flex layout pattern.
**Warning signs:** Swap button appears pushed to one side or overlaps an input.

### Pitfall 5: Toggle Visibility Based on Mode
**What goes wrong:** Both TrafficToggle and FerryToggle rendering simultaneously or neither rendering.
**Why it happens:** Current toggles use `if (mode !== "drive") return null` and `if (mode === "drive") return null` respectively. If refactored into a single OptionsRow component, the conditional logic must be preserved.
**How to avoid:** Keep the mode-conditional logic. If consolidating into one component, use a ternary: `mode === "drive" ? <TrafficSwitch /> : <FerrySwitch />`.
**Warning signs:** Both toggle switches visible at the same time, or no toggle visible for any mode.

## Code Examples

### Example 1: Compact TravelModeSelect with ToggleButtonGroup
```typescript
// Replaces current AppBar+Tabs pattern (TravelModeSelect.tsx)
import React, { useContext } from "react"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import ToggleButton from "@mui/material/ToggleButton"
import { DirectionsBike, DirectionsCar, DirectionsWalk } from "@mui/icons-material"
import { RoutingContext, TravelMode } from "../../contexts/RoutingContext"

export const TravelModeSelect: React.FC = () => {
  const { mode, setMode } = useContext(RoutingContext)

  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      onChange={(_, newMode: TravelMode | null) => newMode && setMode(newMode)}
      aria-label="Travel mode"
      fullWidth
      size="small"
    >
      <ToggleButton value="drive" aria-label="Driving directions" sx={{ minHeight: 44, gap: 0.5 }}>
        <DirectionsCar fontSize="small" />
        Drive
      </ToggleButton>
      <ToggleButton value="bike" aria-label="Biking directions" sx={{ minHeight: 44, gap: 0.5 }}>
        <DirectionsBike fontSize="small" />
        Bike
      </ToggleButton>
      <ToggleButton value="walk" aria-label="Walking directions" sx={{ minHeight: 44, gap: 0.5 }}>
        <DirectionsWalk fontSize="small" />
        Walk
      </ToggleButton>
    </ToggleButtonGroup>
  )
}
```

### Example 2: Compact Search with size="small" and Short Labels
```typescript
// Key changes to Search.tsx
<TextField
  fullWidth
  size="small"
  label={type === "Start" ? "From" : "To"}
  placeholder="e.g., 350 5th Ave, Manhattan"
  // ... all other props unchanged
/>
```

### Example 3: Inline Options Row (Traffic / Ferry Toggle)
```typescript
// New compact inline pattern for toggles
// Replaces separate TrafficToggle.tsx and FerryToggle.tsx sections
import { Switch, Box, Typography, Tooltip } from "@mui/material"
import TrafficIcon from "@mui/icons-material/Traffic"
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat"

// Inside ControlsContainer or a new OptionsRow component:
{mode === "drive" ? (
  <Tooltip title="Include traffic conditions in route calculation">
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 2, py: 0.5 }}>
      <Switch size="small" checked={useTraffic} onChange={e => setUseTraffic(e.target.checked)} />
      <TrafficIcon fontSize="small" sx={{ color: "primary.main" }} />
      <Typography variant="caption" fontWeight={500}>Traffic</Typography>
    </Box>
  </Tooltip>
) : (
  <Tooltip title="Exclude ferry crossings from route">
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 2, py: 0.5 }}>
      <Switch size="small" checked={avoidFerries} onChange={e => setAvoidFerries(e.target.checked)} />
      <DirectionsBoatIcon fontSize="small" sx={{ color: "primary.main" }} />
      <Typography variant="caption" fontWeight={500}>Avoid ferries</Typography>
    </Box>
  </Tooltip>
)}
```

### Example 4: Transit-Themed Zoom Controls
```typescript
// MapControls.tsx updated styling
<Fab
  size="small"
  onClick={handleZoomIn}
  aria-label="Zoom in"
  sx={{
    bgcolor: "background.paper",
    color: "primary.main",
    boxShadow: 2,
    border: "1px solid",
    borderColor: "divider",
    "&:hover": {
      bgcolor: "primary.main",
      color: "primary.contrastText",
    },
    minWidth: 44,
    minHeight: 44,
  }}
>
  <Add />
</Fab>
```

## Vertical Space Analysis

### Current Layout (estimated px from top of sidebar)
| Section | Height | Running Total |
|---------|--------|---------------|
| TitleBar (AppBar + dense Toolbar) | ~48px | 48px |
| TravelModeSelect (AppBar + Tabs, icon+label) | ~64px | 112px |
| TrafficToggle / FerryToggle (Switch row) | ~40px | 152px |
| Container padding top (p:2 = 12px) | 12px | 164px |
| Card padding top (p:2 = 12px) | 12px | 176px |
| Search "Start" (outlined TextField) | ~56px | 232px |
| Stack spacing (spacing:1 = 6px) | 6px | 238px |
| SwapButton row (44px button + centering) | ~44px | 282px |
| Stack spacing (spacing:1 = 6px) | 6px | 288px |
| Search "End" (outlined TextField) | ~56px | 344px |
| Card padding bottom | 12px | 356px |
| Stack spacing (spacing:2 = 12px) | 12px | 368px |
| ButtonControls row | ~44px | 412px |
| Container padding bottom | 12px | 424px |
| **Total before RouteList** | | **~424px** |

### Target Layout (estimated px)
| Section | Height | Running Total | Savings |
|---------|--------|---------------|---------|
| TitleBar (compact, reduced padding) | ~40px | 40px | -8px |
| Mode selector + toggle row | ~44px + ~28px | 112px | -40px |
| Container padding | 6px | 118px | -6px |
| Search "From" (size="small") | ~40px | 158px | -16px |
| Compact swap button | ~28px | 186px | -22px |
| Search "To" (size="small") | ~40px | 226px | -16px |
| Spacing | 6px | 232px | -6px |
| ButtonControls | ~44px | 276px | 0px |
| Container padding bottom | 6px | 282px | -6px |
| **Total before RouteList** | | **~282px** | **~142px saved (~33%)** |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MUI v5 `components` / `componentsProps` | MUI v7 `slots` / `slotProps` | MUI v6+ | Use slotProps for customizing sub-elements of TextField, Drawer, etc. The codebase already uses `slotProps` in some places (RouteList.tsx L64) |
| Separate styled-components for each override | `sx` prop for one-off styles | Stable since MUI v5 | Use sx for component-level styling, theme overrides for global patterns |
| InputProps (capital P) | slotProps.input | MUI v7 | The current Search.tsx uses `InputProps` (deprecated alias). Should migrate to `slotProps.input` during this phase |

**Deprecated/outdated:**
- `InputProps` / `inputProps` on TextField: These still work in MUI v7 as aliases but are officially superseded by `slotProps.input` / `slotProps.htmlInput`. Migration is recommended but not blocking.

## Files to Modify

| File | Changes | Risk |
|------|---------|------|
| `client/src/components/controls/TravelModeSelect.tsx` | Replace AppBar+Tabs with ToggleButtonGroup. Remove AppBar import. | LOW -- self-contained component, clear API swap |
| `client/src/components/controls/TrafficToggle.tsx` | Compact to inline row, remove borderBottom, tighten padding | LOW -- simple styling change |
| `client/src/components/controls/FerryToggle.tsx` | Compact to inline row, remove borderBottom, tighten padding | LOW -- simple styling change |
| `client/src/components/ControlsContainer.tsx` | Restructure layout: remove TitleBar border-based separation, use tighter spacing, possibly combine toggle display logic | MEDIUM -- affects all sidebar content layout |
| `client/src/components/Sidebar.tsx` | Tighten Stack spacing, make Card more compact, reduce swap button size | LOW -- mostly spacing adjustments |
| `client/src/components/controls/Search.tsx` | Add `size="small"`, change label text ("From"/"To"), migrate InputProps to slotProps | MEDIUM -- must preserve all existing behavior (debounce, suggestions, geolocation, keyboard nav) |
| `client/src/components/controls/MapControls.tsx` | Update Fab styling to transit theme (MTA Blue hover, border) | LOW -- style-only change |
| `client/src/components/shared/TitleBar.tsx` | Compact padding, possibly reduce font size | LOW -- presentational change |
| `client/src/components/controls/Search.test.tsx` | Update placeholder/label text expectations to match new labels | LOW -- test maintenance |
| `client/src/utils/theme.ts` | Add MuiToggleButton/MuiToggleButtonGroup overrides for 44px touch targets and transit colors | LOW -- additive theme change |

## Open Questions

1. **Geolocation button placement in compact search**
   - What we know: Currently the geolocation "Use my location" button is an InputAdornment inside each TextField. With size="small", the input area is tighter.
   - What's unclear: Whether the adornment still fits comfortably at size="small" without clipping.
   - Recommendation: Keep the adornment but verify visually. If it clips, reduce icon to `fontSize="inherit"` instead of "small". The adornment is part of the 44px touch target requirement -- it must remain accessible.

2. **TitleBar necessity at all**
   - What we know: TitleBar houses the app name ("NYC Open Routing") and the InfoModal button. It consumes ~48px.
   - What's unclear: Whether the user wants to keep it, minimize it, or remove it entirely.
   - Recommendation: Keep it but compact to ~36-40px. The app name provides branding identity and the info button is necessary. Could reduce font size from 20px to 16px and toolbar padding.

3. **ToggleButtonGroup selected color per mode**
   - What we know: MODE_COLORS has drive=blue, bike=green, walk=orange. Currently Tabs use a single indicatorColor="primary" (blue).
   - What's unclear: Whether selected ToggleButton should change color based on mode (blue for drive, green for bike, orange for walk) or stay uniform MTA Blue.
   - Recommendation: Use mode-specific colors for the selected state background. This gives a strong visual signal of active mode and matches the route line color on the map. Can be done with conditional sx based on the `mode` value.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/mui_material-ui` - ToggleButtonGroup sizing, styling, exclusive selection; TextField size="small"; styled API customization
- Codebase analysis - All 10+ files read directly from the project source

### Secondary (MEDIUM confidence)
- MUI v7 migration notes (slotProps vs InputProps) - verified via Context7 and existing codebase usage in RouteList.tsx

### Tertiary (LOW confidence)
- None. All findings verified against codebase or Context7.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components already in project, API verified via Context7
- Architecture: HIGH - direct codebase analysis, clear component hierarchy mapping
- Pitfalls: HIGH - iOS zoom issue verified in existing theme code, ToggleButtonGroup null behavior documented in MUI docs
- Vertical space estimates: MEDIUM - calculated from MUI component defaults and theme spacing, not pixel-measured from running app

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (stable MUI v7, no breaking changes expected)
