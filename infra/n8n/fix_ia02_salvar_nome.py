"""
Atualiza IA02:
1. Dados IA02: adiciona campo apelido
2. Prompt: injeta apelido + instrucao de uso e salvamento
3. Adiciona tool salvar_nome (HTTP POST /webhook/n8n/contato-perfil)
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

# ── 1. Dados IA02: adicionar campo apelido ──
for n in wf['nodes']:
    if n.get('name') == 'Dados IA02':
        assignments = n['parameters']['assignments']['assignments']
        if not any(a['name'] == 'apelido' for a in assignments):
            assignments.append({
                'id': str(len(assignments) + 1),
                'name': 'apelido',
                'value': "={{ $json.apelido ?? null }}",
                'type': 'string'
            })
            print('Dados IA02: campo apelido adicionado')
        else:
            print('Dados IA02: apelido ja existe')
        break

# ── 2. Prompt: adicionar uso do apelido ──
for n in wf['nodes']:
    if n.get('name') == 'Montar Prompt IA02':
        OLD = 'Se o usuario informar o nome dele durante a conversa, use-o nas respostas seguintes. Nao pergunte o nome novamente se ja foi informado nesta sessao.'
        NEW = ('${d.apelido ? `O nome deste usuario e ${d.apelido}. Use-o nas respostas de forma natural e acolhedora.` : '
               '\'O nome deste usuario e desconhecido. Se ele informar o nome durante a conversa, chame a tool salvar_nome UMA UNICA VEZ para registrar e passe a usar o nome. Nao pergunte o nome diretamente — use somente se o usuario mencionar espontaneamente.\''
               '}\n\nNunca salve o nome mais de uma vez por sessao. Nunca sobrescreva se o usuario ja confirmou o nome.')
        if OLD in n['parameters']['jsCode']:
            n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(OLD, NEW)
            print('Prompt: instrucao de apelido atualizada')
        else:
            print('AVISO: ancora de nome nao encontrada no prompt')
        break

# ── 3. Tool salvar_nome ──
already_exists = any(n.get('name') == 'salvar_nome' for n in wf['nodes'])
if already_exists:
    print('Tool salvar_nome ja existe')
else:
    template = next(n for n in wf['nodes'] if n.get('name') == 'notificar_cliente')
    new_node = {
        'id': 'ia02-salvar-nome-001',
        'name': 'salvar_nome',
        'type': '@n8n/n8n-nodes-langchain.toolHttpRequest',
        'typeVersion': 1.1,
        'position': [template['position'][0] + 560, template['position'][1]],
        'credentials': template['credentials'],
        'parameters': {
            'toolDescription': (
                'Salva ou atualiza o nome/apelido do usuario no banco de dados. '
                'Use APENAS quando o usuario informar o proprio nome espontaneamente durante a conversa. '
                'Use fonte="usuario". Chame no maximo UMA VEZ por sessao. '
                'Parametros: empresaId, telefone, apelido (nome informado), fonte (sempre "usuario").'
            ),
            'method': 'POST',
            'url': 'http://172.18.0.1:3004/webhook/n8n/contato-perfil',
            'authentication': 'genericCredentialType',
            'genericAuthType': 'httpHeaderAuth',
            'sendQuery': True,
            'parametersQuery': {
                'values': [
                    {'name': 'empresaId', 'description': 'ID da empresa'},
                    {'name': 'telefone', 'description': 'Telefone do usuario no formato internacional'},
                    {'name': 'apelido', 'description': 'Nome ou apelido informado pelo usuario'},
                    {'name': 'fonte', 'description': 'Sempre "usuario"'},
                ]
            },
        },
    }
    wf['nodes'].append(new_node)
    print('Tool salvar_nome criada')

api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
})
print('IA02 salva')
