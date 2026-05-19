"""
Diagnóstica e corrige referências quebradas no workflow IA01.
Problema: uma conexão aponta para um nó que não existe mais no array de nodes.
Isso causa "Cannot read properties of undefined (reading 'name')" em 4ms.
"""
import json, urllib.request, urllib.error

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
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise Exception(f'HTTP {e.code}: {e.read().decode()}')

wf = api(f'/api/v1/workflows/{IA01_ID}')

node_names = {n['name'] for n in wf['nodes']}
print(f'\n=== {len(node_names)} nós no workflow ===')
for name in sorted(node_names):
    print(f'  - {name}')

conn = wf['connections']
dangling = []

print('\n=== Verificando conexões ===')
for src, outputs in conn.items():
    if src not in node_names:
        print(f'  ⚠️  SOURCE ausente: "{src}"')
        dangling.append(('source', src, None, None))
    for output_idx, targets in enumerate(outputs.get('main', [])):
        for target in (targets or []):
            tgt_name = target.get('node', '')
            if tgt_name not in node_names:
                print(f'  ⚠️  TARGET ausente: "{src}" → output[{output_idx}] → "{tgt_name}"')
                dangling.append(('target', src, output_idx, tgt_name))

if not dangling:
    print('  ✓ Nenhuma referência quebrada encontrada — problema é outro')
else:
    print(f'\n=== Corrigindo {len(dangling)} problemas ===')
    # Remover conexões com source ausente
    for kind, src, idx, tgt in dangling:
        if kind == 'source':
            del conn[src]
            print(f'  ✓ Removida conexão de source ausente: "{src}"')
        elif kind == 'target':
            # Limpar o target específico do output
            targets = conn[src]['main'][idx]
            conn[src]['main'][idx] = [t for t in targets if t.get('node') != tgt]
            print(f'  ✓ Removido target ausente: "{src}"[{idx}] → "{tgt}"')

    # Push corrigido
    payload = {
        'name': wf['name'],
        'nodes': wf['nodes'],
        'connections': conn,
        'settings': {'executionOrder': wf.get('settings', {}).get('executionOrder', 'v1')},
        'staticData': wf.get('staticData'),
    }
    result = api(f'/api/v1/workflows/{IA01_ID}', method='PUT', body=payload)
    print(f'\nOK: {result["name"]} atualizado')
