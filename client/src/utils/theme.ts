import { createTheme } from "@mui/material/styles"

// --- Module augmentation ---
declare module "@mui/material/styles" {
  interface Theme {
    modeColors: {
      drive: string
      bike: string
      walk: string
    }
    map: {
      startPoint: { color: string }
      endPoint: { color: string }
      route: { color: string; width: number }
      point: {
        radius: number
        blur: number
        strokeWidth: number
        strokeColor: string
      }
    }
  }

  interface ThemeOptions {
    modeColors?: {
      drive?: string
      bike?: string
      walk?: string
    }
    map?: {
      startPoint?: { color?: string }
      endPoint?: { color?: string }
      route?: { color?: string; width?: number }
      point?: {
        radius?: number
        blur?: number
        strokeWidth?: number
        strokeColor?: string
      }
    }
  }

  interface Palette {
    accent: Palette["primary"]
  }

  interface PaletteOptions {
    accent?: PaletteOptions["primary"]
  }
}

// MTA color constants
const MTA_BLUE = "#0039A6"
const MTA_RED = "#EE352E"
const MTA_ORANGE = "#FF6319"

// Shared source of truth for mode-specific colors, consumed by style.ts
export const MODE_COLORS = {
  drive: MTA_BLUE,
  bike: "#087F23", // Accessible dark green (5.16:1 vs white)
  walk: "#E65100", // Accessible dark orange (3.79:1 vs white)
} as const

const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: {
      main: MTA_BLUE,
      contrastText: "#ffffff",
    },
    secondary: {
      main: MTA_RED,
      contrastText: "#000000", // Black text — red fails white AA at 4.05:1
    },
    accent: {
      main: MTA_ORANGE,
      light: "#FF8A50",
      dark: "#C43E00",
      contrastText: "#000000", // Black text — orange fails white AA
    },
    error: {
      main: MTA_RED,
    },
    background: {
      default: "#f5f5f5",
      paper: "#ffffff",
    },
    action: {
      disabledBackground: "rgba(0, 0, 0, 0.12)",
      disabled: "rgba(0, 0, 0, 0.38)",
    },
  },
  breakpoints: {
    values: {
      xs: 0, // Mobile
      sm: 600, // Tablet portrait
      md: 905, // Tablet landscape
      lg: 1240, // Desktop
      xl: 1440, // Large desktop
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
    body1: { fontWeight: 400, fontSize: "0.9375rem", lineHeight: 1.5 },
    body2: { fontWeight: 400, fontSize: "0.8125rem", lineHeight: 1.5 },
    button: { fontWeight: 600, textTransform: "none" as const },
    caption: { fontWeight: 500, fontSize: "0.75rem" },
    overline: {
      fontWeight: 600,
      fontSize: "0.6875rem",
      letterSpacing: "0.08em",
    },
    subtitle1: { fontWeight: 600, fontSize: "0.9375rem" },
    subtitle2: { fontWeight: 600, fontSize: "0.875rem" },
  },
  spacing: 6, // 6px base for compact transit aesthetic
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
          textTransform: "none" as const,
          minHeight: 44, // WCAG minimum touch target
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: MTA_BLUE,
            outlineOffset: "2px",
          },
          "&.Mui-disabled": {
            backgroundColor: "rgba(0, 0, 0, 0.12)",
            color: "rgba(0, 0, 0, 0.38)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          borderRadius: 8,
          border: "1px solid rgba(0, 0, 0, 0.12)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: 44, // WCAG minimum touch target
          minWidth: 44,
          "&:focus-visible": {
            outline: "3px solid",
            outlineColor: MTA_BLUE,
            outlineOffset: "2px",
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& input": {
            fontSize: 16, // Prevents iOS zoom
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 44, // WCAG minimum touch target
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: MTA_BLUE,
            outlineOffset: "-2px",
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: "none" as const,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 4,
        },
      },
    },
  },
  modeColors: MODE_COLORS,
  map: {
    startPoint: { color: "#22c55e" },
    endPoint: { color: "#ef4444" },
    route: { color: MODE_COLORS.drive, width: 5 },
    point: {
      radius: 8,
      blur: 0.15,
      strokeWidth: 2,
      strokeColor: "#ffffff",
    },
  },
})

export default theme
