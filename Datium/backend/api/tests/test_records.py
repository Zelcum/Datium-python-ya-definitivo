import json
from django.test import TestCase, Client

class RecordsTests(TestCase):
    def setUp(self):
        self.client = Client()
        user_data = {
            'nombre': 'User Records',
            'email': 'records@datium.com',
            'password': 'Password123!',
            'phone': '+12345678908',
            'planId': 1
        }
        self.client.post('/api/autenticacion/registro', data=json.dumps(user_data), content_type='application/json')
        login_res = self.client.post('/api/autenticacion/login', data=json.dumps({'email': 'records@datium.com', 'password': 'Password123!'}), content_type='application/json')
        self.token = login_res.json().get('token')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}
        sys_res = self.client.post('/api/systems', data=json.dumps({'name': 'System Records'}), content_type='application/json', **self.headers)
        self.system_id = sys_res.json().get('id')
        table_res = self.client.post(f'/api/systems/{self.system_id}/tables', data=json.dumps({'name': 'Table Records'}), content_type='application/json', **self.headers)
        self.table_id = table_res.json().get('id')

    def test_records(self):
        res = self.client.get(f'/api/tables/{self.table_id}/records', **self.headers)
        self.assertEqual(res.status_code, 200)

# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_records
