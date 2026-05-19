"""
Corrige Buscar Perfil Contato:
1. Remove authentication (usa header fixo sem credencial)
2. Telefone via $('Dados').item.json.Telefone
3. empresaId via $('Verificar Papel').item.json.empresaId
"""
import json, urllib.request

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA01_ID = 'UJnzqU4OF98EzKd8'
WEBHOOK_SECRET = '731d541c0adecbc0c29b4188750e130f994554239278467b583fb98a54586c71'

def api(path, method='GET', body=None):
    req = urllib.request.Request(
        f'{N8N_URL}{path}',
        data=json.dumps(body).encode() if body else None,
        headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY},
        method=method
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

wf = api(f'/api/v1/workflows/{IA01_ID}')

for n in wf['nodes']:
    if n['name'] == 'Buscar Perfil Contato':
        n['parameters'] = {
            'method': 'GET',
            'url': 'http://172.18.0.1:3004/webhook/n8n/contato-perfil',
            'sendHeaders': True,
            'headerParameters': {
                'parameters': [
                    {'name': 'x-webhook-secret', 'value': WEBHOOK_SECRET}
                ]
            },
            'sendQuery': True,
            'queryParameters': {
                'parameters': [
                    {'name': 'empresaId', 'value': "={{ $('Verificar Papel').item.json.empresaId }}"},
                    {'name': 'telefone',  'value': "={{ $('Dados').item.json.Telefone }}"},
                ]
            },
            'options': {
                'response': {'response': {'neverError': True}},
            },
        }
        # Remover credentials se existir
        n.pop('credentials', None)
        print('Buscar Perfil Contato: corrigido (sem auth, expressoes corretas)')
        break

api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
})
print('IA01 salva')
