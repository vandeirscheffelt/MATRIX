"""Corrige pontuação e acentuação das frases de aviso."""
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

NEW_CODE = """\
const d = $input.first().json;

const hora = parseInt((d.dataHoraAtual || '').split(' ')[1]?.split(':')[0] ?? '12');
const saudacao = hora >= 5 && hora < 12 ? 'Bom dia'
               : hora >= 12 && hora < 18 ? 'Boa tarde'
               : 'Boa noite';

const frases = [
  'Só um momento, estou consultando aqui pra você...',
  'Deixa eu verificar isso agora mesmo, já volto!',
  'Um instante, buscando as informações na agenda...',
  'Já estou nisso! Só um segundinho...',
  'Certo! Deixa eu conferir aqui rapidinho...',
  'Estou verificando agora, um momento...',
  'Entendido! Já vou buscar isso pra você...',
  'Pode deixar, estou consultando agora mesmo...',
  'Um momento, estou processando sua solicitação...',
  'Certo! Já estou tratando isso aqui, um instante...',
];

const frase = frases[Math.floor(Math.random() * frases.length)];
const aviso = saudacao + '! ' + frase;

return [{ json: { ...d, avisoTexto: aviso } }];
"""

for n in wf['nodes']:
    if n.get('name') == 'Sortear Aviso':
        n['parameters']['jsCode'] = NEW_CODE
        print('Sortear Aviso: frases corrigidas')
        break

result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body={
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
})
print('OK: ' + result['name'])
