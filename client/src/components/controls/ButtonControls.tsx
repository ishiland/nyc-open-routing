import React, { useContext } from "react"
import Button from "@mui/material/Button"
import { Directions } from "@mui/icons-material"
import CircularProgress from "@mui/material/CircularProgress"
import Box from "@mui/material/Box"

import {
  RoutingContext,
  RoutingContextType,
} from "../../contexts/RoutingContext"
import {
  MessageContext,
  MessageContextType,
} from "../../contexts/MessageContext"
import { useRouteFetch } from "../../hooks/useRouteFetch"

export const ButtonControls: React.FC = () => {
  const { clearAddresses, startAddress, endAddress, setRoute, mode } =
    useContext<RoutingContextType>(RoutingContext)

  const { displayMessage } = useContext<MessageContextType>(MessageContext)

  const { fetchRoute, isFetching } = useRouteFetch({
    startAddress,
    endAddress,
    mode,
    setRoute,
    displayMessage,
  })

  const routeButtonEnabled = !!(startAddress?.geometry && endAddress?.geometry)

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

      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 2, mb: 2 }}>
        <Button
          onClick={reset}
          variant="contained"
          disabled={isFetching}
          aria-label="Clear all addresses and route"
        >
          Clear All
        </Button>
        <Button
          onClick={fetchRoute}
          variant="contained"
          color="primary"
          disabled={isFetching || !routeButtonEnabled}
          startIcon={<Directions />}
          aria-label="Calculate route between selected addresses"
        >
          Calculate Route
        </Button>
        {isFetching && (
          <CircularProgress
            size={20}
            sx={{ ml: 1 }}
            aria-label="Calculating route"
          />
        )}
      </Box>
    </>
  )
}

// Memoize to prevent unnecessary re-renders
export default React.memo(ButtonControls)
