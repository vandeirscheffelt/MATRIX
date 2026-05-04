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

  function buildIso(date: Date, time: string, durationMin = 60) {
    const dateStr = date.toISOString().split("T")[0];
    const inicio = new Date(`${dateStr}T${time}:00Z`);
    const fim = new Date(inicio.getTime() + durationMin * 60 * 1000);
    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
  }

  const autoScheduleAppointment = useCallback(async (req: AutoBookRequest): Promise<AutoBookResponse> => {
    setLoading(true);
    setError(null);
    try {
      const allSlots = await availability.loadSlotsForDate(req.date);
      const freeSlots = allSlots.filter(s => s.status === "free");
      if (freeSlots.length === 0) throw new Error("Nenhum horário disponível para esta data.");
      const preferredSlot = req.preferredTime && req.preferredProfessionalId
        ? freeSlots.find(s => s.time === req.preferredTime && s.professionalId === req.preferredProfessionalId)
        : undefined;
      const candidates = preferredSlot
        ? [preferredSlot, ...freeSlots.filter(s => s !== preferredSlot)]
        : freeSlots;

      // Retry on 409 — skip conflicted slots and try next
      for (const candidate of candidates) {
        const { inicio, fim } = buildIso(req.date, candidate.time, req.durationMin ?? 60);
        try {
          await api.post("/app/agendamentos", {
            profissionalId: candidate.professionalId, inicio, fim,
            clienteNome: req.client, servicoNome: req.service, servicoId: req.servicoId,
          });
          availability.applySlotUpdate(req.date, candidate.time, candidate.professionalId, {
            status: "booked", client: req.client, service: req.service, duration: req.durationMin,
          });
          return { professionalId: candidate.professionalId, time: candidate.time, client: req.client, service: req.service };
        } catch (e: any) {
          if (!e.message?.includes("409")) throw e;
          // 409 = conflict, mark slot as booked locally and try next
          availability.applySlotUpdate(req.date, candidate.time, candidate.professionalId, { status: "booked" });
        }
      }
      throw new Error("Nenhum horário disponível para esta data.");
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
      const { inicio, fim } = buildIso(req.date, req.time, req.durationMin ?? 60);
      await api.post("/app/agendamentos", {
        profissionalId: req.professionalId, inicio, fim,
        clienteNome: req.client, servicoNome: req.service, servicoId: req.servicoId,
      });
      availability.applySlotUpdate(req.date, req.time, req.professionalId, {
        status: "booked", client: req.client, service: req.service, duration: req.durationMin,
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
