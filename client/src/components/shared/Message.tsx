import React, { useContext } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Alert, { AlertColor } from '@mui/material/Alert';
import { MessageContext } from '../../contexts/MessageContext';
import { MessageContextType, MessageLevel } from "../../types/interfaces";

const Message: React.FC = () => {
    const { closeMessage, messageText, messageLevel, messageOpen } = useContext<MessageContextType>(MessageContext);

    const alertSeverity = messageLevel as AlertColor;

    if (!messageOpen) {
        return null;
    }

    return (
        <Snackbar
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
            }}
            open={messageOpen}
            autoHideDuration={6000}
            onClose={closeMessage}
        >
            <Alert
                onClose={closeMessage}
                severity={alertSeverity}
                sx={{ width: '100%' }}
                action={
                    <IconButton
                        aria-label="close"
                        color="inherit"
                        size="small"
                        onClick={closeMessage}
                    >
                        <CloseIcon fontSize="inherit" />
                    </IconButton>
                }
            >
                {messageText}
            </Alert>
        </Snackbar>
    );
}

export default Message;