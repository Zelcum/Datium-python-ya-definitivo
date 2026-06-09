import json
from django.test import TestCase, Client

class AuthTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user_data = {
            'nombre': 'User Auth',
            'email': 'auth@datium.com',
            'password': 'Password123!',
            'phone': '+12345678901',
            'planId': 1
        }
        self.login_data = {
            'email': 'auth@datium.com',
            'password': 'Password123!'
        }

    def test_registro_y_login(self):
        response_register = self.client.post(
            '/api/autenticacion/registro', 
            data=json.dumps(self.user_data), 
            content_type='application/json'
        )
        self.assertEqual(response_register.status_code, 201)
        response_login = self.client.post(
            '/api/autenticacion/login', 
            data=json.dumps(self.login_data), 
            content_type='application/json'
        )
        self.assertEqual(response_login.status_code, 200)
        self.assertTrue('token' in response_login.json())

# Para ejecutar este modulo en consola (copia y pega estas dos lineas):
# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_auth
