import { useMediaQuery, useTheme } from "@mui/material"

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

  // Touch device detection (supplements breakpoint)
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
