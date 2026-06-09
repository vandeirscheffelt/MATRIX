# ERD Completo — MasterSaaS
> Arquiteto (Reversa v1.2.14) — 2026-06-08
> 🟢 CONFIRMADO | 🟡 INFERIDO | 🔴 LACUNA
> Schema: `mastersaas` (a criar no Supabase)

---

```mermaid
erDiagram

    %% ── AUTH (Supabase managed) ──────────────────────────
    AUTH_USERS {
        uuid id PK
        string email
        jsonb raw_user_meta_data
    }

    %% ── PROFILES (existe no banco) ───────────────────────
    PROFILES {
        uuid id PK_FK
        string display_name
        string affiliate_code UK
        uuid referred_by_id FK
        timestamptz created_at
        timestamptz updated_at
        string phone "🔴 a adicionar"
        string country "🔴 a adicionar"
        string preferred_locale "🔴 a adicionar"
        string preferred_currency "🔴 a adicionar"
        string kyc_status "🔴 a adicionar"
        string tax_id_encrypted "🔴 a adicionar"
    }

    %% ── RBAC ─────────────────────────────────────────────
    USER_ROLES {
        uuid id PK
        uuid user_id FK
        enum role "admin|affiliate|user"
    }

    %% ── PAYMENT METHODS (PII crítico) ────────────────────
    PAYMENT_METHODS {
        uuid id PK
        uuid user_id FK
        enum type "pix|bank|wise"
        string pix_key_encrypted
        string bank_name
        string branch
        string account_encrypted
        string holder_name
        string tax_id_encrypted
        string country
        timestamptz created_at
    }

    %% ── PRODUTOS ─────────────────────────────────────────
    PRODUCTS {
        string slug PK
        string name
        string description
        string tagline
        string product_url
        string product_code UK
        decimal commission_rate
        enum commission_duration "Lifetime|12m|6m|3m|Custom"
        int custom_duration_months
        enum billing_type "Monthly|Annual"
        boolean active
        boolean accepting_subscriptions
        string cover_image_url
        string fallback_currency
        timestamptz created_at
    }

    PRODUCT_PRICES {
        uuid id PK
        string product_id FK
        string currency "BRL|USD|EUR|MXN"
        decimal amount
    }

    SALES_COPY_TRANSLATIONS {
        uuid id PK
        string product_id FK
        string locale "pt-BR|en-US|es-ES"
        string headline
        string cta
        jsonb publico
        jsonb mensagens
        jsonb steps
        string vantagem_template
    }

    %% ── RASTREAMENTO ─────────────────────────────────────
    CLICKS {
        uuid id PK
        uuid affiliate_id FK
        string product_slug FK
        string ip_hash
        string ua_hash
        string referrer
        string country
        timestamptz created_at
    }

    REFERRAL_ATTRIBUTIONS {
        uuid id PK
        uuid user_id FK_UK
        uuid parent_affiliate_id FK
        timestamptz attributed_at
        enum source "join|r-link|cookie"
    }

    WEBHOOK_EVENTS {
        string event_id PK "dedupe idempotência"
        string provider "stripe|pix|product"
        string event_type
        jsonb payload
        timestamptz received_at
        boolean processed
    }

    %% ── VENDAS ───────────────────────────────────────────
    SALES {
        uuid id PK
        string customer_email_hash
        string product_id FK
        uuid affiliate_id FK
        uuid referrer_affiliate_id FK_nullable
        uuid campaign_id FK_nullable
        decimal revenue
        decimal commission_snapshot
        decimal commission_rate_snapshot
        enum status "completed|pending|refunded"
        string external_payment_id UK
        timestamptz created_at
    }

    SUBSCRIPTIONS {
        uuid id PK
        string customer_hash
        string product_id FK
        uuid affiliate_id FK
        enum plan "Monthly|Annual"
        enum status "pending|active|canceled"
        enum risk_level "at-risk|null"
        decimal monthly_value
        decimal commission_per_month
        int payments_made
        int payments_total
        timestamptz next_payment_at
        decimal total_earned
        timestamptz started_at
        timestamptz canceled_at
    }

    SUBSCRIPTION_EVENTS {
        uuid id PK
        uuid subscription_id FK
        string event_type
        jsonb payload
        timestamptz created_at
    }

    %% ── COMISSÕES ────────────────────────────────────────
    COMMISSIONS {
        uuid id PK
        uuid sale_id FK
        uuid affiliate_id FK
        uuid campaign_id FK_nullable
        decimal revenue
        decimal commission
        decimal rate_snapshot
        timestamptz sale_date
        timestamptz hold_until
        timestamptz available_at
        timestamptz paid_at
        timestamptz canceled_at
        string payment_id
        enum status "pending|available|processing|paid|canceled|failed|refunded"
        timestamptz created_at
    }

    COMMISSION_HISTORY {
        uuid id PK
        uuid commission_id FK
        enum status_from
        enum status_to
        string note
        uuid actor_id FK
        string ip
        string ua
        timestamptz created_at
    }

    REFERRAL_COMMISSIONS {
        uuid id PK
        uuid commission_id FK
        uuid referrer_affiliate_id FK
        decimal amount
        decimal rate_pct
        enum status "pending|available|processing|paid|canceled"
        timestamptz created_at
    }

    %% ── SAQUES ───────────────────────────────────────────
    WITHDRAWALS {
        uuid id PK
        uuid affiliate_id FK
        decimal amount
        string currency
        enum status "requested|processing|paid|canceled|failed"
        timestamptz requested_at
        timestamptz processed_at
        timestamptz paid_at
        uuid payment_method_id FK
        string payment_id
        string notes
        uuid batch_id FK_nullable
        string idempotency_key UK
    }

    PAYOUT_BATCHES {
        uuid id PK
        uuid created_by_admin_id FK
        decimal total_amount
        string currency
        int item_count
        enum status "created|processing|finalized"
        timestamptz created_at
        timestamptz finalized_at
    }

    %% ── PROMOÇÕES ────────────────────────────────────────
    PROMOTIONS {
        uuid id PK
        string name
        string product_slug FK
        date start_date
        date end_date
        decimal commission_rate_override
        enum duration_override "Lifetime|12m|6m|3m|Custom|null"
        int custom_duration_months
        boolean enabled
        boolean performance_enabled
        int performance_min_sales
        decimal performance_rate_if_reached
        decimal performance_rate_if_not_reached
        timestamptz created_at
    }

    PROMOTION_PERFORMANCE {
        uuid id PK
        uuid affiliate_id FK
        uuid promotion_id FK
        int sales_count
        timestamptz updated_at
    }

    %% ── REDE ─────────────────────────────────────────────
    NETWORK_SETTINGS {
        uuid id PK "singleton"
        boolean enabled
        decimal default_rate_pct
        int eligibility_days
        int min_sales_required
        timestamptz updated_at
    }

    NETWORK_CAMPAIGNS {
        uuid id PK
        string name
        date start_date
        date end_date
        decimal rate_pct_override
        int eligibility_days_override
        int min_sales_override
        boolean enabled
        timestamptz created_at
    }

    %% ── CONTEÚDO ─────────────────────────────────────────
    TUTORIALS {
        uuid id PK
        enum category "getting-started|first-sale|scaling-sales|campaigns"
        int order
        boolean active
        boolean required
        string cta_to
        timestamptz created_at
    }

    TUTORIAL_TRANSLATIONS {
        uuid id PK
        uuid tutorial_id FK
        string locale
        string title
        string description
        string youtube_url
        string cta_label
    }

    TUTORIAL_PROGRESS {
        uuid id PK
        uuid user_id FK
        uuid tutorial_id FK
        timestamptz completed_at
        int watched_seconds
    }

    NEWS {
        uuid id PK
        enum type "tutorial|live|campaign|announcement"
        enum display_location "dashboard|network|products|links|tutorials"
        int priority
        boolean active
        string deep_link_tutorial_id FK_nullable
        timestamptz created_at
        timestamptz expires_at
    }

    NEWS_TRANSLATIONS {
        uuid id PK
        uuid news_id FK
        string locale
        string title
        string body
        string cta_label
        string cta_url
    }

    %% ── WHATSAPP ─────────────────────────────────────────
    WHATSAPP_INTEGRATIONS {
        uuid id PK
        uuid user_id FK
        enum provider "meta|evolution"
        string access_token_encrypted
        string phone_number_id
        enum status "connected|disconnected|pending"
        string connected_number
        string webhook_secret_encrypted
        timestamptz connected_at
    }

    %% ── NOTIFICAÇÕES E AUDIT ─────────────────────────────
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        enum scope "global|campaigns|finance|reports"
        enum severity "info|success|warning|danger"
        string title
        string description
        string action_to
        timestamptz created_at
        timestamptz read_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid actor_id FK
        string scope
        string entity
        uuid entity_id
        string action
        jsonb before_state
        jsonb after_state
        string ip
        string ua
        timestamptz created_at
    }

    %% ── RELACIONAMENTOS ──────────────────────────────────
    AUTH_USERS ||--|| PROFILES : "1:1"
    PROFILES ||--o{ USER_ROLES : "1:N"
    PROFILES ||--o{ PAYMENT_METHODS : "1:N"
    PROFILES }o--o| PROFILES : "referred_by_id (self-ref)"

    PRODUCTS ||--o{ PRODUCT_PRICES : "1:N"
    PRODUCTS ||--o{ SALES_COPY_TRANSLATIONS : "1:N"
    PRODUCTS ||--o{ PROMOTIONS : "1:N"
    PRODUCTS ||--o{ SALES : "1:N"
    PRODUCTS ||--o{ SUBSCRIPTIONS : "1:N"
    PRODUCTS ||--o{ CLICKS : "1:N"

    PROFILES ||--o{ CLICKS : "affiliate"
    PROFILES ||--o{ REFERRAL_ATTRIBUTIONS : "user (indicado)"
    PROFILES ||--o{ REFERRAL_ATTRIBUTIONS : "parent_affiliate (indicador)"
    PROFILES ||--o{ SALES : "affiliate"
    PROFILES ||--o{ SALES : "referrer"
    PROFILES ||--o{ SUBSCRIPTIONS : "affiliate"
    PROFILES ||--o{ COMMISSIONS : "affiliate"
    PROFILES ||--o{ REFERRAL_COMMISSIONS : "referrer"
    PROFILES ||--o{ WITHDRAWALS : "affiliate"
    PROFILES ||--o{ PAYOUT_BATCHES : "created_by_admin"
    PROFILES ||--o{ WHATSAPP_INTEGRATIONS : "user"

    SALES ||--o{ COMMISSIONS : "1:N (recorrência)"
    SUBSCRIPTIONS ||--o{ SUBSCRIPTION_EVENTS : "1:N"

    COMMISSIONS ||--o{ COMMISSION_HISTORY : "1:N (audit)"
    COMMISSIONS ||--o| REFERRAL_COMMISSIONS : "1:1 (rede)"

    WITHDRAWALS }o--o| PAYOUT_BATCHES : "N:1 (batch)"
    WITHDRAWALS }o--|| PAYMENT_METHODS : "N:1"

    PROMOTIONS ||--o{ PROMOTION_PERFORMANCE : "1:N"

    TUTORIALS ||--o{ TUTORIAL_TRANSLATIONS : "1:N"
    TUTORIALS ||--o{ TUTORIAL_PROGRESS : "1:N"
    NEWS ||--o{ NEWS_TRANSLATIONS : "1:N"
    NEWS }o--o| TUTORIALS : "deep_link (opcional)"
```
