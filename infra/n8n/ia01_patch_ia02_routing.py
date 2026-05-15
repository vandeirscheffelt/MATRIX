"""
Patch no IA01: adiciona roteamento para IA02 (Secretária Interna).

Mudança:
  ANTES: Dados → Buscar Contexto
  DEPOIS: Dados → Verificar Papel → É Interno?
                                     ↓ cliente    → Buscar Contexto (fluxo original)
                                     ↓ interno    → Chamar IA02 (Execute Workflow)
"""
import json, urllib.request, urllib.error

N8N_URL = "http://localhost:5678"
N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc"
IA01_ID = "UJnzqU4OF98EzKd8"
IA02_ID = "Itik8EFOzCtA5mG0"

WEBHOOK_CRED = {"httpHeaderAuth": {"id": "1oYeP3L8VFuLR0ZZ", "name": "N8N Webhook Secret"}}
API_BASE = "http://172.18.0.1:3004/webhook/n8n"

def api(path, method="GET", body=None):
    req = urllib.request.Request(
        f"{N8N_URL}{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json", "X-N8N-API-KEY": N8N_KEY},
        method=method
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise Exception(f"HTTP {e.code}: {e.read().decode()}")

# ── Buscar workflow IA01 completo ─────────────────────────────────────────────
print("Buscando IA01...")
wf = api(f"/api/v1/workflows/{IA01_ID}")

nodes = wf["nodes"]
connections = wf["connections"]

# ── Novos nós ─────────────────────────────────────────────────────────────────
new_nodes = [
    # 1. HTTP call para identificar papel do remetente
    {
        "id": "ia01-verifica-papel",
        "name": "Verificar Papel",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [640, 560],   # mesma x do Buscar Contexto antigo, deslocado
        "parameters": {
            "url": "={{ 'http://172.18.0.1:3004/webhook/n8n/interno/identificar/' + $('Dados').item.json.InstanceName + '/' + encodeURIComponent($('Dados').item.json.Telefone) }}",
            "authentication": "genericCredentialType",
            "genericAuthType": "httpHeaderAuth",
            "options": {}
        },
        "credentials": WEBHOOK_CRED
    },
    # 2. Switch: cliente vs interno (gerente/profissional)
    {
        "id": "ia01-eh-interno",
        "name": "É Interno?",
        "type": "n8n-nodes-base.switch",
        "typeVersion": 3,
        "position": [840, 560],
        "parameters": {
            "mode": "rules",
            "rules": {
                "values": [
                    {
                        "conditions": {
                            "options": {"caseSensitive": False, "leftValue": "", "typeValidation": "strict", "version": 2},
                            "conditions": [
                                {
                                    "id": "1",
                                    "leftValue": "={{ $json.papel }}",
                                    "rightValue": "cliente",
                                    "operator": {"type": "string", "operation": "notEquals"}
                                }
                            ],
                            "combinator": "and"
                        },
                        "renameOutput": True,
                        "outputKey": "Interno"
                    }
                ]
            },
            "options": {"fallbackOutput": "extra"}
        }
    },
    # 3. Execute Workflow que chama IA02
    {
        "id": "ia01-chamar-ia02",
        "name": "Chamar IA02",
        "type": "n8n-nodes-base.executeWorkflow",
        "typeVersion": 1.1,
        "position": [1040, 400],
        "parameters": {
            "source": "database",
            "workflowId": {"__rl": True, "value": IA02_ID, "mode": "id"},
            "options": {"waitForSubWorkflow": False},
            "fields": {
                "values": [
                    {"name": "Telefone",        "stringValue": "={{ $('Dados').item.json.Telefone }}"},
                    {"name": "InstanceName",    "stringValue": "={{ $('Dados').item.json.InstanceName }}"},
                    {"name": "message_content", "stringValue": "={{ $('Dados').item.json['message.content'] }}"},
                    {"name": "empresaId",       "stringValue": "={{ $json.empresaId }}"},
                    {"name": "papel",           "stringValue": "={{ $json.papel }}"},
                    {"name": "profissionalId",  "stringValue": "={{ $json.profissionalId ?? '' }}"},
                    {"name": "nomeProfissional","stringValue": "={{ $json.nomeProfissional ?? '' }}"},
                    {"name": "dataHoraAtual",   "stringValue": "={{ $('Dados').item.json.dataHoraAtual }}"},
                    {"name": "nomeAssistente",  "stringValue": "Assistente"},
                ]
            }
        }
    },
]

# ── Reposicionar nós existentes para abrir espaço ─────────────────────────────
# "Buscar Contexto" vai para x=1040 para ficar após o switch "cliente"
for n in nodes:
    if n["name"] == "Buscar Contexto":
        n["position"] = [1040, 560]
    # Empurrar tudo que estava em x >= 640 um pouco mais para direita
    elif n["position"][0] >= 640 and n["name"] not in ("Buscar Contexto",):
        n["position"][0] += 400

# ── Adicionar novos nós ───────────────────────────────────────────────────────
nodes.extend(new_nodes)

# ── Corrigir conexões ─────────────────────────────────────────────────────────
# ANTES: Dados → Buscar Contexto
# DEPOIS: Dados → Verificar Papel
connections["Dados"] = {
    "main": [[{"node": "Verificar Papel", "type": "main", "index": 0}]]
}

# Verificar Papel → É Interno?
connections["Verificar Papel"] = {
    "main": [[{"node": "É Interno?", "type": "main", "index": 0}]]
}

# É Interno?:
#   output 0 (Interno)  → Chamar IA02
#   output fallback (cliente) → Buscar Contexto
connections["É Interno?"] = {
    "main": [
        [{"node": "Chamar IA02", "type": "main", "index": 0}],   # output 0: Interno
        [{"node": "Buscar Contexto", "type": "main", "index": 0}] # output 1: fallback (cliente)
    ]
}

# Chamar IA02 → sem conexão downstream (fire-and-forget, waitForSubWorkflow=False)
# (não adicionamos conexão de saída para Chamar IA02)

# ── PUT workflow atualizado ───────────────────────────────────────────────────
payload = {
    "name": wf["name"],
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": wf.get("settings", {}).get("executionOrder", "v1")},
    "staticData": wf.get("staticData")
}

print("Atualizando IA01 com roteamento IA02...")
result = api(f"/api/v1/workflows/{IA01_ID}", method="PUT", body=payload)
print(f"✅ IA01 atualizado — {result['name']} ({result['id']})")
print("   Novos nós adicionados: Verificar Papel, É Interno?, Chamar IA02")
