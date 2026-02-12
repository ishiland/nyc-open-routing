import { useMediaQuery, useTheme } from "@mui/material"
import { Breakpoint } from "@mui/material/styles"

/**
 * Hook for responsive breakpoint detection
 * Provides convenient boolean flags for different device sizes
 *
 * @example
 * const { isMobile, isTablet, isDesktop } = useResponsive()
 * if (isMobile) {
 *   return <MobileLayout />
 * }
 */
export const useResponsive = () => {
  const theme = useTheme()

  // Breakpoint queries
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")) // 0-599px
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md")) // 600-904px
  const isTabletOrBelow = useMediaQuery(theme.breakpoints.down("md")) // 0-904px
  const isDesktop = useMediaQuery(theme.breakpoints.up("md")) // 905px+
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up("lg")) // 1240px+

  // Touch device detection (optional - supplements breakpoint)
  const isTouchDevice =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)

  return {
    isMobile,
    isTablet,
    isTabletOrBelow,
    isDesktop,
    isLargeDesktop,
    isTouchDevice,
    // Current breakpoint name for debugging
    currentBreakpoint: isMobile
      ? "mobile"
      : isTablet
        ? "tablet"
        : isLargeDesktop
          ? "large-desktop"
          : "desktop",
  }
}

/**
 * Hook to check if viewport is below a specific breakpoint
 *
 * @example
 * const isBelowMd = useBreakpointDown('md')
 */
export const useBreakpointDown = (breakpoint: Breakpoint) => {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down(breakpoint))
}

/**
 * Hook to check if viewport is above a specific breakpoint
 *
 * @example
 * const isAboveSm = useBreakpointUp('sm')
 */
export const useBreakpointUp = (breakpoint: Breakpoint) => {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.up(breakpoint))
}

/**
 * Hook to check if viewport is between two breakpoints
 *
 * @example
 * const isTabletRange = useBreakpointBetween('sm', 'md')
 */
export const useBreakpointBetween = (
  start: Breakpoint,
  end: Breakpoint,
) => {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.between(start, end))
}
