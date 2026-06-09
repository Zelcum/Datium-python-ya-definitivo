import json
from django.test import TestCase, Client

class PublicTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_plans(self):
        res = self.client.get('/api/plans')
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.json(), list)

# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_plans
