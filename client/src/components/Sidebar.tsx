// Sidebar.tsx
import React, { useContext } from "react"
import { Box, IconButton, Tooltip, Stack } from "@mui/material"
import { SwapVert } from "@mui/icons-material"
import { ControlsContainer } from "./ControlsContainer"
import Search from "./controls/Search"
import { RouteList } from "./controls/RouteList"
import { ButtonControls } from "./controls/ButtonControls"
import Message from "./shared/Message"
import { RoutingContext } from "../contexts/RoutingContext"

const Sidebar: React.FC = () => {
  const { swapAddresses, startAddress, endAddress } = useContext(RoutingContext)

  // Only show swap button when both addresses are set
  const canSwap = !!(startAddress?.geometry && endAddress?.geometry)

  return (
    <nav aria-label="Address input and routing">
      <ControlsContainer>
        <Stack spacing={1.5}>
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
                      minWidth: 32,
                      minHeight: 32,
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
            <Search type="End" />
          </Stack>
          <ButtonControls />
          <RouteList />
        </Stack>
      </ControlsContainer>
      <Message />
    </nav>
  )
}

export default Sidebar
