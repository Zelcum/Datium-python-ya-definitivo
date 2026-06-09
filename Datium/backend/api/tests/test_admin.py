import json
from django.test import TestCase, Client

class AdminTests(TestCase):
    def setUp(self):
        self.client = Client()
        # El administrador ibzantrabajo@gmail.com se crea automáticamente en seed_data()
        # al hacer la primera llamada a la API (o usamos views.seed_data())
        # Llamamos al login directamente para forzar la creación del seed
        login_res = self.client.post('/api/autenticacion/login', data=json.dumps({'email': 'ibzantrabajo@gmail.com', 'password': 'Datium777'}), content_type='application/json')
        
        self.token = login_res.json().get('token')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}

    def test_admin_stats(self):
        res = self.client.get('/api/admin/stats', **self.headers)
        self.assertEqual(res.status_code, 200)

# Para ejecutar este modulo en consola (copia y pega estas dos lineas):
# cd c:\Users\Nico9\OneDrive\Escritorio\Datium-py\Datium\backend
# python manage.py test api.tests.test_admin
