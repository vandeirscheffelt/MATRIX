"""
Insere um Code node entre Tipo Msg Interno e Baixar Audio Interno
que normaliza o remoteJid de @lid para @s.whatsapp.net (remoteJidAlt).
A Evolution API v2.3.6 não suporta @lid no getBase64FromMediaMessage.
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

js_code = (
    "const evo = $('Webhook EVO').item.json.body;\n"
    "const data = evo.data;\n"
    "const key = data.key;\n"
    "\n"
    "// Evolution API nao suporta @lid — usar remoteJidAlt (@s.whatsapp.net)\n"
    "const remoteJid = key.remoteJid && key.remoteJid.endsWith('@lid') && key.remoteJidAlt\n"
    "  ? key.remoteJidAlt\n"
    "  : key.remoteJid;\n"
    "\n"
    "return [{ json: {\n"
    "  message: {\n"
    "    key: { remoteJid, fromMe: key.fromMe, id: key.id },\n"
    "    message: data.message\n"
    "  }\n"
    "}}];\n"
)

novo_no = {
    "parameters": {"jsCode": js_code},
    "id": "preparar-msg-audio-interno",
    "name": "Preparar Msg Audio Interno",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1072, 624]
}

# Reposicionar Baixar Audio Interno para dar espaço
for n in wf['nodes']:
    if n['name'] == 'Baixar Audio Interno':
        n['position'] = [1280, 624]
        # Atualizar body para usar $json.message em vez de body.data
        body_expr = "={{ JSON.stringify($json.message) }}"
        n['parameters']['body'] = body_expr
        print('  Baixar Audio Interno reposicionado e body atualizado para $json.message')

wf['nodes'].append(novo_no)
print('  Preparar Msg Audio Interno adicionado')

# Atualizar conexões:
# Tipo Msg Interno[2] → Preparar Msg Audio Interno → Baixar Audio Interno
conn = wf['connections']
conn['Tipo Msg Interno']['main'][2] = [{"node": "Preparar Msg Audio Interno", "type": "main", "index": 0}]
conn['Preparar Msg Audio Interno'] = {'main': [[{"node": "Baixar Audio Interno", "type": "main", "index": 0}]]}
print('  Conexoes atualizadas')

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': conn,
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData'),
}
result = api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body=payload)
print('OK: ' + result['name'])
