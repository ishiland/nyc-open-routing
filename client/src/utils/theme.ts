import { createTheme } from "@mui/material/styles"
import { red } from "@mui/material/colors"

// Extend the Theme interface to include custom map properties
declare module "@mui/material/styles" {
  interface Theme {
    map: {
      startPoint: {
        color: string
      }
      endPoint: {
        color: string
      }
      route: {
        color: string
        width: number
      }
      point: {
        radius: number
        blur: number
        strokeWidth: number
        strokeColor: string
      }
    }
  }

  interface ThemeOptions {
    map?: {
      startPoint?: {
        color?: string
      }
      endPoint?: {
        color?: string
      }
      route?: {
        color?: string
        width?: number
      }
      point?: {
        radius?: number
        blur?: number
        strokeWidth?: number
        strokeColor?: string
      }
    }
  }
}

// A custom theme for this app
const theme = createTheme({
  cssVariables: true,
  breakpoints: {
    values: {
      xs: 0,      // Mobile
      sm: 600,    // Tablet portrait
      md: 905,    // Tablet landscape
      lg: 1240,   // Desktop
      xl: 1440,   // Large desktop
    },
  },
  palette: {
    primary: {
      main: "#556cd6",
      contrastText: "#ffffff", // Ensure white text on primary background (WCAG AA)
    },
    secondary: {
      main: "#19857b",
      contrastText: "#ffffff",
    },
    error: {
      main: red.A400,
    },
    // Improved disabled state contrast
    action: {
      disabledBackground: "rgba(0, 0, 0, 0.12)",
      disabled: "rgba(0, 0, 0, 0.38)", // Higher contrast for disabled text
    },
  },
  typography: {
    fontSize: 16, // Prevents iOS zoom on input focus
  },
  components: {
    // Enhanced focus indicators for accessibility
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44, // WCAG minimum touch target
          '&:focus-visible': {
            outline: '3px solid',
            outlineColor: '#556cd6',
            outlineOffset: '2px',
          },
          // Improved disabled state visibility
          '&.Mui-disabled': {
            backgroundColor: 'rgba(0, 0, 0, 0.12)',
            color: 'rgba(0, 0, 0, 0.38)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: 44, // WCAG minimum touch target
          minWidth: 44,
          '&:focus-visible': {
            outline: '3px solid',
            outlineColor: '#556cd6',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 44, // WCAG minimum touch target
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: '#556cd6',
            outlineOffset: '-2px',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& input': {
            fontSize: 16, // Prevents iOS zoom
          },
        },
      },
    },
  },
  map: {
    startPoint: {
      color: "#22c55e", // Green for start point
    },
    endPoint: {
      color: "#ef4444", // Red for end point
    },
    route: {
      color: "#007cbf", // Blue for route line
      width: 5,
    },
    point: {
      radius: 8,
      blur: 0.15,
      strokeWidth: 2,
      strokeColor: "#ffffff", // White stroke around points
    },
  },
})

export default theme
