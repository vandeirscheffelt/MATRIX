import { useState, useCallback } from "react";
import { api } from "@/lib/apiClient";

export interface Empresa {
  id: string;
  nome: string;
  slug: string;
  timezone: string;
  criadoEm: string;
}

const DEFAULT_TZ = "America/Sao_Paulo";

let cached: Empresa | null = null;

export function useEmpresa() {
  const [empresa, setEmpresa] = useState<Empresa | null>(cached);
  const [loading, setLoading] = useState(false);

  const fetchEmpresa = useCallback(async (): Promise<Empresa> => {
    if (cached) return cached;
    setLoading(true);
    try {
      const data = await api.get<Empresa>("/app/empresa");
      cached = data;
      setEmpresa(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const timezone = empresa?.timezone ?? DEFAULT_TZ;

  return { empresa, timezone, fetchEmpresa, loading };
}
