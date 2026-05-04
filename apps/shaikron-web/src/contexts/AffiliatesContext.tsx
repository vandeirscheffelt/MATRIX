import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { api } from "@/lib/apiClient";

export interface Affiliate {
  id: string;
  productName: string;
  shortDescription: string;
  status: "active" | "coming_soon";
  externalLink: string;
  icon: string;
  highlightBadge: string;
  displayOrder: number;
}

interface AffiliatesState {
  affiliates: Affiliate[];
  loading: boolean;
  addAffiliate: (affiliate: Omit<Affiliate, "id">) => Promise<void>;
  updateAffiliate: (id: string, updates: Partial<Omit<Affiliate, "id">>) => Promise<void>;
  deleteAffiliate: (id: string) => Promise<void>;
}

const AffiliatesContext = createContext<AffiliatesState>({
  affiliates: [],
  loading: false,
  addAffiliate: async () => {},
  updateAffiliate: async () => {},
  deleteAffiliate: async () => {},
});

function mapApi(p: any): Affiliate {
  return {
    id: p.id,
    productName: p.productName ?? p.product_name ?? "",
    shortDescription: p.shortDescription ?? p.short_description ?? "",
    status: p.status ?? "active",
    externalLink: p.externalLink ?? p.external_link ?? "",
    icon: p.icon ?? "🤝",
    highlightBadge: p.highlightBadge ?? p.highlight_badge ?? "",
    displayOrder: p.displayOrder ?? p.display_order ?? 0,
  };
}

export const AffiliatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<any[]>("/app/afiliados");
      setAffiliates((data ?? []).map(mapApi));
    } catch { /* silently fail if not authenticated yet */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addAffiliate = useCallback(async (affiliate: Omit<Affiliate, "id">) => {
    const created = await api.post<any>("/app/afiliados", affiliate);
    setAffiliates(prev => [...prev, mapApi(created)]);
  }, []);

  const updateAffiliate = useCallback(async (id: string, updates: Partial<Omit<Affiliate, "id">>) => {
    const updated = await api.put<any>(`/app/afiliados/${id}`, updates);
    setAffiliates(prev => prev.map(a => a.id === id ? mapApi(updated) : a));
  }, []);

  const deleteAffiliate = useCallback(async (id: string) => {
    await api.delete(`/app/afiliados/${id}`);
    setAffiliates(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <AffiliatesContext.Provider value={{ affiliates, loading, addAffiliate, updateAffiliate, deleteAffiliate }}>
      {children}
    </AffiliatesContext.Provider>
  );
};

export const useAffiliates = () => useContext(AffiliatesContext);
