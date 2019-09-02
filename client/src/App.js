import React from "react";
import Sidebar from "./components/Sidebar";
import MapboxGLMap from "./components/MapboxGLMap";
import AddressContextProvider from "./contexts/AddressContext";
import RouteContextProvider from "./contexts/RouteContext";
import MessageContextProvider from "./contexts/MessageContext";
import TravelModeContextProvider from "./contexts/TravelModeContext";

function App() {
    return (
        <div className="App">
            <MessageContextProvider>
                <RouteContextProvider>
                    <AddressContextProvider>
                        <TravelModeContextProvider>
                            <Sidebar />
                            <MapboxGLMap />
                        </TravelModeContextProvider>
                    </AddressContextProvider>
                </RouteContextProvider>
            </MessageContextProvider>

        </div>
    );
}

export default App;