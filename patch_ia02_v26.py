import json, urllib.request, sys
sys.stdout.reconfigure(encoding='utf-8')

N8N_URL = 'http://209.50.228.131:5678/api/v1/workflows/Itik8EFOzCtA5mG0'
API_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZGI4NDM2YjMtZTJkOC00OTBjLWE5NzAtYWY5MGRlM2M4Njk0IiwiaWF0IjoxNzc2MTAyOTMwfQ.SCadqH4puE_9Aj6NHmA6yvkR41AOa0IEl2GXmVjj0To'
SECRET = '731d541c0adecbc0c29b4188750e130f994554239278467b583fb98a54586c71'
BASE   = 'http://172.18.0.1:3004/webhook/n8n'

# Secret embedded in URL query param _s to avoid toolHttpRequest header structure bugs.
# All URLs start with ?_s=SECRET so subsequent params use &.

def E(js): return '={{ ' + js + ' }}'

CTX  = "$('Sortear Aviso').item.json"
HOJE = "new Date(Date.now()-3*3600000).toISOString().slice(0,10)"

def ai(name, desc):
    return f"(String($fromAI('{name}','{desc}','string')||''))"

def enc(v): return f"encodeURIComponent({v})"

# Base with secret already embedded: BASE/path?_s=SECRET&...other params
def BS(path): return f"'{BASE}/{path}?_s={SECRET}'"

VER_AGENDA_URL = E(
    f"{BS('agenda/'+CTX[1:-5]+'.empresaId')}"
    .replace(f"'{BASE}/agenda/"+CTX[1:-5]+".empresaId?_s={SECRET}'",
             f"'{BASE}/agenda/'+" + CTX + ".empresaId+'?_s={SECRET}'")
    + f"+'&data='+{enc('(' + ai('data','Data YYYY-MM-DD. Use amanha=data de amanha, hoje=data de hoje.') + '||' + HOJE + ')')}"
)

# Simpler helper: static base path with ?_s already included
def B(path): return f"'{BASE}/{path}?_s={SECRET}'"
def BA(path): return f"'{BASE}/{path}'"

VER_AGENDA_URL = E(
    f"'{BASE}/agenda/'+{CTX}.empresaId+'?_s={SECRET}'"
    f"+'&data='+{enc('(' + ai('data','Data YYYY-MM-DD. Use amanha=data de amanha, hoje=data de hoje.') + '||' + HOJE + ')')}"
)

BLOQUEAR_URL = E(
    f"'{BASE}/agenda/bloquear?_s={SECRET}'"
    f"+'&empresaId='+{enc(CTX+'.empresaId')}"
    f"+'&profissionalId='+{enc(ai('profissionalId','UUID do profissional. Use listar_profissionais.'))}"
    f"+'&inicio='+{enc(ai('inicio','Inicio ISO8601 ex: 2026-05-21T08:00:00-03:00'))}"
    f"+'&fim='+{enc(ai('fim','Fim ISO8601 ex: 2026-05-21T12:00:00-03:00'))}"
    f"+({ai('motivo','Motivo do bloqueio (opcional)')}?'&motivo='+{enc(ai('motivo','Motivo do bloqueio (opcional)'))}:'')"
)

CANCELAR_URL = E(
    f"'{BASE}/agenda/cancelar?_s={SECRET}'"
    f"+'&agendamentoId='+{enc(ai('agendamentoId','UUID do agendamento. Use ver_agenda.'))}"
    f"+({ai('motivo','Motivo do cancelamento (opcional)')}?'&motivo='+{enc(ai('motivo','Motivo do cancelamento (opcional)'))}:'')"
)

REAGENDAR_URL = E(
    f"'{BASE}/agenda/reagendar?_s={SECRET}'"
    f"+'&agendamentoId='+{enc(ai('agendamentoId','UUID do agendamento. Use ver_agenda.'))}"
    f"+'&novoInicio='+{enc(ai('novoInicio','Novo inicio ISO8601 ex: 2026-05-21T10:00:00-03:00'))}"
    f"+'&novoFim='+{enc(ai('novoFim','Novo fim ISO8601 ex: 2026-05-21T10:30:00-03:00'))}"
)

NOTIFICAR_URL = E(
    f"'{BASE}/agenda/notificar-cliente?_s={SECRET}'"
    f"+'&empresaId='+{enc(CTX+'.empresaId')}"
    f"+'&leadTelefone='+{enc(ai('leadTelefone','Telefone do cliente. Use buscar_lead.'))}"
    f"+'&mensagem='+{enc(ai('mensagem','Mensagem a enviar ao cliente via WhatsApp'))}"
    f"+({ai('agendamentoId','UUID do agendamento relacionado (opcional)')}?'&agendamentoId='+{enc(ai('agendamentoId','UUID do agendamento (opcional)'))}:'')"
)

LISTAR_PROF_URL = E(f"'{BASE}/profissionais/'+{CTX}.empresaId+'?_s={SECRET}'")

RELATORIO_URL = E(
    f"'{BASE}/agenda/'+{CTX}.empresaId+'/relatorio?_s={SECRET}'"
    f"+({ai('dataInicio','Data inicio YYYY-MM-DD (opcional)')}?'&dataInicio='+{enc(ai('dataInicio','Data inicio YYYY-MM-DD (opcional)'))}:'')"
    f"+({ai('dataFim','Data fim YYYY-MM-DD (opcional)')}?'&dataFim='+{enc(ai('dataFim','Data fim YYYY-MM-DD (opcional)'))}:'')"
)

ENVIAR_EMAIL_URL = E(
    f"'{BASE}/agenda/enviar-relatorio-email?_s={SECRET}'"
    f"+'&empresaId='+{enc(CTX+'.empresaId')}"
    f"+'&emailDestino='+{enc(ai('emailDestino','E-mail de destino para envio do relatorio'))}"
    f"+({ai('dataInicio','Data inicio YYYY-MM-DD (opcional)')}?'&dataInicio='+{enc(ai('dataInicio','Data inicio YYYY-MM-DD (opcional)'))}:'')"
    f"+({ai('dataFim','Data fim YYYY-MM-DD (opcional)')}?'&dataFim='+{enc(ai('dataFim','Data fim YYYY-MM-DD (opcional)'))}:'')"
)

DESBLOQUEAR_URL = E(
    f"'{BASE}/agenda/desbloquear?_s={SECRET}'"
    f"+'&profissionalId='+{enc(ai('profissionalId','UUID do profissional. Use listar_profissionais.'))}"
    f"+'&inicio='+{enc(ai('inicio','Inicio ISO8601 ex: 2026-05-21T08:00:00-03:00'))}"
    f"+'&fim='+{enc(ai('fim','Fim ISO8601 ex: 2026-05-21T12:00:00-03:00'))}"
)

SALVAR_NOME_URL = E(
    f"'{BASE}/contato-perfil?_s={SECRET}'"
    f"+'&empresaId='+{enc(CTX+'.empresaId')}"
    f"+'&telefone='+{enc(CTX+'.Telefone')}"
    f"+'&apelido='+{enc(ai('apelido','Nome ou apelido do contato a salvar'))}"
    f"+'&fonte=usuario'"
)

BUSCAR_EMAIL_URL = E(
    f"'{BASE}/contato-perfil/email?_s={SECRET}'"
    f"+'&empresaId='+{enc(CTX+'.empresaId')}"
    f"+'&telefone='+{enc(CTX+'.Telefone')}"
)

SALVAR_EMAIL_URL = E(
    f"'{BASE}/contato-perfil/email?_s={SECRET}'"
    f"+'&empresaId='+{enc(CTX+'.empresaId')}"
    f"+'&telefone='+{enc(CTX+'.Telefone')}"
    f"+'&emailRelatorio='+{enc(ai('emailRelatorio','E-mail para receber relatorios de agendamentos'))}"
)

BUSCAR_LEAD_URL = E(
    f"'{BASE}/agenda/'+{CTX}.empresaId+'/buscar-lead?_s={SECRET}'"
    f"+'&nome='+{enc(ai('nome','Nome ou parte do nome do cliente para buscar'))}"
)

CRIAR_AGEND_URL = E(
    f"'{BASE}/agendamento?_s={SECRET}'"
    f"+'&empresaId='+{enc(CTX+'.empresaId')}"
    f"+'&profissionalId='+{enc(ai('profissionalId','UUID do profissional. Use listar_profissionais.'))}"
    f"+'&inicio='+{enc(ai('inicio','Inicio ISO8601. Ex: 2026-05-21T18:45:00-03:00'))}"
    f"+'&fim='+{enc(ai('fim','Fim ISO8601. Ex: 2026-05-21T19:15:00-03:00'))}"
    f"+({ai('leadTelefone','Telefone do cliente obtido via buscar_lead. Ex: 5561999999999')}?'&leadTelefone='+{enc(ai('leadTelefone','Telefone do cliente'))}:'')"
    f"+({ai('leadNome','Nome do cliente (opcional)')}?'&leadNome='+{enc(ai('leadNome','Nome do cliente (opcional)'))}:'')"
)

TOOLS = {
    'ver_agenda':             ('Consulta a agenda de um dia. Use para ver horarios ocupados e disponibilidade.', VER_AGENDA_URL, 'GET'),
    'bloquear_horario':       ('Bloqueia um intervalo na agenda de um profissional.', BLOQUEAR_URL, 'POST'),
    'cancelar_agendamento':   ('Cancela um agendamento existente. Use ver_agenda para obter o agendamentoId.', CANCELAR_URL, 'POST'),
    'reagendar_agendamento':  ('Remarca um agendamento para novo horario. Use ver_agenda para obter o agendamentoId.', REAGENDAR_URL, 'POST'),
    'notificar_cliente':      ('Envia mensagem WhatsApp ao cliente via IA01.', NOTIFICAR_URL, 'POST'),
    'listar_profissionais':   ('Lista todos os profissionais da empresa com seus IDs e horarios de atendimento.', LISTAR_PROF_URL, 'GET'),
    'relatorio_agenda':       ('Gera relatorio de atendimentos da empresa.', RELATORIO_URL, 'GET'),
    'enviar_relatorio_email': ('Envia relatorio de agendamentos por e-mail. Requer emailDestino.', ENVIAR_EMAIL_URL, 'POST'),
    'desbloquear_horario':    ('Remove bloqueio de horario de um profissional.', DESBLOQUEAR_URL, 'POST'),
    'salvar_nome':            ('Salva ou atualiza o apelido de um contato no perfil.', SALVAR_NOME_URL, 'POST'),
    'buscar_email':           ('Busca o e-mail de relatorio salvo do gerente. Chame antes de enviar_relatorio_email.', BUSCAR_EMAIL_URL, 'GET'),
    'salvar_email':           ('Salva o e-mail do gerente para receber relatorios futuros.', SALVAR_EMAIL_URL, 'PATCH'),
    'buscar_lead':            ('Busca o telefone de um cliente pelo nome. Use SEMPRE antes de criar_agendamento.', BUSCAR_LEAD_URL, 'GET'),
    'criar_agendamento':      ('Cria um novo agendamento. Antes: chame buscar_lead (leadTelefone) e listar_profissionais (profissionalId).', CRIAR_AGEND_URL, 'POST'),
}

# ASCII check
for name, (desc, url_expr, method) in TOOLS.items():
    bad = [(i, c) for i, c in enumerate(url_expr) if ord(c) > 127]
    if bad:
        print(f'ERRO {name}:'), [print(f'  pos {i}: {repr(c)}') for i, c in bad[:5]]
        sys.exit(1)
    print(f'OK {name}: {len(url_expr)}c [{method}]')

req = urllib.request.Request(N8N_URL, headers={'X-N8N-API-KEY': API_KEY})
wf = json.loads(urllib.request.urlopen(req).read().decode('utf-8', errors='surrogatepass'))
print(f'\nDownloaded {len(wf["nodes"])} nodes')

patched = 0
for n in wf['nodes']:
    if n['name'] in TOOLS:
        desc, url_expr, method = TOOLS[n['name']]
        n['type'] = '@n8n/n8n-nodes-langchain.toolHttpRequest'
        n['typeVersion'] = 1.1
        params = {
            'url': url_expr,
            'options': {},
        }
        if method != 'GET':
            params['method'] = method
        n['parameters'] = params
        patched += 1
        print(f'  {n["name"]} [{method}]')

payload = {
    'name': wf['name'], 'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
}
body = json.dumps(payload, ensure_ascii=True).encode('utf-8')
req2 = urllib.request.Request(
    N8N_URL, data=body, method='PUT',
    headers={'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json; charset=utf-8'}
)
try:
    resp = urllib.request.urlopen(req2)
    print(f'\nPUT {resp.status} OK — {patched}/14 patched (v26b: secret in URL, no headers)')
except urllib.error.HTTPError as e:
    print(f'PUT ERROR {e.code}: {e.read().decode()[:600]}')
    sys.exit(1)

# Verify expressions preserved
req3 = urllib.request.Request(N8N_URL, headers={'X-N8N-API-KEY': API_KEY})
wf2 = json.loads(urllib.request.urlopen(req3).read().decode('utf-8'))
ok, fail = 0, []
no_ai = {'listar_profissionais', 'buscar_email'}
for n in wf2['nodes']:
    if n['name'] in TOOLS:
        url = n.get('parameters', {}).get('url', '')
        if n['name'] in no_ai or '$fromAI' in url:
            ok += 1
        else:
            fail.append(n['name'])
if fail:
    print(f'WARN expressions NOT preserved: {fail}')
else:
    print(f'Verification: {ok}/14 expressions preserved OK')
