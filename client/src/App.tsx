// App.tsx
import React from "react";
import Sidebar from "./components/Sidebar";
import MapLibreGLMap from "./components/MapLibreGLMap";
import AddressContextProvider from "./contexts/AddressContext";
import RouteContextProvider from "./contexts/RouteContext";
import MessageContextProvider from "./contexts/MessageContext";
import TravelModeContextProvider from "./contexts/TravelModeContext";

const App: React.FC = () => {
    return (
        <div
            style={{
                height: '100vh',
                overflow: 'hidden',
                display: 'flex',
            }}
        >
            <MessageContextProvider>
                <RouteContextProvider>
                    <AddressContextProvider>
                        <TravelModeContextProvider>
                            <Sidebar />
                            <MapLibreGLMap />
                        </TravelModeContextProvider>
                    </AddressContextProvider>
                </RouteContextProvider>
            </MessageContextProvider>
        </div>
    );
};

export default App;
