# Phase 1: Design System Foundation - Research

**Researched:** 2026-02-12
**Domain:** MUI theming, typography, spacing, color palette design
**Confidence:** HIGH

## Summary

This phase replaces the existing MUI theme (`client/src/utils/theme.ts`) with an MTA transit-inspired design system. The current theme uses generic colors (`#556cd6` primary, `#19857b` secondary), no custom font, default MUI spacing (8px), and minimal component overrides (mostly WCAG touch targets). The codebase already has `cssVariables: true` enabled and extends the theme with custom `map` properties via TypeScript module augmentation -- both patterns to preserve and build on.

The critical finding is **accessibility contrast**. MTA Red (`#EE352E`) fails WCAG AA for white text (4.05:1 ratio), and MTA Orange (`#FF6319`) fails even more severely (2.98:1). These colors work as accent/decorative colors but cannot be used as button backgrounds with white text. MTA Blue (`#0039A6`) is excellent at 9.83:1. The mode color assignment (drive=blue, bike=green, walk=orange) also requires careful shade selection -- the bright MTA-line greens and oranges fail contrast on white backgrounds.

**Primary recommendation:** Build the theme as a single `createTheme()` call in `theme.ts` with all tokens (palette, typography, spacing, shape, component overrides, mode colors) in one file. Use `augmentColor` for custom palette entries. Install `@fontsource-variable/inter` for the font. Keep the existing `map` theme extension. Add a `modeColors` theme extension for travel mode accents.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mui/material` | ^7.0.1 | Component library + theming | Already in use; `createTheme` is the standard way to define design tokens |
| `@fontsource-variable/inter` | latest | Self-hosted Inter variable font | npm-based, no external requests, supports weight 100-900 as a single file, treeshakeable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@emotion/react` | ^11.14.0 | CSS-in-JS runtime | Already installed; powers MUI's `styled()` and `sx` |
| `@emotion/styled` | ^11.14.0 | Styled components API | Already installed; used by TitleBar, SkipLink |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@fontsource-variable/inter` | Google Fonts `<link>` | External dependency, FOUT risk, privacy concerns; npm package is standard for Vite apps |
| `@fontsource-variable/inter` | `@fontsource/inter` (static) | Static only loads discrete weights (400, 500, 600, 700); variable font is smaller total payload and supports any weight |

### Installation
```bash
cd client && npm install @fontsource-variable/inter
```

No other new dependencies are needed. Everything else is already in `package.json`.

## Architecture Patterns

### Recommended File Structure
```
client/src/
  utils/
    theme.ts          # Single source of truth: createTheme() with ALL tokens
    themeUtils.ts     # Keep existing utility styles (commonStyles, overlayPosition)
    style.ts          # Map layer paint styles -- references theme mode colors
```

### Pattern 1: Single Theme File with Module Augmentation
**What:** All design tokens defined in one `createTheme()` call with TypeScript module augmentation for custom properties.
**When to use:** Always. This is MUI's standard pattern.
**Example:**
```typescript
// Source: MUI docs + existing project pattern in theme.ts
import { createTheme } from "@mui/material/styles"
import "@fontsource-variable/inter"

// Module augmentation for custom theme properties
declare module "@mui/material/styles" {
  interface Theme {
    modeColors: {
      drive: string
      bike: string
      walk: string
    }
    map: { /* existing map properties */ }
  }
  interface ThemeOptions {
    modeColors?: {
      drive?: string
      bike?: string
      walk?: string
    }
    map?: { /* existing map properties */ }
  }
  // Enable custom palette entries on components
  interface Palette {
    accent: Palette["primary"]
  }
  interface PaletteOptions {
    accent?: PaletteOptions["primary"]
  }
}

const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: "#0039A6" },          // MTA Blue
    secondary: { main: "#EE352E" },        // MTA Red
    accent: { main: "#FF6319" },           // MTA Orange (custom palette entry)
    // ...
  },
  typography: {
    fontFamily: "'Inter Variable', sans-serif",
    // variant overrides...
  },
  spacing: 6,  // Compact: 6px base instead of default 8px
  shape: { borderRadius: 6 },
  components: { /* overrides */ },
  modeColors: {
    drive: "#0039A6",  // MTA Blue
    bike: "#087F23",   // Accessible dark green
    walk: "#E65100",   // Accessible dark orange
  },
  map: { /* existing map config */ },
})
```

### Pattern 2: Two-Pass Theme for augmentColor
**What:** Create theme in two passes to use `augmentColor` for generating light/dark/contrastText automatically.
**When to use:** When adding custom palette entries beyond primary/secondary/error.
**Example:**
```typescript
// Source: MUI official palette docs (github.com/mui/material-ui)
let theme = createTheme({
  // First pass: base palette + tonalOffset + contrastThreshold
})

theme = createTheme(theme, {
  palette: {
    accent: theme.palette.augmentColor({
      color: { main: "#FF6319" },
      name: "accent",
    }),
  },
})
```

### Pattern 3: Component Override Cascade
**What:** Use `components` key in `createTheme` to apply consistent overrides across all instances of a component.
**When to use:** For spacing, border-radius, elevation, and typography overrides that should be global.
**Example:**
```typescript
// Source: MUI docs
components: {
  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: { borderRadius: 8, border: "1px solid", borderColor: "divider" },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 600,
        textTransform: "none",
        minHeight: 44,
      },
    },
  },
}
```

### Anti-Patterns to Avoid
- **Scattering color hex codes in components:** Currently `style.ts` has hardcoded colors like `#007cbf`, `#22c55e`, `#f97316`. These must be referenced from theme `modeColors` instead.
- **Multiple theme creation calls in different files:** Keep one theme file. The `themeUtils.ts` file is fine for reusable style objects, but they should reference theme tokens via callback or be used within `sx` props.
- **Setting `fontSize` as a number in `theme.typography`:** MUI's default `fontSize: 14` is used as the base for `rem` calculations. The current `fontSize: 16` is for iOS zoom prevention on inputs -- this should remain but be handled per-component, not globally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font loading | Manual `@font-face` rules | `@fontsource-variable/inter` npm package | Handles font files, WOFF2, CSS; bundled by Vite automatically |
| Color light/dark variants | Manual hex math | `theme.palette.augmentColor()` | Generates light, dark, contrastText automatically based on luminance |
| Responsive spacing | Manual px breakpoint math | MUI `spacing()` function + `sx` responsive syntax | `theme.spacing(2)` = `12px` (with 6px base); `sx={{ p: { xs: 1, md: 2 } }}` |
| Focus ring styling | Per-component focus styles | Theme component overrides for focus-visible | Current theme already does this; extend to new color |
| contrastText calculation | Manual WCAG math | MUI's built-in `getContrastRatio` + `augmentColor` | Automatically picks white or black text based on background luminance |

**Key insight:** MUI's theme system already provides the infrastructure for design tokens. The task is configuration, not construction. Every token should flow from `createTheme()` so that changing a single value propagates everywhere.

## Common Pitfalls

### Pitfall 1: MTA Red/Orange Fail WCAG AA for White Text
**What goes wrong:** Using `#EE352E` (MTA Red) or `#FF6319` (MTA Orange) as button backgrounds with white text fails WCAG AA contrast (4.05:1 and 2.98:1 respectively; need 4.5:1).
**Why it happens:** Transit signage colors are designed for large physical signs, not small digital text.
**How to avoid:** Use MTA Red and Orange as `secondary` and `accent` palette entries, but ensure `contrastText` is set to black (`#000000`) or a very dark color for those palette entries. For small text, use darker variants. For decorative/graphical uses (route lines on map, status indicators), the 3:1 graphical contrast threshold applies instead.
**Warning signs:** White text appearing on red or orange buttons or chips.

**Verified contrast ratios (calculated):**
| Color | Hex | vs White | vs Black | White Text AA |
|-------|-----|----------|----------|---------------|
| MTA Blue | `#0039A6` | 9.83:1 | 2.14:1 | PASS (AAA) |
| MTA Red | `#EE352E` | 4.05:1 | 5.18:1 | FAIL |
| MTA Orange | `#FF6319` | 2.98:1 | 7.05:1 | FAIL |

### Pitfall 2: Bright Mode Colors Invisible on White Backgrounds
**What goes wrong:** Using bright greens (`#6CBE45`, `#22c55e`) and oranges (`#FF6319`) for bike/walk mode indicators on white backgrounds fails the 3:1 graphical contrast minimum.
**Why it happens:** Saturated, light-valued colors have poor contrast against white.
**How to avoid:** Use darker shades for mode colors:
- Bike green: `#087F23` (5.16:1 vs white) or `#15803D` (5.02:1)
- Walk orange: `#E65100` (3.79:1 vs white) or `#D84315` (4.44:1)
- Drive blue: `#0039A6` (9.83:1 vs white) -- no issue
**Warning signs:** Mode color indicators that are hard to distinguish from the white background.

### Pitfall 3: Global fontSize Override Breaks rem Calculations
**What goes wrong:** Setting `typography.fontSize: 16` in theme changes MUI's base rem calculation, making all components larger than intended.
**Why it happens:** MUI uses `fontSize` to compute the `htmlFontSize` to `rem` ratio. The current `fontSize: 16` was intended to prevent iOS zoom, but it also scales all `rem`-based sizes.
**How to avoid:** Keep `htmlFontSize: 16` (browser default) and set `fontSize: 14` (MUI default for density). Handle iOS zoom prevention at the input component level via `styleOverrides`, which the current theme already does correctly for `MuiTextField`.
**Warning signs:** Components appearing oversized after theme change.

### Pitfall 4: Hardcoded Colors in style.ts Won't Update with Theme
**What goes wrong:** `client/src/utils/style.ts` has hardcoded hex colors for route paint (`#007cbf`, `#22c55e`, `#f97316`). These MapLibre GL paint properties cannot directly reference MUI theme values.
**Why it happens:** MapLibre paint properties are plain objects, not React components -- they don't have access to the theme context.
**How to avoid:** Export mode color constants from a shared location (either the theme file or a constants file) and import them in both the theme and `style.ts`. Or accept that map layer colors are a parallel concern and keep them in `style.ts` but ensure the hex values match the theme's `modeColors`.
**Warning signs:** Route colors on the map not matching the mode colors in the UI controls.

### Pitfall 5: Missing TypeScript Module Augmentation
**What goes wrong:** Adding custom properties to the theme without proper `declare module` augmentation causes TypeScript errors or loss of type safety.
**Why it happens:** MUI's `Theme` interface is strictly typed; custom extensions need explicit type declarations.
**How to avoid:** The existing codebase already demonstrates this correctly for `map` properties. Follow the same pattern for `modeColors` and any custom palette entries.
**Warning signs:** TypeScript errors on `theme.modeColors.drive` or similar custom properties.

### Pitfall 6: tss-react Listed as Dependency But Not Used
**What goes wrong:** `tss-react` is in `package.json` but grep shows zero imports in the source code.
**Why it happens:** Likely a leftover from earlier development.
**How to avoid:** Remove it during this phase to avoid confusion. Verify no imports exist first (confirmed: zero matches for `tss-react` or `makeStyles` in `client/src/`).
**Warning signs:** Unnecessary bundle size.

## Code Examples

Verified patterns from official sources and the existing codebase:

### Complete Theme Structure (Recommended)
```typescript
// client/src/utils/theme.ts
import { createTheme } from "@mui/material/styles"
import "@fontsource-variable/inter"

// --- Module Augmentation ---
declare module "@mui/material/styles" {
  interface Theme {
    modeColors: { drive: string; bike: string; walk: string }
    map: {
      startPoint: { color: string }
      endPoint: { color: string }
      route: { color: string; width: number }
      point: { radius: number; blur: number; strokeWidth: number; strokeColor: string }
    }
  }
  interface ThemeOptions {
    modeColors?: { drive?: string; bike?: string; walk?: string }
    map?: {
      startPoint?: { color?: string }
      endPoint?: { color?: string }
      route?: { color?: string; width?: number }
      point?: { radius?: number; blur?: number; strokeWidth?: number; strokeColor?: string }
    }
  }
  interface Palette {
    accent: Palette["primary"]
  }
  interface PaletteOptions {
    accent?: PaletteOptions["primary"]
  }
}

// --- Mode Color Constants (shared with style.ts) ---
export const MODE_COLORS = {
  drive: "#0039A6",   // MTA Blue
  bike: "#087F23",    // Accessible dark green (5.16:1 vs white)
  walk: "#E65100",    // Accessible dark orange (3.79:1 vs white)
} as const

// --- Theme Definition ---
let theme = createTheme({
  cssVariables: true,
  palette: {
    primary: {
      main: "#0039A6",        // MTA Blue
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#EE352E",        // MTA Red
      contrastText: "#000000", // Black text -- red fails white text AA
    },
    error: {
      main: "#EE352E",
    },
    background: {
      default: "#f5f5f5",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: "'Inter Variable', sans-serif",
    fontSize: 14,
    htmlFontSize: 16,
    h1: { fontWeight: 700, fontSize: "2rem" },
    h2: { fontWeight: 700, fontSize: "1.75rem" },
    h3: { fontWeight: 700, fontSize: "1.5rem" },
    h4: { fontWeight: 600, fontSize: "1.25rem" },
    h5: { fontWeight: 600, fontSize: "1.125rem" },
    h6: { fontWeight: 600, fontSize: "1rem" },
    subtitle1: { fontWeight: 600, fontSize: "0.9375rem" },
    subtitle2: { fontWeight: 600, fontSize: "0.875rem" },
    body1: { fontWeight: 400, fontSize: "0.9375rem", lineHeight: 1.5 },
    body2: { fontWeight: 400, fontSize: "0.8125rem", lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: "none" as const },
    caption: { fontWeight: 500, fontSize: "0.75rem" },
    overline: { fontWeight: 600, fontSize: "0.6875rem", letterSpacing: "0.08em" },
  },
  spacing: 6,  // 6px base for compact transit aesthetic
  shape: {
    borderRadius: 6,
  },
  breakpoints: {
    values: { xs: 0, sm: 600, md: 905, lg: 1240, xl: 1440 },
  },
})

// Second pass: augmentColor for custom accent palette
theme = createTheme(theme, {
  palette: {
    accent: theme.palette.augmentColor({
      color: { main: "#FF6319" },  // MTA Orange
      name: "accent",
    }),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
          textTransform: "none",
          minHeight: 44,
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: theme.palette.primary.main,
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: "1px solid",
          borderColor: theme.palette.divider,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          minWidth: 44,
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: theme.palette.primary.main,
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: { "& input": { fontSize: 16 } }, // Prevents iOS zoom
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { fontWeight: 600, textTransform: "none" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 4 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: theme.palette.primary.main,
            outlineOffset: "-2px",
          },
        },
      },
    },
  },
  modeColors: MODE_COLORS,
  map: {
    startPoint: { color: "#22c55e" },
    endPoint: { color: "#ef4444" },
    route: { color: MODE_COLORS.drive, width: 5 },
    point: { radius: 8, blur: 0.15, strokeWidth: 2, strokeColor: "#ffffff" },
  },
})

export default theme
```

### Font Import in Entry Point
```typescript
// client/src/main.tsx -- add this import at top
import "@fontsource-variable/inter"
```

Alternatively, import it in `theme.ts` before `createTheme()` (either location works with Vite).

### Updating style.ts to Use Shared Mode Colors
```typescript
// client/src/utils/style.ts
import { MODE_COLORS } from "./theme"

export const getModeRoutePaint = (mode: "drive" | "bike" | "walk") => {
  const baseStyle = { /* ... same ... */ }
  switch (mode) {
    case "walk":
      return { ...baseStyle, "line-color": MODE_COLORS.walk, "line-dasharray": [2, 2] }
    case "bike":
      return { ...baseStyle, "line-color": MODE_COLORS.bike, "line-dasharray": [4, 2] }
    case "drive":
    default:
      return { ...baseStyle, "line-color": MODE_COLORS.drive, "line-dasharray": null }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@mui/styles` (JSS) | `@mui/material/styles` (Emotion) | MUI v5 (2021) | This project already uses Emotion. No migration needed. |
| `makeStyles` / `tss-react` | `sx` prop + `styled()` + theme component overrides | MUI v5+ | Project already follows this pattern. `tss-react` dep can be removed. |
| Static fonts (`@fontsource/inter`) | Variable fonts (`@fontsource-variable/inter`) | 2023+ | Single file, smaller payload, any weight 100-900 |
| `createMuiTheme` | `createTheme` | MUI v5 | Already using `createTheme`. |
| Manual CSS variables | `cssVariables: true` in `createTheme` | MUI v6 | Already enabled in current theme. |

**Deprecated/outdated:**
- `tss-react` / `makeStyles`: Listed in `package.json` but unused. Can be removed.

## Open Questions

1. **Map marker start/end colors vs. mode colors**
   - What we know: Start point is green (`#22c55e`), end point is red (`#ef4444`). Bike mode is also green. Walk mode orange overlaps with MTA accent orange.
   - What's unclear: Whether mode colors should also tint the route line *and* the markers, or just the route line and UI elements.
   - Recommendation: Keep start/end marker colors independent of mode colors (green/red for start/end is a universal convention). Mode colors apply to route lines and UI indicators only.

2. **Compact spacing exact value**
   - What we know: MUI default is 8px. The requirement says "tighter than default." Common compact values are 4px or 6px.
   - What's unclear: Exact value -- 4px may be too tight; 6px is a common "compact" choice.
   - Recommendation: Use 6px (`spacing: 6`). This gives `theme.spacing(1) = 6px`, `theme.spacing(2) = 12px`, `theme.spacing(3) = 18px`. Components using `p: 2` go from 16px to 12px padding -- noticeably tighter but not cramped.

3. **Sidebar width adjustment**
   - What we know: Current sidebar is hardcoded to `400px` in both `Sidebar.tsx` and `ControlsContainer.tsx`. Constants file has `SIDEBAR_WIDTH_PX = 330`.
   - What's unclear: Whether compact spacing changes require adjusting sidebar width. The 400px in components doesn't match the 330px constant.
   - Recommendation: Note this inconsistency but do not change sidebar width in this phase. Focus on theme tokens only.

## Inventory of Files Requiring Changes

| File | What Changes | Risk |
|------|-------------|------|
| `client/src/utils/theme.ts` | Complete rewrite: new palette, typography, spacing, shape, component overrides, mode colors | HIGH -- central to all rendering |
| `client/src/main.tsx` | Add `import "@fontsource-variable/inter"` | LOW |
| `client/src/utils/style.ts` | Replace hardcoded hex colors with `MODE_COLORS` imports | MEDIUM -- affects map rendering |
| `client/src/utils/themeUtils.ts` | Verify `commonStyles` compatible with new spacing | LOW |
| `client/src/components/shared/TitleBar.tsx` | May need font size/weight tweaks if theme typography changes | LOW |
| `client/index.html` | No font link tag needed (bundled via npm) | NONE |
| `client/package.json` | Add `@fontsource-variable/inter`; optionally remove `tss-react` | LOW |
| Various components with hardcoded `#556cd6` | Focus outlines reference old primary color | LOW -- handled by theme overrides |

## Sources

### Primary (HIGH confidence)
- `/mui/material-ui/v7_3_2` (Context7) - createTheme API, component overrides, breakpoint augmentation
- `/websites/mui_material-ui` (Context7) - Typography customization, variant overrides, style overrides pattern
- [MUI Palette Docs](https://github.com/mui/material-ui/blob/master/docs/data/material/customization/palette/palette.md) - augmentColor utility, TypeScript module augmentation
- [Fontsource Inter Install](https://fontsource.org/fonts/inter/install) - npm install, import syntax, font-family string
- [MTA Colors Dataset](https://data.ny.gov/Transportation/MTA-Colors/3uhz-sej2) - Official MTA color hex codes
- Computed WCAG contrast ratios (local calculation using W3C luminance formula) - All contrast numbers verified programmatically

### Secondary (MEDIUM confidence)
- [MUI Shape Docs](https://mui.com/material-ui/customization/shape/) - borderRadius default value (4px), shape customization
- [@fontsource-variable/inter npm](https://www.npmjs.com/package/@fontsource-variable/inter) - Package availability, weight range 100-900
- [MUI Spacing](https://mui.com/system/getting-started/the-sx-prop/) - Spacing function multiplier, sx prop integration

### Tertiary (LOW confidence)
- None. All findings verified against official sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - MUI 7 already in use, @fontsource is the standard npm font approach
- Architecture: HIGH - Existing codebase already follows MUI theme + module augmentation pattern
- Pitfalls: HIGH - Contrast ratios computed programmatically; hardcoded color inventory found via grep
- Color palette: HIGH - MTA colors from official NYS open data; contrast ratios calculated locally

**Research date:** 2026-02-12
**Valid until:** 2026-03-14 (stable -- MUI theme API and font packages change slowly)
