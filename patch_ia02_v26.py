import json, urllib.request, sys
sys.stdout.reconfigure(encoding='utf-8')

N8N_URL = 'http://209.50.228.131:5678/api/v1/workflows/Itik8EFOzCtA5mG0'
API_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZGI4NDM2YjMtZTJkOC00OTBjLWE5NzAtYWY5MGRlM2M4Njk0IiwiaWF0IjoxNzc2MTAyOTMwfQ.SCadqH4puE_9Aj6NHmA6yvkR41AOa0IEl2GXmVjj0To'
SECRET = '731d541c0adecbc0c29b4188750e130f994554239278467b583fb98a54586c71'
BASE   = 'http://172.18.0.1:3004/webhook/n8n'

def E(js): return '={{ ' + js + ' }}'

CTX  = "$('Sortear Aviso').item.json"
HOJE = "new Date(Date.now()-3*3600000).toISOString().slice(0,10)"

def ai(name, desc):
    return f"($fromAI('{name}','{desc}','string')||'')"

def ai_opt(name, desc):
    return f"($fromAI('{name}','{desc}','string','')||'')"

def enc(v): return f"encodeURIComponent({v})"

def BS(path): return f"'{BASE}/{path}?_s={SECRET}'"
def B(path): return f"'{BASE}/{path}?_s={SECRET}'"
def BA(path): return f"'{BASE}/{path}'"

# -------------------------------------------------------------------
# toolCode para ver_agenda: evita bug do toolHttpRequest que ignora
# os argumentos passados pela IA no modo URL-expression.
# query.data e query.profissionalId vem do schema estruturado abaixo.
# -------------------------------------------------------------------
VER_AGENDA_CODE = (
    "const data = query.data;\n"
    "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
    "const secret = '" + SECRET + "';\n"
    "const base = '" + BASE + "';\n"
    "\n"
    "const url = base + '/agenda/' + empresaId + '?_s=' + secret + '&data=' + encodeURIComponent(data);\n"
    "\n"
    "// fetch nao existe no sandbox vm2 do n8n 2.7.4; usar helpers.httpRequest\n"
    "const result = await helpers.httpRequest({ method: 'GET', url: url });\n"
    "return JSON.stringify(result);"
)

# profissionalId removido do schema: a IA passava nome em vez de UUID causando erro no Postgres.
# O response ja inclui agendamentos[].profissional.nome — a IA filtra pelo nome no resultado.
VER_AGENDA_SCHEMA = {
    "type": "object",
    "properties": {
        "data": {
            "type": "string",
            "description": "Data YYYY-MM-DD. Calcule amanha/hoje antes de chamar: amanha = +1 dia a partir de hoje."
        }
    },
    "required": ["data"]
}

BLOQUEAR_CODE = (
    "const profissionalId = query.profissionalId;\n"
    "const inicio = query.inicio;\n"
    "const fim = query.fim;\n"
    "const motivo = query.motivo || '';\n"
    "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
    "const secret = '" + SECRET + "';\n"
    "const base = '" + BASE + "';\n"
    "\n"
    "let url = base + '/agenda/bloquear?_s=' + secret\n"
    "  + '&empresaId=' + encodeURIComponent(empresaId)\n"
    "  + '&profissionalId=' + encodeURIComponent(profissionalId)\n"
    "  + '&inicio=' + encodeURIComponent(inicio)\n"
    "  + '&fim=' + encodeURIComponent(fim);\n"
    "if (motivo) url += '&motivo=' + encodeURIComponent(motivo);\n"
    "\n"
    "const result = await helpers.httpRequest({ method: 'POST', url: url });\n"
    "return JSON.stringify(result);"
)

BLOQUEAR_SCHEMA = {
    "type": "object",
    "properties": {
        "profissionalId": {
            "type": "string",
            "description": "UUID do profissional. Use listar_profissionais para obter."
        },
        "inicio": {
            "type": "string",
            "description": "Inicio do bloqueio ISO8601 ex: 2026-05-22T08:00:00-03:00"
        },
        "fim": {
            "type": "string",
            "description": "Fim do bloqueio ISO8601 ex: 2026-05-22T12:00:00-03:00"
        },
        "motivo": {
            "type": "string",
            "description": "Motivo do bloqueio. Opcional."
        }
    },
    "required": ["profissionalId", "inicio", "fim"]
}

CANCELAR_CODE = (
    "const agendamentoId = query.agendamentoId;\n"
    "const motivo = query.motivo || '';\n"
    "const secret = '" + SECRET + "';\n"
    "const base = '" + BASE + "';\n"
    "\n"
    "let url = base + '/agenda/cancelar?_s=' + secret\n"
    "  + '&agendamentoId=' + encodeURIComponent(agendamentoId);\n"
    "if (motivo) url += '&motivo=' + encodeURIComponent(motivo);\n"
    "\n"
    "const result = await helpers.httpRequest({ method: 'POST', url: url });\n"
    "return JSON.stringify(result);"
)

CANCELAR_SCHEMA = {
    "type": "object",
    "properties": {
        "agendamentoId": {
            "type": "string",
            "description": "UUID do agendamento a cancelar. Use ver_agenda para obter."
        },
        "motivo": {
            "type": "string",
            "description": "Motivo do cancelamento. Opcional."
        }
    },
    "required": ["agendamentoId"]
}

# toolCode nodes: name -> (description, jsCode, inputSchema)
TOOLCODE_NODES = {
    'ver_agenda': (
        'Consulta todos os agendamentos de um dia. Retorna lista completa com profissional.nome em cada agendamento. Para filtrar por profissional, busque pelo nome dentro da resposta.',
        VER_AGENDA_CODE,
        VER_AGENDA_SCHEMA,
    ),
    'bloquear_horario': (
        'Bloqueia um intervalo na agenda de um profissional. Requer profissionalId (UUID), inicio e fim (ISO8601 com timezone -03:00). Use listar_profissionais para obter o UUID.',
        BLOQUEAR_CODE,
        BLOQUEAR_SCHEMA,
    ),
    'cancelar_agendamento': (
        'Cancela um agendamento existente. Use ver_agenda para obter o agendamentoId.',
        CANCELAR_CODE,
        CANCELAR_SCHEMA,
    ),
    'desbloquear_horario': (
        'Remove bloqueios de horario de um profissional. Busca automaticamente os bloqueios reais (agendamentos e calendario UI) antes de remover.',
        (
            "const profissionalNome = query.profissionalNome;\n"
            "const data = query.data;\n"
            "const horaRef = (query.horaRef || '').trim();\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "// 1. Resolve nome do profissional para UUID\n"
            "const listUrl = base + '/profissionais/' + empresaId + '?_s=' + secret;\n"
            "const lista = await helpers.httpRequest({ method: 'GET', url: listUrl });\n"
            "const profissional = (Array.isArray(lista) ? lista : []).find(p =>\n"
            "  p.nome.toLowerCase().trim() === profissionalNome.toLowerCase().trim()\n"
            ");\n"
            "if (!profissional) {\n"
            "  const nomes = (Array.isArray(lista) ? lista : []).map(p => p.nome).join(', ');\n"
            "  return JSON.stringify({ error: 'Profissional nao encontrado: ' + profissionalNome + '. Disponiveis: ' + nomes });\n"
            "}\n"
            "\n"
            "// Helper: minutos do dia de 'YYYY-MM-DDTHH:MM...'\n"
            "const toMin = s => { const m = s.match(/T(\\d{2}):(\\d{2})/); return m ? +m[1]*60+ +m[2] : -1; };\n"
            "const refMin = horaRef ? (() => { const [h,mm] = horaRef.split(':').map(Number); return h*60+(mm||0); })() : -1;\n"
            "const overlapsRef = (ini, fim) => refMin < 0 || (refMin >= toMin(ini) && refMin < toMin(fim));\n"
            "\n"
            "// 2. Bloqueios da tabela agendamentos (status=BLOQUEADO)\n"
            "const agendaUrl = base + '/agenda/' + empresaId + '?_s=' + secret + '&data=' + encodeURIComponent(data);\n"
            "const agenda = await helpers.httpRequest({ method: 'GET', url: agendaUrl });\n"
            "const agBloqueios = (agenda.agendamentos || []).filter(a =>\n"
            "  a.status === 'BLOQUEADO' &&\n"
            "  a.profissional && a.profissional.nome.toLowerCase().trim() === profissionalNome.toLowerCase().trim() &&\n"
            "  overlapsRef(a.inicio, a.fim)\n"
            ");\n"
            "\n"
            "// 3. Bloqueios da tabela bloqueios (calendario UI Evolia)\n"
            "const calUrl = base + '/agenda/' + empresaId + '/bloqueios-calendario?_s=' + secret\n"
            "  + '&data=' + encodeURIComponent(data)\n"
            "  + '&profissionalId=' + encodeURIComponent(profissional.id);\n"
            "const bloqueiosCal = await helpers.httpRequest({ method: 'GET', url: calUrl });\n"
            "const calBloqueios = (Array.isArray(bloqueiosCal) ? bloqueiosCal : []).filter(b => overlapsRef(b.inicio, b.fim));\n"
            "\n"
            "if (agBloqueios.length === 0 && calBloqueios.length === 0) {\n"
            "  return JSON.stringify({ sucesso: false, mensagem: 'Nenhum bloqueio encontrado para ' + profissionalNome + ' no dia ' + data + '. O horario de almoco (intervalo) nao e gerenciado por esta tool.' });\n"
            "}\n"
            "\n"
            "// 4. Remove bloqueios da tabela agendamentos\n"
            "const removidosAg = [];\n"
            "for (const b of agBloqueios) {\n"
            "  await helpers.httpRequest({ method: 'POST', url: base + '/agenda/desbloquear?_s=' + secret\n"
            "    + '&profissionalId=' + encodeURIComponent(profissional.id)\n"
            "    + '&inicio=' + encodeURIComponent(b.inicio)\n"
            "    + '&fim=' + encodeURIComponent(b.fim) });\n"
            "  removidosAg.push(b.inicio + ' - ' + b.fim);\n"
            "}\n"
            "\n"
            "// 5. Remove bloqueios da tabela bloqueios (calendario UI)\n"
            "const removidosCal = [];\n"
            "for (const b of calBloqueios) {\n"
            "  await helpers.httpRequest({ method: 'POST', url: base + '/agenda/remover-bloqueio-calendario?_s=' + secret\n"
            "    + '&profissionalId=' + encodeURIComponent(profissional.id)\n"
            "    + '&inicio=' + encodeURIComponent(b.inicio)\n"
            "    + '&fim=' + encodeURIComponent(b.fim) });\n"
            "  removidosCal.push(b.inicio + ' - ' + b.fim);\n"
            "}\n"
            "\n"
            "return JSON.stringify({ sucesso: true, removidos: removidosAg.length + removidosCal.length, agendamentos: removidosAg, calendario: removidosCal });"
        ),
        {
            "type": "object",
            "properties": {
                "profissionalNome": {
                    "type": "string",
                    "description": "Nome do profissional ex: Eduardo, Jess."
                },
                "data": {
                    "type": "string",
                    "description": "Data YYYY-MM-DD onde estao os bloqueios ex: 2026-05-22."
                },
                "horaRef": {
                    "type": "string",
                    "description": "Hora de referencia opcional HH:MM ex: 09:00. Se fornecida, remove apenas o bloqueio que cobre esse horario. Se omitida, remove todos os bloqueios do dia."
                }
            },
            "required": ["profissionalNome", "data"]
        }
    ),
    'criar_agendamento': (
        'Cria um novo agendamento. Aceita o NOME do profissional. Se retornar sucesso:false e bloqueado:true, informe o usuario e use desbloquear_horario para liberar o horario.',
        (
            "const profissionalNome = query.profissionalNome;\n"
            "const inicio = query.inicio;\n"
            "const fim = query.fim;\n"
            "const leadTelefone = query.leadTelefone || '';\n"
            "const leadNome = query.leadNome || '';\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "// Resolve nome do profissional para UUID internamente\n"
            "const listUrl = base + '/profissionais/' + empresaId + '?_s=' + secret;\n"
            "const lista = await helpers.httpRequest({ method: 'GET', url: listUrl });\n"
            "const profissional = (Array.isArray(lista) ? lista : []).find(p =>\n"
            "  p.nome.toLowerCase().trim() === profissionalNome.toLowerCase().trim()\n"
            ");\n"
            "if (!profissional) {\n"
            "  const nomes = (Array.isArray(lista) ? lista : []).map(p => p.nome).join(', ');\n"
            "  return JSON.stringify({ error: 'Profissional nao encontrado: ' + profissionalNome + '. Disponiveis: ' + nomes });\n"
            "}\n"
            "\n"
            "let url = base + '/agendamento?_s=' + secret\n"
            "  + '&empresaId=' + encodeURIComponent(empresaId)\n"
            "  + '&profissionalId=' + encodeURIComponent(profissional.id)\n"
            "  + '&inicio=' + encodeURIComponent(inicio)\n"
            "  + '&fim=' + encodeURIComponent(fim);\n"
            "if (leadTelefone) url += '&leadTelefone=' + encodeURIComponent(leadTelefone);\n"
            "if (leadNome) url += '&leadNome=' + encodeURIComponent(leadNome);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'POST', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "profissionalNome": {
                    "type": "string",
                    "description": "Nome do profissional ex: Eduardo, Jess, Duda. A tool resolve o UUID internamente."
                },
                "inicio": {
                    "type": "string",
                    "description": "Inicio ISO8601 com fuso ex: 2026-05-23T10:00:00-03:00"
                },
                "fim": {
                    "type": "string",
                    "description": "Fim do atendimento ISO8601 com fuso. Use EXATAMENTE o horario declarado pelo usuario (ex: 'das 9h as 10h' -> fim = 2026-05-23T10:00:00-03:00). NUNCA calcule pela duracaoPadraoMin."
                },
                "leadTelefone": {
                    "type": "string",
                    "description": "Telefone do cliente ex: 5561999999999. Opcional."
                },
                "leadNome": {
                    "type": "string",
                    "description": "Nome do cliente. Opcional."
                }
            },
            "required": ["profissionalNome", "inicio", "fim"]
        }
    ),
    'listar_profissionais': (
        'Lista todos os profissionais da empresa com seus IDs e horarios de atendimento.',
        (
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "const url = base + '/profissionais/' + empresaId + '?_s=' + secret;\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'GET', url: url });\n"
            "return JSON.stringify(result);"
        ),
        None,
    ),
    'salvar_nome': (
        'Salva ou atualiza o apelido de um contato no perfil.',
        (
            "const apelido = query.apelido;\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const telefone = $('Sortear Aviso').item.json.Telefone;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "const url = base + '/contato-perfil?_s=' + secret\n"
            "  + '&empresaId=' + encodeURIComponent(empresaId)\n"
            "  + '&telefone=' + encodeURIComponent(telefone)\n"
            "  + '&apelido=' + encodeURIComponent(apelido)\n"
            "  + '&fonte=usuario';\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'POST', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "apelido": {
                    "type": "string",
                    "description": "Nome ou apelido do contato a salvar."
                }
            },
            "required": ["apelido"]
        }
    ),
    'relatorio_agenda': (
        'Gera relatorio de atendimentos da empresa. dataInicio e dataFim sao opcionais (YYYY-MM-DD).',
        (
            "const dataInicio = query.dataInicio || '';\n"
            "const dataFim = query.dataFim || '';\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "let url = base + '/agenda/' + empresaId + '/relatorio?_s=' + secret;\n"
            "if (dataInicio) url += '&dataInicio=' + encodeURIComponent(dataInicio);\n"
            "if (dataFim) url += '&dataFim=' + encodeURIComponent(dataFim);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'GET', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "dataInicio": {
                    "type": "string",
                    "description": "Data inicio do relatorio YYYY-MM-DD. Opcional."
                },
                "dataFim": {
                    "type": "string",
                    "description": "Data fim do relatorio YYYY-MM-DD. Opcional."
                }
            },
            "required": []
        }
    ),
    'enviar_relatorio_email': (
        'Envia relatorio de agendamentos por e-mail. Requer emailDestino. Use buscar_email para obter o e-mail salvo do gerente.',
        (
            "const emailDestino = query.emailDestino;\n"
            "const dataInicio = query.dataInicio || '';\n"
            "const dataFim = query.dataFim || '';\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "let url = base + '/agenda/enviar-relatorio-email?_s=' + secret\n"
            "  + '&empresaId=' + encodeURIComponent(empresaId)\n"
            "  + '&emailDestino=' + encodeURIComponent(emailDestino);\n"
            "if (dataInicio) url += '&dataInicio=' + encodeURIComponent(dataInicio);\n"
            "if (dataFim) url += '&dataFim=' + encodeURIComponent(dataFim);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'POST', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "emailDestino": {
                    "type": "string",
                    "description": "E-mail de destino para envio do relatorio."
                },
                "dataInicio": {
                    "type": "string",
                    "description": "Data inicio do relatorio YYYY-MM-DD. Opcional."
                },
                "dataFim": {
                    "type": "string",
                    "description": "Data fim do relatorio YYYY-MM-DD. Opcional."
                }
            },
            "required": ["emailDestino"]
        }
    ),
    'salvar_email': (
        'Salva o e-mail do gerente para receber relatorios futuros.',
        (
            "const emailRelatorio = query.emailRelatorio;\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const telefone = $('Sortear Aviso').item.json.Telefone;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "const url = base + '/contato-perfil/email?_s=' + secret\n"
            "  + '&empresaId=' + encodeURIComponent(empresaId)\n"
            "  + '&telefone=' + encodeURIComponent(telefone)\n"
            "  + '&emailRelatorio=' + encodeURIComponent(emailRelatorio);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'PATCH', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "emailRelatorio": {
                    "type": "string",
                    "description": "E-mail para receber relatorios de agendamentos."
                }
            },
            "required": ["emailRelatorio"]
        }
    ),
    'buscar_email': (
        'Busca o e-mail de relatorio salvo do gerente. Chame antes de enviar_relatorio_email.',
        (
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const telefone = $('Sortear Aviso').item.json.Telefone;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "const url = base + '/contato-perfil/email?_s=' + secret\n"
            "  + '&empresaId=' + encodeURIComponent(empresaId)\n"
            "  + '&telefone=' + encodeURIComponent(telefone);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'GET', url: url });\n"
            "return JSON.stringify(result);"
        ),
        None,
    ),
    'consultar_notificacoes': (
        'Lista as notificacoes pendentes (ainda nao enviadas ao cliente). Use para o gerente saber o que esta na fila.',
        (
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "const url = base + '/agenda/' + empresaId + '/notificacoes-pendentes?_s=' + secret;\n"
            "const result = await helpers.httpRequest({ method: 'GET', url: url });\n"
            "return JSON.stringify(result);"
        ),
        None,
    ),
    'cancelar_notificacao': (
        'Cancela notificacoes pendentes antes de serem enviadas. Use notificacaoId para cancelar uma especifica, ou leadTelefone para cancelar todas do cliente.',
        (
            "const notificacaoId = query.notificacaoId || '';\n"
            "const leadTelefone = query.leadTelefone || '';\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "let url = base + '/agenda/cancelar-notificacao?_s=' + secret\n"
            "  + '&empresaId=' + encodeURIComponent(empresaId);\n"
            "if (notificacaoId) url += '&notificacaoId=' + encodeURIComponent(notificacaoId);\n"
            "if (leadTelefone) url += '&leadTelefone=' + encodeURIComponent(leadTelefone);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'POST', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "notificacaoId": {
                    "type": "string",
                    "description": "ID da notificacao a cancelar. Use consultar_notificacoes para obter. Opcional se leadTelefone fornecido."
                },
                "leadTelefone": {
                    "type": "string",
                    "description": "Telefone do cliente ex: 5561999999999. Cancela todas as notificacoes pendentes desse cliente. Opcional se notificacaoId fornecido."
                }
            },
            "required": []
        }
    ),
    'notificar_cliente': (
        'Envia mensagem WhatsApp ao cliente via IA01. Use buscar_lead para obter o leadTelefone.',
        (
            "const leadTelefone = query.leadTelefone;\n"
            "const mensagem = query.mensagem;\n"
            "const agendamentoId = query.agendamentoId || '';\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "let url = base + '/agenda/notificar-cliente?_s=' + secret\n"
            "  + '&empresaId=' + encodeURIComponent(empresaId)\n"
            "  + '&leadTelefone=' + encodeURIComponent(leadTelefone)\n"
            "  + '&mensagem=' + encodeURIComponent(mensagem);\n"
            "if (agendamentoId) url += '&agendamentoId=' + encodeURIComponent(agendamentoId);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'POST', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "leadTelefone": {
                    "type": "string",
                    "description": "Telefone do cliente ex: 5561999999999. Use buscar_lead para obter."
                },
                "mensagem": {
                    "type": "string",
                    "description": "Mensagem a enviar ao cliente via WhatsApp."
                },
                "agendamentoId": {
                    "type": "string",
                    "description": "UUID do agendamento relacionado. Opcional."
                }
            },
            "required": ["leadTelefone", "mensagem"]
        }
    ),
    'buscar_lead': (
        'Busca o telefone de um cliente pelo nome. Chame antes de criar_agendamento quando o gerente mencionar o nome do cliente.',
        (
            "const nome = query.nome;\n"
            "const empresaId = $('Sortear Aviso').item.json.empresaId;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "const url = base + '/agenda/' + empresaId + '/buscar-lead?_s=' + secret\n"
            "  + '&nome=' + encodeURIComponent(nome);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'GET', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "nome": {
                    "type": "string",
                    "description": "Nome ou parte do nome do cliente a buscar ex: Maria, Joao Silva."
                }
            },
            "required": ["nome"]
        }
    ),
    'reagendar_agendamento': (
        'Remarca um agendamento para novo horario. Use ver_agenda para obter o agendamentoId.',
        (
            "const agendamentoId = query.agendamentoId;\n"
            "const novoInicio = query.novoInicio;\n"
            "const novoFim = query.novoFim;\n"
            "const secret = '" + SECRET + "';\n"
            "const base = '" + BASE + "';\n"
            "\n"
            "const url = base + '/agenda/reagendar?_s=' + secret\n"
            "  + '&agendamentoId=' + encodeURIComponent(agendamentoId)\n"
            "  + '&novoInicio=' + encodeURIComponent(novoInicio)\n"
            "  + '&novoFim=' + encodeURIComponent(novoFim);\n"
            "\n"
            "const result = await helpers.httpRequest({ method: 'POST', url: url });\n"
            "return JSON.stringify(result);"
        ),
        {
            "type": "object",
            "properties": {
                "agendamentoId": {
                    "type": "string",
                    "description": "UUID do agendamento a remarcar. Use ver_agenda para obter."
                },
                "novoInicio": {
                    "type": "string",
                    "description": "Novo inicio ISO8601 ex: 2026-05-22T10:00:00-03:00"
                },
                "novoFim": {
                    "type": "string",
                    "description": "Novo fim ISO8601 ex: 2026-05-22T10:30:00-03:00"
                }
            },
            "required": ["agendamentoId", "novoInicio", "novoFim"]
        }
    ),
}

# toolHttpRequest nodes (all others)
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
    # todos migrados para TOOLCODE_NODES
    # relatorio_agenda migrado para TOOLCODE_NODES
    # enviar_relatorio_email migrado para TOOLCODE_NODES
    # desbloquear_horario migrado para TOOLCODE_NODES
    # salvar_nome migrado para TOOLCODE_NODES
    # buscar_email migrado para TOOLCODE_NODES
    # salvar_email migrado para TOOLCODE_NODES
    # buscar_lead migrado para TOOLCODE_NODES
    # criar_agendamento migrado para TOOLCODE_NODES
}

# ASCII check for toolHttpRequest nodes
for name, tool in TOOLS.items():
    desc, url_expr, method = tool[0], tool[1], tool[2]
    bad = [(i, c) for i, c in enumerate(url_expr) if ord(c) > 127]
    if bad:
        print(f'ERRO {name}:'), [print(f'  pos {i}: {repr(c)}') for i, c in bad[:5]]
        sys.exit(1)
    print(f'OK {name}: {len(url_expr)}c [{method}]')

# ASCII check for toolCode nodes
for name, tool in TOOLCODE_NODES.items():
    desc, code, schema = tool
    bad = [(i, c) for i, c in enumerate(code) if ord(c) > 127]
    if bad:
        print(f'ERRO toolCode {name}:'), [print(f'  pos {i}: {repr(c)}') for i, c in bad[:5]]
        sys.exit(1)
    print(f'OK toolCode {name}: {len(code)}c')

req = urllib.request.Request(N8N_URL, headers={'X-N8N-API-KEY': API_KEY})
wf = json.loads(urllib.request.urlopen(req).read().decode('utf-8', errors='surrogatepass'))
print(f'\nDownloaded {len(wf["nodes"])} nodes')

patched = 0
for n in wf['nodes']:
    if n['name'] in TOOLCODE_NODES:
        desc, code, schema = TOOLCODE_NODES[n['name']]
        n['type'] = '@n8n/n8n-nodes-langchain.toolCode'
        n['typeVersion'] = 1.3
        params = {
            'name': n['name'],
            'description': desc,
            'language': 'javaScript',
            'jsCode': code,
        }
        if schema is not None:
            params['specifyInputSchema'] = True
            params['schemaType'] = 'manual'
            # n8n reads inputSchema via getNodeParameter then calls jsonParse()
            # so it must be stored as a JSON string, not an object
            params['inputSchema'] = json.dumps(schema)
        n['parameters'] = params
        patched += 1
        print(f'  {n["name"]} [toolCode]')
    elif n['name'] in TOOLS:
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
    print(f'\nPUT {resp.status} OK — {patched}/14 patched (ver_agenda=toolCode, rest=toolHttpRequest)')
except urllib.error.HTTPError as e:
    print(f'PUT ERROR {e.code}: {e.read().decode()[:600]}')
    sys.exit(1)

# Verify
req3 = urllib.request.Request(N8N_URL, headers={'X-N8N-API-KEY': API_KEY})
wf2 = json.loads(urllib.request.urlopen(req3).read().decode('utf-8'))
ok, fail = 0, []
for n in wf2['nodes']:
    if n['name'] in TOOLCODE_NODES:
        if n.get('type') == '@n8n/n8n-nodes-langchain.toolCode':
            ok += 1
            print(f'  VERIFY OK {n["name"]} = toolCode')
        else:
            fail.append(n['name'] + '(expected toolCode, got ' + n.get('type','?') + ')')
    elif n['name'] in TOOLS:
        params = n.get('parameters', {})
        url = params.get('url', '')
        no_ai = {'listar_profissionais', 'buscar_email'}
        has_ai = '$fromAI' in url
        if n['name'] in no_ai or has_ai:
            ok += 1
        else:
            fail.append(n['name'])
if fail:
    print(f'WARN not OK: {fail}')
else:
    print(f'Verification: {ok}/14 OK')
