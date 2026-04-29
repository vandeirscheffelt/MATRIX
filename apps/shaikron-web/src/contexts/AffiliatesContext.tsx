import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface Affiliate {
  id: string;
  product_name: string;
  short_description: string;
  status: "active" | "coming_soon";
  external_link: string;
  icon: string;
  highlight_badge: string;
  display_order: number;
}

interface AffiliatesState {
  affiliates: Affiliate[];
  addAffiliate: (affiliate: Omit<Affiliate, "id">) => void;
  updateAffiliate: (id: string, updates: Partial<Omit<Affiliate, "id">>) => void;
  deleteAffiliate: (id: string) => void;
}

const STORAGE_KEY = "schaikron_affiliates";

function loadAffiliates(): Affiliate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

const AffiliatesContext = createContext<AffiliatesState>({
  affiliates: [],
  addAffiliate: () => {},
  updateAffiliate: () => {},
  deleteAffiliate: () => {},
});

export const AffiliatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>(loadAffiliates);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(affiliates));
  }, [affiliates]);

  const addAffiliate = useCallback((affiliate: Omit<Affiliate, "id">) => {
    setAffiliates(prev => [...prev, { ...affiliate, id: crypto.randomUUID() }]);
  }, []);

  const updateAffiliate = useCallback((id: string, updates: Partial<Omit<Affiliate, "id">>) => {
    setAffiliates(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const deleteAffiliate = useCallback((id: string) => {
    setAffiliates(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <AffiliatesContext.Provider value={{ affiliates, addAffiliate, updateAffiliate, deleteAffiliate }}>
      {children}
    </AffiliatesContext.Provider>
  );
};

export const useAffiliates = () => useContext(AffiliatesContext);
