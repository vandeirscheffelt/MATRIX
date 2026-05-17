"""
Corrige IA01 para transcrever áudio/imagem de internos (gerente/profissional)
antes de chamar a IA02.

Problema: quando É Interno? → Preparar IA02, o message_content vem de
dados.message.content que é vazio para áudios. A transcrição só acontecia
no caminho do cliente.

Solução:
- Insere "Tipo Msg Interno" switch entre É Interno? e Preparar IA02
- Caminho texto → vai direto para Preparar IA02
- Caminho áudio → transcreve via Whisper → Set Conteudo Audio → Preparar IA02
- Caminho imagem → analisa via GPT-4o-mini → Set Conteudo Imagem → Preparar IA02
- Preparar IA02 atualizado: lê papel de $('Verificar Papel') e conteúdo de
  $json.conteudo_processado || dados.message.content
"""
import json, urllib.request, urllib.error

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
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise Exception(f'HTTP {e.code}: {e.read().decode()}')

wf = api(f'/api/v1/workflows/{IA01_ID}')

# ── 1. Atualizar Preparar IA02 ──────────────────────────────────────────────
# Lê papel de $('Verificar Papel') em vez de $json (que agora pode vir de
# qualquer branch), e conteúdo de $json.conteudo_processado com fallback.

NOVO_CODIGO_PREPARAR = '''const dados = $('Dados').item.json;
const papel = $('Verificar Papel').item.json;

const agora = new Date();
const opts = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
const partes = new Intl.DateTimeFormat('pt-BR', opts).formatToParts(agora);
const get = (t) => partes.find(p => p.type === t)?.value ?? '00';
const dataHoraAtual = `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;

return [{
  json: {
    Telefone:         dados.Telefone,
    InstanceName:     dados.InstanceName,
    message_content:  $json.conteudo_processado || dados.message?.content || '',
    dataHoraAtual:    dataHoraAtual,
    empresaId:        papel.empresaId,
    papel:            papel.papel,
    profissionalId:   papel.profissionalId || '',
    nomeProfissional: papel.nomeProfissional || '',
    nomeAssistente:   'Assistente',
  }
}];'''

for n in wf['nodes']:
    if n['name'] == 'Preparar IA02':
        n['parameters']['jsCode'] = NOVO_CODIGO_PREPARAR
        n['position'] = [1488, 336]
        print('  ✓ Preparar IA02: código + posição atualizados')
    if n['name'] == 'Chamar IA02':
        n['position'] = [1696, 336]
        print('  ✓ Chamar IA02: reposicionado')

# ── 2. Novos nós ────────────────────────────────────────────────────────────

novos_nos = [
    # Switch de tipo de mensagem para o caminho interno
    {
        "parameters": {
            "rules": {
                "values": [
                    {
                        "conditions": {
                            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 1},
                            "conditions": [{"id": "1", "leftValue": "={{ $('Dados').item.json.message.type }}", "rightValue": "conversation", "operator": {"type": "string", "operation": "equals"}}],
                            "combinator": "or"
                        },
                        "renameOutput": True, "outputKey": "texto"
                    },
                    {
                        "conditions": {
                            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 1},
                            "conditions": [{"id": "2", "leftValue": "={{ $('Dados').item.json.message.type }}", "rightValue": "extendedTextMessage", "operator": {"type": "string", "operation": "equals"}}],
                            "combinator": "or"
                        },
                        "renameOutput": True, "outputKey": "texto"
                    },
                    {
                        "conditions": {
                            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 1},
                            "conditions": [{"id": "3", "leftValue": "={{ $('Dados').item.json.message.type }}", "rightValue": "audioMessage", "operator": {"type": "string", "operation": "equals"}}],
                            "combinator": "and"
                        },
                        "renameOutput": True, "outputKey": "audio"
                    },
                    {
                        "conditions": {
                            "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 1},
                            "conditions": [{"id": "4", "leftValue": "={{ $('Dados').item.json.message.type }}", "rightValue": "imageMessage", "operator": {"type": "string", "operation": "equals"}}],
                            "combinator": "and"
                        },
                        "renameOutput": True, "outputKey": "imagem"
                    }
                ]
            },
            "options": {}
        },
        "id": "tipo-msg-interno",
        "name": "Tipo Msg Interno",
        "type": "n8n-nodes-base.switch",
        "typeVersion": 3,
        "position": [864, 480]
    },

    # ── Caminho ÁUDIO ──
    {
        "parameters": {
            "assignments": {"assignments": [{"id": "1", "name": "data", "value": "={{ $('Webhook EVO').item.json.body.data.message.base64 }}", "type": "string"}]},
            "options": {}
        },
        "id": "set-audio-b64-interno",
        "name": "Set Audio B64 Interno",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [1072, 624]
    },
    {
        "parameters": {
            "operation": "toBinary",
            "sourceProperty": "data",
            "options": {"fileName": "file.ogg", "mimeType": "application/ogg"}
        },
        "id": "audio-to-file-interno",
        "name": "Audio to File Interno",
        "type": "n8n-nodes-base.convertToFile",
        "typeVersion": 1.1,
        "position": [1280, 624]
    },
    {
        "parameters": {"resource": "audio", "operation": "transcribe", "options": {}},
        "id": "transcrever-audio-interno",
        "name": "Transcrever Audio Interno",
        "type": "@n8n/n8n-nodes-langchain.openAi",
        "typeVersion": 1.6,
        "position": [1488, 624],
        "credentials": {"openAiApi": {"id": "1wrcL6GoOkPpEpf7", "name": "OpenAi account"}}
    },
    {
        "parameters": {
            "assignments": {"assignments": [{"id": "1", "name": "conteudo_processado", "value": "={{ $json.text }}", "type": "string"}]},
            "options": {}
        },
        "id": "set-conteudo-audio-interno",
        "name": "Set Conteudo Audio",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [1696, 624]
    },

    # ── Caminho IMAGEM ──
    {
        "parameters": {
            "assignments": {"assignments": [{"id": "1", "name": "data", "value": "={{ $('Webhook EVO').item.json.body.data.message.base64 }}", "type": "string"}]},
            "options": {}
        },
        "id": "set-imagem-b64-interno",
        "name": "Set Imagem B64 Interno",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [1072, 864]
    },
    {
        "parameters": {
            "operation": "toBinary",
            "sourceProperty": "data",
            "options": {"fileName": "file.png", "mimeType": "image/png"}
        },
        "id": "imagem-to-file-interno",
        "name": "Imagem to File Interno",
        "type": "n8n-nodes-base.convertToFile",
        "typeVersion": 1.1,
        "position": [1280, 864]
    },
    {
        "parameters": {
            "resource": "image",
            "operation": "analyze",
            "modelId": {"__rl": True, "value": "gpt-4o-mini", "mode": "list"},
            "text": "Analise a imagem e traga um resumo simples e curto do que ela é",
            "inputType": "base64",
            "options": {}
        },
        "id": "analisar-imagem-interno",
        "name": "Analisar Imagem Interno",
        "type": "@n8n/n8n-nodes-langchain.openAi",
        "typeVersion": 1.6,
        "position": [1488, 864],
        "credentials": {"openAiApi": {"id": "1wrcL6GoOkPpEpf7", "name": "OpenAi account"}}
    },
    {
        "parameters": {
            "assignments": {"assignments": [{"id": "1", "name": "conteudo_processado", "value": "={{ $json.content }}", "type": "string"}]},
            "options": {}
        },
        "id": "set-conteudo-imagem-interno",
        "name": "Set Conteudo Imagem",
        "type": "n8n-nodes-base.set",
        "typeVersion": 3.4,
        "position": [1696, 864]
    },
]

wf['nodes'].extend(novos_nos)
print(f'  ✓ {len(novos_nos)} novos nós adicionados')

# ── 3. Atualizar conexões ────────────────────────────────────────────────────

conn = wf['connections']

# É Interno? output 0 (Interno) → Tipo Msg Interno (era → Preparar IA02)
eh_interno = conn.get('É Interno?', {}).get('main', [])
if eh_interno:
    eh_interno[0] = [{"node": "Tipo Msg Interno", "type": "main", "index": 0}]
    print('  ✓ É Interno? → Tipo Msg Interno')

# Switch interno → branches
conn['Tipo Msg Interno'] = {
    'main': [
        [{"node": "Preparar IA02", "type": "main", "index": 0}],          # texto
        [{"node": "Set Audio B64 Interno", "type": "main", "index": 0}],   # audio
        [{"node": "Set Imagem B64 Interno", "type": "main", "index": 0}]   # imagem
    ]
}

# Áudio
conn['Set Audio B64 Interno']    = {'main': [[{"node": "Audio to File Interno",     "type": "main", "index": 0}]]}
conn['Audio to File Interno']    = {'main': [[{"node": "Transcrever Audio Interno",  "type": "main", "index": 0}]]}
conn['Transcrever Audio Interno']= {'main': [[{"node": "Set Conteudo Audio",         "type": "main", "index": 0}]]}
conn['Set Conteudo Audio']       = {'main': [[{"node": "Preparar IA02",              "type": "main", "index": 0}]]}

# Imagem
conn['Set Imagem B64 Interno']   = {'main': [[{"node": "Imagem to File Interno",    "type": "main", "index": 0}]]}
conn['Imagem to File Interno']   = {'main': [[{"node": "Analisar Imagem Interno",   "type": "main", "index": 0}]]}
conn['Analisar Imagem Interno']  = {'main': [[{"node": "Set Conteudo Imagem",       "type": "main", "index": 0}]]}
conn['Set Conteudo Imagem']      = {'main': [[{"node": "Preparar IA02",             "type": "main", "index": 0}]]}

print('  ✓ Conexões atualizadas')

# ── 4. Push ──────────────────────────────────────────────────────────────────

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': conn,
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}

result = api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
