// Sidebar.tsx
import React from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ControlsContainer } from "./ControlsContainer";
import Search from "./Search";
import { RouteList } from "./RouteList";
import { ButtonControls } from "./ButtonControls";
import Message from "../shared/Message";

const Sidebar: React.FC = () => {
    const theme = useTheme();
    
    return (
        <Box
            data-testid="sidebar"
            sx={{
                width: '330px',
                height: '100vh',
                overflowY: 'auto',
                borderRight: `1px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.background.paper
            }}
        >
            <ControlsContainer>
                <Search type="Start" />
                <Search type="End" />
                <ButtonControls />
                <RouteList />
            </ControlsContainer>
            <Message />
        </Box>
    );
};

export default Sidebar;
