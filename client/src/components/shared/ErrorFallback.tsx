import React from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Paper from "@mui/material/Paper"
import { Refresh, ErrorOutline } from "@mui/icons-material"

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        bgcolor: "background.default",
        p: 3,
      }}
      role="alert"
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 600,
          width: "100%",
          p: 4,
          textAlign: "center",
        }}
      >
        <ErrorOutline
          sx={{
            fontSize: 80,
            color: "error.main",
            mb: 2,
          }}
        />

        <Typography variant="h4" component="h1" gutterBottom>
          Oops! Something went wrong
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          We're sorry, but something unexpected happened. The error has been
          logged and our team will look into it.
        </Typography>

        {import.meta.env.DEV && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 3,
              bgcolor: "grey.100",
              textAlign: "left",
              overflow: "auto",
            }}
          >
            <Typography
              variant="body2"
              component="pre"
              sx={{
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </Typography>
            {error.stack && (
              <Typography
                variant="caption"
                component="pre"
                sx={{
                  fontFamily: "monospace",
                  mt: 1,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: "0.7rem",
                }}
              >
                {error.stack}
              </Typography>
            )}
          </Paper>
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={resetErrorBoundary}
          startIcon={<Refresh />}
          size="large"
        >
          Try Again
        </Button>
      </Paper>
    </Box>
  )
}

export default ErrorFallback
