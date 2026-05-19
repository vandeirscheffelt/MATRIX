"""Debug: expoe erro real do contato-perfil sem try/catch"""
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

# Codigo de debug: sem try/catch no perfil, loga o erro no output
NEW_CODE = """\
const dados = $('Dados').item.json;
const papel = $('Verificar Papel').item.json;

const agora = new Date();
const opts = { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
const partes = new Intl.DateTimeFormat('pt-BR', opts).formatToParts(agora);
const get = (t) => partes.find(p => p.type === t)?.value ?? '00';
const dataHoraAtual = `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;

const WHK_SECRET = '""" + WEBHOOK_SECRET + """';

let idioma = 'pt-BR';
let nomeAssistente = 'Assistente';
let empresaId = papel.empresaId;
try {
  const ctx = await $helpers.httpRequest({
    method: 'GET',
    url: `http://172.18.0.1:3004/webhook/n8n/context/${dados.InstanceName}`,
    headers: { 'x-webhook-secret': WHK_SECRET },
  });
  idioma = ctx.idioma || 'pt-BR';
  nomeAssistente = ctx.nomeAssistente || 'Assistente';
} catch (e) {}

// SEM try/catch para expor o erro real
const perfil = await $helpers.httpRequest({
  method: 'GET',
  url: `http://172.18.0.1:3004/webhook/n8n/contato-perfil?empresaId=${empresaId}&telefone=${encodeURIComponent(dados.Telefone)}`,
  headers: { 'x-webhook-secret': WHK_SECRET },
});

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
    apelido:          perfil.apelido ?? null,
    _debug_perfil:    JSON.stringify(perfil),
  }
}];
"""

for n in wf['nodes']:
    if n.get('name') == 'Preparar IA02':
        n['parameters']['jsCode'] = NEW_CODE
        print('Preparar IA02: modo debug ativado')
        break

api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
})
print('IA01 salva')
