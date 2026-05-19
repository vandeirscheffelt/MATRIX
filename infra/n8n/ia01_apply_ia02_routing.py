"""
Patch consolidado no IA01:
  1. Corrige Buscar Contexto URL ($json → $('Dados').item.json)
  2. Adiciona roteamento IA02: Dados → Verificar Papel → É Interno? → Chamar IA02 / Buscar Contexto
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

print("Buscando IA01...")
d = api(f"/api/v1/workflows/{IA01_ID}")
nodes = d["nodes"]
connections = d["connections"]

# ── 1. Remover nós de patch antigos (se existirem) ───────────────────────────
PATCH_NAMES = {"Verificar Papel", "É Interno?", "Chamar IA02"}
nodes = [n for n in nodes if n["name"] not in PATCH_NAMES]
for k in list(connections.keys()):
    if k in PATCH_NAMES:
        del connections[k]

# ── 2. Fix Buscar Contexto URL ────────────────────────────────────────────────
for n in nodes:
    if n["name"] == "Buscar Contexto":
        n["parameters"]["url"] = "={{ 'http://172.18.0.1:3004/webhook/n8n/context/' + $('Dados').item.json.InstanceName }}"
        print("  ✓ Buscar Contexto URL corrigida")

# ── 3. Reposicionar Buscar Contexto (x=1040) ─────────────────────────────────
for n in nodes:
    if n["name"] == "Buscar Contexto":
        n["position"] = [1040, 560]
    elif n["position"][0] >= 640:
        n["position"][0] += 400

# ── 4. Adicionar nós de roteamento ───────────────────────────────────────────
nodes.extend([
    {
        "id": "ia01-verifica-papel",
        "name": "Verificar Papel",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [640, 560],
        "parameters": {
            "url": "={{ 'http://172.18.0.1:3004/webhook/n8n/interno/identificar/' + $('Dados').item.json.InstanceName + '/' + encodeURIComponent($('Dados').item.json.Telefone) }}",
            "authentication": "genericCredentialType",
            "genericAuthType": "httpHeaderAuth",
            "options": {}
        },
        "credentials": WEBHOOK_CRED
    },
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
                                {"id": "1", "leftValue": "={{ $json.papel }}", "rightValue": "cliente",
                                 "operator": {"type": "string", "operation": "notEquals"}}
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
])

# ── 5. Atualizar conexões ─────────────────────────────────────────────────────
connections["Dados"] = {
    "main": [[{"node": "Verificar Papel", "type": "main", "index": 0}]]
}
connections["Verificar Papel"] = {
    "main": [[{"node": "É Interno?", "type": "main", "index": 0}]]
}
connections["É Interno?"] = {
    "main": [
        [{"node": "Chamar IA02",     "type": "main", "index": 0}],  # output 0: Interno
        [{"node": "Buscar Contexto", "type": "main", "index": 0}]   # output 1: fallback (cliente)
    ]
}

# ── 6. PUT ────────────────────────────────────────────────────────────────────
payload = {
    "name": d["name"],
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": d.get("settings", {}).get("executionOrder", "v1")}
}

print("Aplicando patch...")
result = api(f"/api/v1/workflows/{IA01_ID}", method="PUT", body=payload)
print(f"✅ IA01 atualizado: {result['name']}")

# ── 7. Verificar ──────────────────────────────────────────────────────────────
wf = api(f"/api/v1/workflows/{IA01_ID}")
names = [n["name"] for n in wf["nodes"]]
dados_conn = [c["node"] for c in wf["connections"].get("Dados", {}).get("main", [[]])[0]]
print(f"   Verificar Papel: {'✓' if 'Verificar Papel' in names else '✗'}")
print(f"   É Interno?:      {'✓' if 'É Interno?' in names else '✗'}")
print(f"   Chamar IA02:     {'✓' if 'Chamar IA02' in names else '✗'}")
print(f"   Dados → {dados_conn}")
