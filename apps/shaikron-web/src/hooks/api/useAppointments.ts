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

      const now = new Date();
      const slotMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      // Full datetime comparison: slot is future if its absolute time > now
      const slotIsFuture = (time: string) => {
        const d = req.date;
        const [h, m] = time.split(":").map(Number);
        const slotDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        return slotDate.getTime() > now.getTime();
      };

      const durationMin = req.durationMin ?? 15;
      const slotsNeeded = Math.ceil(durationMin / 15);

      const freeSlots = allSlots.filter(s => s.status === "free" && slotIsFuture(s.time));

      // If a professional was chosen, restrict to that professional only
      // Otherwise if a service was chosen, restrict to professionals who offer it
      // (professionals with empty services[] are treated as unrestricted — backwards compat)
      const proFreeSlots = req.preferredProfessionalId
        ? freeSlots.filter(s => s.professionalId === req.preferredProfessionalId)
        : req.servicoId
          ? freeSlots.filter(s => {
              const pro = professionals.find(p => p.id === s.professionalId);
              return !pro || pro.services.length === 0 || pro.services.includes(req.servicoId!);
            })
          : freeSlots;

      // Only keep slots where all consecutive 15-min slots needed are also free
      const candidates = proFreeSlots.filter(candidate => {
        if (slotsNeeded <= 1) return true;
        const start = slotMin(candidate.time);
        for (let i = 1; i < slotsNeeded; i++) {
          const needed = `${String(Math.floor((start + i * 15) / 60)).padStart(2, "0")}:${String((start + i * 15) % 60).padStart(2, "0")}`;
          if (!freeSlots.find(s => s.time === needed && s.professionalId === candidate.professionalId)) return false;
        }
        return true;
      });

      if (candidates.length === 0) {
        const proName = req.preferredProfessionalId
          ? professionals.find(p => p.id === req.preferredProfessionalId)?.name ?? "Profissional"
          : "Nenhum profissional";
        throw new Error(`${proName} não tem horários disponíveis para ${durationMin} min hoje.`);
      }

      // Prefer the exact clicked slot if available
      const preferredSlot = req.preferredTime
        ? candidates.find(s => s.time === req.preferredTime)
        : undefined;
      const ordered = preferredSlot
        ? [preferredSlot, ...candidates.filter(s => s !== preferredSlot)]
        : candidates;

      // Retry on 409 — skip conflicted slots and try next
      for (const candidate of ordered) {
        const { inicio, fim } = buildIso(req.date, candidate.time, req.durationMin ?? 60);
        try {
          await api.post("/app/agendamentos", {
            profissionalId: candidate.professionalId, inicio, fim,
            clienteNome: req.client, clienteTelefone: req.phone,
            servicoNome: req.service, servicoId: req.servicoId,
          });
          // Invalidate cache so next auto-schedule sees updated availability
          availability.invalidateDate(req.date);
          availability.loadSlotsForDate(req.date);
          availability.applySlotUpdate(req.date, candidate.time, candidate.professionalId, {
            status: "booked", client: req.client, phone: req.phone, service: req.service, duration: req.durationMin,
          });
          return { professionalId: candidate.professionalId, time: candidate.time, client: req.client, service: req.service };
        } catch (e: any) {
          if (!e.message?.includes("409")) throw e;
          // 409 = conflict, do NOT overwrite existing override (preserves client name)
          // Just skip to next candidate; fresh cache load above will fix on next booking
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
        clienteNome: req.client, clienteTelefone: req.phone,
        servicoNome: req.service, servicoId: req.servicoId,
      });
      availability.applySlotUpdate(req.date, req.time, req.professionalId, {
        status: "booked", client: req.client, phone: req.phone, service: req.service, duration: req.durationMin,
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
