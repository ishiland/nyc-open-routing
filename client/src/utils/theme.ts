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
  palette: {
    primary: {
      main: "#556cd6",
    },
    secondary: {
      main: "#19857b",
    },
    error: {
      main: red.A400,
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
