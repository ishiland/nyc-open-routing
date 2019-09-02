import unittest

from geosupport import Geosupport
from suggest import GeosupportSuggest
from api import api

class TestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        g = Geosupport()
        cls.suggest = GeosupportSuggest(g)
        cls.app = api.app.test_client()