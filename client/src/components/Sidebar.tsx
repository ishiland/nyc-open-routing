// Sidebar.tsx
import React, { useContext } from "react"
import { Box, IconButton, Tooltip, Stack, Button } from "@mui/material"
import { SwapVert, AddLocationAlt } from "@mui/icons-material"
import { ControlsContainer } from "./ControlsContainer"
import Search from "./controls/Search"
import WaypointSearch from "./controls/WaypointSearch"
import { RouteList } from "./controls/RouteList"
import { ButtonControls } from "./controls/ButtonControls"
import { IsochroneControls } from "./controls/IsochroneControls"
import Message from "./shared/Message"
import { RoutingContext } from "../contexts/RoutingContext"
import { IsochroneContext } from "../contexts/IsochroneContext"
import { IMapFeature } from "../types/interfaces"

const Sidebar: React.FC = () => {
  const { swapAddresses, startAddress, endAddress, waypoints, addWaypoint } =
    useContext(RoutingContext)
  const { appMode } = useContext(IsochroneContext)

  // Disable swap when waypoints are present
  const canSwap =
    !!(startAddress?.geometry && endAddress?.geometry) &&
    waypoints.length === 0

  const handleAddWaypoint = () => {
    addWaypoint({
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: { label: "" },
    } as IMapFeature)
  }

  return (
    <nav aria-label="Address input and routing" style={{ height: "100%" }}>
      <ControlsContainer>
        <Stack spacing={1.5}>
          {appMode === "route" ? (
            <>
              <Stack spacing={1}>
                <Search type="Start" />
                {/* Swap button between search inputs */}
                <Box sx={{ display: "flex", justifyContent: "center" }}>
                  <Tooltip title="Swap start and end addresses" placement="right">
                    <span>
                      <IconButton
                        onClick={swapAddresses}
                        disabled={!canSwap}
                        size="small"
                        aria-label="Swap start and end addresses"
                        sx={{
                          transform: "rotate(90deg)",
                          bgcolor: "action.hover",
                          transition: "all 0.2s ease-in-out",
                          minWidth: 44,
                          minHeight: 44,
                          "&:hover": {
                            bgcolor: "action.selected",
                            transform: "rotate(90deg) scale(1.15)",
                          },
                          "&.Mui-disabled": {
                            bgcolor: "transparent",
                            transform: "rotate(90deg)",
                          },
                        }}
                      >
                        <SwapVert fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
                {/* Waypoint search inputs */}
                {waypoints.map((wp, i) => (
                  <WaypointSearch key={i} index={i} waypoint={wp} />
                ))}
                {/* Add Stop button - only show when under the 1 intermediate waypoint limit */}
                {waypoints.length < 1 && (
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Button
                      size="small"
                      startIcon={<AddLocationAlt />}
                      onClick={handleAddWaypoint}
                      aria-label="Add an intermediate stop"
                      sx={{
                        textTransform: "none",
                        color: "text.secondary",
                        fontSize: "0.75rem",
                        minHeight: 32,
                      }}
                    >
                      Add Stop
                    </Button>
                  </Box>
                )}
                <Search type="End" />
              </Stack>
              <ButtonControls />
              <RouteList />
            </>
          ) : (
            <>
              <Search type="Start" />
              <IsochroneControls />
            </>
          )}
        </Stack>
      </ControlsContainer>
      <Message />
    </nav>
  )
}

export default Sidebar
