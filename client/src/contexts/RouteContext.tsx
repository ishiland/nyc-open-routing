import React, { createContext, useState, ReactNode } from "react";
// Import shared types
import { Route, RouteFeature, RouteContextType as SharedRouteContextType } from "../types/interfaces";

// Remove local Route and Street interfaces

// Use the imported context type
interface RouteContextType extends SharedRouteContextType {}

export const RouteContext = createContext<RouteContextType>({
    route: {},
    selectedStreet: {} as RouteFeature, // Initialize with an empty RouteFeature assertion
    setRoute: () => { },
    setSelectedStreet: () => { },
});

interface RouteContextProviderProps {
    children: ReactNode;
}

function RouteContextProvider({ children }: RouteContextProviderProps) {

    // Use imported Route and RouteFeature types for state
    const [route, setRoute] = useState<Route>({});
    const [selectedStreet, setSelectedStreet] = useState<RouteFeature>({} as RouteFeature);

    return (
        <RouteContext.Provider
            value={{
                route,
                selectedStreet,
                // Ensure functions match the imported RouteContextType signature
                setRoute: (newRoute: Route) => setRoute(newRoute),
                setSelectedStreet: (newSelectedStreet: RouteFeature) => setSelectedStreet(newSelectedStreet),
            }}
        >
            {children}
        </RouteContext.Provider>
    );

}
export default RouteContextProvider;
