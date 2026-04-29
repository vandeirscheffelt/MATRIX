import { useState, useCallback } from "react";
import { type AutoBookRequest, type AutoBookResponse, type ManualBookRequest } from "./types";
import { useAvailability } from "./useAvailability";
import { useProfessionals } from "./useProfessionals";
import { api } from "@/lib/apiClient";

export function useAppointments() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availability = useAvailability();
  const { professionals, getProfessional } = useProfessionals();

  const clearError = useCallback(() => setError(null), []);

  function buildIso(date: Date, time: string) {
    const dateStr = date.toISOString().split("T")[0];
    // Use explicit UTC (Z) to match backend slot times which are also UTC
    const inicio = new Date(`${dateStr}T${time}:00Z`);
    const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
  }

  const autoScheduleAppointment = useCallback(async (req: AutoBookRequest): Promise<AutoBookResponse> => {
    setLoading(true);
    setError(null);
    try {
      // Load all slots (not just top-3 suggestions) to find the preferred one
      const allSlots = await availability.loadSlotsForDate(req.date);
      const freeSlots = allSlots.filter(s => s.status === "free");
      if (freeSlots.length === 0) throw new Error("Nenhum horário disponível para esta data.");
      // Prefer the exact slot the user clicked, then fall back to first free
      const preferredSlot = req.preferredTime && req.preferredProfessionalId
        ? freeSlots.find(s => s.time === req.preferredTime && s.professionalId === req.preferredProfessionalId)
        : undefined;
      const best = preferredSlot ?? freeSlots[0];
      const { inicio, fim } = buildIso(req.date, best.time);
      await api.post("/app/agendamentos", { profissionalId: best.professionalId, inicio, fim });
      availability.applySlotUpdate(req.date, best.time, best.professionalId, {
        status: "booked", client: req.client, service: req.service,
      });
      return { professionalId: best.professionalId, time: best.time, client: req.client, service: req.service };
    } catch (e: any) {
      setError(e.message); throw e;
    } finally {
      setLoading(false);
    }
  }, [availability]);

  const createAppointment = useCallback(async (req: ManualBookRequest): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { inicio, fim } = buildIso(req.date, req.time);
      await api.post("/app/agendamentos", { profissionalId: req.professionalId, inicio, fim });
      availability.applySlotUpdate(req.date, req.time, req.professionalId, {
        status: "booked", client: req.client, service: req.service,
      });
    } catch (e: any) {
      setError(e.message); throw e;
    } finally {
      setLoading(false);
    }
  }, [availability]);

  const cancelAppointment = useCallback(async (date: Date, time: string, professionalId: string, appointmentId?: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      if (appointmentId) await api.delete(`/app/agendamentos/${appointmentId}`);
      availability.applySlotUpdate(date, time, professionalId, { status: "free", client: undefined, service: undefined });
    } catch (e: any) {
      setError(e.message); throw e;
    } finally {
      setLoading(false);
    }
  }, [availability]);

  return {
    professionals,
    getProfessional,
    getSlotsForDate: availability.getSlotsForDate,
    loadSlotsForDate: availability.loadSlotsForDate,
    getAiSuggestions: availability.getAiSuggestions,
    blockSlot: availability.blockSlot,
    unblockSlot: availability.unblockSlot,
    autoScheduleAppointment,
    createAppointment,
    cancelAppointment,
    loading,
    error,
    clearError,
  };
}
