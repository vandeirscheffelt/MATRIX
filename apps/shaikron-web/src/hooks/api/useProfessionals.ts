import { useCallback } from "react";
import { type Professional, delay } from "./types";
import { useProfessionalsContext } from "@/contexts/ProfessionalsContext";

// ─── Hook ────────────────────────────────────────────────────────────
export function useProfessionals() {
  const { professionals, getProfessional, addProfessional, updateProfessional, removeProfessional } = useProfessionalsContext();

  const fetchProfessionals = useCallback(async (): Promise<Professional[]> => {
    await delay(0);
    return professionals;
  }, [professionals]);

  return { professionals, fetchProfessionals, getProfessional, addProfessional, updateProfessional, removeProfessional };
}
