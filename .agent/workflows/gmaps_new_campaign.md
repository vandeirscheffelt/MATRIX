---
description: [Gmaps Scraper] SOP para subir uma nova Campanha de prospecção alterando apenas Variáveis de nicho, localidades e limites no robô.
---
# SOP de Nova Extração (Google Maps Scraper)

Este SOP transforma o agente de IA num **Cientista de Dados Operacional**. O objetivo dele é pegar novas áreas e novas categorias-alvo do usuário e injetá-las no motor de busca (`apps/gmaps-scraper`) de forma automática, populando o banco do Supabase para que os Workers voltem a trabalhar no momento seguinte.

Você deve rodar este fluxo sempre que o usuário solicitar uma "nova busca", "novo nicho", ou "novas localidades" na extração de mapas.

## 📦 Variáveis Base (O Agente precisa ter o conhecimento destas respostas)
- `[CATEGORIAS_ALVO]`: Lista de palavras-chave do novo prospecto. (ex: `["Pizzarias", "Hamburguerias", "Restaurantes"]`)
- `[LOCALIDADES_ALVO]`: Lista exata no formato `Bairro, Cidade, Estado`. (ex: `["Centro, Osasco, SP", "Bela Vista, Osasco, SP"]`)
- `[LIMITE_CAPTACAO]`: Um número inteiro definindo o limite por bairro. (Ex: `150`)

---

## 🛠️ Procedimento Operacional Padrão (Passo a Passo)

Sempre confirme esses passos para levantar a nova campanha.

### Passo 1: Validação das Variáveis
Interaja com o usuário confirmando as 3 variáveis. Se o usuário fornecer apenas "Dentistas em RJ", desmembre inteligentemente criando um array com uns 5 ou 10 bairros chave da capital RJ.

### Passo 2: Editar o arquivo `config.js` 
Você (O Agente) usará sua tool `replace_file_content` para acessar o arquivo `c:\Users\Vandeir Scheffelt\Matrix\apps\gmaps-scraper\config.js` e substituir de forma limpa as listas dos seguintes arrays usando as novas variáveis do Passo 1:
1. `maxResultsPerSearch: [LIMITE_CAPTACAO]`
2. `locations: [LOCALIDADES_ALVO]`
3. `categories: [CATEGORIAS_ALVO]`

### Passo 3: Semear as Filas (`execucoes`) no Supabase
Execute o Semeador de banco de dados para criar automaticamente as tabelas base, não use `cat` nem `echo`, use estritamente Node.
// turbo
```bash
node "c:\Users\Vandeir Scheffelt\Matrix\apps\gmaps-scraper\seed.js"
```

### Passo 4: Entregar Relatório de Ignição Visual 
Comunique ao usuário o seu sucesso, repassando os números do Terminal ("Você lançou 30 novas localidades x 10 categorias = 300 Novos Jobs"). 
Lembre o usuário que ele agora só precisa ligar as máquinas Worker (`npm start` na VPS ou na máquina Local) para que a esteira continue o trabalho com os novos alvos 24 horas por dia.
