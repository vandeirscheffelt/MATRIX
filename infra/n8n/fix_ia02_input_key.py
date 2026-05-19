"""
Fix: o Redis Chat Memory tem inputKey='input' hardcoded.
O campo da mensagem do usuário estava como 'mensagem' — renomear para 'input'.
Atualiza: Dados IA02 (Set), Agente IA02 (text param).
"""
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

for n in wf['nodes']:
    # 1. Dados IA02: renomear campo 'mensagem' -> 'input'
    if n['name'] == 'Dados IA02':
        for assignment in n['parameters']['assignments']['assignments']:
            if assignment['name'] == 'mensagem':
                assignment['name'] = 'input'
                print('Dados IA02: mensagem -> input')

    # 2. Agente IA02: atualizar referência $json.mensagem -> $json.input
    if n['name'] == 'Agente IA02':
        text = n['parameters'].get('text', '')
        if 'mensagem' in text:
            n['parameters']['text'] = text.replace('$json.mensagem', '$json.input')
            print('Agente IA02: text $json.mensagem -> $json.input')

    # 3. Montar Prompt: atualizar referência d.mensagem se existir
    if n['name'] == 'Montar Prompt IA02':
        code = n['parameters']['jsCode']
        if 'd.mensagem' in code:
            n['parameters']['jsCode'] = code.replace('d.mensagem', 'd.input')
            print('Montar Prompt: d.mensagem -> d.input')

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
