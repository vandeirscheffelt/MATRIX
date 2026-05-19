"""Propaga idioma da config para IA02 e torna o prompt dinâmico por idioma."""
import json, urllib.request

N8N_URL = 'http://localhost:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjQ3ZGEyYy01N2QzLTQ0NzMtOWQxNy05Yjg2OWJkMGEyMzAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDFjN2Y5MjItNWZmNy00YTQxLTljZGQtMzFlOGU0OGZkYTBhIiwiaWF0IjoxNzc4NjkyNDE5fQ.DGVpab93USAvzaSSN20LxTtUw2xc8OoCapfDG5UrmJc'
IA01_ID = 'UJnzqU4OF98EzKd8'
IA02_ID = 'Itik8EFOzCtA5mG0'

def api(path, method='GET', body=None):
    req = urllib.request.Request(
        f'{N8N_URL}{path}',
        data=json.dumps(body).encode() if body else None,
        headers={'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY},
        method=method
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# ── 1. IA01: Preparar IA02 — adicionar idioma e nomeAssistente real ──
wf1 = api(f'/api/v1/workflows/{IA01_ID}')
for n in wf1['nodes']:
    if n.get('name') == 'Preparar IA02':
        OLD_CODE = "nomeAssistente:   'Assistente',"
        NEW_CODE = ("nomeAssistente:   $('Buscar Contexto').item.json.nomeAssistente || 'Assistente',\n"
                    "    idioma:           $('Buscar Contexto').item.json.idioma || 'pt-BR',")
        if OLD_CODE in n['parameters']['jsCode']:
            n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(OLD_CODE, NEW_CODE)
            print('IA01 Preparar IA02: idioma e nomeAssistente adicionados')
        else:
            print('AVISO IA01: ancora nao encontrada')
        break

api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body={
    'name': wf1['name'], 'nodes': wf1['nodes'],
    'connections': wf1['connections'],
    'settings': {'executionOrder': wf1.get('settings', {}).get('executionOrder', 'v1')},
})
print('IA01 salva')

# ── 2. IA02: Dados IA02 — adicionar idioma nos assignments ──
wf2 = api(f'/api/v1/workflows/{IA02_ID}')
for n in wf2['nodes']:
    if n.get('name') == 'Dados IA02':
        assignments = n['parameters']['assignments']['assignments']
        if not any(a['name'] == 'idioma' for a in assignments):
            assignments.append({
                'id': str(len(assignments) + 1),
                'name': 'idioma',
                'value': "={{ $json.idioma ?? 'pt-BR' }}",
                'type': 'string'
            })
            print('IA02 Dados IA02: campo idioma adicionado')
        else:
            print('IA02 Dados IA02: idioma ja existe')
        break

# ── 3. IA02: Prompt — substituir hardcoded por dinamico ──
for n in wf2['nodes']:
    if n.get('name') == 'Montar Prompt IA02':
        OLD = ('IDIOMA — REGRA ABSOLUTA: responda SEMPRE em portugues brasileiro. '
               'Nunca use palavras em ingles como Done, Ok done, Sure, etc. '
               'Use sempre: Feito!, Pronto!, Certo!, Claro!.')
        # A interpolacao ${d.idioma} funciona porque jsCode e um template literal JS
        NEW = ('IDIOMA — REGRA ABSOLUTA: responda SEMPRE no idioma configurado para esta empresa: '
               '${d.idioma === "en" ? "ingles (English)" : d.idioma === "es" ? "espanhol (Espanol)" : "portugues brasileiro"}. '
               'Nunca misture idiomas nem use palavras de outro idioma (ex: nunca diga "Done" se o idioma for portugues). '
               'Mesmo que o usuario escreva em outro idioma, responda sempre no idioma configurado.')
        if OLD in n['parameters']['jsCode']:
            n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(OLD, NEW)
            print('IA02 prompt: idioma dinamico aplicado')
        else:
            print('AVISO IA02: ancora de idioma nao encontrada')
        break

api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body={
    'name': wf2['name'], 'nodes': wf2['nodes'],
    'connections': wf2['connections'], 'settings': wf2.get('settings', {}),
    'staticData': wf2.get('staticData'),
})
print('IA02 salva')
