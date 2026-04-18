import { createContext, useContext, useState, type ReactNode } from "react";

interface AiModeContextType {
  aiActive: boolean;
  setAiActive: (v: boolean) => void;
  toggleAi: () => void;
}

const AiModeContext = createContext<AiModeContextType>({
  aiActive: true,
  setAiActive: () => {},
  toggleAi: () => {},
});

export function AiModeProvider({ children }: { children: ReactNode }) {
  const [aiActive, setAiActive] = useState(true);
  return (
    <AiModeContext.Provider value={{ aiActive, setAiActive, toggleAi: () => setAiActive(p => !p) }}>
      {children}
    </AiModeContext.Provider>
  );
}

export function useAiMode() {
  return useContext(AiModeContext);
}
