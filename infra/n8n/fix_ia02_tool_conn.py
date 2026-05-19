import json, urllib.request, urllib.error

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
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

wf = api(f'/api/v1/workflows/{IA02_ID}')
conn = wf['connections']

# Remover ai_tool errado do Agente IA02 (Agente -> listar_profissionais)
if 'Agente IA02' in conn and 'ai_tool' in conn['Agente IA02']:
    del conn['Agente IA02']['ai_tool']
    print('Removida conexao errada Agente IA02 -> listar_profissionais')

# Adicionar conexao correta: listar_profissionais -> Agente IA02
conn['listar_profissionais'] = {
    'ai_tool': [[{'node': 'Agente IA02', 'type': 'ai_tool', 'index': 0}]]
}
print('Adicionada: listar_profissionais -> Agente IA02')

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': conn,
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
