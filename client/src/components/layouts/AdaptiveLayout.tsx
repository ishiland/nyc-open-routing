import React, { FC, Suspense } from "react"
import { useResponsive } from "../../hooks/useResponsive"
import { LoadingSpinner } from "../shared/LoadingSpinner"
import { BottomSheet } from "../mobile/BottomSheet"
import Sidebar from "../Sidebar"

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

  // Mobile layout: Bottom sheet over full-screen map
  if (isMobile) {
    return (
      <div style={{ display: "flex", width: "100%", height: "100vh" }}>
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

  // Tablet/Desktop layout: Sidebar + Map (existing layout)
  return (
    <div style={{ display: "flex", width: "100%", height: "100vh" }}>
      <aside
        aria-label="Route controls"
        style={{
          flexShrink: 0,
          width: isTabletOrBelow ? "340px" : "400px",
        }}
      >
        <Suspense fallback={<LoadingSpinner message="Loading controls..." />}>
          {sidebar}
        </Suspense>
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
