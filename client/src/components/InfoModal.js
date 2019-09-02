import React, { useState } from "react";
import Typography from "@material-ui/core/Typography";
import Modal from "@material-ui/core/Modal";
import Button from "@material-ui/core/Button";
import {useStyles} from '../utils/style'
import { InfoOutlined } from "@material-ui/icons";


function getModalStyle() {
    return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
    };
}

function InfoModal() {
    const [open, setOpen] = useState(true);
    // getModalStyle is not a pure function, we roll the style only on the first render
    const [modalStyle] = useState(getModalStyle);

    const handleOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };
    const classes = useStyles();

    return (
        <div className={classes.container}>
            <Button
                onClick={handleOpen}
                className={classes.infoButon}
            >
                <InfoOutlined className={classes.icon} />
            </Button>
            <Modal
                aria-labelledby="simple-modal-title"
                aria-describedby="simple-modal-description"
                open={open}
                onClose={handleClose}
            >
                <div style={modalStyle} className={classes.paper}>
                    <Typography variant="h6" id="modal-title">
                        NYC Open Routing
                    </Typography>
                    <Typography variant="subtitle1" id="simple-modal-description" className={classes.modalText}>
                        This project is a Proof of Concept and not intended for real world routing scenarios.
                        <p>For more information or if you would like to contribute, please visit the <a target="_blank"
                            href="https://github.com/ishiland/nyc-open-routing" rel="noopener noreferrer">github repository</a>.</p>
                    </Typography>
                    <Button variant="contained" onClick={handleClose}>ok</Button>
                </div>
            </Modal>
        </div>
    );
}

export default InfoModal;