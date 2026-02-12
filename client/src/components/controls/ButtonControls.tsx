import React, { useContext, useEffect } from "react"
import Button from "@mui/material/Button"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import { Directions, Share } from "@mui/icons-material"
import CircularProgress from "@mui/material/CircularProgress"
import Box from "@mui/material/Box"
import Stack from "@mui/material/Stack"

import {
  RoutingContext,
  RoutingContextType,
} from "../../contexts/RoutingContext"
import {
  MessageContext,
  MessageContextType,
} from "../../contexts/MessageContext"
import { useRouteFetch } from "../../hooks/useRouteFetch"
import { useRouteStateSync } from "../../hooks/useRouteStateSync"

export const ButtonControls: React.FC = () => {
  const { clearAddresses, startAddress, endAddress, setRoute, mode, useTraffic, avoidFerries, trafficHour, trafficDayOfWeek, setAddress, setMode, setUseTraffic, setAvoidFerries, setTrafficHour, setTrafficDayOfWeek } =
    useContext<RoutingContextType>(RoutingContext)

  const { displayMessage } = useContext<MessageContextType>(MessageContext)

  const { fetchRoute, isFetching } = useRouteFetch({
    startAddress,
    endAddress,
    mode,
    useTraffic,
    avoidFerries,
    trafficHour,
    trafficDayOfWeek,
    setRoute,
    displayMessage,
  })

  const { copyRouteUrl } = useRouteStateSync({
    startAddress,
    endAddress,
    mode,
    useTraffic,
    avoidFerries,
    trafficHour,
    trafficDayOfWeek,
    setAddress,
    setMode,
    setUseTraffic,
    setAvoidFerries,
    setTrafficHour,
    setTrafficDayOfWeek,
  })

  // Auto-recalculate route when mode, traffic toggle, or time selection changes if both addresses are set
  // Provides better UX - similar to Google Maps behavior where mode changes immediately show new route
  useEffect(() => {
    if (startAddress?.geometry && endAddress?.geometry) {
      fetchRoute()
    }
    // Note: Intentionally only depend on 'mode', 'useTraffic', 'trafficHour', and 'trafficDayOfWeek'
    // The fetchRoute callback will use current startAddress/endAddress values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, useTraffic, avoidFerries, trafficHour, trafficDayOfWeek])

  const routeButtonEnabled = !!(startAddress?.geometry && endAddress?.geometry)

  // Handle copy link action
  const handleCopyLink = async () => {
    const success = await copyRouteUrl()
    if (success) {
      displayMessage("Route link copied to clipboard!", "success")
    } else {
      displayMessage("Failed to copy link. Please try again.", "error")
    }
  }

  const reset = (): void => {
    clearAddresses()
    setRoute(null)

    // Return focus to start address input after clearing
    // Use setTimeout to ensure DOM updates have completed
    setTimeout(() => {
      // Target the Start input specifically by its ID pattern
      // Search component generates IDs like "auto-suggest-Start-{timestamp}"
      const startInput = document.querySelector<HTMLInputElement>(
        '[id^="auto-suggest-Start-"]',
      )
      if (startInput) {
        startInput.focus()
      }
    }, 0)
  }

  return (
    <>
      {/* Screen reader announcement for route calculation status */}
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        {isFetching && "Calculating route..."}
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <Button
          onClick={fetchRoute}
          variant="contained"
          color="primary"
          disabled={isFetching || !routeButtonEnabled}
          startIcon={isFetching ? <CircularProgress size={16} color="inherit" /> : <Directions />}
          aria-label="Calculate route between selected addresses"
          fullWidth
          sx={{ minHeight: 44 }}
        >
          {isFetching ? "Calculating..." : "Get Directions"}
        </Button>
        <Button
          onClick={reset}
          variant="outlined"
          disabled={isFetching}
          aria-label="Clear all addresses and route"
          sx={{ minHeight: 44, minWidth: 44 }}
        >
          Clear
        </Button>
        {routeButtonEnabled && !isFetching && (
          <Tooltip title="Copy shareable link" placement="top">
            <IconButton
              onClick={handleCopyLink}
              size="medium"
              aria-label="Copy shareable route link"
              sx={{
                minWidth: 44,
                minHeight: 44,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Share fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </>
  )
}

// Memoize to prevent unnecessary re-renders
export default React.memo(ButtonControls)
