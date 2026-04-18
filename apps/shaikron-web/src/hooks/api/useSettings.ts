import { useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { type AppSettings } from "./types";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async (): Promise<AppSettings> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AppSettings>("/app/config");
      setSettings(data);
      return data;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<AppSettings>("/app/config", updates);
      setSettings(prev => prev ? { ...prev, ...updated } : updated);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { settings, fetchSettings, updateSettings, loading, error, clearError };
}
