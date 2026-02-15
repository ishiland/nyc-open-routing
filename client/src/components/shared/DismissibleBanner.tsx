import React, { useState, useEffect } from "react"
import {
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  Link,
  Box,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import { useLocalStorage } from "../../hooks/useLocalStorage"

const BANNER_STORAGE_KEY = "nyc-routing-poc-banner-dismissed"

/**
 * DismissibleBanner component
 * Shows a POC disclaimer that can be dismissed and stays dismissed using localStorage
 */
export const DismissibleBanner: React.FC = () => {
  const [isDismissed, setIsDismissed] = useLocalStorage(
    BANNER_STORAGE_KEY,
    false,
  )
  const [showBanner, setShowBanner] = useState(!isDismissed)

  // Update showBanner when isDismissed changes
  useEffect(() => {
    setShowBanner(!isDismissed)
  }, [isDismissed])

  const handleDismiss = () => {
    setShowBanner(false)
    // Wait for animation to complete before setting localStorage
    setTimeout(() => {
      setIsDismissed(true)
    }, 300)
  }

  return (
    <Collapse in={showBanner}>
      <Box
        sx={{
          position: "relative",
          zIndex: 1200, // Above map but below modals
        }}
      >
        <Alert
          severity="info"
          variant="filled"
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={handleDismiss}
              sx={{
                minWidth: 44,
                minHeight: 44,
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          sx={{
            borderRadius: 0,
            "& .MuiAlert-message": {
              width: "100%",
            },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>
            NYC Open Routing - Proof of Concept
          </AlertTitle>
          This project is a proof of concept and not intended for real-world
          routing scenarios. For more information or to contribute, visit the{" "}
          <Link
            href="https://github.com/ishiland/nyc-open-routing"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: "inherit",
              textDecoration: "underline",
              fontWeight: 600,
              "&:hover": {
                textDecoration: "none",
              },
            }}
          >
            GitHub repository
          </Link>
          .
        </Alert>
      </Box>
    </Collapse>
  )
}

export default DismissibleBanner
