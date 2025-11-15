import React, { useState } from "react"
import Typography from "@mui/material/Typography"
import Modal from "@mui/material/Modal"
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import { InfoOutlined } from "@mui/icons-material"

const InfoModal: React.FC = () => {
  const [open, setOpen] = useState<boolean>(true)

  const handleOpen = (): void => {
    setOpen(true)
  }

  const handleClose = (): void => {
    setOpen(false)
  }

  const modalContentSx = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "background.paper",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
    textAlign: "center",
  }

  return (
    <Box>
      <Button
        onClick={handleOpen}
        sx={{
          color: "white",
        }}
      >
        <InfoOutlined sx={{ mr: 1 }} />
      </Button>
      <Modal
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        open={open}
        onClose={handleClose}
      >
        <Box sx={modalContentSx}>
          <Typography variant="h6" id="modal-title" component="h2">
            NYC Open Routing
          </Typography>
          <Typography
            variant="body1"
            id="modal-description"
            sx={{ mt: 2, mb: 2 }}
          >
            This project is a Proof of Concept and not intended for real world
            routing scenarios.
            <br />
            For more information or if you would like to contribute, please
            visit the{" "}
            <a
              target="_blank"
              href="https://github.com/ishiland/nyc-open-routing"
              rel="noopener noreferrer"
            >
              github repository
            </a>
            .
          </Typography>
          <Button variant="contained" onClick={handleClose}>
            ok
          </Button>
        </Box>
      </Modal>
    </Box>
  )
}

export default InfoModal
