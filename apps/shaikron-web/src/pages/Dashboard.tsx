import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck, Users, Zap, MessageSquarePlus, CalendarPlus, Ban,
  Clock, ChevronRight, AlertTriangle, Wifi, Brain, ArrowRight,
  Pause, Play, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useAiMode } from "@/contexts/AiModeContext";
import { useDashboard } from "@/hooks/api";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { aiActive, toggleAi } = useAiMode();
  const { data, loading, refresh } = useDashboard();

  const today = useMemo(() => new Date(), []);
  const now = new Date().toTimeString().slice(0, 5);

  const handleToggleAi = async () => {
    await toggleAi();
    refresh();
  };

  const suggestions = useMemo(() => {
    if (!data) return [];
    const items: { message: string; icon: React.ElementType; action: () => void; variant: "default" | "warning" | "info" }[] = [];

    if (data.proxima_acao.length > 0) {
      const next = data.proxima_acao[0];
      items.push({
        message: t("dashboard.nextAppt", { client: next.cliente, pro: next.profissional, time: next.hora }),
        icon: Clock,
        action: () => navigate("/agenda"),
        variant: "info",
      });
    }

    if (data.total_conversas_pendentes > 0) {
      items.push({
        message: t("dashboard.waitingConversations", { count: data.total_conversas_pendentes }),
        icon: MessageSquarePlus,
        action: () => navigate("/conversations"),
        variant: "warning",
      });
    }

    if (data.vagas_livres_hoje > 6) {
      items.push({
        message: t("dashboard.openSlotsDetected", { count: data.vagas_livres_hoje }),
        icon: AlertTriangle,
        action: () => navigate("/agenda"),
        variant: "warning",
      });
    }

    if (data.vagas_bloqueadas_hoje > 3) {
      items.push({
        message: t("dashboard.timeBlocksActive", { count: data.vagas_bloqueadas_hoje }),
        icon: Ban,
        action: () => navigate("/agenda"),
        variant: "default",
      });
    }

    if (items.length === 0) {
      items.push({
        message: t("dashboard.allClear"),
        icon: CalendarCheck,
        action: () => {},
        variant: "default",
      });
    }

    return items;
  }, [data, navigate, t]);

  const waStatus = useMemo(() => {
    const s = data?.whatsapp_status ?? "";
    if (s === "open") return { status: "connected" as const, label: t("status.connected") };
    if (s === "connecting") return { status: "connecting" as const, label: "Conectando..." };
    return { status: "disconnected" as const, label: "Desconectado" };
  }, [data?.whatsapp_status, t]);

  const firstNextIdx = useMemo(
    () => data?.timeline.findIndex(a => a.hora >= now) ?? -1,
    [data?.timeline, now]
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Intl.DateTimeFormat(
            language === "pt-BR" ? "pt-BR" : language === "es" ? "es" : "en-US",
            { weekday: "long", month: "long", day: "numeric" }
          ).format(today)} — {loading ? "…" : data?.total_compromissos_hoje ?? 0} {t("dashboard.subtitle")}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: CalendarCheck,
            label: t("dashboard.appointments"),
            value: loading ? "—" : String(data?.total_compromissos_hoje ?? 0),
            sub: `${loading ? "—" : data?.proximos_compromissos_count ?? 0} ${t("dashboard.upcoming")}`,
            color: "text-primary",
            onClick: () => navigate("/agenda"),
          },
          {
            icon: Users,
            label: t("dashboard.conversations"),
            value: loading ? "—" : String(data?.total_conversas_ativas ?? 0),
            sub: `${loading ? "—" : data?.total_conversas_pendentes ?? 0} ${t("dashboard.pending")}`,
            color: "text-warning",
            onClick: () => navigate("/conversations"),
          },
          {
            icon: Activity,
            label: t("dashboard.openSlots"),
            value: loading ? "—" : String(data?.vagas_livres_hoje ?? 0),
            sub: `${loading ? "—" : data?.vagas_bloqueadas_hoje ?? 0} ${t("dashboard.blocked")}`,
            color: "text-muted-foreground",
            onClick: () => navigate("/agenda"),
          },
          {
            icon: Zap,
            label: t("dashboard.aiStatus"),
            value: aiActive ? t("dashboard.active") : t("dashboard.paused"),
            sub: aiActive ? t("dashboard.autoScheduling") : t("dashboard.manualMode"),
            color: aiActive ? "text-success" : "text-destructive",
            onClick: handleToggleAi,
          },
        ].map((card) => (
          <button
            key={card.label}
            onClick={card.onClick}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-all duration-300 group text-left w-full"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                <p className={cn("text-xl font-bold mt-1.5", card.color)}>{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
              </div>
              <div className="rounded-lg bg-secondary p-2 group-hover:bg-primary/10 transition-colors shrink-0">
                <card.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Smart Panel */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">{t("dashboard.nextActions")}</h2>
              <span className="text-xs text-muted-foreground">{suggestions.length} {t("dashboard.items")}</span>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
              ) : suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={s.action}
                  className="flex items-center gap-4 px-5 py-3.5 w-full hover:bg-surface-hover/50 transition-colors group text-left"
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                    s.variant === "warning" ? "bg-warning/10" : "bg-primary/10"
                  )}>
                    <s.icon className={cn("h-4 w-4", s.variant === "warning" ? "text-warning" : "text-primary")} />
                  </div>
                  <p className="text-sm text-foreground flex-1">{s.message}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">{t("dashboard.upcomingTimeline")}</h2>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" onClick={() => navigate("/agenda")}>
                {t("dashboard.viewAgenda")} <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            {loading || !data || data.timeline.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {loading ? "Carregando..." : t("dashboard.noMoreAppointments")}
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[29px] top-4 bottom-4 w-px bg-border" />
                <div className="divide-y divide-border">
                  {data.timeline.slice(0, 8).map((apt, i) => {
                    const isPast = apt.hora < now;
                    const isNext = i === firstNextIdx;
                    return (
                      <div
                        key={apt.id}
                        className={cn(
                          "flex items-center gap-4 px-5 py-3.5 transition-colors",
                          isNext && "bg-primary/5",
                          isPast && "opacity-50"
                        )}
                      >
                        <div className="relative z-10 shrink-0">
                          <div className={cn(
                            "h-3 w-3 rounded-full border-2",
                            isNext ? "bg-primary border-primary animate-pulse"
                            : isPast ? "bg-muted border-muted-foreground"
                            : "bg-card border-border"
                          )} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{apt.hora}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium truncate", isPast ? "text-muted-foreground" : "text-foreground")}>
                            {apt.cliente}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {apt.servico ? `${apt.servico} · ` : ""}{apt.profissional}
                          </p>
                        </div>
                        {isNext && <span className="text-xs font-medium text-primary shrink-0">{t("dashboard.next")}</span>}
                        {isPast && <span className="text-xs text-muted-foreground shrink-0">{t("dashboard.done") ?? "✓"}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.quickActions")}</h2>
            <div className="space-y-2.5">
              <Button variant="glow" className="w-full justify-start gap-2.5 text-sm" onClick={() => navigate("/agenda")}>
                <CalendarPlus className="h-4 w-4" /> {t("dashboard.newAppointment")}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2.5 text-sm" onClick={() => navigate("/conversations")}>
                <MessageSquarePlus className="h-4 w-4" /> {t("dashboard.openConversations")}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2.5 text-sm" onClick={() => navigate("/agenda")}>
                <Ban className="h-4 w-4" /> {t("dashboard.blockTime")}
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2.5 text-sm" onClick={handleToggleAi}>
                {aiActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {aiActive ? t("dashboard.pauseAi") : t("dashboard.activateAi")}
              </Button>
            </div>
          </div>

          {/* Live Status */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">{t("dashboard.systemStatus")}</h2>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t("dashboard.aiMode")}</span>
                </div>
                <StatusBadge status={aiActive ? "active" : "paused"} label={aiActive ? t("dashboard.active") : t("dashboard.paused")} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t("dashboard.system")}</span>
                </div>
                <StatusBadge status="operational" label={t("dashboard.running")} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">WhatsApp</span>
                </div>
                <StatusBadge status={waStatus.status} label={waStatus.label} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
