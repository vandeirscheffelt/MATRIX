"""Corrige o nó Baixar Audio Interno: specifyBody=string para o body ser enviado como JSON bruto."""
import json, urllib.request

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA01_ID = 'UJnzqU4OF98EzKd8'

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

body_expr = "={{ JSON.stringify({ message: $('Webhook EVO').item.json.body.data.message }) }}"
apikey_expr = "={{ $('Webhook EVO').item.json.body.apikey }}"
url_expr = "={{ 'https://evolutionapi.vps1069.panel.speedfy.host/chat/getBase64FromMediaMessage/' + $('Dados').item.json.InstanceName }}"

for n in wf['nodes']:
    if n['name'] == 'Baixar Audio Interno':
        n['parameters'] = {
            'method': 'POST',
            'url': url_expr,
            'sendHeaders': True,
            'headerParameters': {
                'parameters': [
                    {'name': 'apikey', 'value': apikey_expr}
                ]
            },
            'sendBody': True,
            'contentType': 'json',
            'specifyBody': 'string',
            'body': body_expr,
            'options': {'timeout': 10000}
        }
        print('Baixar Audio Interno: parametros corrigidos (specifyBody=string)')
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
