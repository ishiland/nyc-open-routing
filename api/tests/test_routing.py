from api import api
from unittest import TestCase
import json
import sys


class TestDrivingRoutes(TestCase):

    def test_driving_oneway(self):
        coord_from = '-73.998048,40.683115'
        coord_to = '-73.998660,40.681763'
        response = self.app.get('api/route?orig={}&dest={}&mode=drive'.format(coord_from, coord_to))
        print(dir(response))
        print(json.loads(response.get_data().decode(sys.getdefaultencoding())))
        # assert <make your assertion here>
