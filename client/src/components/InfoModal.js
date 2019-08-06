import React from "react";
import {makeStyles} from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Modal from "@material-ui/core/Modal";
import Button from "@material-ui/core/Button";
import {InfoOutlined} from "@material-ui/icons";


function getModalStyle() {
    return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
    };
}

const useStyles = makeStyles(theme => ({
    paper: {
        position: 'absolute',
        width: 400,
        backgroundColor: theme.palette.background.paper,
        boxShadow: theme.shadows[5],
        padding: theme.spacing(4),
        outline: 'none',
    },
    icon: {
        color: '#f5f5f5',
        fontSize: 20
    },
    container: {
        margin: 'auto',
        marginRight: '0'
    },
    modalText: {
        fontSize: "14px"
    },
    infoButon:{
        padding: theme.spacing(1),
        minWidth:'40px'
    }
}));

function InfoModal() {
    const [open, setOpen] = React.useState(true);
    // getModalStyle is not a pure function, we roll the style only on the first render
    const [modalStyle] = React.useState(getModalStyle);

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
                <InfoOutlined className={classes.icon}/>
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
                        This project is a proof-of-concept and not intended for real world routing scenarios.
                        <p>For more information or if you would like to contribute, please visit the <a
                            href="https://github.com/ishiland/nyc-open-routing">github repository</a>.</p>
                    </Typography>
                    <Button onClick={handleClose}>ok</Button>
                </div>
            </Modal>
        </div>
    );
}

export default InfoModal;