interface Route {
    properties: {
        travel_time: number;
        distance: number;
    };
}

export const formatDistance = (feet: number): string => {
    let distance = '';
    if (feet > 1000) {
        distance = `${(feet / 5260).toFixed(1)} mi`;
    } else {
        distance = `${Math.floor(feet)} ft`
    }
    return distance;
};

export const formatTotalRouteTime = (routes: Route[]): string => {
    let time = '';
    const minutes = routes.map(x => x.properties.travel_time).reduce((a, c) => a + c);
    if (minutes > 60) {
        const quotient = Math.floor(minutes / 60);
        const remainder = Math.floor(minutes % 60);
        time = `${quotient} hr ${remainder} min`
    } else {
        time = `${Math.floor(minutes)} min`
    }
    return time;
};


export const formatTotalRouteDistance = (routes: Route[]): string => {
    const feet = routes.map(x => x.properties.distance).reduce((a, c) => a + c);
    return formatDistance(feet)
};

interface GeosupportData {
    Longitude?: string;
    Latitude?: string;
    [key: string]: any;
}

export const geosupportToGeojson = (data: GeosupportData) => {
    const longitude = data.Longitude ? parseFloat(data.Longitude) : 0;
    const latitude = data.Latitude ? parseFloat(data.Latitude) : 0;

    return {
        "type": "Feature",
        "properties": data,
        "geometry": {
            "type": "Point",
            "coordinates": [
                longitude,
                latitude
            ]
        }
    }
};