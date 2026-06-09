# Deployment — MasterSaaS
> Arquiteto (Reversa v1.2.14) — 2026-06-08

---

## Estado atual de deploy

### Frontend
- **Runtime:** Cloudflare Workers (configurado via `wrangler.jsonc`)
- **Entry:** `@tanstack/react-start/server-entry`
- **Compatibility:** `nodejs_compat` flag + date `2025-09-24`
- **Deploy:** `npx wrangler deploy` ou via Lovable Cloud (hospedagem atual)

### Backend (inexistente — target)
- **Padrão Matrix:** VPS Speedfy + Docker Compose
- **Porta:** a definir (padrão Matrix: Fastify em 3001 ou porta livre)
- **Nginx:** HTTPS obrigatório via certbot --nginx

---

## Infraestrutura target (Matrix monorepo)

```
VPS Speedfy (209.50.228.131)
├── OpenResty (Nginx) — 80/443
│   ├── mastersaas.scheffelt.xyz → Frontend (Cloudflare Workers ou VPS)
│   └── api.mastersaas.scheffelt.xyz → Backend Fastify
├── PostgreSQL 17 — porta 5432
│   └── Supabase (hosted) — projeto tbapcaxbawruijrigafn
├── Redis 7.4.1 — porta 6379 (cache/filas futuras)
├── n8n 2.7.4 — porta 5678 (CRON e automações)
└── Docker Compose (apps/mastersaas/infra/)
```

---

## Variáveis de Ambiente Necessárias

### Frontend
```env
VITE_SUPABASE_URL=https://tbapcaxbawruijrigafn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_API_URL=https://api.mastersaas.scheffelt.xyz
```

### Backend (Fastify)
```env
SUPABASE_URL=https://tbapcaxbawruijrigafn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
DATABASE_URL=postgresql://...@db.tbapcaxbawruijrigafn.supabase.co:6543/postgres
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
REDIS_URL=redis://127.0.0.1:6379
N8N_WEBHOOK_URL=http://209.50.228.131:5678/webhook/...
WHATSAPP_META_VERIFY_TOKEN=...
PIX_WEBHOOK_SECRET=...
```

---

## Checklist de Deploy (padrão CLAUDE.md)

- [ ] Nginx HTTPS configurado (HTTP redirect + SSL)
- [ ] Certificado SSL via `certbot --nginx` (não standalone/manual)
- [ ] `authenticator = nginx` verificado em `/etc/letsencrypt/renewal/`
- [ ] Monitor UptimeRobot: `https://api.mastersaas.scheffelt.xyz/health`
- [ ] Monitor UptimeRobot: `https://mastersaas.scheffelt.xyz`
- [ ] Erros visíveis no frontend (sem `.catch(() => null)`)
- [ ] `stop_grace_period: 30s` no docker-compose

---

## wrangler.jsonc (atual)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tanstack-start-app",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry"
}
```

> ⚠️ Nome genérico `tanstack-start-app` — renomear para `mastersaas-hub` antes de deploy em produção.
