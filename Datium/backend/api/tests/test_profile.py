import json
from django.test import TestCase, Client

class ProfileTests(TestCase):
    def setUp(self):
        self.client = Client()
        user_data = {
            'nombre': 'User Profile',
            'email': 'profile@datium.com',
            'password': 'Password123!',
            'phone': '+12345678902',
            'planId': 1
        }
        self.client.post('/api/autenticacion/registro', data=json.dumps(user_data), content_type='application/json')
        login_res = self.client.post('/api/autenticacion/login', data=json.dumps({'email': 'profile@datium.com', 'password': 'Password123!'}), content_type='application/json')
        self.token = login_res.json().get('token')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}

    def test_perfil(self):
        profile_res = self.client.get('/api/user/profile', **self.headers)
        self.assertEqual(profile_res.status_code, 200)
        self.assertEqual(profile_res.json().get('email'), 'profile@datium.com')

# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_profile
