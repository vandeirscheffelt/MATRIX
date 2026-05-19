"""
Adiciona tool listar_profissionais no IA02 e atualiza prompt para usá-la.
"""
import json, urllib.request, urllib.error

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA02_ID = 'Itik8EFOzCtA5mG0'
CRED = {'httpHeaderAuth': {'id': '1oYeP3L8VFuLR0ZZ', 'name': 'N8N Webhook Secret'}}
API = 'http://172.18.0.1:3004/webhook/n8n'

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

wf = api(f'/api/v1/workflows/{IA02_ID}')
nodes = wf['nodes']
connections = wf['connections']

# Remover se já existir
nodes = [n for n in nodes if n['name'] != 'listar_profissionais']

# Posição próxima dos outros tools
nodes.append({
    'id': 'ia02-tool-profissionais',
    'name': 'listar_profissionais',
    'type': '@n8n/n8n-nodes-langchain.toolHttpRequest',
    'typeVersion': 1.1,
    'position': [400, 720],
    'parameters': {
        'url': f"={{{{ '{API}/profissionais/' + $fromAI('empresaId', 'ID da empresa') }}}}",
        'authentication': 'genericCredentialType',
        'genericAuthType': 'httpHeaderAuth',
        'toolDescription': 'Lista todos os profissionais da empresa com id, nome e cargo. Use para obter o profissionalId pelo nome antes de bloquear/cancelar/reagendar.',
        'options': {},
    },
    'credentials': CRED,
})

# Conectar como Tool do Agente IA02
if 'Agente IA02' not in connections:
    connections['Agente IA02'] = {}
if 'ai_tool' not in connections['Agente IA02']:
    connections['Agente IA02']['ai_tool'] = [[]]

connections['Agente IA02']['ai_tool'][0].append({
    'node': 'listar_profissionais', 'type': 'ai_tool', 'index': 0
})

# Atualizar prompt para mencionar listar_profissionais
for n in nodes:
    if n['name'] == 'Montar Prompt IA02':
        code = n['parameters']['jsCode']
        old = 'COMO USAR AS TOOLS:'
        new = ('COMO USAR AS TOOLS:\n'
               '- listar_profissionais: chame PRIMEIRO quando precisar do profissionalId de alguem pelo nome. Retorna id, nome e cargo de todos os profissionais.')
        n['parameters']['jsCode'] = code.replace(old, new)
        print('Prompt atualizado com listar_profissionais')

payload = {
    'name': wf['name'],
    'nodes': nodes,
    'connections': connections,
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
print(f'  listar_profissionais: {"✓" if any(n["name"]=="listar_profissionais" for n in result["nodes"]) else "✗"}')
