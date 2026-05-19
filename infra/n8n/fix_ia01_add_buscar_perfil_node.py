"""
Solucao definitiva: adiciona HTTP Request node 'Buscar Perfil Contato'
antes do Preparar IA02, e simplifica o Code node para apenas ler o resultado.

Fluxo: É Interno? → Preparar IA02
Novo:  É Interno? → Buscar Perfil Contato (HTTP GET) → Preparar IA02
"""
import json, urllib.request

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA01_ID = 'UJnzqU4OF98EzKd8'
WEBHOOK_SECRET = '731d541c0adecbc0c29b4188750e130f994554239278467b583fb98a54586c71'

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

# Descobrir posicao do Preparar IA02
pos_preparar = [1200, 300]
for n in wf['nodes']:
    if n['name'] == 'Preparar IA02':
        pos_preparar = n['position']
        break

# 1. Adicionar node HTTP GET se ainda nao existe
names = [n['name'] for n in wf['nodes']]
if 'Buscar Perfil Contato' not in names:
    http_node = {
        'id': 'ia01-buscar-perfil-001',
        'name': 'Buscar Perfil Contato',
        'type': 'n8n-nodes-base.httpRequest',
        'typeVersion': 4.2,
        'position': [pos_preparar[0] - 200, pos_preparar[1]],
        'parameters': {
            'method': 'GET',
            'url': '=http://172.18.0.1:3004/webhook/n8n/contato-perfil',
            'authentication': 'genericCredentialType',
            'genericAuthType': 'httpHeaderAuth',
            'sendHeaders': True,
            'headerParameters': {
                'parameters': [
                    {'name': 'x-webhook-secret', 'value': WEBHOOK_SECRET}
                ]
            },
            'sendQuery': True,
            'queryParameters': {
                'parameters': [
                    {'name': 'empresaId', 'value': '={{ $json.empresaId }}'},
                    {'name': 'telefone', 'value': '={{ $json.Telefone }}'},
                ]
            },
            'options': {
                'response': {'response': {'neverError': True}},
            },
        },
    }
    wf['nodes'].append(http_node)
    print('Node "Buscar Perfil Contato" criado')
else:
    print('Node ja existe')

# 2. Atualizar Preparar IA02: ler apelido do node anterior
NEW_CODE = """\
const dados = $('Dados').item.json;
const papel = $('Verificar Papel').item.json;
const perfil = $('Buscar Perfil Contato').item.json;

const agora = new Date();
const opts = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
const partes = new Intl.DateTimeFormat('pt-BR', opts).formatToParts(agora);
const get = (t) => partes.find(p => p.type === t)?.value ?? '00';
const dataHoraAtual = `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;

let idioma = 'pt-BR';
let nomeAssistente = 'Assistente';
let empresaId = papel.empresaId;
try {
  const r = await fetch(`http://172.18.0.1:3004/webhook/n8n/context/${dados.InstanceName}`, {
    headers: { 'x-webhook-secret': '""" + WEBHOOK_SECRET + """' }
  });
  const ctx = await r.json();
  idioma = ctx.idioma || 'pt-BR';
  nomeAssistente = ctx.nomeAssistente || 'Assistente';
} catch (e) {}

// Apelido vem do HTTP node (sem codigo de rede aqui)
const apelido = perfil?.apelido ?? null;

return [{
  json: {
    Telefone:         dados.Telefone,
    InstanceName:     dados.InstanceName,
    message_content:  $json.conteudo_processado || dados.message?.content || '',
    dataHoraAtual:    dataHoraAtual,
    empresaId:        empresaId,
    papel:            papel.papel,
    profissionalId:   papel.profissionalId || '',
    nomeProfissional: papel.nomeProfissional || '',
    nomeAssistente:   nomeAssistente,
    idioma:           idioma,
    apelido:          apelido,
  }
}];
"""

for n in wf['nodes']:
    if n['name'] == 'Preparar IA02':
        n['parameters']['jsCode'] = NEW_CODE
        # Mover para depois do HTTP node
        n['position'] = [pos_preparar[0] + 200, pos_preparar[1]]
        print('Preparar IA02: atualizado para ler do HTTP node')
        break

# 3. Remontar conexoes: inserir Buscar Perfil Contato antes do Preparar IA02
# Encontrar quem conecta ao Preparar IA02
predecessor = None
for src, conns in wf['connections'].items():
    for out_list in conns.get('main', []):
        for target in out_list:
            if target['node'] == 'Preparar IA02':
                predecessor = src
                break

if predecessor:
    print(f'Predecessor de Preparar IA02: {predecessor}')
    # predecessor → Buscar Perfil Contato
    wf['connections'][predecessor] = {
        'main': [[{'node': 'Buscar Perfil Contato', 'type': 'main', 'index': 0}]]
    }
    # Buscar Perfil Contato → Preparar IA02
    wf['connections']['Buscar Perfil Contato'] = {
        'main': [[{'node': 'Preparar IA02', 'type': 'main', 'index': 0}]]
    }
    print('Conexoes remontadas')

api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
})
print('IA01 salva')
