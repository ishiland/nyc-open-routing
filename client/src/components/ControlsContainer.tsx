import React from "react"
import Paper from "@mui/material/Paper"
import Box from "@mui/material/Box"

import { TravelModeSelect } from "./controls/TravelModeSelect"
import { TrafficToggle } from "./controls/TrafficToggle"
import { FerryToggle } from "./controls/FerryToggle"
import { TitleBar } from "./shared/TitleBar"
import { ControlsContainerProps } from "../types/interfaces"

const ControlsContainerComponent: React.FC<ControlsContainerProps> = ({
  children,
}) => {
  return (
    <Paper
      square
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
      elevation={8}
    >
      <TitleBar />
      <Box sx={{ px: 1.5, pt: 1 }}>
        <TravelModeSelect />
        <TrafficToggle />
        <FerryToggle />
      </Box>
      <Box sx={{ padding: 1.5, overflowY: "auto" }}>{children}</Box>
    </Paper>
  )
}

// Memoize to prevent unnecessary re-renders
export const ControlsContainer = React.memo(ControlsContainerComponent)
