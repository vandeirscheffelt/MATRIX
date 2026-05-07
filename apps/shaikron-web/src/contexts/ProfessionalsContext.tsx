import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Professional } from "@/hooks/api/types";
import { api } from "@/lib/apiClient";

function mapApiProfessional(p: any): Professional {
  // Build daysOff from gradeHorarios: days 0-6 not present = off
  const presentDays = new Set((p.gradeHorarios ?? []).map((g: any) => g.diaSemana));
  const daysOff = [0,1,2,3,4,5,6].filter(d => !presentDays.has(d));
  const firstGrade = (p.gradeHorarios ?? [])[0];
  return {
    id: p.id,
    name: p.nome,
    phone: p.telefone ?? "",
    aiAccess: p.aiAccess ?? false,
    color: p.cor ?? "217 91% 60%",
    services: (p.profissionalServicos ?? []).map((s: any) => s.servicoId),
    schedule: {
      workingHoursStart: firstGrade?.horaInicio ?? "08:00",
      workingHoursEnd: firstGrade?.horaFim ?? "18:00",
      daysOff,
      breakPeriod: p.intervaloInicio && p.intervaloFim
        ? { enabled: true, start: p.intervaloInicio, end: p.intervaloFim }
        : { enabled: false, start: "12:00", end: "13:00" },
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
      services: [], schedule: { workingHoursStart: "08:00", workingHoursEnd: "18:00", daysOff: [] },
    };
  }, [professionals]);

  const addProfessional = useCallback(async (pro: Omit<Professional, "id">) => {
    const bp = pro.schedule?.breakPeriod;
    const created = await api.post<{ id: string }>("/app/profissionais", {
      nome: pro.name,
      telefone: pro.phone || undefined,
      cor: pro.color,
      aiAccess: pro.aiAccess,
      intervaloInicio: bp?.enabled ? bp.start : null,
      intervaloFim: bp?.enabled ? bp.end : null,
    });
    if (created?.id) {
      if (pro.schedule) {
        const grade = [0,1,2,3,4,5,6]
          .filter(d => !pro.schedule.daysOff.includes(d))
          .map(d => ({ diaSemana: d, horaInicio: pro.schedule.workingHoursStart, horaFim: pro.schedule.workingHoursEnd }));
        await api.put(`/app/profissionais/${created.id}/grade`, grade).catch(() => null);
      }
      if (pro.services && pro.services.length > 0) {
        await api.put(`/app/profissionais/${created.id}/servicos`, { servicoIds: pro.services }).catch(() => null);
      }
    }
    await reload();
  }, [reload]);

  const updateProfessional = useCallback(async (id: string, updates: Partial<Professional>) => {
    const bp = updates.schedule?.breakPeriod;
    await api.put(`/app/profissionais/${id}`, {
      nome: updates.name,
      telefone: updates.phone || undefined,
      cor: updates.color,
      aiAccess: updates.aiAccess,
      intervaloInicio: bp?.enabled ? bp.start : null,
      intervaloFim: bp?.enabled ? bp.end : null,
    });
    if (updates.schedule) {
      const grade = [0,1,2,3,4,5,6]
        .filter(d => !updates.schedule!.daysOff.includes(d))
        .map(d => ({ diaSemana: d, horaInicio: updates.schedule!.workingHoursStart, horaFim: updates.schedule!.workingHoursEnd }));
      await api.put(`/app/profissionais/${id}/grade`, grade).catch(() => null);
    }
    if (updates.services !== undefined) {
      await api.put(`/app/profissionais/${id}/servicos`, { servicoIds: updates.services }).catch(() => null);
    }
    await reload();
  }, [reload]);

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
