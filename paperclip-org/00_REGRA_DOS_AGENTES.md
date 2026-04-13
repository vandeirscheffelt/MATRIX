# 🧠 REGRA DE ARQUITETURA DOS AGENTES (PAPERCLIP)

Este documento dita a **Política de Criação e Orquestração de Agentes** da Scheffelt Matrix Holding. Sempre que uma inteligência artificial for criar, editar ou estruturar um novo Agente, este documento deve ser lido e suas regras seguidas estritamente.

---

## 1. O Paradigma de Separação (Cérebro vs. Músculo)

Nossa arquitetura divide rigorosamente a lógica do sistema:
- **Cérebros (Esta Pasta):** Aqui residem as Identidades, Hierarquias, Prompts e Tomadas de Decisão.
- **Músculos (Pasta `plugins/`):** Lá residem as Ferramentas, APIs, Senhas e Acessos Técnicos.

> **Regra de Ouro:** Um agente (Cérebro) NÃO contém código de integração. Ele recebe ferramentas (Plugins) e usa inteligência para decidir QUANDO usá-las. Se um Agente precisa ler o banco de dados, NÃO peça para ele "dar um jeito"; vá na pasta de plugins e crie o Plugin do banco de dados primeiro.

---

## 2. Infraestrutura como Código (IaC)

As "Mentes" da empresa não devem viver presas apenas na interface do Paperclip ou em um banco de dados volátil.
Sempre que um novo agente for idealizado, **antes** de ir para o painel do Paperclip:
1. Crie a pasta do agente aqui dentro, respeitando a hierarquia (ex: `03_Specialists/analista_de_dados/`).
2. Crie o arquivo `prompt_canonical.md`.
3. Escreva a identidade e as regras de operação dentro deste arquivo.
4. Vá para o painel do Paperclip e crie o Agente.
5. **Configuração Obrigatória de Ambiente:** No painel do agente, aba "Configuration", altere sempre o campo **"Command"** para `C:\tools\codex.cmd` (em vez do padrão `codex`). Isso evita o bug fatal do Windows onde espaços no nome de usuário (`C:\Users\Vandeir Scheffelt\...`) derrubam o processo do Codex.
6. Cole o prompt `prompt_canonical.md` na aba "Instructions" do agente.

Isso garante versionamento, estabilidade no ambiente Windows e permite migrações seguras sem perda de inteligência.

---

## 3. O Paradigma de Reutilização (O Padrão "Almoxarifado")

A Matrix Holding adota o design de **Fábrica de Softwares e Ativos Otimizada**. Nós não começamos nada do zero se já temos uma base pronta, para economizar tempo, tokens e evitar alucinações da IA.

### O Exemplo Prático de Fluxo (Caso do Gateway Stripe):
Para ilustrar a arquitetura, veja como múltiplos agentes devem interagir para resolver um problema técnico:

1. **O Gerente:** Recebe do CEO a ordem *"Adicione pagamento no Novo App"*. O Gerente sabe que a ordem é NÃO reinventar a roda. Ele cria uma sub-tarefa para o Almoxarife.
2. **O Almoxarife (Librarian Agent):** O guardião dos repositórios. Usando um Plugin de Busca (`github-search` ou `file-search`), ele procura na base de código da empresa por "módulo stripe". Ele encontra o boilerplate `matrix-stripe-base-v1` e entrega esse link para o Gerente.
3. **O Especialista (Executor Agent):** O Gerente repassa o código-base encontrado pelo Almoxarife para o "Especialista em Stripe". O Especialista gasta tokens e esforço apenas para **adaptar e injetar** o código-base no projeto atual, mudando rotas e variáveis. 

**Resumo da Filosofia de Orquestração:**
- **Gerentes** orquestram e quebram tarefas.
- **Arquivistas/Almoxarifes** localizam ativos pré-prontos (código, criativos de anúncios aprovados, etc).
- **Especialistas** executam o refinamento e a entrega final.

Nenhum agente deve atuar como "faz-tudo". Especialização diminui o custo computacional e aumenta assustadoramente a assertividade.
