# Guia de Criação de Plugins para Paperclip

> Leia este documento antes de criar qualquer plugin.
> Ele documenta o processo real, incluindo os problemas encontrados no Windows e como resolvê-los.

---

## Estrutura obrigatória do plugin

```
plugins/meu-plugin/
├── src/
│   ├── manifest-src/
│   │   └── manifest.cts        # CJS obrigatório — extensão .cts
│   └── worker.ts               # ESM — extensão .ts normal
├── dist/                       # gerado pelo build
│   ├── manifest-src/
│   │   └── manifest.cjs        # gerado automaticamente
│   └── worker.js               # gerado automaticamente
├── package.json
└── tsconfig.json
```

---

## package.json

```json
{
  "name": "paperclip-plugin-NOME",
  "version": "1.0.0",
  "description": "Descrição do plugin",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "paperclipPlugin": {
    "manifest": "./dist/manifest-src/manifest.cjs",
    "worker": "./dist/worker.js"
  },
  "dependencies": {
    "@paperclipai/plugin-sdk": "^2026.403.0"
  },
  "devDependencies": {
    "@types/node": "^25.6.0",
    "typescript": "^5.9.3"
  }
}
```

**Regras críticas:**
- `"type": "module"` obrigatório (worker é ESM)
- `name` deve começar com `paperclip-plugin-` OU usar o campo `paperclipPlugin`
- `manifest` aponta para `.cjs` (CJS)
- `worker` aponta para `.js` (ESM)

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true,
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Por que NodeNext?** O `@paperclipai/plugin-sdk` só tem exports ESM. O worker precisa de ESM para importá-lo. O manifest usa `.cts` para forçar CJS independente do module do tsconfig.

---

## src/manifest-src/manifest.cts

```typescript
import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  apiVersion: 1,
  id: "meu-plugin",                          // único, lowercase, hífens
  displayName: "Meu Plugin",
  description: "O que o plugin faz.",
  version: "1.0.0",
  author: "Scheffelt Matrix <email@example.com>",
  categories: ["automation"],               // "automation" | "connector" | "workspace" | "ui"
  capabilities: [
    "http.outbound",                         // para chamadas HTTP externas
    "secrets.read-ref",                      // para ler secrets configurados
    "agent.tools.register",                  // obrigatório para registrar tools
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      minhaSenhaSecret: {
        type: "string",
        description: "Referência ao secret com a API key",
      },
    },
    required: ["minhaSenhaSecret"],
  },
  tools: [
    {
      name: "minha-tool",
      displayName: "Minha Tool",
      description: "Descrição clara do que a tool faz para o agente.",
      parametersSchema: {
        type: "object",
        properties: {
          parametro: { type: "string", description: "..." },
        },
        required: ["parametro"],
      },
    },
  ],
};

export default manifest;
module.exports = manifest;  // OBRIGATÓRIO — permite leitura via require() no servidor
```

**Campos obrigatórios:** `id`, `apiVersion`, `version`, `displayName`, `description`, `author`, `categories`, `capabilities`, `entrypoints`

---

## src/worker.ts

```typescript
import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info("Plugin iniciando");

    const config = (await ctx.config.get()) as unknown as {
      minhaSenhaSecret: string;
    };

    ctx.tools.register(
      "minha-tool",
      {
        displayName: "Minha Tool",
        description: "Descrição da tool.",
        parametersSchema: {
          type: "object",
          properties: {
            parametro: { type: "string", description: "..." },
          },
          required: ["parametro"],
        },
      },
      async (params, _runCtx): Promise<ToolResult> => {
        const { parametro } = params as { parametro: string };

        // Ler secret configurado no dashboard
        const apiKey = await ctx.secrets.resolve(config.minhaSenhaSecret);

        // Chamada HTTP externa
        const res = await ctx.http.fetch(`https://api.exemplo.com/${parametro}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!res.ok) {
          return { error: `Erro: ${res.statusText}` };
        }

        const data = await res.json() as Record<string, unknown>;

        return {
          content: `Resultado: ${JSON.stringify(data)}`,
        };
      }
    );

    ctx.logger.info("Plugin pronto");
  },

  async onHealth() {
    return { status: "ok" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
```

**Regras do worker:**
- `ctx.config.get()` retorna `Promise<Record<string, unknown>>` — sempre fazer cast
- `ctx.secrets.resolve(ref)` — resolve o secret pelo nome de referência
- `ctx.http.fetch()` — usar em vez de fetch nativo (auditado pelo host)
- `ToolResult` tem apenas `{ content?: string; data?: unknown; error?: string }`
- `import.meta.url` funciona normalmente (ESM)

---

## Comandos de build e instalação

```bash
# Instalar dependências
cd plugins/meu-plugin
npm install

# Build
npm run build

# Instalar no Paperclip (servidor deve estar rodando)
cd ../..
paperclipai plugin install --local ./plugins/meu-plugin

# Verificar status
paperclipai plugin list

# Reinstalar após mudanças
paperclipai plugin uninstall meu-plugin
paperclipai plugin install --local ./plugins/meu-plugin
```

---

## Patch obrigatório no Windows (feito uma vez, persiste)

O Paperclip tem um bug no Windows: passa paths `C:\...` para `import()` sem o prefixo `file://`.
O patch já foi aplicado em todas as cópias do servidor em 2026-04-12.

**Arquivo patchado:**
`~\AppData\Roaming\npm\node_modules\paperclipai\node_modules\@paperclipai\server\dist\services\plugin-loader.js`

**Função patchada:** `loadManifestFromPath` — adicionado fallback `createRequire` para Windows.

Se o Paperclip for atualizado (`npm update -g paperclipai`), o patch será sobrescrito e precisará ser reaplicado nas 4 cópias do arquivo:
- `~\AppData\Roaming\npm\node_modules\paperclipai\node_modules\@paperclipai\server\dist\services\plugin-loader.js`
- `~\AppData\Local\npm-cache\_npx\0aa74679bec75e15\node_modules\@paperclipai\server\dist\services\plugin-loader.js`
- `~\AppData\Local\npm-cache\_npx\43414d9b790239bb\node_modules\@paperclipai\server\dist\services\plugin-loader.js`
- `~\AppData\Local\npm-cache\_npx\4cc26c48ea9243e4\node_modules\@paperclipai\server\dist\services\plugin-loader.js`

**Código do patch** (substitui o bloco `loadManifestFromPath`):
```javascript
async function loadManifestFromPath(manifestPath) {
    let raw;
    try {
        const { pathToFileURL } = await import("node:url");
        const { createRequire } = await import("node:module");
        let mod;
        try {
            const importTarget = manifestPath.match(/^[A-Za-z]:[/\\]/) ? pathToFileURL(manifestPath).href : manifestPath;
            mod = await import(importTarget);
        } catch (esmErr) {
            const require2 = createRequire(import.meta.url);
            mod = require2(manifestPath);
        }
        raw = mod["default"] ?? mod;
    }
    catch (err) {
        throw new Error(`Failed to load manifest module at ${manifestPath}: ${String(err)}`);
    }
    return manifestValidator.parseOrThrow(raw);
}
```

---

## Etapa 2 — configurar no dashboard após instalar

1. Acesse **http://127.0.0.1:3100**
2. Vá em **Company → Skills** ou **Settings → Plugins**
3. Configure os campos do `instanceConfigSchema` (secrets, IDs, etc.)
4. Crie um agente em **Agents +**
5. Nas tools do agente, ative as tools registradas pelo plugin
6. Posicione o agente no **Org Chart**

---

## Plugin Meta Ads (referência implementada)

- **Localização:** `plugins/meta-ads/`
- **Tools:** `meta-ads:verify-campaign`, `meta-ads:list-campaigns`
- **Config necessária:** `accessTokenSecret` (ref ao META_ACCESS_TOKEN) + `adAccountId`
- **Status:** instalado e ativo (`paperclipai plugin list` → `status=ready`)
