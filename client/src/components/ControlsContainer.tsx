import React from "react"
import Paper from "@mui/material/Paper"
import Box from "@mui/material/Box"

import { TravelModeSelect } from "./controls/TravelModeSelect"
import { TrafficToggle } from "./controls/TrafficToggle"
import { FerryToggle } from "./controls/FerryToggle"
import { TitleBar } from "./shared/TitleBar"
import { ControlsContainerProps } from "../types/interfaces"
import { SIDEBAR_WIDTH_PX } from "../utils/constants"

const ControlsContainerComponent: React.FC<ControlsContainerProps> = ({
  children,
}) => {
  return (
    <Paper
      square
      sx={{
        width: SIDEBAR_WIDTH_PX,
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
      elevation={8}
    >
      <TitleBar />
      <TravelModeSelect />
      <TrafficToggle />
      <FerryToggle />
      <Box sx={{ padding: 2, overflowY: "auto", flexGrow: 1 }}>{children}</Box>
    </Paper>
  )
}

// Memoize to prevent unnecessary re-renders
export const ControlsContainer = React.memo(ControlsContainerComponent)
