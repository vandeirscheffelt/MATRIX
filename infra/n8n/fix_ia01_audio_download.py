"""
Corrige o caminho de áudio interno do IA01.

Problema: $('Webhook EVO').item.json.body.data.message.base64 é null para áudios.
A Evolution API não embute áudio como base64 no webhook — requer download explícito.

Solução:
- Remove Set Audio B64 Interno (que retornava null)
- Insere Baixar Audio Interno (HTTP POST → /chat/getBase64FromMediaMessage)
- Insere Normalizar Audio Interno (Code — strip do prefixo data URI se presente)
- Reposiciona Audio to File Interno, Transcrever e Set Conteudo Audio para acomodar
"""
import json, urllib.request, urllib.error

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
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise Exception(f'HTTP {e.code}: {e.read().decode()}')

wf = api(f'/api/v1/workflows/{IA01_ID}')

# ── 1. Remover Set Audio B64 Interno (retornava null) ──────────────────────
before = len(wf['nodes'])
wf['nodes'] = [n for n in wf['nodes'] if n['name'] != 'Set Audio B64 Interno']
print(f'  ✓ Set Audio B64 Interno removido ({before} → {len(wf["nodes"])} nós)')

# ── 2. Reposicionar nós existentes do pipeline de áudio ────────────────────
NOVAS_POSICOES = {
    'Audio to File Interno':    [1488, 624],
    'Transcrever Audio Interno':[1696, 624],
    'Set Conteudo Audio':       [1904, 624],
}
for n in wf['nodes']:
    if n['name'] in NOVAS_POSICOES:
        n['position'] = NOVAS_POSICOES[n['name']]
        print(f'  ✓ {n["name"]} reposicionado → {NOVAS_POSICOES[n["name"]]}')

# ── 3. Adicionar nós de download + normalização ────────────────────────────
novos = [
    # HTTP Request → Evolution API para baixar o áudio como base64
    {
        "parameters": {
            "method": "POST",
            "url": "={{ '" + EVO_URL + "/chat/getBase64FromMediaMessage/' + $('Dados').item.json.InstanceName }}",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "apikey", "value": "={{ $('Webhook EVO').item.json.body.apikey }}"}
                ]
            },
            "sendBody": True,
            "contentType": "json",
            "body": "={{ JSON.stringify({ message: $('Webhook EVO').item.json.body.data }) }}",
            "options": {"timeout": 10000}
        },
        "id": "baixar-audio-interno",
        "name": "Baixar Audio Interno",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [1072, 624]
    },
    # Code → normaliza o base64 (remove prefixo data URI se presente)
    {
        "parameters": {
            "jsCode": (
                "const raw = $json.base64 || '';\n"
                "// Remove 'data:audio/ogg;base64,' ou qualquer prefixo data URI\n"
                "const data = raw.includes(',') ? raw.split(',')[1] : raw;\n"
                "if (!data) throw new Error('Evolution API não retornou base64 para o áudio');\n"
                "return [{ json: { data } }];"
            )
        },
        "id": "normalizar-audio-interno",
        "name": "Normalizar Audio Interno",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1280, 624]
    },
]

wf['nodes'].extend(novos)
print(f'  ✓ {len(novos)} novos nós adicionados (Baixar + Normalizar)')

# ── 4. Atualizar conexões do pipeline de áudio ─────────────────────────────
conn = wf['connections']

# Tipo Msg Interno → Baixar Audio Interno (era → Set Audio B64 Interno)
tipo_main = conn.get('Tipo Msg Interno', {}).get('main', [])
if len(tipo_main) > 1:
    tipo_main[1] = [{"node": "Baixar Audio Interno", "type": "main", "index": 0}]
    print('  ✓ Tipo Msg Interno → Baixar Audio Interno')

# Novo pipeline de áudio
conn['Baixar Audio Interno']    = {'main': [[{"node": "Normalizar Audio Interno", "type": "main", "index": 0}]]}
conn['Normalizar Audio Interno']= {'main': [[{"node": "Audio to File Interno",    "type": "main", "index": 0}]]}
# Audio to File → Transcrever e Transcrever → Set Conteudo já existem, só garantir
conn['Audio to File Interno']   = {'main': [[{"node": "Transcrever Audio Interno", "type": "main", "index": 0}]]}
conn['Transcrever Audio Interno']= {'main': [[{"node": "Set Conteudo Audio",       "type": "main", "index": 0}]]}
conn['Set Conteudo Audio']      = {'main': [[{"node": "Preparar IA02",             "type": "main", "index": 0}]]}

# Remover conexão antiga do Set Audio B64 Interno caso tenha sobrado
conn.pop('Set Audio B64 Interno', None)

print('  ✓ Conexões atualizadas')

# ── 5. Push ────────────────────────────────────────────────────────────────
payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': conn,
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}

result = api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
