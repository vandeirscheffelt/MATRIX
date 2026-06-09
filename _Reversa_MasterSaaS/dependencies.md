# Dependências — MasterSaaS Frontend
> Gerado pelo Scout (Reversa v1.2.14) em 2026-06-08

---

## Gerenciador de Pacotes
- **npm** (package-lock.json presente) + **bun** (bun.lockb presente)
- Tipo: ESM (`"type": "module"`)

---

## Framework Principal
| Lib | Versão | Papel |
|-----|--------|-------|
| `@tanstack/react-start` | ^1.167.14 | Framework SSR/SSG principal |
| `@tanstack/react-router` | ^1.168.0 | Roteamento file-based |
| `react` | ^19.2.0 | UI |
| `vite` | ^7.3.1 | Bundler |
| `tailwindcss` | ^4.2.1 | Estilização |

---

## UI / Componentes
| Lib | Versão | Papel |
|-----|--------|-------|
| `@radix-ui/*` | várias ^1-2.x | Primitivos de UI (17 pacotes) |
| `shadcn/ui` | via `components.json` | Design system |
| `lucide-react` | ^0.575.0 | Ícones |
| `class-variance-authority` | ^0.7.1 | Variantes de classe |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.5.0 | Utilitários CSS |
| `recharts` | ^2.15.4 | Gráficos (dashboard, relatórios) |
| `embla-carousel-react` | ^8.6.0 | Carrossel |
| `vaul` | ^1.1.2 | Drawer |
| `cmdk` | ^1.1.1 | Command palette |
| `sonner` | ^2.0.7 | Toasts |

---

## Formulários e Validação
| Lib | Versão | Papel |
|-----|--------|-------|
| `react-hook-form` | ^7.71.2 | Formulários |
| `@hookform/resolvers` | ^5.2.2 | Integração Zod |
| `zod` | ^3.24.2 | Validação de schema |
| `input-otp` | ^1.4.2 | Input OTP (login magic link) |

---

## Backend / Integrações
| Lib | Versão | Papel |
|-----|--------|-------|
| `@supabase/supabase-js` | ^2.104.0 | Auth + banco (única integração real) |
| `@lovable.dev/cloud-auth-js` | ^1.1.1 | Auth Lovable Cloud |
| `@tanstack/react-query` | ^5.83.0 | Data fetching / cache |

---

## Datas e Utilitários
| Lib | Versão | Papel |
|-----|--------|-------|
| `date-fns` | ^4.1.0 | Manipulação de datas |
| `react-day-picker` | ^9.14.0 | Date picker UI |
| `react-resizable-panels` | ^4.6.5 | Painéis redimensionáveis |

---

## Deploy / Infraestrutura
| Lib | Versão | Papel |
|-----|--------|-------|
| `@cloudflare/vite-plugin` | ^1.25.5 | Deploy em Cloudflare Workers |
| `@lovable.dev/vite-tanstack-config` | ^1.4.0 | Config unificada Lovable |
| `wrangler.jsonc` | presente | Config Cloudflare Workers |

---

## Scripts disponíveis
```json
"dev":       "vite dev"
"build":     "vite build"
"build:dev": "vite build --mode development"
"preview":   "vite preview"
"lint":      "eslint ."
"format":    "prettier --write ."
```

---

## Integrações externas detectadas
| Serviço | Como | Status |
|---------|------|--------|
| Supabase | SDK client + server | ✅ Ativo (Auth + profiles) |
| Cloudflare Workers | vite-plugin + wrangler | 🟡 Configurado (deploy target) |
| Lovable Cloud | auth-js + vite-config | 🟡 Plataforma de hospedagem |
| Stripe | Não presente no código | 🔴 Apenas referenciado nos blueprints |
| Evolution API / WhatsApp | Não presente no código | 🔴 Apenas mock na UI |
| Meta Cloud API | Não presente no código | 🔴 Apenas mock na UI |
