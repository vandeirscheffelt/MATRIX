import { useState, useCallback, useRef } from "react";
import { format } from "date-fns";
import { useProfessionalsContext } from "@/contexts/ProfessionalsContext";

// ─── Types ───────────────────────────────────────────────────────────
export type SlotStatus = "booked" | "free" | "blocked";

export interface Professional {
  id: string;
  name: string;
  color: string;
}

export interface TimeSlot {
  time: string;
  professionalId: string;
  status: SlotStatus;
  client?: string;
  service?: string;
}

export interface AutoBookRequest {
  date: Date;
  client: string;
  service: string;
}

export interface AutoBookResponse {
  professionalId: string;
  time: string;
  client: string;
  service: string;
}

export interface ManualBookRequest {
  date: Date;
  time: string;
  professionalId: string;
  client: string;
  service: string;
}

export interface AiSuggestion {
  professionalId: string;
  time: string;
  score: number;
  reason: string;
  isBest: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────
export const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

// PROFESSIONALS now come from context (see useScheduleApi hook below)

const CLIENTS = [
  { client: "Ana Costa", service: "Consultation" },
  { client: "Lucas", service: "Follow-up" },
  { client: "Carla", service: "Strategy Session" },
  { client: "Rafael", service: "Onboarding" },
  { client: "Beatriz", service: "Review" },
  { client: "Diego", service: "Planning" },
];

// ─── Simulated backend helpers ───────────────────────────────────────
function dateKey(d: Date) { return format(d, "yyyy-MM-dd"); }
function slotKey(time: string, proId: string) { return `${time}__${proId}`; }

function generateSlotsForDate(date: Date, professionals: { id: string; schedule?: any }[]): TimeSlot[] {
  const seed = date.getDate() + date.getMonth() * 31;
  const dayOfWeek = date.getDay();
  const slots: TimeSlot[] = [];
  professionals.forEach((pro, pIdx) => {
    // Respect per-day schedule and off days
    const schedule = pro.schedule;
    if (schedule) {
      const { daysOff, dayOverrides } = schedule;
      if (daysOff?.includes(dayOfWeek)) return;
      const override = dayOverrides?.[dayOfWeek];
      if (override?.isOff) return;
    }
    HOURS.forEach((time, i) => {
      // Skip break times
      if (schedule?.breakPeriod?.enabled) {
        const [h, m] = time.split(":").map(Number);
        const t = h * 60 + m;
        const [bsh, bsm] = schedule.breakPeriod.start.split(":").map(Number);
        const [beh, bem] = schedule.breakPeriod.end.split(":").map(Number);
        if (t >= bsh * 60 + bsm && t < beh * 60 + bem) {
          slots.push({ time, professionalId: pro.id, status: "blocked" });
          return;
        }
      }
      // Check working hours (use override if exists)
      if (schedule) {
        const override = schedule.dayOverrides?.[dayOfWeek];
        const start = override ? override.workingHoursStart : schedule.workingHoursStart;
        const end = override ? override.workingHoursEnd : schedule.workingHoursEnd;
        const [h] = time.split(":").map(Number);
        const [sh] = start.split(":").map(Number);
        const [eh] = end.split(":").map(Number);
        if (h < sh || h >= eh) return;
      }
      const v = (seed * (i + 1) * 7 + pIdx * 13) % 10;
      if (v < 3) {
        const c = CLIENTS[(seed + i + pIdx) % CLIENTS.length];
        slots.push({ time, professionalId: pro.id, status: "booked", ...c });
      } else if (v === 3) {
        slots.push({ time, professionalId: pro.id, status: "blocked" });
      } else {
        slots.push({ time, professionalId: pro.id, status: "free" });
      }
    });
  });
  return slots;
}

/** Simulate AI scoring */
function computeAiSuggestions(slots: TimeSlot[], date: Date): AiSuggestion[] {
  const freeSlots = slots.filter(s => s.status === "free");
  if (freeSlots.length === 0) return [];

  const proBookedCount: Record<string, number> = {};
  slots.forEach(s => {
    if (s.status === "booked") proBookedCount[s.professionalId] = (proBookedCount[s.professionalId] || 0) + 1;
  });

  const scored = freeSlots.map(s => {
    const hourNum = parseInt(s.time.split(":")[0]);
    const timePref = hourNum >= 9 && hourNum <= 11 ? 30 : hourNum >= 14 && hourNum <= 16 ? 20 : 10;
    const loadBalance = Math.max(0, 30 - (proBookedCount[s.professionalId] || 0) * 8);
    const variation = (date.getDate() * 3 + hourNum * 7 + s.professionalId.charCodeAt(0)) % 15;
    const score = timePref + loadBalance + variation;

    const reasons: string[] = [];
    if (timePref >= 25) reasons.push("Optimal time window");
    if (loadBalance > 15) reasons.push("Balanced workload");
    if ((proBookedCount[s.professionalId] || 0) === 0) reasons.push("Fully available today");

    return {
      professionalId: s.professionalId,
      time: s.time,
      score,
      reason: reasons.length > 0 ? reasons.join(" · ") : "Available slot",
      isBest: false,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 0) scored[0].isBest = true;
  return scored.slice(0, 3);
}

/** Simulate network latency */
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── Hook ────────────────────────────────────────────────────────────
export function useScheduleApi() {
  const { professionals, getProfessional: getProFromCtx } = useProfessionalsContext();
  const [overrides, setOverrides] = useState<Record<string, Record<string, TimeSlot>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const safeSet = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, val: T | ((prev: T) => T)) => {
    if (mountedRef.current) setter(val as any);
  }, []);

  // ── Read ──
  const getProfessionals = useCallback(async (): Promise<Professional[]> => {
    await delay(0);
    return professionals;
  }, [professionals]);


  const getSlotsForDate = useCallback((date: Date): TimeSlot[] => {
    const key = dateKey(date);
    const base = generateSlotsForDate(date, professionals);
    const ov = overrides[key];
    if (!ov) return base;
    return base.map(s => ov[slotKey(s.time, s.professionalId)] ?? s);
  }, [overrides]);

  const fetchSlotsForDate = useCallback(async (date: Date): Promise<TimeSlot[]> => {
    // Future: GET /api/slots?date=...
    await delay(300);
    return getSlotsForDate(date);
  }, [getSlotsForDate]);

  const getAiSuggestions = useCallback(async (date: Date): Promise<AiSuggestion[]> => {
    // Future: POST /api/appointments/suggestions
    safeSet(setLoading, true);
    safeSet(setError, null);
    try {
      await delay(400);
      const slots = getSlotsForDate(date);
      return computeAiSuggestions(slots, date);
    } finally {
      safeSet(setLoading, false);
    }
  }, [getSlotsForDate, safeSet]);

  // ── Write helpers ──
  const applySlotUpdate = useCallback((date: Date, time: string, professionalId: string, update: Partial<TimeSlot>) => {
    const key = dateKey(date);
    const sk = slotKey(time, professionalId);
    setOverrides(prev => {
      const base = generateSlotsForDate(date, professionals);
      const existing = prev[key] ?? {};
      const current = existing[sk] ?? base.find(s => s.time === time && s.professionalId === professionalId)!;
      return { ...prev, [key]: { ...existing, [sk]: { ...current, ...update } } };
    });
  }, []);

  // ── Auto-book (AI mode) ──
  const autoBook = useCallback(async (req: AutoBookRequest): Promise<AutoBookResponse> => {
    // Future: POST /api/appointments/auto
    safeSet(setLoading, true);
    safeSet(setError, null);
    try {
      await delay(800); // simulate AI processing
      const slots = getSlotsForDate(req.date);
      const suggestions = computeAiSuggestions(slots, req.date);
      if (suggestions.length === 0) {
        throw new Error("No available slots for this date.");
      }
      const best = suggestions[0];
      applySlotUpdate(req.date, best.time, best.professionalId, {
        status: "booked",
        client: req.client,
        service: req.service,
      });
      return {
        professionalId: best.professionalId,
        time: best.time,
        client: req.client,
        service: req.service,
      };
    } catch (e: any) {
      safeSet(setError, e.message);
      throw e;
    } finally {
      safeSet(setLoading, false);
    }
  }, [getSlotsForDate, applySlotUpdate, safeSet]);

  // ── Manual book ──
  const manualBook = useCallback(async (req: ManualBookRequest): Promise<void> => {
    // Future: POST /api/appointments
    safeSet(setLoading, true);
    safeSet(setError, null);
    try {
      await delay(500);
      const slots = getSlotsForDate(req.date);
      const target = slots.find(s => s.time === req.time && s.professionalId === req.professionalId);
      if (target && target.status !== "free") {
        throw new Error(`${getProFromCtx(req.professionalId)?.name ?? req.professionalId} is not available at ${req.time}.`);
      }
      applySlotUpdate(req.date, req.time, req.professionalId, {
        status: "booked",
        client: req.client,
        service: req.service,
      });
    } catch (e: any) {
      safeSet(setError, e.message);
      throw e;
    } finally {
      safeSet(setLoading, false);
    }
  }, [getSlotsForDate, applySlotUpdate, safeSet]);

  // ── Cancel ──
  const cancelAppointment = useCallback(async (date: Date, time: string, professionalId: string): Promise<void> => {
    // Future: DELETE /api/appointments/:id
    safeSet(setLoading, true);
    safeSet(setError, null);
    try {
      await delay(400);
      applySlotUpdate(date, time, professionalId, { status: "free", client: undefined, service: undefined });
    } catch (e: any) {
      safeSet(setError, e.message);
      throw e;
    } finally {
      safeSet(setLoading, false);
    }
  }, [applySlotUpdate, safeSet]);

  // ── Block / Unblock ──
  const blockSlot = useCallback(async (date: Date, time: string, professionalId: string): Promise<void> => {
    // Future: POST /api/blocked-times
    safeSet(setLoading, true);
    try {
      await delay(300);
      applySlotUpdate(date, time, professionalId, { status: "blocked", client: undefined, service: undefined });
    } finally {
      safeSet(setLoading, false);
    }
  }, [applySlotUpdate, safeSet]);

  const unblockSlot = useCallback(async (date: Date, time: string, professionalId: string): Promise<void> => {
    // Future: DELETE /api/blocked-times/:id
    safeSet(setLoading, true);
    try {
      await delay(300);
      applySlotUpdate(date, time, professionalId, { status: "free", client: undefined, service: undefined });
    } finally {
      safeSet(setLoading, false);
    }
  }, [applySlotUpdate, safeSet]);

  const clearError = useCallback(() => setError(null), []);

  return {
    // Data
    professionals,
    getSlotsForDate,
    fetchSlotsForDate,
    getAiSuggestions,
    // Actions
    autoBook,
    manualBook,
    cancelAppointment,
    blockSlot,
    unblockSlot,
    // State
    loading,
    error,
    clearError,
  };
}

// getPro is deprecated — use useProfessionalsContext().getProfessional instead
export function getPro(_id: string): Professional {
  return { id: _id, name: _id, color: "0 0% 50%" };
}
