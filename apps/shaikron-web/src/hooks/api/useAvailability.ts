import { useState, useCallback, useRef } from "react";
import { type TimeSlot, type AiSuggestion, type SlotStatus, HOURS, slotKey } from "./types";
import { api } from "@/lib/apiClient";
import { useProfessionals } from "./useProfessionals";

export function useAvailability() {
  const { professionals } = useProfessionals();
  const [slotOverrides, setSlotOverrides] = useState<Record<string, Partial<TimeSlot>>>({});
  // Cache: dateStr (YYYY-MM-DD) → slots fetched from API
  const [slotsCache, setSlotsCache] = useState<Record<string, TimeSlot[]>>({});
  // Track in-flight fetches to avoid duplicate requests
  const pendingFetches = useRef<Set<string>>(new Set());

  const applyOverrides = useCallback((slots: TimeSlot[]): TimeSlot[] =>
    slots.map(slot => {
      const key = slotKey(slot.time, slot.professionalId);
      const override = slotOverrides[key];
      return override ? { ...slot, ...override } : slot;
    }),
    [slotOverrides]
  );

  // Async fetch that updates the cache
  const loadSlotsForDate = useCallback(async (date: Date): Promise<void> => {
    const iso = date.toISOString().split("T")[0];
    if (pendingFetches.current.has(iso)) return;
    pendingFetches.current.add(iso);
    try {
      const data = await api.get<any>(`/app/agenda/day?date=${iso}`);
      const agendas: any[] = Array.isArray(data) ? data : [];
      const slots: TimeSlot[] = agendas.flatMap((agenda: any) =>
        (agenda.slots ?? []).map((s: any): TimeSlot => ({
          time: s.hora,
          professionalId: agenda.profissionalId,
          status: (s.status === "DISPONIVEL" ? "free"
            : s.status === "AGENDADO" ? "booked"
            : "blocked") as SlotStatus,
          client: s.leadNome,
        }))
      );
      setSlotsCache(prev => ({ ...prev, [iso]: slots }));
    } catch {
      // On error, store empty array so we don't retry on every render
      setSlotsCache(prev => ({ ...prev, [iso]: [] }));
    } finally {
      pendingFetches.current.delete(iso);
    }
  }, []);

  // Synchronous — reads from cache (or returns fallback free slots)
  const getSlotsForDate = useCallback((date: Date): TimeSlot[] => {
    const iso = date.toISOString().split("T")[0];
    const cached = slotsCache[iso];
    if (cached) return applyOverrides(cached);
    // Trigger background fetch if not already cached/loading
    loadSlotsForDate(date);
    // Return fallback free slots from known professionals while loading
    return applyOverrides(
      professionals.flatMap(pro =>
        HOURS.map((time): TimeSlot => ({ time, professionalId: pro.id, status: "free" }))
      )
    );
  }, [slotsCache, professionals, applyOverrides, loadSlotsForDate]);

  const getAiSuggestions = useCallback(async (date: Date): Promise<AiSuggestion[]> => {
    await loadSlotsForDate(date);
    const slots = getSlotsForDate(date);
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
  }, [loadSlotsForDate, getSlotsForDate]);

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
