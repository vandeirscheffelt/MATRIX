"""
Adiciona sanitização de tags XML/HTML no output do Agente IA02
antes do split de mensagens.
"""
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

NEW_CODE = r"""const texto = ($input.first().json.output || '').toString()
  .replace(/<\/?[^>]+>/g, '')   // remove tags XML/HTML residuais (ex: </>)
  .trim()
  .replace(/\*\*(.*?)\*\*/g, '*$1*')
  .replace(/^\* /gm, '• ');

const idx = texto.indexOf('\n\n');
let mensagens;

if (idx !== -1 && texto.length > 300) {
  const msg1 = texto.slice(0, idx).trim();
  const msg2 = texto.slice(idx + 2).trim();
  mensagens = [msg1, msg2].filter(function(m){ return m && m.length > 0; });
} else {
  mensagens = [texto.replace(/\n\n/g, '\n')];
}

return [{ json: { output: { messages: mensagens } } }];"""

for n in wf['nodes']:
    if n.get('name') == 'Formatar Mensagens':
        n['parameters']['jsCode'] = NEW_CODE
        print('Formatar Mensagens: sanitização adicionada')
        break

api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
})
print('IA02 salva')
