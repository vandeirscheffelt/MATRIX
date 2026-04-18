import { useState, useCallback } from "react";
import { type TimeSlot, type AiSuggestion, type SlotStatus, HOURS, slotKey } from "./types";
import { api } from "@/lib/apiClient";
import { useProfessionals } from "./useProfessionals";

export function useAvailability() {
  const { professionals } = useProfessionals();
  const [slotOverrides, setSlotOverrides] = useState<Record<string, Partial<TimeSlot>>>({});

  const getSlotsForDate = useCallback(async (date: Date): Promise<TimeSlot[]> => {
    try {
      const iso = date.toISOString().split("T")[0];
      const data = await api.get<any>(`/app/agenda/day?data=${iso}`);
      const slots: TimeSlot[] = (data.slots ?? []).map((s: any): TimeSlot => ({
        time: s.hora,
        professionalId: s.profissionalId,
        status: (s.status === "DISPONIVEL" ? "free"
          : s.status === "AGENDADO" ? "booked"
          : "blocked") as SlotStatus,
        client: s.lead?.nome ?? s.lead?.telefone,
        service: s.servico?.nome,
      }));
      return slots.map(slot => {
        const key = slotKey(slot.time, slot.professionalId);
        const override = slotOverrides[key];
        return override ? { ...slot, ...override } : slot;
      });
    } catch {
      return professionals.flatMap(pro =>
        HOURS.map((time): TimeSlot => ({ time, professionalId: pro.id, status: "free" }))
      );
    }
  }, [professionals, slotOverrides]);

  const getAiSuggestions = useCallback(async (date: Date): Promise<AiSuggestion[]> => {
    const slots = await getSlotsForDate(date);
    return slots
      .filter(s => s.status === "free")
      .slice(0, 3)
      .map((s, i): AiSuggestion => ({
        time: s.time,
        professionalId: s.professionalId,
        score: 1 - i * 0.1,
        reason: "Horário disponível",
        isBest: i === 0,
      }));
  }, [getSlotsForDate]);

  const applySlotUpdate = useCallback((date: Date, time: string, professionalId: string, updates: Partial<TimeSlot>) => {
    const key = slotKey(time, professionalId);
    setSlotOverrides(prev => ({ ...prev, [key]: updates }));
  }, []);

  const blockSlot = useCallback(async (_date: Date, time: string, professionalId: string) => {
    applySlotUpdate(_date, time, professionalId, { status: "blocked" });
  }, [applySlotUpdate]);

  const unblockSlot = useCallback(async (date: Date, time: string, professionalId: string) => {
    applySlotUpdate(date, time, professionalId, { status: "free" });
  }, [applySlotUpdate]);

  return { getSlotsForDate, getAiSuggestions, applySlotUpdate, blockSlot, unblockSlot };
}
