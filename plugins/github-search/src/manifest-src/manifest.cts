import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  apiVersion: 1,
  id: "github-search",
  displayName: "GitHub Search",
  description: "Permite ao Almoxarife buscar módulos, arquivos e estrutura de código no repositório Matrix via GitHub API.",
  version: "1.0.0",
  author: "Scheffelt Matrix <vandeir@scheffelt.com.br>",
  categories: ["automation"],
  capabilities: [
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      githubTokenSecret: {
        type: "string",
        description: "Referência ao secret MATRIX_ALMOXARIFE_TOKEN (GitHub PAT)",
      },
      owner: {
        type: "string",
        description: "Dono do repositório (ex: vandeirscheffelt)",
      },
      repo: {
        type: "string",
        description: "Nome do repositório (ex: MATRIX)",
      },
    },
    required: ["githubTokenSecret", "owner", "repo"],
  },
  tools: [
    {
      name: "list-packages",
      displayName: "Listar Módulos",
      description: "Lista todos os módulos reutilizáveis em packages/ do repositório Matrix. Use para verificar o que já existe antes de criar algo novo.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "find-module",
      displayName: "Buscar Módulo",
      description: "Busca se um módulo específico já existe em packages/. Retorna path, README e estrutura se encontrado.",
      parametersSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Nome ou palavra-chave do módulo a buscar (ex: auth, payments, whatsapp)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "read-file",
      displayName: "Ler Arquivo",
      description: "Lê o conteúdo de um arquivo específico do repositório. Use para inspecionar código existente.",
      parametersSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Caminho do arquivo no repositório (ex: packages/auth/src/index.ts)",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "list-directory",
      displayName: "Listar Diretório",
      description: "Lista o conteúdo de um diretório do repositório com tipos (arquivo/pasta) e tamanhos.",
      parametersSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Caminho do diretório (ex: packages/auth ou apps/shaikron/src)",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "search-code",
      displayName: "Buscar no Código",
      description: "Busca um termo ou padrão de código em todo o repositório. Útil para encontrar implementações existentes.",
      parametersSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Termo a buscar no código (ex: createClient, useAuth, StripeWebhook)",
          },
          path: {
            type: "string",
            description: "Limitar busca a um diretório (opcional, ex: packages/)",
          },
        },
        required: ["query"],
      },
    },
  ],
};

export default manifest;
module.exports = manifest;
