"""Adiciona instrução de memória de nome no prompt da IA02."""
import json, urllib.request

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
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

wf = api(f'/api/v1/workflows/{IA02_ID}')

OLD = 'Fale de forma natural, acolhedora e direta — como uma recepcionista atenciosa faria. Use frases curtas, seja gentil, e quando precisar redirecionar, faca com leveza e sem rispidez.'
NEW = OLD + '\n\nSe o usuario informar o nome dele durante a conversa, use-o nas respostas seguintes. Nao pergunte o nome novamente se ja foi informado nesta sessao.'

for n in wf['nodes']:
    if n['name'] == 'Montar Prompt IA02':
        if OLD in n['parameters']['jsCode']:
            n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(OLD, NEW)
            print('Prompt atualizado com instrucao de nome')
        else:
            print('AVISO: trecho nao encontrado — verifique manualmente')
        break

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print('OK: ' + result['name'])
