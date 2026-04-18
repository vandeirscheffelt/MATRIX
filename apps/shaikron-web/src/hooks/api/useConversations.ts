import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────
export type ConversationStatus = "active" | "pending" | "paused";
export type MessageSender = "client" | "ai" | "human" | "system";
export type DetectedIntent = "booking" | "question" | "reschedule" | "info" | "confirmation";

export interface Message {
  id: string;
  sender: MessageSender;
  text: string;
  time: string;
  isManagerAction?: boolean;
}

export interface ConversationInsight {
  text: string;
  cta?: { label: string; action: "schedule" | "followup" | "catalog" };
}

export interface ConversationDetail {
  id: string;
  name: string;
  lastMessage: string;
  status: ConversationStatus;
  time: string;
  aiHandling: boolean;
  phone: string;
  messages: Message[];
  insights: ConversationInsight[];
  intent: DetectedIntent;
  suggestions: string[];
  pausedByKeyword?: boolean;
  autoResumeAt?: number | null;
  lastActivityAt?: number;
  archived?: boolean;
}

// ─── API response → local type ────────────────────────────────────────
function mapApiConversation(c: any): ConversationDetail {
  return {
    id: c.id,
    name: c.lead?.nome ?? c.lead?.telefone ?? "Desconhecido",
    phone: c.lead?.telefone ?? "",
    lastMessage: c.ultimaMensagem ?? "",
    status: c.statusIa === "PAUSADO" ? "paused" : c.arquivada ? "active" : "active",
    time: c.ultimaAtividade ? new Date(c.ultimaAtividade).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
    aiHandling: c.statusIa === "ATIVO",
    intent: "info",
    suggestions: [],
    insights: [],
    messages: (c.mensagens ?? []).map((m: any) => ({
      id: m.id,
      sender: m.origem === "LEAD" ? "client" : m.origem === "BOT" ? "ai" : "human",
      text: m.conteudo,
      time: new Date(m.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    })),
    archived: c.arquivada ?? false,
    lastActivityAt: c.ultimaAtividade ? new Date(c.ultimaAtividade).getTime() : Date.now(),
  };
}

const STATUS_PRIORITY: Record<ConversationStatus, number> = { pending: 0, active: 1, paused: 2 };
function sortConversations(list: ConversationDetail[]) {
  return [...list].sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
}

// ─── Hook ────────────────────────────────────────────────────────────
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoResumeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    return () => { Object.values(autoResumeTimers.current).forEach(clearTimeout); };
  }, []);

  const fetchConversations = useCallback(async (): Promise<ConversationDetail[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<any[]>("/app/conversas");
      const mapped = sortConversations(data.map(mapApiConversation));
      setConversations(mapped);
      return mapped;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleAiHandling = useCallback(async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    try {
      if (conv.aiHandling) {
        await api.post(`/app/conversas/${id}/pause`);
        toast.success("IA pausada. Você está respondendo.");
      } else {
        await api.post(`/app/conversas/${id}/resume`);
        toast.success("IA retomou o controle.");
      }
      setConversations(prev => sortConversations(prev.map(c =>
        c.id === id ? { ...c, aiHandling: !c.aiHandling, status: !c.aiHandling ? "active" : "paused" } : c
      )));
    } catch (e: any) {
      toast.error("Erro ao alternar IA: " + e.message);
    }
  }, [conversations]);

  const sendMessage = useCallback(async (id: string, text: string) => {
    try {
      await api.post(`/app/conversas/${id}/reply`, { mensagem: text });
      const newMsg: Message = {
        id: `m-${Date.now()}`,
        sender: "human",
        text,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setConversations(prev => sortConversations(prev.map(c =>
        c.id === id ? { ...c, messages: [...c.messages, newMsg], lastMessage: text, time: "agora" } : c
      )));
      toast.success("Mensagem enviada");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + e.message);
    }
  }, []);

  const markResolved = useCallback(async (id: string) => {
    try {
      await api.post(`/app/conversas/${id}/resolve`);
      setConversations(prev => sortConversations(prev.map(c =>
        c.id === id ? { ...c, archived: true } : c
      )));
      toast.success("Conversa resolvida");
    } catch (e: any) {
      toast.error(e.message);
    }
  }, []);

  const archiveConversation = useCallback(async (id: string) => {
    try {
      await api.post(`/app/conversas/${id}/archive`);
      setConversations(prev => sortConversations(prev.map(c =>
        c.id === id ? { ...c, archived: true } : c
      )));
      toast.success("Conversa arquivada");
    } catch (e: any) {
      toast.error(e.message);
    }
  }, []);

  const unarchiveConversation = useCallback(async (id: string) => {
    setConversations(prev => sortConversations(prev.map(c =>
      c.id === id ? { ...c, archived: false } : c
    )));
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    toast.success("Conversa removida");
  }, []);

  // kept for interface compatibility — not used in real mode
  const simulateClientMessage = useCallback(async (_id: string, _text: string) => {}, []);
  const executeManagerAction = useCallback(async (_id: string, _text: string) => {}, []);
  const cancelAutoResume = useCallback((_id: string) => {}, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    conversations,
    fetchConversations,
    toggleAiHandling,
    sendMessage,
    simulateClientMessage,
    executeManagerAction,
    markResolved,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
    cancelAutoResume,
    loading,
    error,
    clearError,
  };
}
