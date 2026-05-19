"""Adiciona tool desbloquear_horario na IA02 e atualiza prompt."""
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

# Usar notificar_cliente como template de estrutura
template_node = next(n for n in wf['nodes'] if n.get('name') == 'notificar_cliente')

# Verificar se tool já existe
already_exists = any(n.get('name') == 'desbloquear_horario' for n in wf['nodes'])
if already_exists:
    print('Tool desbloquear_horario ja existe — pulando criacao')
else:
    new_node = {
        'id': 'ia02-desbloquear-001',
        'name': 'desbloquear_horario',
        'type': '@n8n/n8n-nodes-langchain.toolHttpRequest',
        'typeVersion': 1.1,
        'position': [
            template_node['position'][0] + 280,
            template_node['position'][1],
        ],
        'credentials': template_node['credentials'],  # reutiliza mesma credencial N8N Webhook Secret
        'parameters': {
            'toolDescription': (
                'Desbloquia um intervalo de horario de um profissional. '
                'Cancela todos os bloqueios que se sobrepoem ao periodo informado. '
                'Para desbloquear so a tarde: use inicio=12:00 e fim=hora_fim_do_dia. '
                'Para desbloquear so a manha: use inicio=hora_inicio_do_dia e fim=12:00. '
                'Para desbloquear o dia inteiro: use o horario completo de trabalho. '
                'Parametros: profissionalId (UUID), inicio (ISO 8601 fuso Brasilia), fim (ISO 8601 fuso Brasilia).'
            ),
            'method': 'POST',
            'url': 'http://172.18.0.1:3004/webhook/n8n/agenda/desbloquear',
            'authentication': 'genericCredentialType',
            'genericAuthType': 'httpHeaderAuth',
            'sendQuery': True,
            'parametersQuery': {
                'values': [
                    {'name': 'profissionalId', 'description': 'UUID do profissional'},
                    {'name': 'inicio', 'description': 'Data/hora inicio do intervalo a desbloquear (ISO 8601, fuso Brasilia)'},
                    {'name': 'fim', 'description': 'Data/hora fim do intervalo a desbloquear (ISO 8601, fuso Brasilia)'},
                ]
            },
        },
    }
    wf['nodes'].append(new_node)
    print('Tool desbloquear_horario criada')

# Atualizar prompt
for n in wf['nodes']:
    if n['name'] == 'Montar Prompt IA02':
        OLD = 'Ao reagendar ou cancelar: use notificar_cliente SOMENTE se o agendamento tiver telefone de lead disponivel.'
        NEW = ('Para desbloquear horarios: use SEMPRE a tool desbloquear_horario (nunca cancele bloqueios via cancelar_agendamento). '
               'Passe o intervalo EXATO solicitado: se pedir "so a tarde", inicio=12:00 e fim=horario_fim_do_profissional. '
               'Se pedir "so a manha", inicio=horario_inicio e fim=12:00. Se pedir o dia inteiro, use o horario completo.\n\n'
               + OLD)
        if OLD in n['parameters']['jsCode']:
            n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(OLD, NEW)
            print('Prompt atualizado com instrucao de desbloqueio parcial')
        elif NEW in n['parameters']['jsCode']:
            print('Prompt ja atualizado — pulando')
        else:
            print('AVISO: ancora nao encontrada no prompt')
        break

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print('OK: ' + result['name'])
