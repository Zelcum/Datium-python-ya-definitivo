import json
from django.test import TestCase, Client

class TablesTests(TestCase):
    def setUp(self):
        self.client = Client()
        user_data = {
            'nombre': 'User Tables',
            'email': 'tables@datium.com',
            'password': 'Password123!',
            'phone': '+12345678904',
            'planId': 1
        }
        self.client.post('/api/autenticacion/registro', data=json.dumps(user_data), content_type='application/json')
        login_res = self.client.post('/api/autenticacion/login', data=json.dumps({'email': 'tables@datium.com', 'password': 'Password123!'}), content_type='application/json')
        self.token = login_res.json().get('token')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}
        sys_res = self.client.post('/api/systems', data=json.dumps({'name': 'Sistema Tablas'}), content_type='application/json', **self.headers)
        self.system_id = sys_res.json().get('id')

    def test_tablas(self):
        table_res = self.client.post(f'/api/systems/{self.system_id}/tables', data=json.dumps({'name': 'Tabla Test'}), content_type='application/json', **self.headers)
        self.assertEqual(table_res.status_code, 201)
        self.assertIsNotNone(table_res.json().get('id'))
        tables_get = self.client.get(f'/api/systems/{self.system_id}/tables', **self.headers)
        self.assertEqual(tables_get.status_code, 200)
        self.assertTrue(len(tables_get.json()) > 0)

# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_tables
