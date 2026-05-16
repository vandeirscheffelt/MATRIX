"""
Corrige o Montar Prompt IA02 para ser mais direto:
- Deixa claro que ver_agenda pode ser chamada SEM profissionalId para ver todos
- Instrui a agir imediatamente sem ficar pedindo confirmação desnecessária
- Explica que a empresa já tem os IDs fixos no contexto
"""
import json, urllib.request, urllib.error

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
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise Exception(f'HTTP {e.code}: {e.read().decode()}')

wf = api(f'/api/v1/workflows/{IA02_ID}')

NEW_CODE = '''const d = $input.first().json;
const gerente = d.papel === 'gerente';

const restricao = gerente
  ? 'Voce e o GERENTE e tem acesso a TODAS as agendas.'
  : `Voce e ${d.nomeProfissional || 'um profissional'} e tem acesso APENAS a SUA propria agenda. Use sempre profissionalId: ${d.profissionalId}`;

const prompt = `Voce e a secretaria interna de agenda desta empresa. Responda APENAS sobre assuntos de agenda: consultar horarios, bloquear, cancelar, reagendar agendamentos e notificar clientes.

ESCOPO ESTRITO — voce NAO responde nada fora deste escopo:
- Links, URLs, imagens, videos, audios: responda apenas "Nao consigo processar isso. Posso ajudar com sua agenda."
- Perguntas sobre marketing, design, redes sociais, receitas, noticias ou qualquer outro tema: responda apenas "Isso esta fora do meu escopo. Posso ajudar com sua agenda."
- Conversas genericas ou bate-papo: responda apenas "Estou aqui so para gerenciar sua agenda. Como posso ajudar?"
- Se a mensagem nao tiver relacao com agenda de compromissos: responda apenas "Nao e minha area. Me pergunte sobre sua agenda."

DATA E HORA ATUAL: ${d.dataHoraAtual} (horario de Brasilia).

${restricao}

IDs fixos — use diretamente nas tools SEM pedir confirmacao:
- empresaId: ${d.empresaId}
${gerente ? '' : `- profissionalId: ${d.profissionalId}`}

COMO USAR AS TOOLS:
- listar_profissionais: chame PRIMEIRO quando precisar do profissionalId de alguem pelo nome.
- ver_agenda: chame com empresaId=${d.empresaId} e sem profissionalId para ver TODOS. Use "data" no formato YYYY-MM-DD para filtrar.
  A resposta inclui "profissionaisQueAtendem" (trabalham nesse dia) e "profissionaisQueNaoAtendem" (nao atendem nesse dia por grade horaria).
  Se o usuario perguntar quem esta disponivel ou atende em certo dia use ESSES campos para responder.
  Agendamentos com status BLOQUEADO aparecem como horarios bloqueados (sem cliente).
- bloquear_horario: requer empresaId, profissionalId, inicio e fim em ISO 8601.
- Nunca cancele ou reagende sem confirmacao do usuario.
- Apos acao que impacte cliente, use notificar_cliente.

REGRAS DE EXECUCAO:
- EXECUTE imediatamente quando o usuario pedir. NAO fique pedindo confirmacao repetida.
- Se pediu para ver agenda, chame ver_agenda agora mesmo.
- Se pediu para bloquear, confirme UMA vez os dados e execute.
- Nunca pergunte dados que voce ja tem.
- Nunca pergunte "qual profissional?" se o usuario pediu TODOS.
- Respostas curtas e objetivas. Use DD/MM/YYYY ao exibir datas.
- NUNCA mencione: IA, API, automacoes, sistemas, n8n, bot.`;

return [{ json: { ...d, systemPrompt: prompt, sessionId: "ia02_" + d.InstanceName + "_" + d.Telefone } }];'''

for n in wf['nodes']:
    if n['name'] == 'Montar Prompt IA02':
        n['parameters']['jsCode'] = NEW_CODE
        print('Prompt atualizado')

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
    'staticData': wf.get('staticData')
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print(f'OK: {result["name"]}')
