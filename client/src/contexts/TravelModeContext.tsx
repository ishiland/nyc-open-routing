import React, { createContext, useState, ReactNode } from "react";

type TravelMode = 'drive' | 'walk' | 'bike';

interface TravelModeContextType {
    mode: TravelMode;
    setMode: (event: React.ChangeEvent<{}>, value: TravelMode) => void;
}

export const TravelModeContext = createContext < TravelModeContextType > ({
    mode: 'drive',
    setMode: () => { }
});

interface TravelModeContextProviderProps {
    children: ReactNode;
}

function TravelModeContextProvider({ children }: TravelModeContextProviderProps) {

    const [mode, setMode] = useState < TravelMode > ('drive');

    const toggleMode = (event: React.ChangeEvent<{}>, value: TravelMode) => {
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
