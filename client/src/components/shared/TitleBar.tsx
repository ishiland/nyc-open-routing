import React from "react"
import { styled } from "@mui/material/styles"
import AppBar from "@mui/material/AppBar"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import InfoModal from "./InfoModal"

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  // Assuming primary color should come from the theme
  // color: theme.palette.primary.main, // This sets text color, AppBar bg is primary by default
}))

const StyledToolbar = styled(Toolbar)({
  minHeight: "48px", // Example for dense toolbar, adjust as needed
  paddingLeft: "16px", // Example padding
  paddingRight: "16px", // Example padding
})

const Title = styled(Typography)(({ theme }) => ({
  fontSize: "20px",
  fontWeight: 500, // Slightly bolder for better readability
  flexGrow: 1, // Make title take available space
  color: theme.palette.primary.contrastText, // Ensure proper contrast on primary background
}))

const TitleBarComponent: React.FC = () => {
  return (
    <>
      {/* Use background color from theme primary */}
      <StyledAppBar position="relative" color="primary">
        <StyledToolbar variant="dense">
          <Title variant="h6">
            NYC Open Routing
          </Title>
          <InfoModal />
        </StyledToolbar>
      </StyledAppBar>
    </>
  )
}

// Memoize presentational component to prevent unnecessary re-renders
export const TitleBar = React.memo(TitleBarComponent)
