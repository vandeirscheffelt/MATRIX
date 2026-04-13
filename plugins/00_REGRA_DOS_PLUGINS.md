# ⚙️ REGRA DE ARQUITETURA DOS PLUGINS (PAPERCLIP)

Este documento dita a **Política de Ferramentas** da Scheffelt Matrix Holding. Sempre que uma inteligência artificial for criar código ou ferramentas para que os Agentes executem ações externas, as regras abaixo devem ser o norte.

Para o manual técnico de estrutura, instalação, código typescript e correção do bug do Windows, leia: `PLUGIN_GUIDE.md`. Este documento aqui foca na ESTRATÉGIA.

---

## 1. O que é um Plugin na nossa Arquitetura?

Na nossa visão, **o Plugin é o Músculo e os Sentidos**. O Agente é o Cérebro.
- Plugins não tomam decisões de negócios.
- Plugins não avaliam se uma campanha publicitária está boa ou ruim.
- Plugins apenas executam ordens rígidas: "Liste as campanhas", "Adicione X no banco", "Pesquise Y no repositório".

Se você estiver tentanto colocar lógica de decisão complexa do negócio dentro de um código TypeScript em `worker.ts`, você está quebrando a arquitetura. Entregue os dados brutos e deixe o Agente (Cérebro) decidir o que fazer com eles lá no painel.

---

## 2. Por que criamos Plugins ANTES dos Agentes?

Sempre que a empresa precisar que a IA interaja com algo novo (ex: um banco de dados Supabase, uma API do WhatsApp, pagamentos via Stripe), a ordem inegociável de trabalho é:

**1º. Construa o Plugin (Músculo):**
Crie a estrutura, proteja a Senha/API Key (usando `ctx.secrets`), desenvolva a chamada segura e instale o plugin localmente (`paperclipai plugin install --local`). 

**2º. Contrate o Agente (Cérebro):**
Feito o plugin, vá para a documentação organizacional (`apps/paperclip-org/`) e desenhe a personalidade do Agente.
No prompt do Agente (`AGENTS.md`), você dirá exatamente: *"Sua responsabilidade é analisar os dados usando a ferramenta `stripe:get-payments`"*.

**Os Benefícios desta Regra:**
1. **Segurança:** O Agente (que pode sofrer ataques de prompt injection e responder o que não deve) nunca tem acesso à sua String Base do banco de dados (senha real). Ele só tem um "botão" seguro que o Plugin oferece.
2. **Determinismo:** Agentes sem ferramentas alucinam. Agentes engessados por ferramentas sólidas não erram o alvo.
3. **Reuso Total:** O plugin de leitura do Supabase pode ser usado hoje pelo Especialista Financeiro, e amanhã pelo Almoxarife de Códigos, sem precisarmos recriar código de autenticação.

---

## 3. Integração com a Filosofia de "Módulos Base" (Almoxarifado)
Quando criamos plugins que leem repositórios internos (como um `search_files`), o objetivo é permitir que os Agentes achem **Módulos Base (Boilerplates)** que a empresa já possui.
Os plugins servem justamente como os "braços robóticos" que entram no nosso galpão de ativos (arquivos locais, repositórios de vídeos, base de código padrão) para buscar os Módulos e repassar ao Agente Especialista que fará o ajuste fino.

Para o desenvolvedor e para o LLM que lê isso: Mantenha as ferramentas burras e extremamente estáveis. Deixe a "inteligência" fluir no prompt do Agente.
