"""
Script para criar o workflow Evolia — Secretária Interna (IA02) no n8n via REST API.
Execute na VPS: python3 /tmp/ia02_workflow.py
"""
import json
import urllib.request

N8N_URL = "http://localhost:5678"
N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc"

WEBHOOK_CRED = {"httpHeaderAuth": {"id": "1oYeP3L8VFuLR0ZZ", "name": "N8N Webhook Secret"}}
EVOLUTION_CRED = {"evolutionApi": {"id": "mVQnz4JWlbdbEut9", "name": "Evolution account"}}
OPENAI_CRED = {"openAiApi": {"id": "1wrcL6GoOkPpEpf7", "name": "OpenAi account"}}
POSTGRES_CRED = {"postgres": {"id": "gDTb2tKcGUSRNYIn", "name": "Postgres account"}}

API_BASE = "http://172.18.0.1:3004/webhook/n8n"

PROMPT_CODE = r"""const d = $input.first().json;
const gerente = d.papel === 'gerente';

const restricao = gerente
  ? 'O usuario e o GERENTE e tem acesso a TODAS as agendas. Pode consultar, bloquear, cancelar e reagendar para qualquer profissional.'
  : `O usuario e ${d.nomeProfissional || 'um profissional'} e tem acesso APENAS a SUA propria agenda. Para TODAS as acoes de agenda, use sempre profissionalId: ${d.profissionalId}`;

const prompt = `Voce e a assistente interna de agenda da empresa.
DATA E HORA ATUAL: ${d.dataHoraAtual} (horario de Brasilia).

${restricao}

IDs fixos para usar nas tools:
- empresaId: ${d.empresaId}
${gerente ? '' : `- profissionalId: ${d.profissionalId}`}
REGRAS:
- Nunca cancele ou reagende agendamento com cliente sem pedir confirmacao primeiro
- Apos qualquer acao que impacte um cliente, use a tool notificar_cliente para que a atendente avise o cliente
- Use formato de data YYYY-MM-DD e hora HH:MM nas tools
- Apresente datas ao usuario em DD/MM/YYYY e hora HH:MM
- Responda de forma objetiva e profissional
- NUNCA mencione: IA, API, automacoes, sistemas, n8n, bot`;

return [{ json: { ...d, systemPrompt: prompt } }];"""

FORMATAR_CODE = r"""const texto = ($input.first().json.output || '').toString().trim()
  .replace(/\*\*(.*?)\*\*/g, '*$1*')
  .replace(/^\* /gm, '• ');

const idx = texto.indexOf('\n\n');
let mensagens;

if (idx !== -1 && texto.length > 300) {
  const msg1 = texto.slice(0, idx).trim();
  const msg2 = texto.slice(idx + 2).trim();
  mensagens = [msg1, msg2].filter(function(m){ return m && m.length > 0; });
} else {
  mensagens = [texto.replace(/\n\n/g, '\n')];
}

return [{ json: { output: { messages: mensagens } } }];"""

workflow = {
    "name": "Evolia — Secretária Interna (IA02)",
    "settings": {"executionOrder": "v1"},
    "nodes": [
        # ── Trigger ───────────────────────────────────────────────────────────
        {
            "id": "ia02-n01",
            "name": "Receber da IA01",
            "type": "n8n-nodes-base.executeWorkflowTrigger",
            "typeVersion": 1,
            "position": [0, 400],
            "parameters": {}
        },
        # ── Extrair campos do input ───────────────────────────────────────────
        {
            "id": "ia02-n02",
            "name": "Dados IA02",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [220, 400],
            "parameters": {
                "assignments": {
                    "assignments": [
                        {"id": "1", "name": "Telefone",        "value": "={{ $json.Telefone }}", "type": "string"},
                        {"id": "2", "name": "InstanceName",    "value": "={{ $json.InstanceName }}", "type": "string"},
                        {"id": "3", "name": "mensagem",        "value": "={{ $json.message_content }}", "type": "string"},
                        {"id": "4", "name": "empresaId",       "value": "={{ $json.empresaId }}", "type": "string"},
                        {"id": "5", "name": "papel",           "value": "={{ $json.papel }}", "type": "string"},
                        {"id": "6", "name": "profissionalId",  "value": "={{ $json.profissionalId ?? '' }}", "type": "string"},
                        {"id": "7", "name": "nomeProfissional","value": "={{ $json.nomeProfissional ?? '' }}", "type": "string"},
                        {"id": "8", "name": "dataHoraAtual",   "value": "={{ $json.dataHoraAtual }}", "type": "string"},
                        {"id": "9", "name": "nomeAssistente",  "value": "={{ $json.nomeAssistente ?? 'Assistente' }}", "type": "string"},
                    ]
                },
                "options": {}
            }
        },
        # ── Monta system prompt dinamicamente ────────────────────────────────
        {
            "id": "ia02-n03",
            "name": "Montar Prompt IA02",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [440, 400],
            "parameters": {"jsCode": PROMPT_CODE}
        },
        # ── Agente IA ─────────────────────────────────────────────────────────
        {
            "id": "ia02-n04",
            "name": "Agente IA02",
            "type": "@n8n/n8n-nodes-langchain.agent",
            "typeVersion": 1.6,
            "position": [660, 400],
            "parameters": {
                "promptType": "define",
                "text": "={{ $json.mensagem }}",
                "options": {
                    "systemMessage": "={{ $json.systemPrompt }}"
                }
            }
        },
        # ── Modelo de linguagem ───────────────────────────────────────────────
        {
            "id": "ia02-n05",
            "name": "OpenAI Chat Model",
            "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
            "typeVersion": 1,
            "position": [440, 680],
            "parameters": {"model": "gpt-5-nano", "options": {}},
            "credentials": OPENAI_CRED
        },
        # ── Memória Postgres ──────────────────────────────────────────────────
        {
            "id": "ia02-n06",
            "name": "Postgres Chat Memory",
            "type": "@n8n/n8n-nodes-langchain.memoryPostgresChat",
            "typeVersion": 1.3,
            "position": [660, 680],
            "parameters": {
                "sessionIdType": "customKey",
                "sessionKey": "=ia02_{{ $('Dados IA02').item.json.InstanceName }}_{{ $('Dados IA02').item.json.Telefone }}",
                "tableName": "atendente_ia.n8n_chat_histories",
                "contextWindowLength": 30
            },
            "credentials": POSTGRES_CRED
        },
        # ── Tool: Ver Agenda ──────────────────────────────────────────────────
        {
            "id": "ia02-n07",
            "name": "Tool Ver Agenda",
            "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
            "typeVersion": 1.1,
            "position": [0, 680],
            "parameters": {
                "name": "ver_agenda",
                "description": "Consulta agendamentos confirmados ou remarcados. Informe data em YYYY-MM-DD (padrao hoje). Para gerente, profissionalId e opcional. Para profissional, sempre informe o profissionalId fixo do contexto.",
                "method": "GET",
                "url": f"={API_BASE}/agenda/{{{{$('Dados IA02').item.json.empresaId}}}}",
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendQuery": True,
                "queryParameters": {
                    "parameters": [
                        {"name": "data", "value": "={{ $fromAI('data', 'Data em YYYY-MM-DD') }}"},
                        {"name": "profissionalId", "value": "={{ $fromAI('profissionalId', 'ID do profissional (opcional)') }}"}
                    ]
                },
                "options": {}
            },
            "credentials": WEBHOOK_CRED
        },
        # ── Tool: Bloquear Horário ────────────────────────────────────────────
        {
            "id": "ia02-n08",
            "name": "Tool Bloquear Horário",
            "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
            "typeVersion": 1.1,
            "position": [0, 840],
            "parameters": {
                "name": "bloquear_horario",
                "description": "Bloqueia um horario vago na agenda de um profissional. Use apenas para horarios SEM cliente agendado.",
                "method": "POST",
                "url": f"{API_BASE}/agenda/bloquear",
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={\n  \"empresaId\": \"{{ $('Dados IA02').item.json.empresaId }}\",\n  \"profissionalId\": \"{{ $fromAI('profissionalId', 'ID do profissional') }}\",\n  \"inicio\": \"{{ $fromAI('inicio', 'Datetime ISO 8601, ex: 2026-05-15T09:00:00-03:00') }}\",\n  \"fim\": \"{{ $fromAI('fim', 'Datetime ISO 8601') }}\",\n  \"motivo\": \"{{ $fromAI('motivo', 'Motivo do bloqueio (opcional)') }}\"\n}",
                "options": {}
            },
            "credentials": WEBHOOK_CRED
        },
        # ── Tool: Cancelar Agendamento ────────────────────────────────────────
        {
            "id": "ia02-n09",
            "name": "Tool Cancelar Agendamento",
            "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
            "typeVersion": 1.1,
            "position": [0, 1000],
            "parameters": {
                "name": "cancelar_agendamento",
                "description": "Cancela um agendamento pelo ID. Se tiver cliente, o retorno indica leadTelefone para notificar.",
                "method": "POST",
                "url": f"{API_BASE}/agenda/cancelar",
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={\n  \"agendamentoId\": \"{{ $fromAI('agendamentoId', 'UUID do agendamento') }}\",\n  \"motivo\": \"{{ $fromAI('motivo', 'Motivo do cancelamento (opcional)') }}\"\n}",
                "options": {}
            },
            "credentials": WEBHOOK_CRED
        },
        # ── Tool: Reagendar ───────────────────────────────────────────────────
        {
            "id": "ia02-n10",
            "name": "Tool Reagendar",
            "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
            "typeVersion": 1.1,
            "position": [0, 1160],
            "parameters": {
                "name": "reagendar_agendamento",
                "description": "Move um agendamento para novo horario. Retorna dados do cliente para notificar se necessario.",
                "method": "POST",
                "url": f"{API_BASE}/agenda/reagendar",
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={\n  \"agendamentoId\": \"{{ $fromAI('agendamentoId', 'UUID do agendamento') }}\",\n  \"novoInicio\": \"{{ $fromAI('novoInicio', 'Novo inicio ISO 8601') }}\",\n  \"novoFim\": \"{{ $fromAI('novoFim', 'Novo fim ISO 8601') }}\"\n}",
                "options": {}
            },
            "credentials": WEBHOOK_CRED
        },
        # ── Tool: Notificar Cliente ───────────────────────────────────────────
        {
            "id": "ia02-n11",
            "name": "Tool Notificar Cliente",
            "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
            "typeVersion": 1.1,
            "position": [0, 1320],
            "parameters": {
                "name": "notificar_cliente",
                "description": "Solicita que a atendente (IA01) envie uma mensagem ao cliente sobre mudanca de agendamento. Use SEMPRE apos cancelar ou reagendar com cliente.",
                "method": "POST",
                "url": f"{API_BASE}/agenda/notificar-cliente",
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={\n  \"empresaId\": \"{{ $('Dados IA02').item.json.empresaId }}\",\n  \"leadTelefone\": \"{{ $fromAI('leadTelefone', 'Telefone do cliente (com DDI, ex: 5511999999999@s.whatsapp.net)') }}\",\n  \"mensagem\": \"{{ $fromAI('mensagem', 'Mensagem a ser enviada ao cliente') }}\",\n  \"agendamentoId\": \"{{ $fromAI('agendamentoId', 'UUID do agendamento (opcional)') }}\"\n}",
                "options": {}
            },
            "credentials": WEBHOOK_CRED
        },
        # ── Formatar Resposta ─────────────────────────────────────────────────
        {
            "id": "ia02-n12",
            "name": "Formatar Mensagens",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [880, 400],
            "parameters": {"jsCode": FORMATAR_CODE}
        },
        # ── Split e Loop de envio ─────────────────────────────────────────────
        {
            "id": "ia02-n13",
            "name": "Split Mensagens",
            "type": "n8n-nodes-base.splitOut",
            "typeVersion": 1,
            "position": [1100, 400],
            "parameters": {
                "fieldToSplitOut": "output.messages",
                "options": {"destinationFieldName": "output"}
            }
        },
        {
            "id": "ia02-n14",
            "name": "Loop Mensagens",
            "type": "n8n-nodes-base.splitInBatches",
            "typeVersion": 3,
            "position": [1320, 400],
            "parameters": {"options": {}}
        },
        # ── Enviar via Evolution API ──────────────────────────────────────────
        {
            "id": "ia02-n15",
            "name": "Enviar Texto",
            "type": "n8n-nodes-evolution-api.evolutionApi",
            "typeVersion": 1,
            "position": [1540, 400],
            "parameters": {
                "resource": "messages-api",
                "instanceName": "={{ $('Dados IA02').item.json.InstanceName }}",
                "remoteJid": "={{ $('Dados IA02').item.json.Telefone }}",
                "messageText": "={{ $json.output }}",
                "options_message": {"delay": 3000, "linkPreview": False}
            },
            "credentials": EVOLUTION_CRED
        },
        # ── Delay entre mensagens ─────────────────────────────────────────────
        {
            "id": "ia02-n16",
            "name": "Delay Entre Msgs",
            "type": "n8n-nodes-base.wait",
            "typeVersion": 1.1,
            "position": [1760, 400],
            "parameters": {"amount": 3},
            "webhookId": "delay-ia02-msgs"
        },
    ],
    "connections": {
        "Receber da IA01":      {"main": [[{"node": "Dados IA02", "type": "main", "index": 0}]]},
        "Dados IA02":           {"main": [[{"node": "Montar Prompt IA02", "type": "main", "index": 0}]]},
        "Montar Prompt IA02":   {"main": [[{"node": "Agente IA02", "type": "main", "index": 0}]]},
        "Agente IA02":          {"main": [[{"node": "Formatar Mensagens", "type": "main", "index": 0}]]},

        # LangChain connections
        "OpenAI Chat Model":    {"ai_languageModel": [[{"node": "Agente IA02", "type": "ai_languageModel", "index": 0}]]},
        "Postgres Chat Memory": {"ai_memory":        [[{"node": "Agente IA02", "type": "ai_memory", "index": 0}]]},
        "Tool Ver Agenda":      {"ai_tool":          [[{"node": "Agente IA02", "type": "ai_tool", "index": 0}]]},
        "Tool Bloquear Horário":{"ai_tool":          [[{"node": "Agente IA02", "type": "ai_tool", "index": 0}]]},
        "Tool Cancelar Agendamento": {"ai_tool":     [[{"node": "Agente IA02", "type": "ai_tool", "index": 0}]]},
        "Tool Reagendar":       {"ai_tool":          [[{"node": "Agente IA02", "type": "ai_tool", "index": 0}]]},
        "Tool Notificar Cliente":{"ai_tool":         [[{"node": "Agente IA02", "type": "ai_tool", "index": 0}]]},

        # Send pipeline
        "Formatar Mensagens":   {"main": [[{"node": "Split Mensagens", "type": "main", "index": 0}]]},
        "Split Mensagens":      {"main": [[{"node": "Loop Mensagens", "type": "main", "index": 0}]]},
        "Loop Mensagens":       {"main": [[], [{"node": "Enviar Texto", "type": "main", "index": 0}]]},
        "Enviar Texto":         {"main": [[{"node": "Delay Entre Msgs", "type": "main", "index": 0}]]},
        "Delay Entre Msgs":     {"main": [[{"node": "Loop Mensagens", "type": "main", "index": 0}]]},
    }
}

payload = json.dumps(workflow).encode("utf-8")
req = urllib.request.Request(
    f"{N8N_URL}/api/v1/workflows",
    data=payload,
    headers={
        "Content-Type": "application/json",
        "X-N8N-API-KEY": N8N_KEY
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print(f"✅ Workflow criado: {result['id']} — {result['name']}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"❌ Erro {e.code}: {body}")
