#!/usr/bin/env python3
import os
from flask import Flask
from flask_restful import Resource, Api, reqparse, marshal_with, fields
from flask_sqlalchemy import SQLAlchemy
from shapely import wkb, geometry
from geosupport import Geosupport
from suggest import GeosupportSuggest

g = Geosupport()
s = GeosupportSuggest(g)

user = os.getenv('POSTGRES_USER')
password = os.getenv('POSTGRES_PASSWORD')
database = os.getenv('POSTGRES_DB')
host = os.getenv('POSTGRES_HOST')
flask_env = os.getenv('FLASK_ENV')

app = Flask(__name__)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://{}:{}@{}:{}/{}".format(user, password, host, '5432', database)

api = Api(app, prefix='/api')
db = SQLAlchemy(app)


def dump_geo(data):
    if data is None:
        return None
    p = wkb.loads(data, hex=True)
    return geometry.mapping(p)


resource_fields = {
    'properties': {
        'seq': fields.Integer,
        'street': fields.String,
        'distance': fields.Float,  # feet
        'travel_time': fields.Float,
        # 'feature_type': fields.String,
    },
    'geometry': fields.Raw(attribute=lambda x: dump_geo(x.geom))
}


class GeoRouter(Resource):
    @marshal_with(resource_fields, envelope='features')
    def get(self):
        parser = reqparse.RequestParser()
        parser.add_argument('orig', type=str, trim=True, required=True)
        parser.add_argument('dest', type=str, trim=True, required=True)
        parser.add_argument('mode', type=str, trim=True, required=True)
        args = parser.parse_args()
        if args['mode'] == 'drive':
            route_result = db.engine.execute("SELECT * FROM getdrivingroute({},{})".format(args['orig'], args['dest']))
            return route_result.fetchall()
        elif args['mode'] == 'bike':
            route_result = db.engine.execute("SELECT * FROM getbikingroute({},{})".format(args['orig'], args['dest']))
            return route_result.fetchall()
        elif args['mode'] == 'walk':
            route_result = db.engine.execute("SELECT * FROM getwalkingroute({},{})".format(args['orig'], args['dest']))
            return route_result.fetchall()
        return '', 204


api.add_resource(GeoRouter, '/route', endpoint='route')


class AddressSearch(Resource):
    def get(self):
        parser = reqparse.RequestParser()
        parser.add_argument('address', type=str, trim=True, required=True)
        args = parser.parse_args()
        return s.suggestions(args['address'])


api.add_resource(AddressSearch, '/search', endpoint='search')

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
