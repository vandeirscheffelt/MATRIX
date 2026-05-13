import { useState, useEffect, useCallback } from "react";
import { MessageSquare, CheckCircle2, Loader2, Smartphone, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/apiClient";

type ConnectionStatus = "disconnected" | "loading" | "qr" | "connecting" | "connected" | "error";

interface InstanciaData {
  status: string;
  qrCodeBase64?: string;
  qrExpiresAt?: string;
}

export default function WhatsAppConnection() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [polling, setPolling] = useState(false);

  const loadInstancia = useCallback(async () => {
    try {
      const data = await api.get<InstanciaData>("/app/instancia");
      // Se está conectando mas sem QR, busca QR novo automaticamente
      if (data.status === "CONNECTING" && !data.qrCodeBase64) {
        try {
          const qrData = await api.get<{ qrCodeBase64: string; qrExpiresAt: string }>("/app/instancia/qr");
          if (qrData.qrCodeBase64) {
            setQrCode(qrData.qrCodeBase64);
            setStatus("qr");
            setPolling(true);
            return;
          }
        } catch {
          // ignora e cai no applyStatus normal
        }
      }
      applyStatus(data);
    } catch (err: any) {
      if (err?.message?.includes("404")) {
        setStatus("disconnected");
      } else {
        setStatus("error");
        setErrorMsg("Erro ao carregar status da instância.");
      }
    }
  }, []);

  function applyStatus(data: InstanciaData) {
    if (data.status === "CONNECTED") {
      setStatus("connected");
      setPolling(false);
    } else if (data.status === "CONNECTING" && data.qrCodeBase64) {
      setQrCode(data.qrCodeBase64);
      setStatus("qr");
    } else if (data.status === "CONNECTING") {
      setStatus("connecting");
    } else {
      setStatus("disconnected");
    }
  }

  // Polling enquanto aguarda conexão
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.get<InstanciaData>("/app/instancia");
        applyStatus(data);
        if (data.status === "CONNECTED") clearInterval(interval);
      } catch {
        clearInterval(interval);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [polling]);

  useEffect(() => {
    loadInstancia();
  }, [loadInstancia]);

  const handleCriarInstancia = async () => {
    setStatus("connecting");
    try {
      const data = await api.post<InstanciaData>("/app/instancia", {});
      if (data.qrCodeBase64) {
        setQrCode(data.qrCodeBase64);
        setStatus("qr");
        setPolling(true);
      } else {
        setStatus("connecting");
        setPolling(true);
      }
    } catch (err: any) {
      // Se já existe instância, busca QR atualizado
      if (err?.message?.includes("409")) {
        handleAtualizarQR();
      } else {
        setStatus("error");
        setErrorMsg(err?.message ?? "Erro ao criar instância.");
      }
    }
  };

  const handleAtualizarQR = async () => {
    setStatus("connecting");
    try {
      const data = await api.get<{ qrCodeBase64: string; qrExpiresAt: string }>("/app/instancia/qr");
      if (data.qrCodeBase64) {
        setQrCode(data.qrCodeBase64);
        setStatus("qr");
        setPolling(true);
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMsg("Erro ao atualizar QR code.");
    }
  };

  const handleDesconectar = async () => {
    try {
      await api.delete("/app/instancia");
      setStatus("disconnected");
      setQrCode(null);
      setPhoneNumber("");
      setPolling(false);
      toast.success("WhatsApp desconectado.");
    } catch {
      toast.error("Erro ao desconectar.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[hsl(142,70%,45%)]/15 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-[hsl(142,70%,45%)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("wa.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("wa.subtitle")}</p>
          </div>
        </div>
        <StatusIndicator status={status} />
      </div>

      {/* Carregando */}
      {status === "loading" && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Desconectado */}
      {status === "disconnected" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Conecte seu número de WhatsApp para ativar o assistente de IA.
          </p>
          <Button
            size="sm"
            onClick={handleCriarInstancia}
            className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white"
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Gerar QR Code
          </Button>
        </div>
      )}

      {/* Aguardando QR / gerando */}
      {status === "connecting" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">{t("wa.connectingDots")}</p>
        </div>
      )}

      {/* QR code real */}
      {status === "qr" && qrCode && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-xl border-2 border-dashed border-border p-3 bg-white">
            <img
              src={qrCode}
              alt="QR Code WhatsApp"
              className="w-48 h-48 object-contain"
            />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5 justify-center">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              {t("wa.scanQR")}
            </p>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              {t("wa.scanInstructions")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleAtualizarQR}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Atualizar QR Code
          </Button>
        </div>
      )}

      {/* Conectado */}
      {status === "connected" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[hsl(142,70%,45%)]/20 bg-[hsl(142,70%,45%)]/5 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[hsl(142,70%,45%)] shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t("wa.connectedTitle")}</p>
              {phoneNumber && (
                <p className="text-xs text-muted-foreground">{t("wa.number", { phone: phoneNumber })}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAtualizarQR} className="flex-1">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t("wa.reconnect")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDesconectar}
              className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              {t("wa.disconnect")}
            </Button>
          </div>
        </div>
      )}

      {/* Erro */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <XCircle className="h-4 w-4" />
            {errorMsg}
          </div>
          <Button variant="outline" size="sm" onClick={loadInstancia}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const { t } = useLanguage();
  const config: Record<ConnectionStatus, { label: string; color: string }> = {
    loading:      { label: "Carregando...",   color: "bg-muted-foreground/40 animate-pulse" },
    disconnected: { label: t("wa.notConnected"), color: "bg-muted-foreground/40" },
    connecting:   { label: t("wa.connecting"),   color: "bg-amber-400 animate-pulse" },
    qr:           { label: "Aguardando scan",    color: "bg-amber-400 animate-pulse" },
    connected:    { label: t("wa.connected"),    color: "bg-[hsl(142,70%,45%)]" },
    error:        { label: "Erro",               color: "bg-destructive" },
  };
  const { label, color } = config[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
