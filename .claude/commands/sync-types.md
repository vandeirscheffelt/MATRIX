# /sync-types — Sincroniza types do Lovable com o backend

Dado um componente ou página do Lovable (cole o código ou descreva), este comando:

1. Extrai os tipos/interfaces usados no frontend
2. Mapeia para os endpoints de API necessários
3. Gera ou atualiza os types em `packages/shared-types/`
4. Cria ou atualiza os schemas Zod correspondentes no backend
5. Atualiza as rotas Fastify se necessário

Use após exportar/copiar código do Lovable.
