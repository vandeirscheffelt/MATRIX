"""
Corrige os tool nodes do IA02:
1. ver_agenda: URL malformada + parametersQuery com [{}] vazio
2. bloquear_horario / notificar_cliente: usam $('Dados IA02') que não funciona em tools
   → trocados para $fromAI('empresaId', ...)
"""
import json, urllib.request, urllib.error

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA02_ID = 'Itik8EFOzCtA5mG0'
CRED = {'httpHeaderAuth': {'id': '1oYeP3L8VFuLR0ZZ', 'name': 'N8N Webhook Secret'}}
API = 'http://172.18.0.1:3004/webhook/n8n'

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

wf = api(f'/api/v1/workflows/{IA02_ID}')

TOOLS = {
    'ver_agenda': {
        # empresaId é path param; profissionalId e data são query params opcionais
        # 'string', '' como 3º/4º arg → n8n marca como não-required no JSON schema
        'url': f"={{{{ '{API}/agenda/' + $fromAI('empresaId', 'ID da empresa fixo no contexto', 'string') }}}}",
        'authentication': 'genericCredentialType',
        'genericAuthType': 'httpHeaderAuth',
        'sendQuery': True,
        'parametersQuery': {
            'values': [
                {'name': 'profissionalId', 'value': "={{ $fromAI('profissionalId', 'UUID do profissional - deixar vazio para ver todos', 'string', '') }}"},
                {'name': 'data',           'value': "={{ $fromAI('data', 'Data YYYY-MM-DD - deixar vazio para hoje', 'string', '') }}"},
            ]
        },
        'options': {},
    },
    'bloquear_horario': {
        'method': 'POST',
        'url': f'{API}/agenda/bloquear',
        'authentication': 'genericCredentialType',
        'genericAuthType': 'httpHeaderAuth',
        'sendQuery': True,
        'parametersQuery': {
            'values': [
                {'name': 'empresaId',      'value': "={{ $fromAI('empresaId', 'ID da empresa') }}"},
                {'name': 'profissionalId', 'value': "={{ $fromAI('profissionalId', 'UUID do profissional') }}"},
                {'name': 'inicio',         'value': "={{ $fromAI('inicio', 'Inicio ISO 8601 ex 2026-05-16T09:00:00-03:00') }}"},
                {'name': 'fim',            'value': "={{ $fromAI('fim', 'Fim ISO 8601') }}"},
                {'name': 'motivo',         'value': "={{ $fromAI('motivo', 'Motivo opcional') }}"},
            ]
        },
        'toolDescription': 'Bloqueia um horario na agenda. Requer: empresaId (fixo no contexto) profissionalId (UUID - busque com listar_profissionais) inicio e fim em ISO 8601.',
        'options': {},
    },
    'cancelar_agendamento': {
        'method': 'POST',
        'url': f'{API}/agenda/cancelar',
        'authentication': 'genericCredentialType',
        'genericAuthType': 'httpHeaderAuth',
        'sendQuery': True,
        'parametersQuery': {
            'values': [
                {'name': 'agendamentoId', 'value': "={{ $fromAI('agendamentoId', 'UUID do agendamento a cancelar') }}"},
                {'name': 'motivo',        'value': "={{ $fromAI('motivo', 'Motivo opcional') }}"},
            ]
        },
        'toolDescription': 'Cancela um agendamento existente. Requer: agendamentoId (UUID do agendamento).',
        'options': {},
    },
    'reagendar_agendamento': {
        'method': 'POST',
        'url': f'{API}/agenda/reagendar',
        'authentication': 'genericCredentialType',
        'genericAuthType': 'httpHeaderAuth',
        'sendQuery': True,
        'parametersQuery': {
            'values': [
                {'name': 'agendamentoId', 'value': "={{ $fromAI('agendamentoId', 'UUID do agendamento') }}"},
                {'name': 'novoInicio',    'value': "={{ $fromAI('novoInicio', 'Novo inicio ISO 8601') }}"},
                {'name': 'novoFim',       'value': "={{ $fromAI('novoFim', 'Novo fim ISO 8601') }}"},
            ]
        },
        'toolDescription': 'Remarca um agendamento para nova data e hora. Requer: agendamentoId novoInicio e novoFim em ISO 8601.',
        'options': {},
    },
    'notificar_cliente': {
        'method': 'POST',
        'url': f'{API}/agenda/notificar-cliente',
        'authentication': 'genericCredentialType',
        'genericAuthType': 'httpHeaderAuth',
        'sendQuery': True,
        'parametersQuery': {
            'values': [
                {'name': 'empresaId',     'value': "={{ $fromAI('empresaId', 'ID da empresa') }}"},
                {'name': 'leadTelefone',  'value': "={{ $fromAI('leadTelefone', 'Telefone do cliente com DDI') }}"},
                {'name': 'mensagem',      'value': "={{ $fromAI('mensagem', 'Mensagem para o cliente') }}"},
                {'name': 'agendamentoId', 'value': "={{ $fromAI('agendamentoId', 'UUID do agendamento opcional') }}"},
            ]
        },
        'toolDescription': 'Notifica o cliente via WhatsApp sobre alteracao no agendamento.',
        'options': {},
    },
    'relatorio_agenda': {
        'url': f"={{{{ '{API}/agenda/' + $fromAI('empresaId', 'ID da empresa fixo no contexto', 'string') + '/relatorio' }}}}",
        'authentication': 'genericCredentialType',
        'genericAuthType': 'httpHeaderAuth',
        'sendQuery': True,
        'parametersQuery': {
            'values': [
                {'name': 'dataInicio', 'value': "={{ $fromAI('dataInicio', 'Data inicio YYYY-MM-DD - deixar vazio para 14 dias atras', 'string', '') }}"},
                {'name': 'dataFim',    'value': "={{ $fromAI('dataFim', 'Data fim YYYY-MM-DD - deixar vazio para hoje', 'string', '') }}"},
            ]
        },
        'toolDescription': 'Gera relatorio de atendimentos por profissional em um periodo. Retorna total de atendimentos e horas trabalhadas de cada profissional. Sem parametros = ultimas 2 semanas.',
        'options': {},
    },
}

for n in wf['nodes']:
    if n['name'] in TOOLS:
        n['parameters'] = TOOLS[n['name']]
        n['credentials'] = CRED
        print(f'  ✓ {n["name"]} corrigido')

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
