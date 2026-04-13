import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  apiVersion: 1,
  id: "meta-ads",
  displayName: "Meta Ads",
  description: "Verifica e monitora campanhas no Meta Ads (Facebook/Instagram).",
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
      accessTokenSecret: {
        type: "string",
        description: "Referência ao secret com o META_ACCESS_TOKEN",
      },
      adAccountId: {
        type: "string",
        description: "ID da conta de anúncios (ex: act_1234567890)",
      },
    },
    required: ["accessTokenSecret", "adAccountId"],
  },
  tools: [
    {
      name: "verify-campaign",
      displayName: "Verificar Campanha",
      description:
        "Consulta o status de uma campanha no Meta Ads após a criação. Retorna status, status efetivo, nome e objetivo da campanha.",
      parametersSchema: {
        type: "object",
        properties: {
          campaignId: {
            type: "string",
            description: "ID da campanha no Meta (ex: 120210000000000000)",
          },
        },
        required: ["campaignId"],
      },
    },
    {
      name: "list-campaigns",
      displayName: "Listar Campanhas",
      description:
        "Lista as campanhas da conta de anúncios com status e métricas básicas.",
      parametersSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["ACTIVE", "PAUSED", "ARCHIVED", "ALL"],
            description: "Filtrar por status (padrão: ALL)",
          },
          limit: {
            type: "number",
            description: "Quantidade máxima de campanhas a retornar (padrão: 20)",
          },
        },
      },
    },
  ],
};

export default manifest;
module.exports = manifest;
