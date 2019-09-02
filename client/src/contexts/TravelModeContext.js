import React, { createContext, useState } from "react";

export const TravelModeContext = createContext();


function TravelModeContextProvider({ children }) {

    const [mode, setMode] = useState('drive');

    const toggleMode = (event, value) => {
        setMode(value)
    };

    return (
        <TravelModeContext.Provider
            value={{
                mode,
                setMode: toggleMode
            }}
        >
            {children}
        </TravelModeContext.Provider>
    );

}
export default TravelModeContextProvider;
