"""
Corrige Preparar Msg Audio Interno para enviar apenas a key da mensagem.
A Evolution API busca o resto (mediaKey, fileSha256, etc.) no seu banco interno.
Enviar os campos binários via JSON serializa como arrays, corrompendo o Buffer.
"""
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

# Novo codigo: envia apenas a key para Evolution API buscar no banco
js_code = (
    "const evo = $('Webhook EVO').item.json.body;\n"
    "const data = evo.data;\n"
    "const key = data.key;\n"
    "\n"
    "// @lid nao suportado — usar remoteJidAlt (@s.whatsapp.net)\n"
    "const remoteJid = key.remoteJid && key.remoteJid.endsWith('@lid') && key.remoteJidAlt\n"
    "  ? key.remoteJidAlt\n"
    "  : key.remoteJid;\n"
    "\n"
    "// Enviar apenas a key: Evolution API busca a mensagem completa no banco interno\n"
    "// (enviar campos binarios via JSON os serializa como arrays, corrompendo o Buffer)\n"
    "return [{ json: {\n"
    "  message: {\n"
    "    key: { remoteJid, fromMe: key.fromMe, id: key.id }\n"
    "  }\n"
    "}}];\n"
)

for n in wf['nodes']:
    if n['name'] == 'Preparar Msg Audio Interno':
        n['parameters']['jsCode'] = js_code
        print('Preparar Msg Audio Interno: atualizado para enviar apenas key')
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
