# NYC Open Routing
An open source approach to routing using authoritative NYC data. This project is currently a proof of concept and not intended for real world routing scenarios.

![image](./screen.png)

## Features
- Driving, Walking and Biking routes using DCP's [LION](https://www1.nyc.gov/site/planning/data-maps/open-data/dwn-lion.page) data
- DCP's [Geosearch API](https://geosearch.planninglabs.nyc/) for easy address searching
- Routing capabilities using PostgreSQL + [PostGIS](https://postgis.net/) + [pgRouting](https://pgrouting.org/)
- Web API using [Flask RESTful](https://flask-restful.readthedocs.io/en/latest/)
- Frontend built with [React](https://reactjs.org/) and [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/api/)
- Containerized with [Docker](https://docs.docker.com/engine/docker-overview/)

## Getting Started

Requires: Docker and docker-compose

1. Clone this repo

    `$ git clone https://github.com/ishiland/nyc-open-routing.git && cd nyc-open-routing`

    and cd into it

    `$ cd nyc-open-routing`
2. Build and start the containers. Default version of LION is 19b:
    
    `$ docker-compose up`
    
    Specify a different version of LION: 
    
    `$ docker-compose up --build-arg LION=19c`
3. The initial container building and data loading will take some time. It is helpful if you can allocate more memory and cpu to the database container to expedite this process.
4. When build is complete, navigate to http://localhost:3000. 

## db
Once loaded into the `postgis` container, Lion data will persist in the `postgresql_data` volume. Any subsequent re-build will ignore data loading scripts unless the `postgresql_data` volume is removed. See [Docker Postgres](https://docs.docker.com/samples/library/postgres/) for additional information.
 
## api
Use the flask api to query routes directly. All successful requests return GeoJSON w/MultiLineString geometries. You can comment out the `client` container in the docker-compose.yml if all you require is the api. 

Parameters:

- `orig`: Origin coordinates. Expects a comma separated _lat,long_.
- `dest`: Destination coordinates. Expects a comma separated _lat,long_.
- `mode`: Travel mode. Can be `drive`, `walk` or `bike`

Example request:
http://localhost:5000/api/route?orig=-74.0117,40.649221&dest=-73.951458,40.797061&mode=drive

response:
```js
{
    "features": [
        {
            "properties": {
                "seq": 1,  // sequence of segment in route
                "street": "3 AVENUE",
                "distance": 260.679437746423,  // distance of segment in feet
                "travel_time": 0.0987422112675845,  // travel time of segment in minutes 
                "feature_type": "0"  // 'FeatureTyp' field from LION
            },
            "geometry": {
                "type": "GeometryCollection",
                "geometries": [
                    {
                        "type": "MultiLineString",
                        "coordinates": [
                            [
                                [
                                    -74.01149956053376,
                                    40.65037686591395
                                ],
                                [
                                    -74.01207536260924,
                                    40.649811516367066
                                ]
                            ]
                        ]
                    }
                ]
            }
        },
...
```


### Further Ideas

- Incorporate traffic data to more accurately calculate driving costs. Live or static traffic data would be a significant improvement.
- Add public transit modes using MTA data.
- Ferry schedules for more accurate biking/walking cost.
- Travel time isochrones for selected addresses.
- Line Merge segments where possible to optimize and reduce complexity of graph.
- Optimize functions by adding BBOX parameter. 
- Add turn by turn directions with angle (left, right, sharp right, etc. ) similar to google maps. 
- Send GeoJSON directly from the database using `ST_AsGeoJSON` to remove gdal dependency in `api` container.

### Resources
- https://github.com/mixedbredie/highways-for-pgrouting
- https://docs.pgrouting.org/latest/en/pgRouting-concepts.html
