# Permissões e RBAC — MasterSaaS
> Gerado pelo Detetive (Reversa v1.2.14) — 2026-06-08
> 🟢 CONFIRMADO | 🟡 INFERIDO | 🔴 LACUNA

---

## ⚠️ Estado atual: RBAC inexistente no backend

Qualquer usuário autenticado vê o sidebar Admin completo. Não há `user_roles`, `has_role()` ou RLS por papel. A proteção de rotas é **zero** no servidor.

Fonte: `app-sidebar.tsx` — `adminItems` renderizados para todos os usuários autenticados sem qualquer verificação de role.

---

## Papéis propostos para o backend

| Role | Enum | Descrição |
|------|------|-----------|
| `admin` | `app_role.admin` | Acesso total — CRUD operacional, gestão financeira |
| `affiliate` | `app_role.affiliate` | Acesso ao portal afiliado — links, vendas, financeiro pessoal |
| `user` | `app_role.user` | Cadastrado mas sem papel definido (onboarding pendente) |

---

## Matriz de Permissões por Recurso

| Recurso | Visitante | Affiliate | Admin |
|---------|-----------|-----------|-------|
| `/login`, `/signup` | ✅ | ✅ (redirect /) | ✅ (redirect /) |
| `/join/:code` | ✅ | ✅ (ignora, já tem referrer) | ✅ |
| `/r/:userId/:slug` | ✅ | ✅ | ✅ |
| `/` — Dashboard | ❌ | ✅ | ✅ |
| `/links` | ❌ | ✅ | ✅ |
| `/products` | ❌ | ✅ | ✅ |
| `/sales` | ❌ | ✅ (apenas próprias) | ✅ |
| `/finance` | ❌ | ✅ (apenas próprio) | ✅ |
| `/network` | ❌ | ✅ (apenas própria rede) | ✅ |
| `/account` | ❌ | ✅ (apenas próprio) | ✅ |
| `/tutorials` | ❌ | ✅ | ✅ |
| `/promotions` | ❌ | ✅ (leitura) | ✅ (CRUD) |
| `/admin/products` | ❌ | ❌ | ✅ |
| `/admin/network` | ❌ | ❌ | ✅ |
| `/admin/finance` | ❌ | ❌ | ✅ |
| `/admin/sales` | ❌ | ❌ | ✅ |
| `/admin/reports` | ❌ | ❌ | ✅ |
| `/admin/tutorials` | ❌ | ❌ | ✅ |
| `/admin/news` | ❌ | ❌ | ✅ |
| `/admin/whatsapp` | ❌ | ❌ | ✅ |

---

## Matriz de Permissões por Tabela (RLS)

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `profiles` | autenticado (todos) 🟢 | trigger apenas | apenas próprio 🟢 | ❌ |
| `user_roles` | 🔴 não existe | 🔴 | 🔴 | 🔴 |
| `payment_methods` | apenas próprio 🟡 | apenas próprio 🟡 | apenas próprio 🟡 | 🔴 |
| `products` | público 🟡 | admin 🟡 | admin 🟡 | admin 🟡 |
| `product_prices` | público 🟡 | admin 🟡 | admin 🟡 | admin 🟡 |
| `clicks` | admin 🟡 | edge function 🟡 | ❌ | ❌ |
| `referral_attributions` | próprio + admin 🟡 | trigger/edge 🟡 | ❌ (imutável) 🟡 | ❌ |
| `sales` | affiliate (próprias) / admin (todas) 🟡 | edge function 🟡 | admin 🟡 | ❌ |
| `subscriptions` | affiliate (próprias) / admin (todas) 🟡 | edge function 🟡 | admin 🟡 | ❌ |
| `commissions` | affiliate (próprias) / admin (todas) 🟡 | edge function / CRON 🟡 | **admin apenas** 🟡 | ❌ |
| `commission_history` | affiliate (próprias) / admin (todas) 🟡 | triggers / admin 🟡 | ❌ (append-only) 🟡 | ❌ |
| `withdrawals` | affiliate (próprias) / admin (todas) 🟡 | affiliate (próprias) 🟡 | **admin apenas** (status) 🟡 | ❌ |
| `payment_methods` | apenas próprio 🟡 | apenas próprio 🟡 | apenas próprio 🟡 | apenas próprio 🟡 |
| `payout_batches` | admin 🟡 | admin 🟡 | admin 🟡 | ❌ |
| `promotions` | público (leitura) 🟡 | admin 🟡 | admin 🟡 | admin 🟡 |
| `network_settings` | autenticado 🟡 | admin 🟡 | admin 🟡 | ❌ |
| `network_campaigns` | autenticado 🟡 | admin 🟡 | admin 🟡 | admin 🟡 |
| `tutorials` | autenticado 🟡 | admin 🟡 | admin 🟡 | admin 🟡 |
| `news` | autenticado 🟡 | admin 🟡 | admin 🟡 | admin 🟡 |
| `tutorial_progress` | affiliate (próprio) 🟡 | affiliate (próprio) 🟡 | affiliate (próprio) 🟡 | ❌ |
| `whatsapp_integrations` | admin 🟡 | admin 🟡 | admin 🟡 | admin 🟡 |
| `notifications` | próprio 🟡 | sistema 🟡 | próprio (read_at) 🟡 | ❌ |
| `audit_logs` | admin 🟡 | triggers 🟡 | ❌ (append-only) 🟡 | ❌ |

---

## SQL de Implementação Recomendado

```sql
-- Criar tipo e tabela de roles
CREATE TYPE app_role AS ENUM ('admin', 'affiliate', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode gerenciar roles
CREATE POLICY "Only admins can manage roles"
  ON public.user_roles
  USING (has_role(auth.uid(), 'admin'));

-- Função helper
CREATE OR REPLACE FUNCTION public.has_role(_uid uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = _role
  )
$$;

-- Atribuir role automaticamente no signup (affiliate por padrão)
-- Adicionar ao handle_new_user():
INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'affiliate');
```

---

## Operações Sensíveis que exigem confirmação extra

| Operação | Quem | Proteção extra |
|----------|------|----------------|
| Mudar commission para `paid` | Admin | Nota obrigatória + log de actor_id |
| Bulk pay (batch) | Admin | Re-confirm modal + log batch_id |
| Editar payment_method | Affiliate | 🔴 Requer re-auth ou email de confirmação |
| Deletar produto | Admin | 🔴 Soft-delete recomendado (archived) |
| Suspender afiliado | Admin | 🔴 Não implementado |
