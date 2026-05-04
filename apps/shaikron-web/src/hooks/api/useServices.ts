import { useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { type Service } from "./types";

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);

  const fromApi = (s: any): Service => ({
    id: s.id,
    name: s.nome ?? s.name ?? "",
    duration: s.duracaoMin ?? s.duration ?? 60,
    color: s.color ?? "",
  });

  const toApi = (s: Omit<Service, "id"> | Partial<Service>) => ({
    nome: (s as any).name,
    duracaoMin: (s as any).duration,
  });

  const fetchServices = useCallback(async (): Promise<Service[]> => {
    const data = await api.get<any[]>("/app/servicos");
    const mapped = (data ?? []).map(fromApi);
    setServices(mapped);
    return mapped;
  }, []);

  const getService = useCallback((id: string): Service | undefined => {
    return services.find(s => s.id === id);
  }, [services]);

  const addService = useCallback(async (service: Omit<Service, "id">): Promise<Service> => {
    const created = await api.post<any>("/app/servicos", toApi(service));
    const mapped = fromApi(created);
    setServices(prev => [...prev, mapped]);
    return mapped;
  }, []);

  const updateService = useCallback(async (id: string, updates: Partial<Service>): Promise<void> => {
    const updated = await api.patch<any>(`/app/servicos/${id}`, toApi(updates));
    setServices(prev => prev.map(s => s.id === id ? fromApi(updated) : s));
  }, []);

  const removeService = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/app/servicos/${id}`);
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  return { services, fetchServices, getService, addService, updateService, removeService };
}
