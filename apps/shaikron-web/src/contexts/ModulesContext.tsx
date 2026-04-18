import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface AppModule {
  id: string;
  module_name: string;
  short_description: string;
  status: "active" | "coming_soon" | "disabled";
  route_path: string;
  icon: string;
  highlight_badge: string;
  requires_plan: boolean;
  display_order: number;
}

interface ModulesState {
  modules: AppModule[];
  addModule: (module: Omit<AppModule, "id">) => void;
  updateModule: (id: string, updates: Partial<Omit<AppModule, "id">>) => void;
  deleteModule: (id: string) => void;
}

const STORAGE_KEY = "schaikron_modules";

function loadModules(): AppModule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

const ModulesContext = createContext<ModulesState>({
  modules: [],
  addModule: () => {},
  updateModule: () => {},
  deleteModule: () => {},
});

export const ModulesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<AppModule[]>(loadModules);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
  }, [modules]);

  const addModule = useCallback((module: Omit<AppModule, "id">) => {
    setModules(prev => [...prev, { ...module, id: crypto.randomUUID() }]);
  }, []);

  const updateModule = useCallback((id: string, updates: Partial<Omit<AppModule, "id">>) => {
    setModules(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  const deleteModule = useCallback((id: string) => {
    setModules(prev => prev.filter(m => m.id !== id));
  }, []);

  return (
    <ModulesContext.Provider value={{ modules, addModule, updateModule, deleteModule }}>
      {children}
    </ModulesContext.Provider>
  );
};

export const useModules = () => useContext(ModulesContext);
