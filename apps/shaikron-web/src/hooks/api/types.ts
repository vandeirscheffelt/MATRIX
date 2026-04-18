import { format } from "date-fns";

// ─── Core Types ──────────────────────────────────────────────────────
export type SlotStatus = "booked" | "free" | "blocked";

export interface Service {
  id: string;
  name: string;
  duration: number; // in minutes
  color?: string;
}

export interface DayScheduleOverride {
  workingHoursStart: string;
  workingHoursEnd: string;
  isOff?: boolean;
}

export interface BreakPeriod {
  enabled: boolean;
  start: string;
  end: string;
}

export interface ProfessionalSchedule {
  workingHoursStart: string;
  workingHoursEnd: string;
  daysOff: number[]; // 0=Sun, 6=Sat
  breakPeriod?: BreakPeriod;
  dayOverrides?: Record<number, DayScheduleOverride>; // key = day index 0-6
}

export interface Professional {
  id: string;
  name: string;
  phone: string;
  aiAccess: boolean;
  color: string;
  services: string[]; // service IDs
  schedule: ProfessionalSchedule;
}

export interface TimeSlot {
  time: string;
  professionalId: string;
  status: SlotStatus;
  client?: string;
  service?: string;
  duration?: number; // in minutes
}

export interface AiSuggestion {
  professionalId: string;
  time: string;
  score: number;
  reason: string;
  isBest: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  status: "active" | "pending" | "paused";
  time: string;
}

export interface AppSettings {
  businessName: string;
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  autoScheduleEnabled: boolean;
}

// ─── Request / Response Types ────────────────────────────────────────
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

// ─── Constants ───────────────────────────────────────────────────────
export const HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
];

export const DEFAULT_SERVICES: Service[] = [
  { id: "consultation", name: "Consulta", duration: 60, color: "217 91% 60%" },
  { id: "quick-service", name: "Atendimento Rápido", duration: 30, color: "142 71% 45%" },
  { id: "follow-up", name: "Retorno", duration: 30, color: "32 95% 55%" },
  { id: "strategy", name: "Sessão Estratégica", duration: 90, color: "280 65% 60%" },
];

// ─── Helpers ─────────────────────────────────────────────────────────
export function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function slotKey(time: string, proId: string) {
  return `${time}__${proId}`;
}

/** Convert time string to minutes */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Check if a time falls within a break period */
export function isDuringBreak(time: string, breakPeriod?: BreakPeriod): boolean {
  if (!breakPeriod?.enabled) return false;
  const t = timeToMinutes(time);
  return t >= timeToMinutes(breakPeriod.start) && t < timeToMinutes(breakPeriod.end);
}

/** Get effective schedule for a professional on a given day */
export function getEffectiveSchedule(schedule: ProfessionalSchedule, dayOfWeek: number): { start: string; end: string; isOff: boolean } {
  if (schedule.daysOff.includes(dayOfWeek)) return { start: schedule.workingHoursStart, end: schedule.workingHoursEnd, isOff: true };
  const override = schedule.dayOverrides?.[dayOfWeek];
  if (override?.isOff) return { start: schedule.workingHoursStart, end: schedule.workingHoursEnd, isOff: true };
  if (override) return { start: override.workingHoursStart, end: override.workingHoursEnd, isOff: false };
  return { start: schedule.workingHoursStart, end: schedule.workingHoursEnd, isOff: false };
}

/** Generate time slots based on service duration */
export function generateTimeSlots(start: string, end: string, durationMin: number = 60, breakPeriod?: BreakPeriod): string[] {
  const slots: string[] = [];
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  for (let m = startMinutes; m + durationMin <= endMinutes; m += durationMin) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    if (!isDuringBreak(timeStr, breakPeriod)) {
      slots.push(timeStr);
    }
  }
  return slots;
}

/** Simulate network latency */
export const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
