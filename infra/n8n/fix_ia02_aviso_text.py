"""Embutir instrucao de aviso diretamente no text do agente IA02."""
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

PREFIXO = (
    '[INSTRUCAO OBRIGATORIA: Sua primeira resposta DEVE ser uma frase curta '
    'avisando o que voce vai fazer. So entao execute as tools. '
    'Ex: "Certo, vou bloquear agora! Um momento..." '
    'NUNCA chame uma tool sem antes enviar essa mensagem.]\n\n'
)

for n in wf['nodes']:
    if n.get('name') == 'Agente IA02':
        n['parameters']['text'] = '={{ "' + PREFIXO + '" + $json.input }}'
        print('Agente IA02: instrucao de aviso embutida no text')
        break

api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
})
print('IA02 salva')
