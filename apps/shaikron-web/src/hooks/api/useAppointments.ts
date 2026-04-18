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

  const autoScheduleAppointment = useCallback(async (req: AutoBookRequest): Promise<AutoBookResponse> => {
    setLoading(true);
    setError(null);
    try {
      const suggestions = await availability.getAiSuggestions(req.date);
      if (suggestions.length === 0) throw new Error("Nenhum horário disponível para esta data.");
      const best = suggestions[0];
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
      await api.post("/app/agendamentos", {
        profissionalId: req.professionalId,
        data: req.date.toISOString().split("T")[0],
        horaInicio: req.time,
        clienteNome: req.client,
        servicoNome: req.service,
      });
      availability.applySlotUpdate(req.date, req.time, req.professionalId, {
        status: "booked", client: req.client, service: req.service,
      });
    } catch (e: any) {
      setError(e.message); throw e;
    } finally {
      setLoading(false);
    }
  }, [availability]);

  const cancelAppointment = useCallback(async (date: Date, time: string, professionalId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
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
