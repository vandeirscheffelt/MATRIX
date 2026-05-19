"""
Atualiza Preparar IA02 na IA01:
- Busca contato_perfil no backend
- Se novo contato e pushName presente, limpa via GPT-4o-mini e salva
- Injeta apelido no contexto passado para IA02
"""
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

// Buscar config da instancia (idioma, nomeAssistente)
let idioma = 'pt-BR';
let nomeAssistente = 'Assistente';
let empresaId = papel.empresaId;
try {
  const ctx = await $helpers.httpRequest({
    method: 'GET',
    url: `http://172.18.0.1:3004/webhook/n8n/context/${dados.InstanceName}`,
    headers: { 'x-webhook-secret': $vars.N8N_WEBHOOK_SECRET },
  });
  idioma = ctx.idioma || 'pt-BR';
  nomeAssistente = ctx.nomeAssistente || 'Assistente';
} catch (e) {}

// Buscar perfil do contato
let apelido = null;
const telefone = dados.Telefone;
try {
  const perfil = await $helpers.httpRequest({
    method: 'GET',
    url: `http://172.18.0.1:3004/webhook/n8n/contato-perfil?empresaId=${empresaId}&telefone=${encodeURIComponent(telefone)}`,
    headers: { 'x-webhook-secret': $vars.N8N_WEBHOOK_SECRET },
  });
  apelido = perfil.apelido ?? null;

  // Se nao tem apelido ainda, tentar extrair do pushName via LLM
  if (!apelido && dados.NomeWpp) {
    try {
      const limpeza = await $helpers.httpRequest({
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${$vars.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 20,
          messages: [{
            role: 'user',
            content: `Extraia apenas o primeiro nome próprio desta string, sem emojis, sem apelidos, sem títulos. Se não houver nome próprio claro, responda exatamente: null. Responda APENAS com o nome ou null, sem mais nada. String: "${dados.NomeWpp}"`,
          }],
        }),
      });
      const nome = limpeza.choices?.[0]?.message?.content?.trim();
      if (nome && nome !== 'null' && nome.length >= 2 && nome.length <= 30) {
        apelido = nome;
        // Salvar no banco com fonte='whatsapp'
        await $helpers.httpRequest({
          method: 'POST',
          url: 'http://172.18.0.1:3004/webhook/n8n/contato-perfil',
          headers: {
            'x-webhook-secret': $vars.N8N_WEBHOOK_SECRET,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ empresaId, telefone, apelido, fonte: 'whatsapp' }),
        });
      }
    } catch (e) {}
  }
} catch (e) {}

return [{
  json: {
    Telefone:         telefone,
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
    if n.get('name') == 'Preparar IA02':
        n['parameters']['jsCode'] = NEW_CODE
        print('Preparar IA02: atualizado com busca de perfil e limpeza de pushName')
        break

api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body={
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
})
print('IA01 salva')
