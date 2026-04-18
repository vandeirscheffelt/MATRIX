import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Professional } from "@/hooks/api/types";
import { api } from "@/lib/apiClient";

function mapApiProfessional(p: any): Professional {
  return {
    id: p.id,
    name: p.nome,
    phone: p.telefone ?? "",
    aiAccess: false,
    color: "217 91% 60%",
    services: (p.servicos ?? []).map((s: any) => s.servicoId ?? s.id),
    schedule: {
      workingHoursStart: p.gradeHorarios?.[0]?.horaInicio ?? "08:00",
      workingHoursEnd: p.gradeHorarios?.[0]?.horaFim ?? "18:00",
      daysOff: [],
    },
  };
}

interface ProfessionalsContextType {
  professionals: Professional[];
  getProfessional: (id: string) => Professional;
  addProfessional: (pro: Omit<Professional, "id">) => Promise<void>;
  updateProfessional: (id: string, updates: Partial<Professional>) => Promise<void>;
  removeProfessional: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const ProfessionalsContext = createContext<ProfessionalsContextType | null>(null);

export function ProfessionalsProvider({ children }: { children: ReactNode }) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const reload = useCallback(async () => {
    try {
      const data = await api.get<any[]>("/app/profissionais");
      setProfessionals(data.map(mapApiProfessional));
    } catch {
      // silently fail — may not be authenticated yet
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const getProfessional = useCallback((id: string): Professional => {
    return professionals.find(p => p.id === id) ?? {
      id, name: id, phone: "", aiAccess: false, color: "0 0% 50%",
      services: [], schedule: { workingHoursStart: "08:00", workingHoursEnd: "17:00", daysOff: [] },
    };
  }, [professionals]);

  const addProfessional = useCallback(async (pro: Omit<Professional, "id">) => {
    await api.post("/app/profissionais", { nome: pro.name });
    await reload();
  }, [reload]);

  const updateProfessional = useCallback(async (id: string, updates: Partial<Professional>) => {
    await api.patch(`/app/profissionais/${id}`, { nome: updates.name });
    setProfessionals(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const removeProfessional = useCallback(async (id: string) => {
    await api.delete(`/app/profissionais/${id}`);
    setProfessionals(prev => prev.filter(p => p.id !== id));
  }, []);

  return (
    <ProfessionalsContext.Provider value={{ professionals, getProfessional, addProfessional, updateProfessional, removeProfessional, reload }}>
      {children}
    </ProfessionalsContext.Provider>
  );
}

export function useProfessionalsContext() {
  const ctx = useContext(ProfessionalsContext);
  if (!ctx) throw new Error("useProfessionalsContext must be used within ProfessionalsProvider");
  return ctx;
}
