"""Corrige Preparar IA02: busca idioma via API em vez de $('Buscar Contexto')."""
import json, urllib.request

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
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

wf = api(f'/api/v1/workflows/{IA01_ID}')

NEW_CODE = """\
const dados = $('Dados').item.json;
const papel = $('Verificar Papel').item.json;

const agora = new Date();
const opts = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
const partes = new Intl.DateTimeFormat('pt-BR', opts).formatToParts(agora);
const get = (t) => partes.find(p => p.type === t)?.value ?? '00';
const dataHoraAtual = `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;

// Buscar idioma e nomeAssistente da config da instancia
let idioma = 'pt-BR';
let nomeAssistente = 'Assistente';
try {
  const resp = await $helpers.httpRequest({
    method: 'GET',
    url: `http://172.18.0.1:3004/webhook/n8n/context/${dados.InstanceName}`,
    headers: { 'x-webhook-secret': $vars.N8N_WEBHOOK_SECRET },
  });
  idioma = resp.idioma || 'pt-BR';
  nomeAssistente = resp.nomeAssistente || 'Assistente';
} catch (e) {
  // fallback silencioso
}

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
    nomeAssistente:   nomeAssistente,
    idioma:           idioma,
  }
}];
"""

for n in wf['nodes']:
    if n.get('name') == 'Preparar IA02':
        n['parameters']['jsCode'] = NEW_CODE
        print('Preparar IA02: codigo atualizado')
        break

api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
})
print('IA01 salva')
