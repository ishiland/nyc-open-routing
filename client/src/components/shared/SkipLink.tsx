import React from "react"
import { styled } from "@mui/material/styles"

const SkipLinkStyled = styled("a")(({ theme }) => ({
  position: "absolute",
  left: "-9999px",
  zIndex: 9999,
  padding: theme.spacing(1, 2),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  textDecoration: "none",
  fontSize: "1rem",
  fontWeight: 600,
  "&:focus": {
    left: theme.spacing(1),
    top: theme.spacing(1),
    outline: `3px solid ${theme.palette.secondary.main}`,
    outlineOffset: "2px",
  },
}))

export const SkipLink: React.FC = () => {
  return (
    <SkipLinkStyled href="#main-content">Skip to main content</SkipLinkStyled>
  )
}

export default SkipLink
