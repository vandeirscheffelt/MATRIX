# /review-bot — Revisa a config de um bot

Analisa o arquivo YAML em `configs/bots/$ARGUMENTS.yaml` e verifica:

1. Se o system prompt está claro e bem estruturado
2. Se os flows cobrem os casos de uso esperados
3. Se as tools declaradas estão implementadas em `src/core/tools.js`
4. Se há inconsistências entre intent schema e os intents usados
5. Sugere melhorias de performance e clareza

Argumento: nome do bot (ex: `/review-bot claudia`)
