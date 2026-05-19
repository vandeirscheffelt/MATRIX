const { prisma } = require('/app/packages/database/dist/index.js');
const sql = [
  'CREATE TABLE IF NOT EXISTS atendente_ia.contato_perfil (',
  '  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,',
  '  empresa_id    TEXT NOT NULL,',
  '  telefone      TEXT NOT NULL,',
  '  apelido       TEXT,',
  '  fonte         TEXT,',
  '  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),',
  '  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),',
  '  UNIQUE(empresa_id, telefone)',
  ')',
].join('\n');
prisma.$executeRawUnsafe(sql)
  .then(() => { console.log('tabela contato_perfil criada ou ja existe'); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
