import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";

const META_GRAPH_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface PluginConfig {
  accessTokenSecret: string;
  adAccountId: string;
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("Meta Ads plugin iniciando");

    const config = (await ctx.config.get()) as unknown as PluginConfig;

    // ── Tool: verify-campaign ─────────────────────────────────────────────
    ctx.tools.register(
      "verify-campaign",
      {
        displayName: "Verificar Campanha",
        description:
          "Consulta o status de uma campanha no Meta Ads após a criação.",
        parametersSchema: {
          type: "object",
          properties: {
            campaignId: {
              type: "string",
              description: "ID da campanha no Meta",
            },
          },
          required: ["campaignId"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { campaignId } = params as { campaignId: string };

        ctx.logger.info("Verificando campanha", { campaignId });

        const token = await ctx.secrets.resolve(config.accessTokenSecret);

        const url = new URL(`${META_BASE_URL}/${campaignId}`);
        url.searchParams.set(
          "fields",
          "id,name,status,effective_status,objective,configured_status,start_time,stop_time,daily_budget,lifetime_budget"
        );
        url.searchParams.set("access_token", token);

        const res = await ctx.http.fetch(url.toString());

        if (!res.ok) {
          const err = (await res.json().catch(() => ({ message: res.statusText }))) as { message?: string };
          ctx.logger.error("Erro ao consultar Meta API", { status: res.status });
          return {
            error: `Erro ao consultar campanha ${campaignId}: ${err.message ?? res.statusText}`,
          };
        }

        const data = (await res.json()) as Record<string, unknown>;

        ctx.logger.info("Campanha verificada", { campaignId, status: data["status"] });

        const statusEmoji: Record<string, string> = {
          ACTIVE: "✅",
          PAUSED: "⏸️",
          DELETED: "🗑️",
          ARCHIVED: "📦",
          DISAPPROVED: "❌",
          PENDING_REVIEW: "🔍",
        };

        const effectiveStatus = data["effective_status"] as string | undefined;
        const emoji = statusEmoji[effectiveStatus ?? ""] ?? "❓";
        const dailyBudget = data["daily_budget"] ? `R$ ${Number(data["daily_budget"]) / 100}` : "—";
        const lifetimeBudget = data["lifetime_budget"] ? `R$ ${Number(data["lifetime_budget"]) / 100}` : "—";

        return {
          content: [
            `${emoji} **${data["name"]}**`,
            `- ID: \`${data["id"]}\``,
            `- Status: ${data["status"]}`,
            `- Status efetivo: ${data["effective_status"]}`,
            `- Objetivo: ${data["objective"] ?? "—"}`,
            `- Orçamento diário: ${dailyBudget}`,
            `- Orçamento total: ${lifetimeBudget}`,
            `- Início: ${data["start_time"] ?? "—"}`,
            `- Término: ${data["stop_time"] ?? "—"}`,
          ].join("\n"),
        };
      }
    );

    // ── Tool: list-campaigns ──────────────────────────────────────────────
    ctx.tools.register(
      "list-campaigns",
      {
        displayName: "Listar Campanhas",
        description: "Lista as campanhas da conta de anúncios.",
        parametersSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["ACTIVE", "PAUSED", "ARCHIVED", "ALL"],
              description: "Filtrar por status",
            },
            limit: {
              type: "number",
              description: "Quantidade máxima (padrão: 20)",
            },
          },
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { status = "ALL", limit = 20 } = params as {
          status?: string;
          limit?: number;
        };

        ctx.logger.info("Listando campanhas", { status, limit });

        const token = await ctx.secrets.resolve(config.accessTokenSecret);
        const accountId = config.adAccountId;

        const url = new URL(`${META_BASE_URL}/${accountId}/campaigns`);
        url.searchParams.set(
          "fields",
          "id,name,status,effective_status,objective,daily_budget,lifetime_budget"
        );
        if (status !== "ALL") {
          url.searchParams.set("effective_status", `["${status}"]`);
        }
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("access_token", token);

        const res = await ctx.http.fetch(url.toString());

        if (!res.ok) {
          const err = (await res.json().catch(() => ({ message: res.statusText }))) as { message?: string };
          return {
            error: `Erro ao listar campanhas: ${err.message ?? res.statusText}`,
          };
        }

        const data = (await res.json()) as { data: Record<string, unknown>[] };
        const campaigns = data.data ?? [];

        if (campaigns.length === 0) {
          return { content: "Nenhuma campanha encontrada." };
        }

        const lines = campaigns.map((c) => {
          const budget = c["daily_budget"]
            ? `R$ ${Number(c["daily_budget"]) / 100}/dia`
            : c["lifetime_budget"]
            ? `R$ ${Number(c["lifetime_budget"]) / 100} total`
            : "—";
          return `- **${c["name"]}** | ${c["effective_status"]} | ${c["objective"]} | ${budget} | \`${c["id"]}\``;
        });

        return {
          content: `**${campaigns.length} campanha(s) encontrada(s):**\n\n${lines.join("\n")}`,
        };
      }
    );

    ctx.logger.info("Meta Ads plugin pronto", {
      adAccountId: config.adAccountId,
    });
  },

  async onHealth() {
    return { status: "ok" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
