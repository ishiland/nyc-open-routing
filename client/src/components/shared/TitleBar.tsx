import React from "react";
import { styled } from "@mui/material/styles";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import InfoModal from "./InfoModal";


const StyledAppBar = styled(AppBar)(({ theme }) => ({
    // Assuming primary color should come from the theme
    // color: theme.palette.primary.main, // This sets text color, AppBar bg is primary by default
}));

const StyledToolbar = styled(Toolbar)({
    minHeight: '48px', // Example for dense toolbar, adjust as needed
    paddingLeft: '16px', // Example padding
    paddingRight: '16px', // Example padding
});

const Title = styled(Typography)({
    fontSize: '20px',
    fontWeight: 400,
    flexGrow: 1, // Make title take available space
});

export const TitleBar: React.FC = () => {
    return (
        <>
            {/* Use background color from theme primary */}
            <StyledAppBar position='relative' color="primary">
                <StyledToolbar variant="dense">
                    <Title variant="h6" color="inherit"> {/* Use h6 for AppBar title consistency */}
                        NYC Open Routing
                    </Title>
                    <InfoModal /> 
                </StyledToolbar>
            </StyledAppBar>
        </>
    );
}; 