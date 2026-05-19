"""
Insere dois nodes entre Montar Prompt IA02 e Agente IA02:
1. Code node: sorteia saudacao + frase de aviso
2. Evolution API node: envia o aviso via WhatsApp
Remove a instrucao [INSTRUCAO OBRIGATORIA] do text do agente.
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

# ── 1. Remover instrucao OBRIGATORIA do text do Agente IA02 ──
for n in wf['nodes']:
    if n.get('name') == 'Agente IA02':
        n['parameters']['text'] = '={{ $json.input }}'
        print('Agente IA02: text restaurado para $json.input')
        break

# ── 2. Verificar se nodes ja existem ──
names = [n['name'] for n in wf['nodes']]
if 'Sortear Aviso' in names and 'Enviar Aviso' in names:
    print('Nodes ja existem — pulando criacao')
else:
    # ── 3. Code node: Sortear Aviso ──
    code_sortear = """\
const d = $input.first().json;

// Saudacao por horario
const hora = parseInt((d.dataHoraAtual || '').split(' ')[1]?.split(':')[0] ?? '12');
const saudacao = hora >= 5 && hora < 12 ? 'Bom dia'
               : hora >= 12 && hora < 18 ? 'Boa tarde'
               : 'Boa noite';

// 10 frases de aviso
const frases = [
  'so um momento, estou consultando aqui pra voce...',
  'deixa eu verificar isso agora mesmo, ja volto!',
  'um instante, buscando as informacoes na agenda...',
  'ja estou nisso! So um segundinho...',
  'certo! Deixa eu conferir aqui rapidinho...',
  'estou verificando agora, um momento...',
  'entendido! Ja vou buscar isso pra voce...',
  'pode deixar, estou consultando agora mesmo...',
  'um momento, estou processando sua solicitacao...',
  'certo! Ja estou tratando isso aqui, um instante...',
];

const frase = frases[Math.floor(Math.random() * frases.length)];
const aviso = saudacao + '! ' + frase.charAt(0).toUpperCase() + frase.slice(1);

return [{ json: { ...d, avisoTexto: aviso } }];
"""

    node_sortear = {
        'id': 'ia02-sortear-aviso',
        'name': 'Sortear Aviso',
        'type': 'n8n-nodes-base.code',
        'typeVersion': 2,
        'position': [544, 400],
        'parameters': {
            'jsCode': code_sortear,
        },
    }

    # ── 4. Evolution API node: Enviar Aviso ──
    node_enviar = {
        'id': 'ia02-enviar-aviso',
        'name': 'Enviar Aviso',
        'type': 'n8n-nodes-evolution-api.evolutionApi',
        'typeVersion': 1,
        'position': [740, 400],
        'credentials': {
            'evolutionApi': {
                'id': 'mVQnz4JWlbdbEut9',
                'name': 'Evolution account',
            }
        },
        'parameters': {
            'resource': 'messages-api',
            'instanceName': "={{ $json.InstanceName }}",
            'remoteJid': "={{ $json.Telefone }}",
            'messageText': "={{ $json.avisoTexto }}",
            'options_message': {
                'delay': 500,
                'linkPreview': False,
            },
        },
    }

    wf['nodes'].append(node_sortear)
    wf['nodes'].append(node_enviar)
    print('Nodes Sortear Aviso e Enviar Aviso criados')

    # ── 5. Remontar conexoes ──
    # Montar Prompt IA02 → Sortear Aviso
    wf['connections']['Montar Prompt IA02'] = {
        'main': [[{'node': 'Sortear Aviso', 'type': 'main', 'index': 0}]]
    }
    # Sortear Aviso → Enviar Aviso
    wf['connections']['Sortear Aviso'] = {
        'main': [[{'node': 'Enviar Aviso', 'type': 'main', 'index': 0}]]
    }
    # Enviar Aviso → Agente IA02
    wf['connections']['Enviar Aviso'] = {
        'main': [[{'node': 'Agente IA02', 'type': 'main', 'index': 0}]]
    }
    print('Conexoes atualizadas: Montar Prompt → Sortear Aviso → Enviar Aviso → Agente IA02')

# ── 6. Salvar ──
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body={
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
})
print('OK: ' + result['name'])
