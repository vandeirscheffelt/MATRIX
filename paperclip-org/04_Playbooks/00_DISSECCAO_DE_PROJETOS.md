# 📖 Playbook: Dissecação e Modularização de Projetos

Este playbook documenta o Procedimento Operacional Padrão (SOP) para que qualquer IA (Antigravity ou agentes Paperclip) saiba exatamente como agir quando o CEO fizer o upload de um projeto inteiro gerado por IAs de UI (ex: Lovable, V0, etc).

## O Problema (Por que dissecamos?)
IAs focadas em design (como Lovable) geram "Código Espaguete Funcional" (Tudo acoplado no mesmo app). Para escalar a Matrix Holding, **nós não subimos apps inteiros diretamente**. Nós cortamos a lógica pura e a transformamos em "Módulos Lego" dentro da pasta `packages/` para que outros apps possam usar os mesmos módulos no futuro.

---

## 🛠 Passo a Passo da Cirurgia (S.O.P.)

### Passo 1: Recebimento e Sandboxing
- O usuário anexa o código compactado (.zip) ou fornece a URL do repositório gerado.
- A IA extrai o conteúdo para uma pasta temporária (nunca insere os arquivos direto na árvore principal).

### Passo 2: Avaliação de Dependências
- A IA lê o `package.json` do projeto original.
- Identifica quais bibliotecas (shadcn, tailwind, react-query, supabase) devem ser migradas para a raiz do `pnpm-workspace`.
- Resolve conflitos de versão com o ecossistema existente da Matrix.

### Passo 3: Extração do Core (Músculos)
- Arquivos de Conexão com Banco (`supabase.ts`), Helpers (`utils.ts`) e Regras de Negócio são movidos para dentro de `packages/commerce-core` (ou módulo adequado).
- O código é refatorado para NÃO depender de UI diretamente.

### Passo 4: Extração Visual (Pele)
- Componentes Genéricos (Botões, Inputs, Cards) e Configurações Globais (Tailwind config, Global CSS) são isolados.
- Se já existir em `packages/ui`, são ignorados ou mesclados.
- Componentes altamente específicos do negócio viram bibliotecas (`@matrix/auth-ui`).

### Passo 5: Montagem do App Final
- Só então a IA constrói um App Final na pasta `/apps/` (ex: `apps/shaikron`).
- Este app não tem lógica pesada. Ele apenas importa: 
  - `import { PayButton } from "@matrix/commerce-core"`
  - `import { AuthForm } from "@matrix/auth-ui"`

### Passo 6: O Aval do Gerente DevOps
- Uma vez concluída a refatoração, o humano aprova usando testes do browser local.
- O Agente "Gerente DevOps" entra em cena usando suas ferramentas `git-tools` para realizar a leitura do Diff e subir (Push) as extrações para o Github oficialmente.

---

> **Diretriz de Memória:** Sempre que uma nova sub-sessão no chat começar com a frase *"Vamos dissecar o projeto X"*, a IA deve ler imediata e primariamente este documento (04_Playbooks/00_DISSECCAO_DE_PROJETOS.md) para restaurar todo o protocolo de governança Monorepo que criamos hoje.
