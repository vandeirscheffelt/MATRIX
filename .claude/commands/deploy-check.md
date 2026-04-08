# /deploy-check — Checklist pré-deploy

Antes de deployar `$ARGUMENTS` (ou o projeto raiz se sem argumento), verifica:

1. Variáveis de ambiente — todas as do `.env.example` estão definidas?
2. Scripts de sanity — roda `npm run sanity:all` se disponível
3. Dependências — há pacotes desatualizados com vulnerabilidades?
4. Logs — há `console.log` no código que deveria usar Pino?
5. Secrets — há valores hardcoded que deveriam estar no `.env`?
6. ESM — há `require()` onde deveria ser `import`?

Gera um relatório com o que precisa ser corrigido antes do deploy.
