-- Turn restrictions table. Need to identify grade separation turns.
-- see https://github.com/pgRouting/pgrouting/wiki/TRSP-for-railroads
DROP TABLE IF EXISTS restrictions;

CREATE TABLE restrictions (
    rid serial,
    to_cost double precision,
    to_edge integer,
    from_edge integer,
    via text
);

