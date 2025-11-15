# LION

## About
LION is a single line representation of New York City streets containing address ranges and other information.

**Extents**
West longitude -74.260380
East longitude -73.699206
North latitude 40.917691
South latitude 40.477211
Spatial Reference StatePlane_New York Long_Island FIPS_3104 Feet

**Spatial Data Properties**
Geometry type: Polyline
Has topology: FALSE
Row Count: 241,442

## Fields

**Shape**
Data type: Geometry
Width: 0
Field Description: Feature geometry

**Street**
Data type: String
Width: 32
Field Description: Street or non-street feature name used for labeling.

**FeatureTyp**
Data type: String
Width: 1
Field Description: Feature Type Code
List of values:
    - Value 0: Street other than vehicle only street.
    - Value 1: Description Railroad
    - Value 2: Water Edge / Shoreline
    - Value 3: Census Block Boundary
    - Value 5: boroughs
    - Value 6: Private Street: This is a physically existing street which is not owned by the City and is not officially mapped. For example, streets in the Fort Totten and Breezy Point sections of Queens.
    - Value 7: District Boundary: Physically non-existent boundary for a community district, a police precinct, or a fire company.
    - Value 8: Physical Non-Street Boundary: Physically existing un-addressable boundary (such as a rock wall cemetery edge).
    - Value 9: Paper Street and Census/District Boundary: A legally mapped, but unbuilt street that also acts as a census block or district boundary.
    - Value A: Alley - a narrow street or passageway between and behind city buildings.
    - Value W: Path, Non-Vehicular, Addressable: This is a walking path that contains addresses. For example, some boardwalks and some walking paths in housing projects.
    - Value C: CCO (Corporation Counsel Opinion). A CCO is an opinion by the City's Law Department that a street area, not owned by the City, has been dedicated for public use, consistent with the requirements of General City Law, Section 36(2). That allows the City to use public funds for various improvements and services, including paving of the roadway and installing sewers. The request usually relates to planned work by the City's Department of Transportation, Department of Design and Construction, and Department of Environmental Protection.
    - Value F: Ferry Route: A schematic representation of a ferry's passage through a water body. Please note that only selected ferry routes required for the bicycle routing within NYC are included.

**SegmentTyp**
Data type: String
Width: 1
Field Description: This field is used to define the segment's status in relation to the horizontal topology enhancements first introduced with LION 06A.
List of values:
	- Value B: Both - Segment is both generic and roadbed; the center roadbed segment of a divided roadway containing an odd number of roadbeds.
	- Value C: Connector - Segments used to connect adjacent roadbeds of a divided street. Typically these exist to allow traffic flow from one roadbed to another.
	- Value E: Entrance/Exit Ramp - Connects a highway to a different street or highway.
	- Value F: Faux Segment - These are used when a street or ramp physically ends at a roadbed, but connectivity needs to be maintained with the generic segment.
    - Value G: Generic Segment - An imaginary single line representation of a physically divided street.
    - Value R: Roadbed Segment - Depicts physically separated carriageway segments of a particular street.
    - Value T: Terminator - Used to model situations where a divided section of a street terminates, but the street itself continues.
    - Value U: Undivided Street - All other LION segments that do not fall into any of the above categories.
    - Value S: Suppressed - Undivided segment to be suppressed in a generic view of LION

**NonPed**
Data type: String
Width: 1
Field Description: Non-Pedestrian Indicator.
List of values:
	- Value D: Pedestrian accessible, but are excluded by the Department of Education in determining walking routes from a pupil's home to their school. 
	- Value V: Vehicle-only: primarily roadways, inaccessible to pedestrian usage.

**TrafDir**
Data type: String
Width: 1
Field Description: Traffic Direction. Code indicating the flow of traffic relative to the street segment's directionality.
List of values:
	-Value W: With: One-way street, traffic flows with the segment's directionality, i.e., from the segment's FROM node to the TO node..
	-Value A: Against: One-way street, traffic flows from against the segment's directionality, i.e., from the segment's TO node to the FROM node.
	-Value T: Two-Way: Traffic flows in both directions.
	-Value P: Pedestrian path: Non-vehicular.
	-Value blank: Non-street feature.

**SeqNum**
Data type: String
Width: 5
Field Description: Sequence Number: A five digit number assigned sequentially to the street segments within a given face code. The sequence number generally increases with
the directionality of the street. Also a component field of a unique identifier in LION known as the LIONkey (comprised of Boro, FaceCode and SeqNum.


**SegmentID**
Data type: String
Width: 7
Field Description: Segment ID: A seven digit number (right justified, zero filled) that identifies each segment of a street or a non-street feature represented in the LION file.
Segment ID differs from the LIONKey (see FaceCode and SeqNum definitions) in that the former identifies a geographic entity, whereas the latter identifies a
record in the LION file. In the case of a segment lying along a borough boundary (for example, the Brooklyn-Queens border), there will be two distinct
LIONKeys (one for each borough), but the Segment ID in each LION record will be identical since it refers to the same physical geometry.

**SegCount**
Data type: String
Width: 1
Field Description: Coincident Segment Count: Indicates situations where there are double-decker roads and therefore more than one segment for the same geography in LION
(as it is maintained in CSCL). An example would be the upper and lower roadways of the George Washington Bridge. In this case, the SegCount would be
equal to 2. Most LION segments will have a SegCount of 1. However there will appear to be some anomalies because of the difference in the way LION is
maintained, and the way it must be exported. For example, the Department of City Planning maintains an associated Special Address file that links various
types of special address records (described further down in this document) to the LION file. In the BYTES version of LION, the only way to include these
special address records is by replicating the segment with alternate address information. The result can be multiple records with the same Segment ID while
the coincident segment count remains '1'.

**LocStatus**
Data type: String
Width: 1
Field Description: Segment Locational Status.
List of values:
	-Value H: Land-hooked segment, i.e. a segment internal to a Dynamic Block but not a dead end.
	-Value I: Dead end segment
	-Value X: Tract Boundary segment other than a borough boundary
	-Value 1: Segment bordering Manhattan
	-Value 2: Segment bordering The Bronx
	-Value 3: Segment bordering Brooklyn
	-Value 4: Segment bordering Queens
	-Value 5: Segment bordering Staten Island
	-Value 9: Segment on the New York City Boundary

**NodeIDFrom**
Data type: String
Width: 7
Field Description: Node identifier at the low address end, or beginning of the segment.

**NodeIDTo**
Data type: String
Width: 7
Field Description: Node identifier at the high address end, or end of the segment.

**NodeLevelF**
Data type: String
Width: 1
Field Description: Level code indicator vertical topology at the start of the street segment.
List of values:
	-Value A-Z: Relative level code on a scale where A is the lowest level of subterranean, M is ground level and Z is highest elevated level.
    -Value *: Level-less feature associated with node. The asterisk is used to indicate the level-code on non-physical geometry, such as generic roadbed segments. Since these are non-physical, there is no 'real' level code that can be associated.
	-Value $: Shoreline / water level.

**NodeLevelT**
Data type: String
Width: 1
Field Description: Level code indicator vertical topology at the end of the street segment.
List of values:
	-Value A-Z: Relative level code on a scale where A is the lowest level of subterranean, M is ground level and Z is highest elevated level.
    -Value *: Level-less feature associated with node. The asterisk is used to indicate the level-code on non-physical geometry, such as generic roadbed segments. Since these are non-physical, there is no 'real' level code that can be associated.
	-Value $: Shoreline / water level.

**ConParity**
Data type: String
Width: 1
Field Description: Continuous Parity Indicator (Domain Values = L, R). A continuous parity segment has both odd and even addresses on the same side of the segment, and no
addresses on the other side. In a LION record that represents a continous parity segment, the odd and even address ranges are stored separately and the 1-
byte code indicates on which side of the street the addresses physically exist.
List of values:
	-Value L: Odd and Even house number are bothe on the left side of the segment.
	-Value R: Odd and Even house number are bothe on the right side of the segment.

**Twisted**
Data type: String
Width: 1
Field Description: Twisted Parity: Occasionally, the address parities along a street switch. If a 'T' value exists in this field, it indicates that the parities have changed since the
immediately preceding segment of the same street (i.e., if odd addresses were on the left, now they are on the right).
List of values:
	-Value T: were on the left, they are now on the right). Indicates that the address parities along a street have switched since the immediately preceding segment of the same street (i.e., if odd addresses)

**RW_Type**
Data type: String
Width: 2
Field Description: Roadway Type
List of values:
	-Value 1: Street
	-Value 2: Highway
	-Value 3: Bridge
	-Value 4: Tunnel
	-Value 5: Boardwalk
	-Value 6: Path/Trail
	-Value 7: Step Street
	-Value 8: Driveway
	-Value 9: Ramp
	-Value 10: Alley
	-Value 11: Unknown
	-Value 12: Non-Physical Street Segment
	-Value 13: U-Turn
	-Value 14: Ferry Route

**PhysicalID**
Data type: Integer
Width: 4
Field Description: A unique ID assigned in order to aggregate granular geometry to represent a Physical View of the city's street network. In CSCL, segmentation is very
granular in order to accommodate many types of physical and non-physical geometry. The Physical ID is a unique number used to identify a physically
existing piece of geometry that may or may not be comprised of several Segment IDs. For example, E 28 Street between 2nd Ave and 3rd Ave in Manhattan
would have 1 Physical ID although there are 3 segments defining that block face, with 3 separate Segment IDs.

**GenericID**
Width: 4
Field Description: A unique ID assigned in order to aggregate granular geometry to represent a Generic View of the city's street network. Streets that contain multiple
carriageways or roadbeds (such as Queens Boulevard in Queens and Park Ave in Manhattan) are represented by multiple centerlines corresponding to each
roadbed as well as an imaginary 'single' generic centerline.

**Status**
Data type: String
Width: 1
Field Description: Refers to the construction status of a street segment.
List of values:
	-Value 1: Planned Private
	-Value 2: Constructed
	-Value 3: Paper
	-Value 4: Under Construction
	-Value 5: Demapped
	-Value 9: Paper Street Coincident with Boundary

**StreetWidth_Min**
Data type: Double
Width: 8
Field Description: Formerly known as StreetWidth, this represents the narrowest width, in feet, of the paved area of the street. These values correspond to the StreetWidth

**BikeLane**
Data type: String
Width: 2
Field Description: Defines which segments are part of the bicycle network as defined by the Department of Transportation. These values correspond to Bike Lane 2 in
List of values:
	-Value 1: Class 1 - Separated Greenway
	-Value 2: Class II - Striped Bike Lane
	-Value 3: Class III - Signed Bicycle Route
	-Value 4: Links - Connecting segments.
	-Value 5: Class I, II - Combination of Class I and II
	-Value 6: Class II, III - Combination of Class II and III
	-Value 7: Stairs - Includes step streets, bridge stairs, etc.
	-Value 8: Class I, III - Combination of Class I and III
	-Value 9: Class II, I - Combination of Class II and I
	-Value 10: Class III, I - Combination of Class III and I
	-Value 11: Class III, II - Combination of Class III and II

**Snow_Priority**
Data type: String
Width: 1
Field Description: DSNY snow removal priority designation.
List of values:
	-Value blank: unknown
	-Value C: Critical: These routes are comprised of highways (main beds, entrances, exits, interchanges), arterial roadways, main travel thoroughfares (single land and multi-lane), bus routes, that contain emergency services and first responder facilities (Hospitals, EMS, FDNY, NYPD) and schools.
	-Value S: truck with a plow attached. Sector: Designed to encompass all streets that are not classified as Critical Streets and are awide enough to accommodate a full size DSNY collection
	-Value H: Haulster: Designed to service dead ends and streets that cannot be serviced with a collection truck or salt spreader with a plow attached due to narrow street Width: or tight turning radius (either entering or exiting the street).
	-Value V: Non-DSNY

**Number_Travel_Lanes**
Data type: String
Width: 2
Field Description: The number of lanes in a carriageway (roadway) that are designated for the movement of vehicles traveling from one destination to another. The number of
travel lanes were determined by DoITT's consultants working on the planimetric feature classes for NYC.

**Number_Park_Lanes**
Data type: String
Width: 2
Field Description: The number of lanes in a carriageway (roadway) that are reserved for parallel parking of vehicles. The number of parking lanes were determined by DoITT’s
consultants working on the planimetric feature classes for NYC.
Park

**Number_Total_Lanes**
Data type: String
Width: 2
Field Description: The total number of lanes in a carriageway (roadway) including travel lanes and parking lanes. The total number of lanes were determined by DoITT’s
consultants working on the planimetric feature classes for NYC.

**Carto_Display_Level**
Data type: String
Width: 20
Field Description: Cartographic Display Level: Select LION segments are flagged as a way to designate major roads for cartographic purposes at various scales.
List of values:
	-Value 10: City
	-Value 20: Borough
	-Value 30: Neighborhood

**ROW_Type**
Data type: String
Width: 1
Field Description: Right-of-Way Type: These refer only to subway and rail segments.
List of values:
	-Value 1: Subterranean
	-Value 2: Elevated
	-Value 3: Surface
	-Value 4: Hidden
	-Value 5: Open Cut Depression
	-Value 6: Embankment
	-Value 7: Viaduct
	-Value 8: Subterranean Coincident with Boundary

**LLo_Hyphen**
Data type: String
Width: 7
Field Description: Low Value for the hyphenated address range beginning on the left side of the street segment. Left and right are defined relative to a street segment's
direction. For streets that have addresses, the direction of a DCPLION streeet segment is determined by the direction of increasing address numbers. Note
that this direction is unrelated to the street's traffic direction or its orientation relative to the points of the compass. The direction of streets with out address
numbers, as well as non-street features, is assigned arbitrarily, but is consistent within the street feature. Direction can usually be determined by observing
which way the SeqNum increases. Includes hyphenated addresses.

**LHi_Hyphen**
Data type: String
Width: 7
Field Description: High Value for the hyphenated address range beginning on the left side of the street segment.

**RLo_Hyphen**
Data type: String
Width: 7
Field Description: Low Value for the hyphenated address range beginning on the right side of the street segment.

**RHi_Hyphen**
Data type: String
Width: 7
Field Description: High Value for the hyphenated address range beginning on the right side of the street segment.

**FromLeft**
Data type: Integer
Width: 4
Field Description: Low Value for the numeric address range beginning on the left side of the street segment. For all hyphanated addresses, the hyphen has been removed. To convert the before hyphen portion of the house number is multiplied by 1000 and then added to the after hyphen portion of the house number (e.g. 101-40 would be converted to 101040).

**ToLeft**
Data type: Integer
Width: 4
Field Description: High Value for the numeric address range beginning on the left side of the street segment.

**FromRight**
Data type: Integer
Width: 4
Field Description: Low Value for the numeric address range beginning on the right side of the street segment.

**ToRight**
Data type: Integer
Width: 4
Field Description: High Value for the numeric address range beginning on the right side of the street segment.

**Join_ID**
Data type: String
Width: 15
Field Description: Identification field used to link LION feature class with Alternative Names table during a geocoding operation.

**BIKE_TRAFDIR**
Data type: String
Width: 2
Field Description: defines bicycle traffic direction on segments that are part of the bicycle network as defined by the Department of Transportation.
List of values:
	-Value blank: This segment is not part of the bicycle network as defined by the Department of Transportation.
	-Value FT: Bike traffic is one way. The bike traffic flow is with the direction of increasing addresses, if any. This direction is also known as ‘with’ the segment’s logical direction, i.e. from the FROM node to the TO node.
	-Value TF: Bike traffic is one way. The bike traffic flow is against the direction of increasing addresses, if any. This direction is also known as ‘against’ the segment’s logical direction, i.e. from the TO node to the FROM node.
	-Value TW: Bike traffic is two way. Bicycles travel in both directions.

**ACTIVE_FLAG**
Data type: String
Width: 1
Field Description: ACTIVE_FLAG only applies to LION segments representing subway features. This field is being introduced with the digitization of the 2nd Avenue subway to
indicate which portions are open versus under construction or proposed.
List of values:
	-Value Y: This portion of the subway is active and open.
	-Value N: This portion of the subway is inactive, i.e. either under construction or proposed.
	-Value NULL: This segment does not represent a subway feature.Hide Field ACTIVE

**POSTED_SPEED**
Data type: String
Width: 2
Field Description: POSTED SPEED contains the speed limit, in miles per hour, of the paved area.

**SHAPE_Length**
Data type: Double
Width: 8
Field Description: Length of feature in internal units.

**StreetWidth_Max**
Data type: Double
Width: 8
Field Description: The maximum width, in feet, of the paved area of the street.

**TRUCK_ROUTE_TYPE**
Data type: String
Width: 1
Field Description: vehicles.
Segments that are part of the New York City truck route network designated by Department of Transportation for use by trucks and other commercial
List of values:
	-Value 1: Limited Local
	-Value 2: Local
	-Value 3: Through
