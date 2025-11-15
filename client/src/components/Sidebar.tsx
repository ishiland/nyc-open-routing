// Sidebar.tsx
import React from "react"
import { ControlsContainer } from "./ControlsContainer"
import Search from "./controls/Search"
import { RouteList } from "./controls/RouteList"
import { ButtonControls } from "./controls/ButtonControls"
import Message from "./shared/Message"

const Sidebar: React.FC = () => {
  return (
    <aside
      style={{ width: "330px", height: "100vh", overflowY: "auto" }}
      aria-label="Route planning controls"
    >
      <nav aria-label="Address input and routing">
        <ControlsContainer>
          <Search type="Start" />
          <Search type="End" />
          <ButtonControls />
          <RouteList />
        </ControlsContainer>
      </nav>
      <Message />
    </aside>
  )
}

export default Sidebar
