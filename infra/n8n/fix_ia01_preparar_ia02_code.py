"""
Substitui o Set 'Preparar IA02' por um Code node que:
- acessa $('Dados').item.json corretamente (incluindo 'message.content' com ponto)
- computa dataHoraAtual via $now
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
nodes = wf['nodes']

# Substituir o Set node por Code node
for n in nodes:
    if n['name'] == 'Preparar IA02':
        n['type'] = 'n8n-nodes-base.code'
        n['typeVersion'] = 2
        n['parameters'] = {
            'jsCode': """const dados = $('Dados').item.json;
const papel = $json;

// dataHoraAtual: formatar horário de Brasília
const agora = new Date();
const opts = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
const partes = new Intl.DateTimeFormat('pt-BR', opts).formatToParts(agora);
const get = (t) => partes.find(p => p.type === t)?.value ?? '00';
const dataHoraAtual = `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;

return [{
  json: {
    Telefone:        dados.Telefone,
    InstanceName:    dados.InstanceName,
    message_content: dados['message.content'] || '',
    dataHoraAtual:   dataHoraAtual,
    empresaId:       papel.empresaId,
    papel:           papel.papel,
    profissionalId:  papel.profissionalId || '',
    nomeProfissional: papel.nomeProfissional || '',
    nomeAssistente:  'Assistente',
  }
}];"""
        }
        print('Preparar IA02: trocado para Code node')

payload = {
    'name': wf['name'],
    'nodes': nodes,
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
