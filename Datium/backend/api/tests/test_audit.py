import json
from django.test import TestCase, Client

class AuditTests(TestCase):
    def setUp(self):
        self.client = Client()
        user_data = {
            'nombre': 'Audit User',
            'email': 'audit@datium.com',
            'password': 'Password123!',
            'phone': '+12345678906',
            'planId': 1
        }
        self.client.post('/api/autenticacion/registro', data=json.dumps(user_data), content_type='application/json')
        login_res = self.client.post('/api/autenticacion/login', data=json.dumps({'email': 'audit@datium.com', 'password': 'Password123!'}), content_type='application/json')
        self.token = login_res.json().get('token')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}

    def test_audit_logs(self):
        res = self.client.get('/api/auditoria/logs/filtrar', **self.headers)
        self.assertEqual(res.status_code, 200)

# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_audit
