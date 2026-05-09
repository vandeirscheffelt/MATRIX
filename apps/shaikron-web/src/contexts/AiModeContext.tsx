import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "@/lib/apiClient";

interface AiModeContextType {
  aiActive: boolean;
  toggleAi: () => Promise<void>;
}

const AiModeContext = createContext<AiModeContextType>({
  aiActive: true,
  toggleAi: async () => {},
});

export function AiModeProvider({ children }: { children: ReactNode }) {
  const [aiActive, setAiActive] = useState(true);

  useEffect(() => {
    api.get<any>("/app/config")
      .then(d => { if (typeof d?.botAtivo === "boolean") setAiActive(d.botAtivo); })
      .catch(() => {});
  }, []);

  const toggleAi = async () => {
    const next = !aiActive;
    setAiActive(next);
    try {
      await api.patch("/app/config/bot-ativo", { botAtivo: next });
    } catch {
      setAiActive(!next);
    }
  };

  return (
    <AiModeContext.Provider value={{ aiActive, toggleAi }}>
      {children}
    </AiModeContext.Provider>
  );
}

export function useAiMode() {
  return useContext(AiModeContext);
}
