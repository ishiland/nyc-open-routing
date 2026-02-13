import React, { FC, Suspense, useState, useCallback, useContext, useRef } from "react"
import { IconButton } from "@mui/material"
import { ChevronLeft, ChevronRight } from "@mui/icons-material"
import { useResponsive } from "../../hooks/useResponsive"
import { LoadingSpinner } from "../shared/LoadingSpinner"
import { BottomSheet } from "../mobile/BottomSheet"
import Sidebar from "../Sidebar"
import { MapInstanceContext } from "../../contexts/MapInstanceContext"
import {
  SIDEBAR_WIDTH_PX,
  SIDEBAR_WIDTH_TABLET_PX,
  SIDEBAR_COLLAPSED_WIDTH_PX,
} from "../../utils/constants"

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

  return (
    <div style={{ display: "flex", width: "100%", height: "100dvh" }}>
      <aside
        aria-label="Route controls"
        onTransitionEnd={handleTransitionEnd}
        style={{
          width: isCollapsed
            ? `${SIDEBAR_COLLAPSED_WIDTH_PX}px`
            : `${expandedWidth}px`,
          transition: "width 250ms ease-in-out",
          overflow: "hidden",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <IconButton
          ref={expandBtnRef}
          onClick={handleToggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          sx={{
            position: "absolute",
            top: 48,
            right: 8,
            zIndex: 1,
            minWidth: 44,
            minHeight: 44,
          }}
        >
          {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
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
      </aside>
      <main
        id="main-content"
        role="main"
        aria-label="Interactive map"
        style={{ flex: 1, overflow: "hidden" }}
      >
        {map}
      </main>
    </div>
  )
}

export default AdaptiveLayout
