// ─── Structured API Layer ────────────────────────────────────────────
// Each hook simulates a backend endpoint and can be replaced with
// real fetch() calls without changing component logic.

export { useAppointments } from "./useAppointments";
export { useProfessionals } from "./useProfessionals";
export { useAvailability } from "./useAvailability";
export { useConversations, type ConversationDetail, type Message } from "./useConversations";
export { useSettings } from "./useSettings";
export { useServices } from "./useServices";

// Re-export types for convenience
export type {
  SlotStatus,
  Professional,
  ProfessionalSchedule,
  Service,
  TimeSlot,
  AiSuggestion,
  AppSettings,
  AutoBookRequest,
  AutoBookResponse,
  ManualBookRequest,
} from "./types";

export { HOURS, DEFAULT_SERVICES, generateTimeSlots } from "./types";
