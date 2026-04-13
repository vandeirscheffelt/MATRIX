#!/bin/bash
# =====================================================================
# CHECKPOINT_GITHUB_MATRIX_v1.sh
# Projeto: MATRIZ / ARQUITETURA MONOREPO
# Tipo: SCRIPT DE SCAFFOLDING CANÔNICO
# Status: PRONTO PARA EXECUÇÃO
# Objetivo: Estruturar a fábrica de softwares corporativa em 4 camadas
#           (apps, packages, infra, paperclip-org)
# =====================================================================

echo "🚀 Iniciando inicialização da Fábrica de Softwares Matrix..."

# 1. CRIAR PASTAS PRINCIPAIS
echo "📁 Criando estrutura de três camadas..."
mkdir -p apps
mkdir -p packages
mkdir -p infra
mkdir -p plugins

# Mover o paperclip-org para a raiz (como cérebro isolado) ou mantê-lo em apps
# Segundo a nova arquitetura, paperclip-org fica na raiz para orquestrar tudo:
if [ -d "apps/paperclip-org" ]; then
    echo "🧠 Movendo paperclip-org para a raiz..."
    mv apps/paperclip-org ./paperclip-org
else
    mkdir -p paperclip-org
fi

# 2. DEFINIR WORKSPACE PNPM (Ouro do Monorepo)
echo "📦 Criando pnpm-workspace.yaml..."
cat <<EOF > pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'plugins/*'
EOF

# 3. CRIAR PACKAGE.JSON RAIZ (Turborepo / Monorepo setup)
echo "⚙️ Criando package.json raiz..."
cat <<EOF > package.json
{
  "name": "scheffelt-matrix",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint"
  },
  "devDependencies": {
    "turbo": "latest"
  },
  "packageManager": "pnpm@9.0.0"
}
EOF

# 4. CRIAR TURBO.JSON (Orquestração de Build)
echo "⚡ Criando turbo.json..."
cat <<EOF > turbo.json
{
  "\$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
EOF

# 5. SCAFFOLDING DO PRIMEIRO MÓDULO (commerce-core)
echo "💎 Criando módulo base: commerce-core..."
mkdir -p packages/commerce-core/src
mkdir -p packages/commerce-core/components
mkdir -p packages/commerce-core/services

cat <<EOF > packages/commerce-core/package.json
{
  "name": "@matrix/commerce-core",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "private": true,
  "dependencies": {}
}
EOF

cat <<EOF > packages/commerce-core/README.md
# @matrix/commerce-core

Módulo base para transações e comércio.

## Regras Canônicas
1. Nenhuma regra de negócio específica de um SaaS deve entrar aqui.
2. Tudo deve ser parametrizável.
3. Se um app precisa importar algo de pagamentos, importa daqui.
EOF

# 6. INFRAESTRUTURA
echo "🔧 Criando pasta de infraestrutura..."
mkdir -p infra/docker
mkdir -p infra/supabase
mkdir -p infra/deploy

echo "✅ CHECKPOINT CONCLUÍDO COM SUCESSO!"
echo "Sua fábrica está pronta. Para instalar dependências, rode:"
echo "👉 pnpm install"
