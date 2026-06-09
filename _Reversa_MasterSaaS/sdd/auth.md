# Auth — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo responsável por autenticação de usuários (email+senha, OTP magic-link, Google OAuth), criação automática de perfil de afiliado e captura do referral code antes do cadastro. É a porta de entrada do ecossistema e a única camada com backend real no estado atual.

---

## Responsabilidades

- Autenticar usuários via Supabase Auth (3 métodos) 🟢
- Criar perfil `profiles` automaticamente no signup via trigger `handle_new_user` 🟢
- Gerar `affiliate_code` único e imutável (8 chars alfanuméricos) 🟢
- Capturar e propagar `referred_by_code` para resolução de `referred_by_id` 🟢
- Bloquear auto-referência no trigger 🟢
- Manter sessão persistida em localStorage (client) 🟢
- Exibir banner de boas-vindas após signup com referral 🟢
- Redirecionar usuário autenticado para `/` ao acessar `/login` ou `/signup` 🟢

---

## Interface

### Entrada — `signUp`
```typescript
signUp(email: string, password: string, displayName?: string): Promise<{error: string | null}>
// raw_user_meta_data enviado ao Supabase:
// { display_name: string, referred_by_code: string | "" }
```

### Entrada — `signIn`
```typescript
signIn(email: string, password: string): Promise<{error: string | null}>
```

### Entrada — `sendEmailOtp` / `verifyEmailOtp`
```typescript
sendEmailOtp(email: string): Promise<{error: string | null}>
verifyEmailOtp(email: string, token: string): Promise<{error: string | null}>
// token: 6 dígitos numéricos
```

### Entrada — `signInWithGoogle`
```typescript
signInWithGoogle(): Promise<{error: string | null}>
// Usa lovable.auth.signInWithOAuth("google") — não Supabase direto
```

### Saída — `AuthState` (Context)
```typescript
type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null   // id, display_name, affiliate_code, referred_by_id, created_at
  loading: boolean
  signUp / signIn / signInWithGoogle / sendEmailOtp / verifyEmailOtp / signOut / refreshProfile
}
```

### Tipo `Profile`
```typescript
type Profile = {
  id: string               // uuid — FK auth.users
  display_name: string | null
  affiliate_code: string   // 8 chars, imutável
  referred_by_id: string | null  // uuid, imutável após set
  created_at: string
}
```

---

## Regras de Negócio

- `referred_by_code` viaja via `raw_user_meta_data` no signup → trigger `handle_new_user` resolve `referred_by_id` 🟢
- `affiliate_code` é imutável após criação — trigger `profiles_prevent_immutable_changes` lança exception 🟢
- `referred_by_id` é imutável após primeiro set 🟢
- Auto-referência bloqueada: `if inviter_id = new.id then inviter_id := null` 🟢
- `setRefCode` normaliza: UPPERCASE + remove não-`[A-Z0-9]` + slice(16) 🟢
- `ref_code` limpo do localStorage após signup bem-sucedido (clearRefCode) 🟢
- `fetchProfile` deferred via `setTimeout(0)` para evitar deadlock do Supabase onAuthStateChange 🟢
- Senha mínima: 6 caracteres (validação HTML `minLength={6}`) 🟢
- OTP: exatamente 6 dígitos, type `"email"` via `supabase.auth.verifyOtp` 🟢
- Google OAuth via `lovable.auth.signInWithOAuth` — não via Supabase SDK diretamente 🟢
- Supabase client é lazy-init via `Proxy` — instância criada na primeira chamada 🟢
- Session persistida em `localStorage` no browser, `undefined` no SSR 🟢
- `referred_by_code` também incluído no `sendEmailOtp` (OTP cria usuário novo) 🟡

---

## Fluxo Principal — Signup com Referral

1. Usuário acessa `/join/:code` → `setRefCode(code)` → redirect `/signup`
2. `SignupPage` carrega → `getRefCode()` → exibe banner de convite com código
3. Usuário preenche email + senha + nome → submit
4. `signUp(email, password, displayName)` → `getRefCode()` captura ref_code atual
5. `supabase.auth.signUp({ email, password, options: { data: { display_name, referred_by_code } } })`
6. Trigger `handle_new_user` executa no banco:
   - Resolve `inviter_id` via `SELECT id FROM profiles WHERE affiliate_code = UPPER(ref_code)`
   - Bloqueia auto-referência
   - Gera `affiliate_code` único via `generate_affiliate_code()`
   - Insere em `profiles`
7. Se `ref_code` presente: `markWelcomePending(refCode)` + `clearRefCode()`
8. `fetchProfile(user.id)` → `setProfile(p)`
9. Redirect para `/`

## Fluxo Alternativo — Login OTP (método primário da UI)

1. Usuário digita email → `handleSendOtp` → `sendEmailOtp(email)`
2. `supabase.auth.signInWithOtp({ email, shouldCreateUser: true, data: { referred_by_code } })`
3. Usuário recebe email com código de 6 dígitos → `mode = "otp-sent"`
4. Usuário digita OTP → `verifyEmailOtp(email, token)`
5. `supabase.auth.verifyOtp({ email, token, type: "email" })`
6. Se ref_code presente: `markWelcomePending` + `clearRefCode`
7. Redirect para `/`

## Fluxo Alternativo — Login Google

1. `handleGoogle` → `signInWithGoogle()`
2. `lovable.auth.signInWithOAuth("google", { redirect_uri: origin })`
3. Browser redireciona para Google → callback → sessão criada
4. `onAuthStateChange` detecta nova sessão → `fetchProfile` via setTimeout

---

## Fluxos Alternativos (Erros)

- **Email já cadastrado no signup:** Supabase retorna error → `toast.error(error.message)`
- **OTP inválido/expirado:** `verifyEmailOtp` retorna error → `toast.error(error.message)`
- **OTP com menos de 6 dígitos:** validação client-side bloqueia submit + `toast.error("Enter the 6-digit code")`
- **Google OAuth falha:** error retornado como `Error` ou `string` — ambos tratados via `String(result.error)`
- **Profile fetch falha:** `console.error` + retorna `null` — UI continua com `profile = null`
- **Usuário já autenticado acessa /login:** `useEffect` detecta `user !== null` → `navigate("/", { replace: true })`

---

## Dependências

- `@supabase/supabase-js ^2.104.0` — Auth SDK 🟢
- `@lovable.dev/cloud-auth-js ^1.1.1` — wrapper Google OAuth 🟢
- `referral-storage.ts` — captura/limpeza de ref_code 🟢
- `profiles` table (Supabase) — destino do profile 🟢
- Trigger `handle_new_user` (banco) — criação do profile 🟢
- Trigger `profiles_prevent_immutable_changes` (banco) — imutabilidade 🟢
- Função `generate_affiliate_code()` (banco) — geração do código 🟢

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | Session em localStorage — risco XSS se CSP não configurado | `client.ts:19` | 🟡 |
| Segurança | `referred_by_id` imutável — prevenção de fraude de atribuição | migration SQL | 🟢 |
| Disponibilidade | Lazy init do Supabase client via Proxy — falha explícita se env vars ausentes | `client.ts:11-15` | 🟢 |
| Compatibilidade SSR | Storage `undefined` no server, localStorage no browser | `client.ts:19` | 🟢 |
| Performance | Profile fetch deferred (setTimeout 0) para não bloquear callback de auth | `use-auth.tsx:73` | 🟢 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Signup com referral
Dado que um visitante acessou /join/VAN01 anteriormente
Quando ele completa o formulário de signup com email e senha válidos
Então um profile é criado com referred_by_id = id do afiliado VAN01
E o affiliate_code do novo usuário é único e tem 8 caracteres
E o ref_code é removido do localStorage após o signup
E um banner de boas-vindas é exibido mencionando o código VAN01

# Happy path — Login OTP
Dado que um usuário cadastrado digita seu email em /login
Quando ele clica em "Email me a 6-digit code" e recebe o email
E digita corretamente os 6 dígitos
Então a sessão é criada e ele é redirecionado para /

# Falha — OTP incorreto
Dado que o usuário está na tela de verificação OTP
Quando digita um código inválido ou expirado
Então recebe toast.error com a mensagem do Supabase
E permanece na tela de verificação

# Falha — Auto-referência
Dado que um afiliado com código VAN01 acessa /join/VAN01
Quando completa o signup
Então referred_by_id é null (auto-referência bloqueada pelo trigger)

# Falha — Signup sem senha mínima
Dado que o usuário preenche senha com menos de 6 caracteres
Quando tenta submeter o formulário
Então o browser bloqueia o submit via HTML validation (minLength=6)

# Borda — Google OAuth com ref_code pendente
Dado que o usuário acessou /join/XYZ antes de autenticar via Google
Quando completa o OAuth do Google
Então 🔴 LACUNA: referred_by_code não é passado no fluxo Google OAuth atual

# Borda — Profile fetch falha após login
Dado que o login Supabase foi bem-sucedido
Quando fetchProfile retorna erro (rede/RLS)
Então profile = null, loading = false, user está definido
E a UI não crasha (ErrorBoundary necessário nas rotas que usam profile)
```

---

## Cenários de Borda (detalhado)

1. **Supabase client sem env vars:** `createSupabaseClient()` lança `Error("Missing Supabase environment variables")` — aplicação não sobe. Verificar no CI antes de deploy.

2. **Dois signups simultâneos com mesmo ref_code:** `generate_affiliate_code()` faz até 10 tentativas com verificação de existência — colisão é improvável mas possível em volume alto. Fallback: append do epoch timestamp.

3. **Usuário limpa localStorage entre /join e /signup:** `getRefCode()` retorna `null` → signup sem referral → `referred_by_id = null`. Sem erro, silencioso. Mitigação futura: passar ref_code via query param na URL.

4. **onAuthStateChange dispara antes de getSession:** listener registrado primeiro (correto) — mas se getSession completar antes do listener detectar, pode haver duplo fetch de profile. `setLoading(false)` só ocorre no getSession, não no listener.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| signUp + signIn + OTP | Must | Entrada de usuários — caminho crítico |
| Trigger handle_new_user | Must | Cria profile + resolve referral — sem fallback |
| affiliate_code imutável | Must | Regra de negócio core — fraude se violada |
| referred_by_id imutável | Must | Atribuição de comissão depende disso |
| Google OAuth | Should | Alternativa ao OTP — importante mas não único método |
| markWelcomePending banner | Could | UX de boas-vindas — sem impacto financeiro |
| refreshProfile | Could | Acionado manualmente — raramente necessário |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/hooks/use-auth.tsx` | `AuthProvider`, `useAuth`, `fetchProfile` | 🟢 |
| `src/integrations/supabase/client.ts` | `createSupabaseClient`, Proxy | 🟢 |
| `src/lib/referral-storage.ts` | `setRefCode`, `getRefCode`, `clearRefCode`, `markWelcomePending` | 🟢 |
| `src/routes/login.tsx` | `LoginPage` | 🟢 |
| `src/routes/signup.tsx` | `SignupPage` | 🟢 |
| `src/routes/join.$code.tsx` | `JoinPage` | 🟢 |
| `supabase/migrations/20260421201903_*.sql` | `handle_new_user`, `generate_affiliate_code` | 🟢 |
| `supabase/migrations/20260421201938_*.sql` | `profiles_prevent_immutable_changes` | 🟢 |
