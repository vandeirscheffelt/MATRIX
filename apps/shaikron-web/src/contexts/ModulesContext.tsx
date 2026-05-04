import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "@/lib/apiClient";

export interface AppModule {
  id: string;
  nome: string;
  descricao: string;
  chave: string;
  icon: string;
  highlightBadge: string;
  routePath: string;
  displayOrder: number;
  status: "active" | "coming_soon" | "disabled";
  requiresPlan: boolean;
  stripePriceId: string | null;
  ativo: boolean;
}

interface ModulesState {
  modules: AppModule[];
  loading: boolean;
}

const ModulesContext = createContext<ModulesState>({
  modules: [],
  loading: false,
});

function mapApi(m: any): AppModule {
  return {
    id: m.id,
    nome: m.nome ?? "",
    descricao: m.descricao ?? "",
    chave: m.chave ?? "",
    icon: m.icon ?? "🧩",
    highlightBadge: m.highlightBadge ?? m.highlight_badge ?? "",
    routePath: m.routePath ?? m.route_path ?? "",
    displayOrder: m.displayOrder ?? m.display_order ?? 0,
    status: m.status ?? "active",
    requiresPlan: m.requiresPlan ?? m.requires_plan ?? false,
    stripePriceId: m.stripePriceId ?? m.stripe_price_id ?? null,
    ativo: m.ativo ?? true,
  };
}

export const ModulesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<AppModule[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<any[]>("/modules/public");
      setModules((data ?? []).map(mapApi));
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ModulesContext.Provider value={{ modules, loading }}>
      {children}
    </ModulesContext.Provider>
  );
};

export const useModules = () => useContext(ModulesContext);
