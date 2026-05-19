"""
Torna leadTelefone opcional no notificar_cliente e adiciona instrução no prompt
para não tentar notificar quando o telefone não estiver disponível.
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

for n in wf['nodes']:
    # 1. Tornar leadTelefone opcional na tool description
    if n.get('name') == 'notificar_cliente':
        n['parameters']['toolDescription'] = (
            'Notifica o cliente via WhatsApp sobre alteracao no agendamento. '
            'Use APENAS se souber o telefone do cliente (leadTelefone). '
            'Se nao tiver o telefone, confirme o reagendamento/cancelamento sem usar esta tool.'
        )
        # Marcar leadTelefone como opcional adicionando "(opcional)" no name
        for v in n['parameters']['parametersQuery']['values']:
            if v['name'] == 'leadTelefone':
                v['description'] = 'Telefone do cliente no formato internacional. Opcional — so envie se disponivel.'
        print('notificar_cliente: descricao atualizada, leadTelefone marcado como opcional')

    # 2. Adicionar instrução no prompt do Montar Prompt IA02
    if n.get('name') == 'Montar Prompt IA02':
        OLD = 'IDs fixos — use diretamente nas tools SEM pedir confirmacao:'
        NEW = ('Ao reagendar ou cancelar: use notificar_cliente SOMENTE se o agendamento tiver telefone de lead disponivel. '
               'Se nao tiver telefone, confirme a operacao sem tentar notificar.\n\n'
               + OLD)
        if OLD in n['parameters']['jsCode']:
            n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(OLD, NEW)
            print('Montar Prompt IA02: instrucao sobre notificar_cliente adicionada')
        else:
            print('AVISO: trecho nao encontrado no prompt')

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print('OK: ' + result['name'])
