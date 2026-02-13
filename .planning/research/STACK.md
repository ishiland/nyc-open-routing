# Stack Research: Transit-Inspired UI Redesign

**Domain:** Frontend theming and visual design for React mapping application
**Researched:** 2026-02-12
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| MUI (Material UI) | 7.x (current: 7.3.2) | Component library & theming system | Already integrated in project. MUI v7 provides excellent theming with CSS variables (`cssVariables: true`), component style overrides, and TypeScript support. High source reputation, 30.7k stars. |
| @emotion/react | 11.x (current: 11.14.0) | CSS-in-JS styling engine | Default styling engine for MUI v7. Faster than styled-components, React Concurrent Mode ready, smaller bundle size. Already installed in project. |
| @emotion/styled | 11.x (current: 11.14.0) | Styled components API | For component-level styled components when needed. Performance-optimized with GPU acceleration. Already installed in project. |
| tss-react | 4.x (current: 4.9.16) | Type-safe JSS-style API for Emotion | Already installed. Provides type-safe equivalent of JSS `makeStyles` API powered by Emotion. Useful for complex component styles with theme access. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | CSS animations via Emotion keyframes | Use built-in Emotion `keyframes` for all animations. No additional animation library needed for transit UI transitions. |

### Typography & Design Tokens

| Resource | Type | Purpose | Implementation |
|----------|------|---------|----------------|
| Inter | Google Font | Primary UI font (Helvetica alternative) | 414B annual requests, designed for UIs with tall x-height and open apertures. Best screen legibility. Use font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold). |
| Roboto | Google Font | Fallback option | Used in NYC Subway B Division countdown clocks. Good Helvetica alternative if Inter doesn't fit design needs. |
| Official MTA Colors | Design tokens | Subway line colors for visual identity | Use hex codes from official MTA data (see Design Tokens section below). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript | Type safety for theme extensions | Already configured. Extend MUI theme interface for custom tokens. |
| MUI DevTools (browser extension) | Theme debugging | Optional. Useful for inspecting theme values during development. |

## Design Tokens: Official MTA Subway Colors

Use these official hex codes from [MTA Colors dataset](https://github.com/jsvine/mta-colors/blob/master/mta-colors.json):

**Numbered Lines (IRT):**
- 1/2/3: `#EE352E` (Red - Pantone 185)
- 4/5/6: `#00933C` (Green - Pantone 355)
- 7: `#B933AD` (Purple)

**Lettered Lines (IND/BMT):**
- A/C/E: `#2850AD` (Blue - Pantone 286)
- B/D/F/M: `#FF6319` (Orange - Pantone 165)
- G: `#6CBE45` (Light Green - Pantone 376)
- J/Z: `#996633` (Brown - Pantone 154)
- L: `#A7A9AC` (Gray - 50% black)
- N/Q/R: `#FCCC0A` (Yellow - Pantone 116)
- S: `#808183` (Gray - 70% black)

**Recommended Palette Mapping:**
- Primary: `#0039A6` (classic MTA Blue - A/C/E line, also official MTA brand blue)
- Secondary: `#EE352E` (Red - 1/2/3 line)
- Accent 1: `#FF6319` (Orange - B/D/F/M line)
- Accent 2: `#00933C` (Green - 4/5/6 line)
- Accent 3: `#B933AD` (Purple - 7 line)

## Installation

```bash
# Typography (Google Fonts via CDN or npm)
# Option 1: Add to index.html <head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

# Option 2: npm package (if preferred for offline support)
npm install @fontsource/inter

# All other dependencies already installed in package.json
# No additional animation libraries needed
```

## MUI Theming Approach (v7 Best Practices)

### 1. Custom Theme Creation with Design Tokens

**Pattern: Centralized theme with CSS variables enabled**

```typescript
// src/utils/theme.ts
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  cssVariables: true, // Enable CSS custom properties (MUI v7 feature)

  palette: {
    mode: 'light',
    primary: {
      main: '#0039A6', // MTA Blue (A/C/E)
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#EE352E', // MTA Red (1/2/3)
      contrastText: '#ffffff',
    },
    error: {
      main: '#EE352E', // Use MTA Red for errors too
    },
    // Custom colors for transit lines (extend palette)
    transit: {
      orange: '#FF6319',
      green: '#00933C',
      purple: '#B933AD',
      lightGreen: '#6CBE45',
      yellow: '#FCCC0A',
      brown: '#996633',
      gray: '#808183',
    },
  },

  typography: {
    fontFamily: '"Inter", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    fontSize: 16, // Prevents iOS zoom on input focus

    // Bold typography for transit aesthetic
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      letterSpacing: '-0.02em', // Tight spacing for impact
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.125rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '1rem',
    },
    body1: {
      fontWeight: 400,
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontWeight: 400,
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
    button: {
      fontWeight: 600, // Bold buttons for transit aesthetic
      textTransform: 'none', // Avoid ALL CAPS unless intentional
    },
  },

  spacing: 8, // Compact spacing (default is 8, can reduce to 6 for tighter feel)

  breakpoints: {
    values: {
      xs: 0,      // Mobile
      sm: 600,    // Tablet portrait
      md: 905,    // Tablet landscape (already customized in existing theme)
      lg: 1240,   // Desktop
      xl: 1440,   // Large desktop
    },
  },

  components: {
    // Component style overrides for transit aesthetic
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44, // WCAG touch target (already in existing theme)
          borderRadius: 4, // Slightly rounded (transit style is geometric)
          fontWeight: 600,
          '&:focus-visible': {
            outline: '3px solid',
            outlineColor: '#0039A6',
            outlineOffset: '2px',
          },
        },
        contained: {
          boxShadow: 'none', // Flat design for transit aesthetic
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Flat, no gradient overlays
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none', // Clean edges
        },
      },
    },
    // ... other component overrides
  },

  // Custom theme extension for map styles
  map: {
    startPoint: {
      color: '#00933C', // Green (4/5/6 line)
    },
    endPoint: {
      color: '#EE352E', // Red (1/2/3 line)
    },
    route: {
      color: '#0039A6', // Blue (A/C/E line)
      width: 5,
    },
    // ... existing map config
  },
});

export default theme;
```

**TypeScript extension for custom palette:**

```typescript
// src/utils/theme.ts (extend module)
declare module '@mui/material/styles' {
  interface Palette {
    transit: {
      orange: string;
      green: string;
      purple: string;
      lightGreen: string;
      yellow: string;
      brown: string;
      gray: string;
    };
  }
  interface PaletteOptions {
    transit?: {
      orange?: string;
      green?: string;
      purple?: string;
      lightGreen?: string;
      yellow?: string;
      brown?: string;
      gray?: string;
    };
  }
}
```

### 2. Styling Approach Hierarchy (Performance-Optimized)

**Priority order for styling in MUI v7:**

1. **`sx` prop** (HIGHEST PRIORITY) — Most optimized, compiles to Emotion efficiently
2. **Component `styleOverrides` in theme** — Global component customization
3. **`tss-react` makeStyles** — For complex multi-class components with theme access
4. **`styled()` components** — Use sparingly, adds CSS-in-JS processing overhead
5. **Inline `style` prop** — Only for truly dynamic values (e.g., calculated positions)

**Example: sx prop usage (preferred)**

```tsx
<Box
  sx={{
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    p: 2, // padding: theme.spacing(2)
    borderRadius: 1,
    '&:hover': {
      bgcolor: 'primary.dark',
    },
  }}
>
  Content
</Box>
```

**Example: tss-react for complex components**

```tsx
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  root: {
    backgroundColor: theme.palette.primary.main,
    padding: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1),
    },
  },
  icon: {
    color: theme.palette.transit.orange,
    marginRight: theme.spacing(1),
  },
}));

function MyComponent() {
  const { classes, cx } = useStyles();
  // Use cx() instead of clsx() for Emotion-generated class names
  return <div className={classes.root}>...</div>;
}
```

### 3. Animation Strategy (CSS via Emotion)

**Use Emotion `keyframes` for all animations. DO NOT install additional animation libraries.**

**Rationale:**
- CSS animations leverage GPU acceleration (better mobile performance)
- Emotion is already installed and integrated with MUI
- Smaller bundle size than framer-motion (3.6M downloads) or react-spring (788k downloads)
- Transit UI needs simple, functional animations (slide, fade, expand) not complex physics

**Example: Transit-style slide animation**

```tsx
import { keyframes } from '@emotion/react';
import { Box } from '@mui/material';

const slideIn = keyframes`
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

<Box
  sx={{
    animation: `${slideIn} 0.3s ease-out`,
  }}
>
  Sidebar content
</Box>
```

**Example: Expand/collapse transition**

```tsx
<Box
  sx={{
    transition: 'max-height 0.3s ease-in-out',
    maxHeight: expanded ? '500px' : '0',
    overflow: 'hidden',
  }}
>
  Collapsible content
</Box>
```

**Performance best practices:**
- Animate only `transform` and `opacity` (GPU-accelerated)
- Avoid animating `height`, `width`, `margin`, `padding` (triggers layout reflow)
- Use `will-change: transform` sparingly for frequently animated elements
- Duration: 150-300ms for UI transitions (feels snappy, not sluggish)

### 4. Responsive Layout Patterns

**Existing system:** Project already has `AdaptiveLayout`, `useResponsive` hook, and mobile `BottomSheet`.

**MUI Drawer variants for sidebar:**

| Viewport | Drawer Variant | Behavior |
|----------|---------------|----------|
| Mobile (< 600px) | `temporary` | Overlay with backdrop, swipe to dismiss |
| Tablet (600-904px) | `persistent` | Pushes content, manually toggle |
| Desktop (≥ 905px) | `permanent` | Always visible, optional mini variant |

**Example: Responsive drawer implementation**

```tsx
import { Drawer, useMediaQuery, useTheme } from '@mui/material';

function ResponsiveSidebar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile: temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }} // Better mobile performance
          sx={{
            '& .MuiDrawer-paper': {
              width: 280, // Compact for transit UI
            },
          }}
        >
          {/* Sidebar content */}
        </Drawer>
      )}

      {/* Tablet/Desktop: persistent or permanent */}
      {!isMobile && (
        <Drawer
          variant={isTablet ? 'persistent' : 'permanent'}
          open={!isTablet || mobileOpen}
          sx={{
            '& .MuiDrawer-paper': {
              width: 320,
              boxSizing: 'border-box',
            },
          }}
        >
          {/* Sidebar content */}
        </Drawer>
      )}
    </>
  );
}
```

**Existing breakpoints (keep current values):**
```typescript
breakpoints: {
  values: {
    xs: 0,      // Mobile
    sm: 600,    // Tablet portrait
    md: 905,    // Tablet landscape (custom)
    lg: 1240,   // Desktop (custom)
    xl: 1440,   // Large desktop (custom)
  },
}
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Emotion keyframes | framer-motion | Only if complex gesture-based animations (drag, swipe with physics) are needed. Not necessary for transit UI. |
| Emotion keyframes | react-spring | Only if spring physics-based animations are critical to UX. Overkill for transit UI. |
| Inter (Google Font) | Roboto | If Inter feels too modern. Roboto is used in NYC Subway countdown clocks. |
| Inter (Google Font) | IBM Plex Sans | If technical/scientific feel is desired. Slightly squared letterforms. |
| sx prop | styled() | Only for reusable styled components that don't need theme access. |
| tss-react | @mui/styles (deprecated) | Never. @mui/styles is deprecated in MUI v5+. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| @mui/styles (makeStyles/withStyles) | Deprecated in MUI v5+, removed in v6+ | tss-react for makeStyles-style API |
| styled-components | Not compatible with SSR in MUI, slower than Emotion | @emotion/styled (already installed) |
| framer-motion | Overkill for simple transit UI animations, 3.6M weekly downloads adds bundle size | Emotion keyframes (already available) |
| react-spring | Unnecessary complexity for functional animations | Emotion keyframes + CSS transitions |
| GSAP | External library for complex timeline animations. Transit UI doesn't need this. | Emotion keyframes |
| Tailwind CSS animations | Not compatible with MUI theming system | MUI sx prop + Emotion keyframes |
| Custom CSS files | Breaks theme consistency, hard to maintain with dynamic theming | sx prop, component styleOverrides, tss-react |
| CSS Modules | Not compatible with MUI theme tokens | sx prop, Emotion styled |

## Stack Patterns by Variant

**If targeting ONLY modern browsers (Chrome/Firefox/Safari last 2 versions):**
- Use CSS variables (`cssVariables: true` in theme) for dynamic theme switching
- Use CSS `color-scheme` property (automatic dark mode support)
- Use modern CSS features (container queries, cascade layers)

**If supporting older browsers (IE11, legacy mobile):**
- Disable CSS variables: `cssVariables: false`
- Use JavaScript-based theme switching via `ThemeProvider`
- Avoid modern CSS features, stick to Flexbox/Grid only

**If implementing dark mode later:**
- Keep `cssVariables: true`
- Use `palette.mode: 'light'` and `palette.mode: 'dark'` variants
- Use MUI's `useColorScheme()` hook for theme switching
- Transit colors should maintain high contrast in both modes

**If implementing SSR (not currently in project):**
- Use `InitColorSchemeScript` in root layout (Next.js App Router)
- Enable `suppressHydrationWarning` on `<html>` tag
- Ensure Emotion SSR setup is configured

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @mui/material@7.x | @emotion/react@11.x | MUI v7 requires Emotion 11.x as default engine |
| @mui/material@7.x | @emotion/styled@11.x | Same major version as @emotion/react required |
| @mui/material@7.x | tss-react@4.x | Verified compatible, already installed in project |
| @mui/material@7.x | React@18.x | MUI v7 requires React 18+ |
| @emotion/react@11.x | TypeScript@5.x | Full type support, already configured |

## Sources

**High Confidence (Context7 + Official Docs):**
- [MUI Material UI v7.3.2 Documentation](https://github.com/mui/material-ui/blob/v7.3.2/) — Theme creation, component overrides, CSS variables
- [Emotion Documentation](https://github.com/emotion-js/emotion) — Keyframes, styled components, performance best practices
- [tss-react GitHub](https://github.com/garronej/tss-react) — Type-safe makeStyles alternative

**Medium Confidence (WebSearch + Official Sources):**
- [MTA Brand Colors Official](https://www.mta.info/document/168976) — Official Pantone/hex color specifications
- [MTA Colors JSON Dataset](https://github.com/jsvine/mta-colors/blob/master/mta-colors.json) — Complete subway line color data
- [MTA Graphics Standards Manual](https://standardsmanual.com/products/nyctacompactedition) — Historical design guide (1970)
- [Inter Font](https://rsms.me/inter/) — Google Fonts, 414B annual requests
- [Comparing React Animation Libraries 2026](https://blog.logrocket.com/best-react-animation-libraries/) — framer-motion vs react-spring comparison
- [CSS vs JS Animation Performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance) — MDN performance guide
- [MUI Drawer Responsive Patterns](https://mui.com/material-ui/react-drawer/) — Official drawer documentation
- [MUI Style Library Interoperability](https://mui.com/material-ui/integrations/interoperability/) — sx vs styled vs makeStyles

---
*Stack research for: NYC Open Routing Transit UI Redesign*
*Researched: 2026-02-12*
