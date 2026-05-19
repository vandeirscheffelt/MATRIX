"""
Corrige o nó 'Chamar IA02' no IA01.
O nó perdeu todos os fields (Telefone, InstanceName, message_content, etc.)
e precisa da configuração source='database' com os campos corretos.
"""
import json, urllib.request, urllib.error

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA01_ID = 'UJnzqU4OF98EzKd8'
IA02_ID = 'Itik8EFOzCtA5mG0'

def api(path, method='GET', body=None):
    req = urllib.request.Request(
        f'{N8N_URL}{path}',
        data=json.dumps(body).encode() if body else None,
        headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY},
        method=method
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise Exception(f'HTTP {e.code}: {e.read().decode()}')

wf = api(f'/api/v1/workflows/{IA01_ID}')

for n in wf['nodes']:
    if n['name'] == 'Chamar IA02':
        n['parameters'] = {
            'source': 'database',
            'workflowId': {'__rl': True, 'value': IA02_ID, 'mode': 'id'},
            'options': {'waitForSubWorkflow': False},
            'fields': {
                'values': [
                    {'name': 'Telefone',         'stringValue': "={{ $('Dados').item.json.Telefone }}"},
                    {'name': 'InstanceName',     'stringValue': "={{ $('Dados').item.json.InstanceName }}"},
                    {'name': 'message_content',  'stringValue': "={{ $('Dados').item.json['message.content'] }}"},
                    {'name': 'empresaId',        'stringValue': '={{ $json.empresaId }}'},
                    {'name': 'papel',            'stringValue': '={{ $json.papel }}'},
                    {'name': 'profissionalId',   'stringValue': "={{ $json.profissionalId ?? '' }}"},
                    {'name': 'nomeProfissional', 'stringValue': "={{ $json.nomeProfissional ?? '' }}"},
                    {'name': 'dataHoraAtual',    'stringValue': "={{ $('Dados').item.json.dataHoraAtual }}"},
                    {'name': 'nomeAssistente',   'stringValue': 'Assistente'},
                ]
            }
        }
        print('Chamar IA02: fields restaurados')
        print(f"  campos: {[v['name'] for v in n['parameters']['fields']['values']]}")

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
