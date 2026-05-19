"""Corrige a URL do Baixar Audio Interno para usar o nome real da instância do webhook."""
import json, urllib.request

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA01_ID = 'UJnzqU4OF98EzKd8'

EVO_URL = 'https://evolutionapi.vps1069.panel.speedfy.host'

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

# URL correta: usar body.instance (nome real da instancia no Evolution API)
# em vez de Dados.InstanceName (que retorna o empresaId completo com hifens)
correct_url = "={{ '" + EVO_URL + "/chat/getBase64FromMediaMessage/' + $('Webhook EVO').item.json.body.instance }}"

for n in wf['nodes']:
    if n['name'] == 'Baixar Audio Interno':
        old_url = n['parameters'].get('url', '')
        n['parameters']['url'] = correct_url
        print('URL antiga: ' + old_url)
        print('URL nova:   ' + correct_url)
        break

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData'),
}
result = api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body=payload)
print('OK: ' + result['name'])
