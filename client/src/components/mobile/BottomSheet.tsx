import React, { FC, useState, useEffect, useCallback } from "react"
import { SwipeableDrawer, Box, useTheme, Typography, Fade } from "@mui/material"
import { KeyboardArrowUp } from "@mui/icons-material"
import {
  BOTTOM_SHEET_SNAP_POINTS,
  BOTTOM_SHEET_DRAG_HANDLE_HEIGHT_PX,
  BOTTOM_SHEET_Z_INDEX,
} from "../../utils/constants"
import { getNextSnapPoint } from "../../utils/responsive"
import { useLocalStorage } from "../../hooks/useLocalStorage"

interface BottomSheetProps {
  children: React.ReactNode
  open?: boolean
  onClose?: () => void
  onOpen?: () => void
  initialSnapPoint?: number
}

/**
 * Mobile bottom sheet component with snap points and swipe gestures
 * Provides progressive disclosure of routing information
 *
 * Snap Points:
 * - 40%: Route summary (distance, time, mode)
 * - 60%: Turn-by-turn directions
 * - 90%: Full controls + search
 */
export const BottomSheet: FC<BottomSheetProps> = ({
  children,
  open = true,
  onClose,
  onOpen,
  initialSnapPoint = BOTTOM_SHEET_SNAP_POINTS[0],
}) => {
  const theme = useTheme()
  const [snapPoint, setSnapPoint] = useState(initialSnapPoint)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [hasSeenSwipeHint, setHasSeenSwipeHint] = useLocalStorage(
    "bottom-sheet-swipe-hint-seen",
    false,
  )
  const [showSwipeHint, setShowSwipeHint] = useState(!hasSeenSwipeHint)

  // Hide hint after 5 seconds
  useEffect(() => {
    if (showSwipeHint) {
      const timer = setTimeout(() => {
        setShowSwipeHint(false)
        setHasSeenSwipeHint(true)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showSwipeHint, setHasSeenSwipeHint])

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      setIsDragging(true)
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
      setDragStartY(clientY)
    },
    [],
  )

  // Handle keyboard navigation on drag handle
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp": {
          e.preventDefault()
          const nextUp = getNextSnapPoint(snapPoint, "up")
          setSnapPoint(nextUp)
          break
        }
        case "ArrowDown": {
          e.preventDefault()
          const nextDown = getNextSnapPoint(snapPoint, "down")
          if (
            nextDown === snapPoint &&
            snapPoint === BOTTOM_SHEET_SNAP_POINTS[0] &&
            onClose
          ) {
            onClose()
          } else {
            setSnapPoint(nextDown)
          }
          break
        }
        case "Enter":
        case " ": {
          e.preventDefault()
          // Toggle between min and max snap points
          const min = BOTTOM_SHEET_SNAP_POINTS[0]
          const max =
            BOTTOM_SHEET_SNAP_POINTS[BOTTOM_SHEET_SNAP_POINTS.length - 1]
          setSnapPoint(snapPoint === max ? min : max)
          break
        }
      }
    },
    [snapPoint, onClose],
  )

  // Handle drag end
  const handleDragEnd = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDragging) return

      const clientY =
        "changedTouches" in e ? e.changedTouches[0].clientY : e.clientY
      const deltaY = clientY - dragStartY

      // Determine swipe direction based on distance
      const direction = deltaY > 20 ? "down" : deltaY < -20 ? "up" : null

      if (direction) {
        const nextSnap = getNextSnapPoint(snapPoint, direction)
        setSnapPoint(nextSnap)

        // If swiping down at lowest snap point, close the sheet
        if (
          direction === "down" &&
          snapPoint === BOTTOM_SHEET_SNAP_POINTS[0] &&
          onClose
        ) {
          onClose()
        }
      }

      setIsDragging(false)
    },
    [isDragging, dragStartY, snapPoint, onClose],
  )

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose || (() => {})}
      onOpen={onOpen || (() => {})}
      disableSwipeToOpen={false}
      disableDiscovery // Prevents interfering with map gestures
      hideBackdrop // Allows map interaction around the sheet
      sx={{
        zIndex: BOTTOM_SHEET_Z_INDEX,
        pointerEvents: "none", // Let events pass through to map
        "& .MuiDrawer-paper": {
          pointerEvents: "auto", // Re-enable events on the sheet itself
          height: `${snapPoint * 100}%`,
          overflow: "visible",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          transition: isDragging
            ? "none"
            : theme.transitions.create("height", {
                easing: theme.transitions.easing.easeOut,
                duration: theme.transitions.duration.shorter,
              }),
        },
      }}
      ModalProps={{
        keepMounted: true, // Better mobile performance
        slotProps: {
          backdrop: { invisible: true }, // MUI v7 compatibility
        },
      }}
    >
      {/* Drag Handle */}
      <Box
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        sx={{
          width: "100%",
          height: BOTTOM_SHEET_DRAG_HANDLE_HEIGHT_PX,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "grab",
          touchAction: "none", // Prevent browser from interpreting drag as scroll/pan
          "&:active": {
            cursor: "grabbing",
          },
        }}
        role="slider"
        aria-label="Resize bottom sheet"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(snapPoint * 100)}
        aria-valuetext={`${Math.round(snapPoint * 100)} percent`}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: "grey.400",
          }}
        />
      </Box>

      {/* Swipe Hint */}
      <Fade in={showSwipeHint} timeout={1000}>
        <Box
          sx={{
            position: "absolute",
            top: BOTTOM_SHEET_DRAG_HANDLE_HEIGHT_PX + 8,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            px: 2,
            py: 1,
            borderRadius: 2,
            fontSize: "0.875rem",
            boxShadow: 2,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <KeyboardArrowUp fontSize="small" />
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            Swipe up for directions
          </Typography>
        </Box>
      </Fade>

      {/* Content */}
      <Box
        sx={{
          height: `calc(100% - ${BOTTOM_SHEET_DRAG_HANDLE_HEIGHT_PX}px)`,
          overflow: "auto",
          overscrollBehavior: "contain", // Prevent iOS bounce-scroll propagation
          px: 2,
          pb: 2,
        }}
      >
        {children}
      </Box>

      {/* Snap Point Indicator (for debugging - can be removed) */}
      {process.env.NODE_ENV === "development" && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "rgba(0,0,0,0.6)",
            color: "white",
            px: 1,
            py: 0.5,
            borderRadius: 1,
            fontSize: "0.7rem",
            pointerEvents: "none",
          }}
        >
          {Math.round(snapPoint * 100)}%
        </Box>
      )}
    </SwipeableDrawer>
  )
}

export default BottomSheet
