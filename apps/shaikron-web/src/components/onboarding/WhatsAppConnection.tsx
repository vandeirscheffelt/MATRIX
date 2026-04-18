import { useState } from "react";
import { MessageSquare, CheckCircle2, Loader2, Smartphone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const QR_PLACEHOLDER = [
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,1,0,0,1,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,1,0,0,1,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0],
  [1,0,1,1,0,1,1,1,0,0,1,0,1,1,0,1,1,0,1,0,1],
  [0,1,0,0,1,0,0,0,1,1,0,1,0,0,1,0,0,1,0,1,0],
  [1,1,0,1,0,1,1,0,0,1,1,1,0,1,1,0,1,0,1,1,0],
  [0,0,1,0,1,0,0,1,1,0,0,0,1,0,0,1,0,1,0,0,1],
  [1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,0,1,1,0,1,0],
  [0,0,0,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1],
  [1,1,1,1,1,1,1,0,0,1,1,1,0,0,1,1,0,1,0,1,0],
  [1,0,0,0,0,0,1,0,1,0,0,0,1,1,0,0,1,0,1,0,1],
  [1,0,1,1,1,0,1,0,0,1,0,1,0,1,1,0,1,1,0,1,0],
  [1,0,1,1,1,0,1,0,1,1,1,0,1,0,0,1,0,0,1,0,1],
  [1,0,1,1,1,0,1,0,0,0,1,1,0,1,1,0,1,0,1,1,0],
  [1,0,0,0,0,0,1,0,1,1,0,0,1,0,0,1,0,1,0,0,1],
  [1,1,1,1,1,1,1,0,0,0,1,0,1,1,0,1,1,0,1,0,1],
];

export default function WhatsAppConnection() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleConnect = () => {
    setStatus("connecting");
    setTimeout(() => {
      setStatus("connected");
      setPhoneNumber("+55 11 9****-1234");
      toast.success(t("wa.connectedSuccess"));
    }, 3000);
  };

  const handleDisconnect = () => {
    setStatus("disconnected");
    setPhoneNumber("");
    toast(t("wa.disconnected"));
  };

  const handleRetry = () => {
    setStatus("disconnected");
    setTimeout(() => handleConnect(), 300);
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

      {status === "disconnected" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-xl border-2 border-dashed border-border p-4 bg-secondary/50">
            <QRCodeGrid />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5 justify-center">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              {t("wa.scanQR")}
            </p>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              {t("wa.scanInstructions")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            className="border-[hsl(142,70%,45%)]/30 text-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,45%)]/10"
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            {t("wa.simulateConnection")}
          </Button>
        </div>
      )}

      {status === "connecting" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="relative">
            <div className="rounded-xl border-2 border-primary/30 p-4 bg-secondary/50 opacity-50">
              <QRCodeGrid />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-card/60 rounded-xl backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <span className="text-xs font-medium text-primary">{t("wa.connectingDots")}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("wa.waitingConfirmation")}</p>
        </div>
      )}

      {status === "connected" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[hsl(142,70%,45%)]/20 bg-[hsl(142,70%,45%)]/5 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[hsl(142,70%,45%)] shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t("wa.connectedTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("wa.number", { phone: phoneNumber })}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRetry} className="flex-1">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t("wa.reconnect")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              {t("wa.disconnect")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const { t } = useLanguage();
  const config = {
    disconnected: { label: t("wa.notConnected"), color: "bg-muted-foreground/40" },
    connecting: { label: t("wa.connecting"), color: "bg-amber-400 animate-pulse" },
    connected: { label: t("wa.connected"), color: "bg-[hsl(142,70%,45%)]" },
  }[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${config.color}`} />
      {config.label}
    </span>
  );
}

function QRCodeGrid() {
  return (
    <div className="inline-grid gap-0" style={{ gridTemplateColumns: `repeat(21, 6px)` }}>
      {QR_PLACEHOLDER.flat().map((cell, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 ${cell ? "bg-foreground" : "bg-transparent"}`}
        />
      ))}
    </div>
  );
}
