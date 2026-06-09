import json
from django.test import TestCase, Client

class SystemsTests(TestCase):
    def setUp(self):
        self.client = Client()
        user_data = {
            'nombre': 'User Systems',
            'email': 'systems@datium.com',
            'password': 'Password123!',
            'phone': '+12345678903',
            'planId': 1
        }
        self.client.post('/api/autenticacion/registro', data=json.dumps(user_data), content_type='application/json')
        login_res = self.client.post('/api/autenticacion/login', data=json.dumps({'email': 'systems@datium.com', 'password': 'Password123!'}), content_type='application/json')
        self.token = login_res.json().get('token')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}

    def test_sistemas(self):
        sys_res = self.client.post('/api/systems', data=json.dumps({'name': 'Mi Sistema Test'}), content_type='application/json', **self.headers)
        self.assertEqual(sys_res.status_code, 201)
        self.assertIsNotNone(sys_res.json().get('id'))
        sys_get = self.client.get('/api/systems', **self.headers)
        self.assertEqual(sys_get.status_code, 200)
        self.assertTrue(len(sys_get.json()) > 0)

# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_systems
