"""
Troca Postgres Chat Memory por Redis Chat Memory no IA02.
Tipo correto: @n8n/n8n-nodes-langchain.memoryRedisChat (versão 1.3)
"""
import json, urllib.request, urllib.error

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA02_ID = 'Itik8EFOzCtA5mG0'
REDIS_CRED_ID = 'QesotSdxNu67YPd2'

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

for n in wf['nodes']:
    if n['name'] == 'Postgres Chat Memory':
        n['name'] = 'Redis Chat Memory'
        n['type'] = '@n8n/n8n-nodes-langchain.memoryRedisChat'
        n['typeVersion'] = 1.3
        n['parameters'] = {
            'sessionIdType': 'customKey',
            'sessionKey': '={{ $json.sessionId }}',
            'sessionTTL': 3600,
            'contextWindowLength': 30,
        }
        n['credentials'] = {
            'redis': {
                'id': REDIS_CRED_ID,
                'name': 'Redis account'
            }
        }
        print('Nó trocado para Redis Chat Memory')

# Atualizar conexões que referenciam "Postgres Chat Memory"
def rename_in_connections(connections, old_name, new_name):
    if old_name in connections:
        connections[new_name] = connections.pop(old_name)
    for node_name, conn in connections.items():
        for output_list in conn.get('main', []):
            for edge in output_list:
                if edge.get('node') == old_name:
                    edge['node'] = new_name

rename_in_connections(wf['connections'], 'Postgres Chat Memory', 'Redis Chat Memory')

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
