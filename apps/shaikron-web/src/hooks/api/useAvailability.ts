import { useState, useCallback, useRef, useEffect } from "react";
import { type TimeSlot, type AiSuggestion, type SlotStatus, HOURS, slotKey } from "./types";
import { api } from "@/lib/apiClient";
import { useProfessionals } from "./useProfessionals";

export function useAvailability() {
  const { professionals } = useProfessionals();
  const [slotOverrides, setSlotOverrides] = useState<Record<string, Partial<TimeSlot>>>({});
  const [slotsCache, setSlotsCache] = useState<Record<string, TimeSlot[]>>({});
  // Refs always reflect latest values — avoid stale closures in async functions
  const slotsCacheRef = useRef<Record<string, TimeSlot[]>>({});
  const professionalsRef = useRef(professionals);
  const pendingFetches = useRef<Set<string>>(new Set());

  useEffect(() => { slotsCacheRef.current = slotsCache; }, [slotsCache]);
  useEffect(() => { professionalsRef.current = professionals; }, [professionals]);

  const applyOverrides = useCallback((slots: TimeSlot[]): TimeSlot[] =>
    slots.map(slot => {
      const key = slotKey(slot.time, slot.professionalId);
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
    if (cached) return applyOverrides(cached);
    // Trigger background fetch
    loadSlotsForDate(date);
    // Fallback: show all professionals as free while loading
    return applyOverrides(
      professionals.flatMap(pro =>
        HOURS.map((time): TimeSlot => ({ time, professionalId: pro.id, status: "free" }))
      )
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

  return { getSlotsForDate, loadSlotsForDate, getAiSuggestions, applySlotUpdate, blockSlot, unblockSlot };
}
