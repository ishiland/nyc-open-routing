import React from "react";
import {ControlsContainer} from "./ControlsContainer";
import Search from "./Search";
import {RouteList} from "./RouteList";
import {ButtonControls} from "./ButtonControls";
import Message from "./Message";


function Sidebar() {
    return (
        <section>
            <ControlsContainer>
                <Search type="Start"/>
                <Search type="End"/>
                <ButtonControls />
                <RouteList />
            </ControlsContainer>
            <Message  />
        </section>
    );
}

export default Sidebar;