import json
from django.test import TestCase, Client
from api.models import System, SystemTable, SystemField, SystemRecord, SystemRecordValue

class PKRelationsTests(TestCase):
    def setUp(self):
        self.client = Client()
        user_data = {
            'nombre': 'Tester',
            'email': 'test@datium.com',
            'password': 'Password123!',
            'phone': '+1234567890',
            'planId': 1
        }
        self.client.post('/api/autenticacion/registro', data=json.dumps(user_data), content_type='application/json')
        login_res = self.client.post('/api/autenticacion/login', data=json.dumps({'email': 'test@datium.com', 'password': 'Password123!'}), content_type='application/json')
        self.token = login_res.json().get('token')
        self.headers = {'HTTP_AUTHORIZATION': f'Bearer {self.token}'}
        
        # Create System
        sys_res = self.client.post('/api/systems', data=json.dumps({'name': 'Test Sys'}), content_type='application/json', **self.headers)
        self.system_id = sys_res.json().get('id')

    def test_primary_key_and_uniqueness(self):
        # Create Table with a PK field
        table_data = {
            'name': 'Departamentos',
            'fields': [
                {'name': 'ID_Dep', 'type': 'text', 'isPrimaryKey': True, 'required': True, 'unique': True},
                {'name': 'Nombre', 'type': 'text', 'required': True}
            ]
        }
        res = self.client.post(f'/api/systems/{self.system_id}/tables', data=json.dumps(table_data), content_type='application/json', **self.headers)
        self.assertEqual(res.status_code, 201)
        table_id = res.json().get('id')
        
        # Add a record
        rec1_res = self.client.post(f'/api/tables/{table_id}/records', data=json.dumps({
            'values': {'ID_Dep': 'DEP01', 'Nombre': 'Ventas'}
        }), content_type='application/json', **self.headers)
        self.assertEqual(rec1_res.status_code, 201)
        
        # Try to add another record with SAME PK
        rec2_res = self.client.post(f'/api/tables/{table_id}/records', data=json.dumps({
            'values': {'ID_Dep': 'DEP01', 'Nombre': 'RRHH'}
        }), content_type='application/json', **self.headers)
        self.assertEqual(rec2_res.status_code, 400)
        self.assertIn('ya existe', rec2_res.json().get('error'))

    def test_relations_integrity(self):
        # 1. Create Depto Table
        res_dep = self.client.post(f'/api/systems/{self.system_id}/tables', data=json.dumps({
            'name': 'Depto', 'fields': [{'name': 'Nombre', 'type': 'text', 'isPrimaryKey': True}]
        }), content_type='application/json', **self.headers)
        dep_table_id = res_dep.json().get('id')
        
        # Add a depto record
        rec_dep = self.client.post(f'/api/tables/{dep_table_id}/records', data=json.dumps({'values': {'Nombre': 'IT'}}), content_type='application/json', **self.headers)
        dep_rec_id = rec_dep.json().get('id')
        
        # 2. Create Empleados Table with relation to Depto
        res_emp = self.client.post(f'/api/systems/{self.system_id}/tables', data=json.dumps({
            'name': 'Empleados',
            'fields': [
                {'name': 'Nombre', 'type': 'text'},
                {'name': 'Depto', 'type': 'relation', 'relatedTableId': dep_table_id}
            ]
        }), content_type='application/json', **self.headers)
        emp_table_id = res_emp.json().get('id')
        
        # Try to add employee with INVALID relation ID
        rec_emp_bad = self.client.post(f'/api/tables/{emp_table_id}/records', data=json.dumps({
            'values': {'Nombre': 'Juan', 'Depto': '99999'}
        }), content_type='application/json', **self.headers)
        self.assertEqual(rec_emp_bad.status_code, 400)
        self.assertIn('no existe', rec_emp_bad.json().get('error'))
        
        # Add employee with VALID relation ID
        rec_emp_good = self.client.post(f'/api/tables/{emp_table_id}/records', data=json.dumps({
            'values': {'Nombre': 'Juan', 'Depto': str(dep_rec_id)}
        }), content_type='application/json', **self.headers)
        self.assertEqual(rec_emp_good.status_code, 201)
        
        # Check display values in list
        list_res = self.client.get(f'/api/tables/{emp_table_id}/records', **self.headers)
        records = list_res.json()
        self.assertEqual(records[0]['displayValues']['Depto'], 'IT')

    def test_relation_requires_target_pk(self):
        # 1. Create a table WITHOUT a PK
        res_no_pk = self.client.post(f'/api/systems/{self.system_id}/tables', data=json.dumps({
            'name': 'NoPKTable', 'fields': [{'name': 'Dato', 'type': 'text'}]
        }), content_type='application/json', **self.headers)
        no_pk_table_id = res_no_pk.json().get('id')
        
        # 2. Try to create a relation to this table -> Should FAIL
        res_rel = self.client.post(f'/api/systems/{self.system_id}/tables', data=json.dumps({
            'name': 'RelTable',
            'fields': [
                {'name': 'Ref', 'type': 'relation', 'relatedTableId': no_pk_table_id}
            ]
        }), content_type='application/json', **self.headers)
        
        self.assertEqual(res_rel.status_code, 400)
        resp_json = res_rel.json()
        err_msg = resp_json[0] if isinstance(resp_json, list) else resp_json.get('error', str(resp_json))
        self.assertIn('debe tener una Llave Primaria', err_msg)
