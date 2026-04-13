import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";

interface PluginConfig {
  githubTokenSecret: string;
  owner: string;
  repo: string;
}

interface GithubItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  download_url?: string | null;
}

interface GithubSearchItem {
  name: string;
  path: string;
  repository: { full_name: string };
  url: string;
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("GitHub Search plugin iniciando");

    const config = (await ctx.config.get()) as unknown as PluginConfig;

    // Helper: headers autenticados
    async function headers(): Promise<Record<string, string>> {
      const token = await ctx.secrets.resolve(config.githubTokenSecret);
      return {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
    }

    // Helper: GET da GitHub API
    async function ghGet(endpoint: string): Promise<unknown> {
      const base = "https://api.github.com";
      const url = endpoint.startsWith("http") ? endpoint : `${base}${endpoint}`;
      const res = await ctx.http.fetch(url, { headers: await headers() });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(`GitHub API error ${res.status}: ${err.message ?? res.statusText}`);
      }
      return res.json();
    }

    // ── Tool: list-packages ───────────────────────────────────────────────
    ctx.tools.register(
      "list-packages",
      {
        displayName: "Listar Módulos",
        description: "Lista todos os módulos em packages/ do repositório Matrix.",
        parametersSchema: { type: "object", properties: {} },
      },
      async (_params, _runCtx): Promise<ToolResult> => {
        ctx.logger.info("Listando packages/");

        let items: GithubItem[];
        try {
          items = (await ghGet(
            `/repos/${config.owner}/${config.repo}/contents/packages`
          )) as GithubItem[];
        } catch (err) {
          return { error: String(err) };
        }

        const dirs = items.filter((i) => i.type === "dir");

        if (dirs.length === 0) {
          return { content: "Nenhum módulo encontrado em packages/." };
        }

        const lines = dirs.map((d) => `- **${d.name}** → \`packages/${d.name}/\``);

        return {
          content: `**${dirs.length} módulo(s) em packages/:**\n\n${lines.join("\n")}`,
        };
      }
    );

    // ── Tool: find-module ────────────────────────────────────────────────
    ctx.tools.register(
      "find-module",
      {
        displayName: "Buscar Módulo",
        description: "Busca se um módulo já existe em packages/.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Nome ou palavra-chave" },
          },
          required: ["query"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { query } = params as { query: string };
        ctx.logger.info("Buscando módulo", { query });

        let items: GithubItem[];
        try {
          items = (await ghGet(
            `/repos/${config.owner}/${config.repo}/contents/packages`
          )) as GithubItem[];
        } catch (err) {
          return { error: String(err) };
        }

        const matches = items.filter(
          (i) => i.type === "dir" && i.name.toLowerCase().includes(query.toLowerCase())
        );

        if (matches.length === 0) {
          return {
            content: `❌ Nenhum módulo encontrado para **"${query}"** em packages/.\n\nCandidato a novo módulo — pode ser extraído e catalogado.`,
          };
        }

        // Para cada match, busca o README
        const details = await Promise.all(
          matches.map(async (m) => {
            let readme = "";
            try {
              const readmeData = (await ghGet(
                `/repos/${config.owner}/${config.repo}/contents/packages/${m.name}/README.md`
              )) as { content?: string };
              if (readmeData.content) {
                readme = Buffer.from(readmeData.content, "base64").toString("utf-8").split("\n").slice(0, 5).join("\n");
              }
            } catch {
              readme = "_sem README_";
            }
            return `### \`packages/${m.name}/\`\n${readme}`;
          })
        );

        return {
          content: `✅ **${matches.length} módulo(s) encontrado(s) para "${query}":**\n\n${details.join("\n\n")}`,
        };
      }
    );

    // ── Tool: read-file ──────────────────────────────────────────────────
    ctx.tools.register(
      "read-file",
      {
        displayName: "Ler Arquivo",
        description: "Lê o conteúdo de um arquivo do repositório.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Caminho do arquivo no repo" },
          },
          required: ["path"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { path } = params as { path: string };
        ctx.logger.info("Lendo arquivo", { path });

        let file: { content?: string; encoding?: string; size?: number };
        try {
          file = (await ghGet(
            `/repos/${config.owner}/${config.repo}/contents/${path}`
          )) as typeof file;
        } catch (err) {
          return { error: String(err) };
        }

        if (!file.content) {
          return { error: `Arquivo ${path} não tem conteúdo legível (binário ou vazio).` };
        }

        const content = Buffer.from(file.content, "base64").toString("utf-8");
        const lines = content.split("\n").length;

        return {
          content: `**\`${path}\`** (${lines} linhas, ${file.size ?? 0} bytes)\n\n\`\`\`\n${content}\n\`\`\``,
        };
      }
    );

    // ── Tool: list-directory ─────────────────────────────────────────────
    ctx.tools.register(
      "list-directory",
      {
        displayName: "Listar Diretório",
        description: "Lista o conteúdo de um diretório do repositório.",
        parametersSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Caminho do diretório" },
          },
          required: ["path"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { path } = params as { path: string };
        ctx.logger.info("Listando diretório", { path });

        let items: GithubItem[];
        try {
          items = (await ghGet(
            `/repos/${config.owner}/${config.repo}/contents/${path}`
          )) as GithubItem[];
        } catch (err) {
          return { error: String(err) };
        }

        if (!Array.isArray(items) || items.length === 0) {
          return { content: `Diretório \`${path}\` está vazio.` };
        }

        const dirs = items.filter((i) => i.type === "dir").map((i) => `📁 ${i.name}/`);
        const files = items.filter((i) => i.type === "file").map((i) => `📄 ${i.name} (${i.size ?? 0}b)`);

        return {
          content: `**\`${path}/\`** — ${items.length} item(s)\n\n${[...dirs, ...files].join("\n")}`,
        };
      }
    );

    // ── Tool: search-code ────────────────────────────────────────────────
    ctx.tools.register(
      "search-code",
      {
        displayName: "Buscar no Código",
        description: "Busca um termo em todo o repositório via GitHub code search.",
        parametersSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Termo a buscar" },
            path: { type: "string", description: "Limitar a um diretório (opcional)" },
          },
          required: ["query"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { query, path } = params as { query: string; path?: string };
        ctx.logger.info("Buscando código", { query, path });

        const repoFilter = `repo:${config.owner}/${config.repo}`;
        const pathFilter = path ? ` path:${path}` : "";
        const q = encodeURIComponent(`${query}${pathFilter} ${repoFilter}`);

        let result: { total_count: number; items: GithubSearchItem[] };
        try {
          result = (await ghGet(
            `/search/code?q=${q}&per_page=10`
          )) as typeof result;
        } catch (err) {
          return { error: String(err) };
        }

        if (result.total_count === 0) {
          return { content: `Nenhuma ocorrência de **"${query}"** encontrada no repositório.` };
        }

        const lines = result.items
          .slice(0, 10)
          .map((i) => `- [\`${i.path}\`](https://github.com/${config.owner}/${config.repo}/blob/main/${i.path})`);

        return {
          content: `**${result.total_count} ocorrência(s) de "${query}"** (mostrando ${Math.min(10, result.items.length)}):\n\n${lines.join("\n")}`,
        };
      }
    );

    ctx.logger.info("GitHub Search plugin pronto", {
      owner: config.owner,
      repo: config.repo,
    });
  },

  async onHealth() {
    return { status: "ok" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
