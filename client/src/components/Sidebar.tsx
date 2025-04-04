// Sidebar.tsx
import React from "react";
import { ControlsContainer } from "./ControlsContainer";
import Search from "./Search";
import { RouteList } from "./RouteList";
import { ButtonControls } from "./ButtonControls";
import Message from "./Message";

const Sidebar: React.FC = () => {
    return (
        <div style={{ width: '330px', height: '100vh', overflowY: 'auto' }}>
            <ControlsContainer>
                <Search type="Start" />
                <Search type="End" />
                <ButtonControls />
                <RouteList />
            </ControlsContainer>
            <Message />
        </div>
    );
};

export default Sidebar;
