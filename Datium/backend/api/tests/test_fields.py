import json
from django.test import TestCase, Client

class FieldsTests(TestCase):
    def setUp(self):
        self.client = Client()
        user_data = {
            'nombre': 'User Fields',
            'email': 'fields@datium.com',
            'password': 'Password123!',
            'phone': '+12345678907',
            'planId': 1
        }
        self.client.post('/api/autenticacion/registro', data=json.dumps(user_data), content_type='application/json')
        login_res = self.client.post('/api/autenticacion/login', data=json.dumps({'email': 'fields@datium.com', 'password': 'Password123!'}), content_type='application/json')
        self.token = login_res.json().get('token')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}
        sys_res = self.client.post('/api/systems', data=json.dumps({'name': 'System Fields'}), content_type='application/json', **self.headers)
        self.system_id = sys_res.json().get('id')
        table_res = self.client.post(f'/api/systems/{self.system_id}/tables', data=json.dumps({'name': 'Table Fields'}), content_type='application/json', **self.headers)
        self.table_id = table_res.json().get('id')

    def test_fields(self):
        res = self.client.get(f'/api/tables/{self.table_id}/fields', **self.headers)
        self.assertEqual(res.status_code, 200)

# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_fields
