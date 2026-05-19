"""
Adiciona nó 'Preparar IA02' (Set) entre 'É Interno?' e 'Chamar IA02'.
Esse nó mescla os dados do papel ($json) com os dados originais ($('Dados').item.json)
para que o Execute Workflow passe tudo corretamente via $json.
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
nodes = wf['nodes']
connections = wf['connections']

# Remover nó antigo se já existir
nodes = [n for n in nodes if n['name'] != 'Preparar IA02']
if 'Preparar IA02' in connections:
    del connections['Preparar IA02']

# Posição: entre É Interno? (x=840) e Chamar IA02 (x=1040)
nodes.append({
    'id': 'ia01-preparar-ia02',
    'name': 'Preparar IA02',
    'type': 'n8n-nodes-base.set',
    'typeVersion': 3.4,
    'position': [940, 400],
    'parameters': {
        'mode': 'manual',
        'assignments': {
            'assignments': [
                {'id': '1', 'name': 'Telefone',        'value': "={{ $('Dados').item.json.Telefone }}",           'type': 'string'},
                {'id': '2', 'name': 'InstanceName',    'value': "={{ $('Dados').item.json.InstanceName }}",       'type': 'string'},
                {'id': '3', 'name': 'message_content', 'value': "={{ $('Dados').item.json['message.content'] }}", 'type': 'string'},
                {'id': '4', 'name': 'dataHoraAtual',   'value': "={{ $('Dados').item.json.dataHoraAtual }}",      'type': 'string'},
                {'id': '5', 'name': 'empresaId',       'value': '={{ $json.empresaId }}',                         'type': 'string'},
                {'id': '6', 'name': 'papel',           'value': '={{ $json.papel }}',                             'type': 'string'},
                {'id': '7', 'name': 'profissionalId',  'value': "={{ $json.profissionalId ?? '' }}",              'type': 'string'},
                {'id': '8', 'name': 'nomeProfissional','value': "={{ $json.nomeProfissional ?? '' }}",            'type': 'string'},
                {'id': '9', 'name': 'nomeAssistente',  'value': 'Assistente',                                     'type': 'string'},
            ]
        },
        'options': {}
    }
})

# Chamar IA02 — agora usa só $json (tudo já está em $json após Preparar IA02)
for n in nodes:
    if n['name'] == 'Chamar IA02':
        n['parameters'] = {
            'source': 'database',
            'workflowId': {'__rl': True, 'value': IA02_ID, 'mode': 'id'},
            'options': {'waitForSubWorkflow': False},
            'fields': {
                'values': [
                    {'name': 'Telefone',         'stringValue': '={{ $json.Telefone }}'},
                    {'name': 'InstanceName',     'stringValue': '={{ $json.InstanceName }}'},
                    {'name': 'message_content',  'stringValue': '={{ $json.message_content }}'},
                    {'name': 'empresaId',        'stringValue': '={{ $json.empresaId }}'},
                    {'name': 'papel',            'stringValue': '={{ $json.papel }}'},
                    {'name': 'profissionalId',   'stringValue': '={{ $json.profissionalId }}'},
                    {'name': 'nomeProfissional', 'stringValue': '={{ $json.nomeProfissional }}'},
                    {'name': 'dataHoraAtual',    'stringValue': '={{ $json.dataHoraAtual }}'},
                    {'name': 'nomeAssistente',   'stringValue': '={{ $json.nomeAssistente }}'},
                ]
            }
        }
        print('Chamar IA02: campos atualizados para $json.X')

# Conexões: É Interno? [output 0: Interno] -> Preparar IA02 -> Chamar IA02
connections['É Interno?'] = {
    'main': [
        [{'node': 'Preparar IA02',   'type': 'main', 'index': 0}],  # output 0: Interno
        [{'node': 'Buscar Contexto', 'type': 'main', 'index': 0}]   # output 1: cliente
    ]
}
connections['Preparar IA02'] = {
    'main': [[{'node': 'Chamar IA02', 'type': 'main', 'index': 0}]]
}

payload = {
    'name': wf['name'],
    'nodes': nodes,
    'connections': connections,
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')

# Verificar
wf2 = api(f'/api/v1/workflows/{IA01_ID}')
names = [n['name'] for n in wf2['nodes']]
print(f'  Preparar IA02: {"✓" if "Preparar IA02" in names else "✗"}')
eh_interno = wf2["connections"].get("É Interno?", {}).get("main", [])
print(f'  É Interno? outputs: {[[e["node"] for e in o] for o in eh_interno]}')
