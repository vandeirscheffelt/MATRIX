"""
Filtro de aviso: só envia para mensagens de ação.
Insere IF node entre Sortear Aviso e Enviar Aviso.
Conexão: Sortear Aviso → IF → (true) Enviar Aviso → Agente IA02
                               (false) ────────────→ Agente IA02
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

# ── 1. Atualizar Sortear Aviso com filtro ──
NEW_CODE = """\
const d = $input.first().json;
const msg = (d.input || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

const palavrasAcao = [
  'bloquei', 'desbloquei', 'cancel', 'reagend', 'remarc', 'horario', 'horarios',
  'agenda', 'agendamento', 'disponiv', 'profissional', 'atend', 'marcar', 'marque',
  'desmarca', 'libera', 'libere', 'relatorio', 'relat', 'cliente', 'clientes',
  'email', 'e-mail', 'notific', 'avisa', 'manda', 'semana', 'amanha', 'hoje',
  'manha', 'tarde', 'hora', 'turno', 'consulta', 'verifica', 'veja', 'lista',
  'quais', 'quantos', 'quando', 'preciso', 'pode', 'consegue',
];

const precisaAviso = palavrasAcao.some(p => msg.includes(p));

if (!precisaAviso) {
  return [{ json: { ...d, avisoTexto: null } }];
}

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
return [{ json: { ...d, avisoTexto: saudacao + '! ' + frase } }];
"""

for n in wf['nodes']:
    if n.get('name') == 'Sortear Aviso':
        n['parameters']['jsCode'] = NEW_CODE
        print('Sortear Aviso: filtro aplicado')
        break

# ── 2. Inserir IF node (se ainda nao existe) ──
names = [n['name'] for n in wf['nodes']]
if 'Tem Aviso?' not in names:
    node_if = {
        'id': 'ia02-if-aviso',
        'name': 'Tem Aviso?',
        'type': 'n8n-nodes-base.if',
        'typeVersion': 2,
        'position': [644, 400],
        'parameters': {
            'conditions': {
                'options': {'caseSensitive': False, 'leftValue': '', 'typeValidation': 'strict'},
                'conditions': [{
                    'id': 'cond-aviso',
                    'leftValue': '={{ $json.avisoTexto }}',
                    'rightValue': '',
                    'operator': {
                        'type': 'string',
                        'operation': 'notEmpty',
                    },
                }],
                'combinator': 'and',
            },
        },
    }
    wf['nodes'].append(node_if)
    print('IF node "Tem Aviso?" criado')

    # Atualizar posicao do Enviar Aviso para ficar depois do IF
    for n in wf['nodes']:
        if n.get('name') == 'Enviar Aviso':
            n['position'] = [840, 300]
        if n.get('name') == 'Agente IA02':
            n['position'] = [1040, 400]

    # Remontar conexoes:
    # Sortear Aviso → Tem Aviso?
    wf['connections']['Sortear Aviso'] = {
        'main': [[{'node': 'Tem Aviso?', 'type': 'main', 'index': 0}]]
    }
    # Tem Aviso? → true (output 0) → Enviar Aviso
    # Tem Aviso? → false (output 1) → Agente IA02
    wf['connections']['Tem Aviso?'] = {
        'main': [
            [{'node': 'Enviar Aviso', 'type': 'main', 'index': 0}],   # true
            [{'node': 'Agente IA02', 'type': 'main', 'index': 0}],    # false
        ]
    }
    # Enviar Aviso → Agente IA02 (mantém)
    wf['connections']['Enviar Aviso'] = {
        'main': [[{'node': 'Agente IA02', 'type': 'main', 'index': 0}]]
    }
    print('Conexoes: Sortear Aviso → Tem Aviso? → (true) Enviar Aviso → Agente | (false) → Agente')
else:
    print('IF node ja existe')

api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
})
print('IA02 salva')
