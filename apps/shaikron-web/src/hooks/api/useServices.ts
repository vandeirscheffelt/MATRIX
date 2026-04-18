import { useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { type Service } from "./types";

export function useServices() {
  const [services, setServices] = useState<Service[]>([]);

  const fetchServices = useCallback(async (): Promise<Service[]> => {
    const data = await api.get<Service[]>("/app/servicos");
    setServices(data);
    return data;
  }, []);

  const getService = useCallback((id: string): Service | undefined => {
    return services.find(s => s.id === id);
  }, [services]);

  const addService = useCallback(async (service: Omit<Service, "id">): Promise<Service> => {
    const created = await api.post<Service>("/app/servicos", service);
    setServices(prev => [...prev, created]);
    return created;
  }, []);

  const updateService = useCallback(async (id: string, updates: Partial<Service>): Promise<void> => {
    const updated = await api.patch<Service>(`/app/servicos/${id}`, updates);
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
  }, []);

  const removeService = useCallback(async (id: string): Promise<void> => {
    await api.delete(`/app/servicos/${id}`);
    setServices(prev => prev.filter(s => s.id !== id));
  }, []);

  return { services, fetchServices, getService, addService, updateService, removeService };
}
