import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/apiClient";

export interface DashboardTimeline {
  tipo: "agendamento";
  hora: string;
  cliente: string;
  profissional: string;
  servico: string;
  id: string;
}

export interface DashboardProximaAcao {
  hora: string;
  cliente: string;
  profissional: string;
  servico: string;
  agendamentoId: string;
}

export interface DashboardOverview {
  total_compromissos_hoje: number;
  proximos_compromissos_count: number;
  total_conversas_ativas: number;
  total_conversas_pendentes: number;
  vagas_livres_hoje: number;
  vagas_bloqueadas_hoje: number;
  ia_status: "ativa" | "pausada";
  whatsapp_status: string;
  sistema_status: string;
  proxima_acao: DashboardProximaAcao[];
  timeline: DashboardTimeline[];
}

export function useDashboard() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await api.get<DashboardOverview>("/app/dashboard/overview");
      setData(overview);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
