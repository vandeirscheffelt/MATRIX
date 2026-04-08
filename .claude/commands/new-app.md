# /new-app — Scaffolda um novo app backend

Cria a estrutura completa de um novo app em `apps/$ARGUMENTS/` com:

1. `package.json` com TypeScript + Fastify + Prisma + Zod
2. `tsconfig.json` com strict mode
3. `src/index.ts` — entry point Fastify
4. `src/routes/` — pasta de rotas
5. `src/plugins/` — plugins Fastify (db, auth, etc.)
6. `prisma/schema.prisma` — schema base
7. `.env.example` com variáveis necessárias
8. `CLAUDE.md` local com contexto do app

Ao final, liste os próximos passos para o usuário.

Argumento: nome do app (ex: `/new-app crm-api`)
