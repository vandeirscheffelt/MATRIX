import { useState, useCallback, useRef, useEffect } from "react";
import { type TimeSlot, type AiSuggestion, type SlotStatus, HOURS, slotKey } from "./types";
import { api } from "@/lib/apiClient";
import { useProfessionals } from "./useProfessionals";

export function useAvailability() {
  const { professionals } = useProfessionals();
  // Keyed as "YYYY-MM-DD__time__proId" to prevent cross-day bleed
  const [slotOverrides, setSlotOverrides] = useState<Record<string, Partial<TimeSlot>>>({});
  const [slotsCache, setSlotsCache] = useState<Record<string, TimeSlot[]>>({});
  // Refs always reflect latest values — avoid stale closures in async functions
  const slotsCacheRef = useRef<Record<string, TimeSlot[]>>({});
  const professionalsRef = useRef(professionals);
  const pendingFetches = useRef<Set<string>>(new Set());

  useEffect(() => { slotsCacheRef.current = slotsCache; }, [slotsCache]);
  useEffect(() => { professionalsRef.current = professionals; }, [professionals]);

  const applyOverrides = useCallback((slots: TimeSlot[], iso: string): TimeSlot[] =>
    slots.map(slot => {
      const key = `${iso}__${slotKey(slot.time, slot.professionalId)}`;
      const override = slotOverrides[key];
      return override ? { ...slot, ...override } : slot;
    }),
    [slotOverrides]
  );

  // Async fetch — returns loaded slots directly (avoids stale closure problem)
  const loadSlotsForDate = useCallback(async (date: Date): Promise<TimeSlot[]> => {
    const iso = date.toISOString().split("T")[0];
    // Return already-cached slots immediately
    if (slotsCacheRef.current[iso]) return slotsCacheRef.current[iso];
    if (pendingFetches.current.has(iso)) {
      // Wait for in-flight fetch to complete
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (!pendingFetches.current.has(iso)) { clearInterval(check); resolve(); }
        }, 50);
      });
      return slotsCacheRef.current[iso] ?? [];
    }
    pendingFetches.current.add(iso);
    try {
      const data = await api.get<any>(`/app/agenda/day?date=${iso}`);
      const agendas: any[] = Array.isArray(data) ? data : [];
      let slots: TimeSlot[] = agendas.flatMap((agenda: any) =>
        (agenda.slots ?? []).map((s: any): TimeSlot => ({
          time: s.hora,
          professionalId: agenda.profissionalId,
          status: (s.status === "DISPONIVEL" ? "free"
            : s.status === "AGENDADO" ? "booked"
            : "blocked") as SlotStatus,
          client: s.leadNome,
          service: s.servicoNome,
          appointmentId: s.agendamentoId ?? s.bloqueioId,
        }))
      );
      // API returned nothing — build default free slots so the grid never goes blank
      if (slots.length === 0) {
        slots = professionalsRef.current.flatMap(pro =>
          HOURS.map((time): TimeSlot => ({ time, professionalId: pro.id, status: "free" }))
        );
      }
      slotsCacheRef.current = { ...slotsCacheRef.current, [iso]: slots };
      setSlotsCache(prev => ({ ...prev, [iso]: slots }));
      return slots;
    } catch {
      slotsCacheRef.current = { ...slotsCacheRef.current, [iso]: [] };
      setSlotsCache(prev => ({ ...prev, [iso]: [] }));
      return [];
    } finally {
      pendingFetches.current.delete(iso);
    }
  }, []);

  // Synchronous — reads from cache (or returns fallback free slots)
  const getSlotsForDate = useCallback((date: Date): TimeSlot[] => {
    const iso = date.toISOString().split("T")[0];
    const cached = slotsCache[iso];
    if (cached) return applyOverrides(cached, iso);
    // Trigger background fetch
    loadSlotsForDate(date);
    // Fallback: show all professionals as free while loading
    return applyOverrides(
      professionals.flatMap(pro =>
        HOURS.map((time): TimeSlot => ({ time, professionalId: pro.id, status: "free" }))
      ),
      iso
    );
  }, [slotsCache, professionals, applyOverrides, loadSlotsForDate]);

  // Uses ref to get fresh slots after await — avoids stale closure
  const getAiSuggestions = useCallback(async (date: Date): Promise<AiSuggestion[]> => {
    const slots = await loadSlotsForDate(date);
    const fresh = slots.length > 0 ? slots : (slotsCacheRef.current[date.toISOString().split("T")[0]] ?? []);
    return fresh
      .filter(s => s.status === "free")
      .slice(0, 3)
      .map((s, i): AiSuggestion => ({
        time: s.time,
        professionalId: s.professionalId,
        score: 1 - i * 0.1,
        reason: "Horário disponível",
        isBest: i === 0,
      }));
  }, [loadSlotsForDate]);

  const invalidateDate = useCallback((date: Date) => {
    const iso = date.toISOString().split("T")[0];
    slotsCacheRef.current = { ...slotsCacheRef.current };
    delete slotsCacheRef.current[iso];
    setSlotsCache(prev => { const next = { ...prev }; delete next[iso]; return next; });
  }, []);

  const applySlotUpdate = useCallback((date: Date, time: string, professionalId: string, updates: Partial<TimeSlot>) => {
    const iso = date.toISOString().split("T")[0];
    const key = `${iso}__${slotKey(time, professionalId)}`;
    setSlotOverrides(prev => ({ ...prev, [key]: updates }));
  }, []);

  const blockSlot = useCallback(async (date: Date, time: string, professionalId: string) => {
    const dateStr = date.toISOString().split("T")[0];
    const dataInicio = new Date(`${dateStr}T${time}:00Z`);
    const dataFim = new Date(dataInicio.getTime() + 60 * 60 * 1000);
    try {
      const res = await api.post<{ id: string }>("/app/bloqueios", {
        profissionalId: professionalId,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
      });
      invalidateDate(date);
      applySlotUpdate(date, time, professionalId, { status: "blocked", appointmentId: res.id });
    } catch {
      applySlotUpdate(date, time, professionalId, { status: "blocked" });
    }
  }, [applySlotUpdate, invalidateDate]);

  const unblockSlot = useCallback(async (date: Date, time: string, professionalId: string, bloqueioId?: string) => {
    if (bloqueioId) {
      try { await api.delete(`/app/bloqueios/${bloqueioId}`); } catch { /* ignore */ }
    }
    invalidateDate(date);
    applySlotUpdate(date, time, professionalId, { status: "free", appointmentId: undefined });
  }, [applySlotUpdate, invalidateDate]);

  return { getSlotsForDate, loadSlotsForDate, getAiSuggestions, applySlotUpdate, blockSlot, unblockSlot };
}
