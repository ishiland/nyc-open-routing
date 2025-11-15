import React from "react"
import Paper from "@mui/material/Paper"
import Box from "@mui/material/Box"

import { TravelModeSelect } from "./controls/TravelModeSelect"
import { TitleBar } from "./shared/TitleBar"
import { ControlsContainerProps } from "../types/interfaces"

const ControlsContainerComponent: React.FC<ControlsContainerProps> = ({
  children,
}) => {
  return (
    <Paper
      square
      sx={{
        width: 330,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
      elevation={8}
    >
      <TitleBar />
      <TravelModeSelect />
      <Box sx={{ padding: 2, overflowY: "auto", flexGrow: 1 }}>{children}</Box>
    </Paper>
  )
}

// Memoize to prevent unnecessary re-renders
export const ControlsContainer = React.memo(ControlsContainerComponent)
