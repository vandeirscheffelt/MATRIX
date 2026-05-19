"""Reforça restrição de e-mail — versão mais explícita e categórica."""
import json, urllib.request

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
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

wf = api(f'/api/v1/workflows/{IA02_ID}')

OLD = '- E-mail enviado: informe que o envio foi feito e encerre. Nao prometa monitorar respostas, confirmar leitura ou receber retornos — voce nao tem acesso a caixa de entrada de ninguem.'
NEW = ('- E-mail: sua unica funcao e ENVIAR. Apos enviar, confirme o envio e ENCERRE o assunto.\n'
       '  PROIBIDO: prometer avisar retorno, monitorar resposta, confirmar leitura, reencaminhar resposta ou qualquer acao pos-envio.\n'
       '  Voce NAO tem acesso a nenhuma caixa de entrada. Nao existe forma de voce "avisar quando houver retorno". Nunca sugira isso.')

for n in wf['nodes']:
    if n['name'] == 'Montar Prompt IA02':
        if OLD in n['parameters']['jsCode']:
            n['parameters']['jsCode'] = n['parameters']['jsCode'].replace(OLD, NEW)
            print('Restricao de e-mail reforçada')
        else:
            print('AVISO: trecho anterior nao encontrado')
        break

payload = {
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': wf.get('settings', {}),
    'staticData': wf.get('staticData'),
}
result = api(f'/api/v1/workflows/{IA02_ID}', method='PUT', body=payload)
print('OK: ' + result['name'])
