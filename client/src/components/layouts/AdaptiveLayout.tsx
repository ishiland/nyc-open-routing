import React, { FC, Suspense, useState, useCallback, useContext, useRef } from "react"
import { IconButton, Tooltip, Box } from "@mui/material"
import {
  ChevronLeft,
  ChevronRight,
  DirectionsCar,
  DirectionsBike,
  DirectionsWalk,
} from "@mui/icons-material"
import { useResponsive } from "../../hooks/useResponsive"
import { LoadingSpinner } from "../shared/LoadingSpinner"
import { BottomSheet } from "../mobile/BottomSheet"
import Sidebar from "../Sidebar"
import { MapInstanceContext } from "../../contexts/MapInstanceContext"
import { RoutingContext } from "../../contexts/RoutingContext"
import { MODE_COLORS } from "../../utils/theme"
import {
  SIDEBAR_WIDTH_PX,
  SIDEBAR_WIDTH_TABLET_PX,
  SIDEBAR_COLLAPSED_WIDTH_PX,
} from "../../utils/constants"

const MODE_ICONS = {
  drive: DirectionsCar,
  bike: DirectionsBike,
  walk: DirectionsWalk,
} as const

interface AdaptiveLayoutProps {
  sidebar: React.ReactNode
  map: React.ReactNode
}

/**
 * Adaptive layout component that renders different layouts based on viewport size
 *
 * - Mobile (0-599px): Full-screen map + bottom sheet
 * - Tablet (600-904px): Collapsible sidebar (340px)
 * - Desktop (905px+): Fixed sidebar (400px)
 */
export const AdaptiveLayout: FC<AdaptiveLayoutProps> = ({ sidebar, map }) => {
  const { isMobile, isTabletOrBelow } = useResponsive()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { map: mapInstance } = useContext(MapInstanceContext)
  const { mode } = useContext(RoutingContext)
  const expandBtnRef = useRef<HTMLButtonElement>(null)

  const handleTransitionEnd = useCallback(() => {
    mapInstance?.resize()
  }, [mapInstance])

  const handleToggle = useCallback(() => {
    setIsCollapsed(prev => {
      const willCollapse = !prev
      if (willCollapse) {
        // After collapse: focus the expand button
        setTimeout(() => {
          expandBtnRef.current?.focus()
        }, 260)
      } else {
        // After expand: focus the start address input
        setTimeout(() => {
          const firstInput = document.querySelector<HTMLInputElement>(
            'aside [id^="auto-suggest-Start-"]',
          )
          firstInput?.focus()
        }, 260)
      }
      return willCollapse
    })
  }, [])

  // Mobile layout: Bottom sheet over full-screen map
  if (isMobile) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100dvh" }}>
        {/* Full-screen map */}
        <main
          id="main-content"
          role="main"
          aria-label="Interactive map"
          style={{ flex: 1, overflow: "hidden" }}
        >
          {map}
        </main>

        {/* Bottom sheet with controls */}
        <BottomSheet>
          <Suspense fallback={<LoadingSpinner message="Loading controls..." />}>
            {sidebar}
          </Suspense>
        </BottomSheet>
      </div>
    )
  }

  // Tablet/Desktop layout: Collapsible sidebar + Map
  const expandedWidth = isTabletOrBelow ? SIDEBAR_WIDTH_TABLET_PX : SIDEBAR_WIDTH_PX

  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH_PX : expandedWidth

  return (
    <div
      style={{
        width: "100%",
        height: "100dvh",
        position: "relative",
      }}
    >
      {/* Map fills the entire viewport */}
      <main
        id="main-content"
        role="main"
        aria-label="Interactive map"
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      >
        {map}
      </main>

      {/* Sidebar overlays the map */}
      <aside
        aria-label="Route controls"
        onTransitionEnd={handleTransitionEnd}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${sidebarWidth}px`,
          maxHeight: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          transition: "width 250ms ease-in-out",
          zIndex: 1050,
        }}
      >
        {isCollapsed ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              pt: 2,
              gap: 1,
            }}
          >
            <Tooltip title={`Mode: ${mode}`} placement="right">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: MODE_COLORS[mode],
                  color: mode === "walk" ? "#000" : "#fff",
                }}
              >
                {React.createElement(MODE_ICONS[mode], { fontSize: "small" })}
              </Box>
            </Tooltip>
          </Box>
        ) : (
          <div
            style={{
              width: expandedWidth,
              minWidth: expandedWidth,
            }}
          >
            <Suspense fallback={<LoadingSpinner message="Loading controls..." />}>
              {sidebar}
            </Suspense>
          </div>
        )}
      </aside>

      {/* Collapse/expand toggle — positioned on the sidebar edge */}
      <IconButton
        ref={expandBtnRef}
        onClick={handleToggle}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        sx={{
          position: "absolute",
          top: 12,
          left: `${sidebarWidth}px`,
          transition: "left 250ms ease-in-out",
          transform: "translateX(-50%)",
          zIndex: 1100,
          width: 28,
          height: 28,
          minWidth: 28,
          minHeight: 28,
          bgcolor: "background.paper",
          boxShadow: 2,
          border: "1px solid",
          borderColor: "divider",
          "&:hover": {
            bgcolor: "grey.100",
          },
        }}
      >
        {isCollapsed ? (
          <ChevronRight fontSize="small" />
        ) : (
          <ChevronLeft fontSize="small" />
        )}
      </IconButton>
    </div>
  )
}

export default AdaptiveLayout
