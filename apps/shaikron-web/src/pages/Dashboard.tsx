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
import { useAppointments, useConversations } from "@/hooks/api";
import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Dashboard() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { aiActive, toggleAi } = useAiMode();
  const { professionals, getSlotsForDate } = useAppointments();
  const { conversations } = useConversations();

  const today = useMemo(() => new Date(), []);
  const todaySlots = getSlotsForDate(today);

  const bookedSlots = useMemo(
    () => todaySlots.filter((s) => s.status === "booked").sort((a, b) => a.time.localeCompare(b.time)),
    [todaySlots]
  );

  const now = format(new Date(), "HH:mm");
  const upcomingAppointments = useMemo(
    () => bookedSlots.filter((s) => s.time >= now).slice(0, 5),
    [bookedSlots, now]
  );
  const nextAppointment = upcomingAppointments[0];

  const freeSlots = todaySlots.filter((s) => s.status === "free").length;
  const blockedSlots = todaySlots.filter((s) => s.status === "blocked").length;
  const activeConversations = conversations.filter((c) => c.status === "active" || c.status === "pending");
  const pendingConversations = conversations.filter((c) => c.status === "pending");

  // Smart suggestions
  const suggestions = useMemo(() => {
    const items: { message: string; icon: React.ElementType; action: () => void; variant: "default" | "warning" | "info" }[] = [];

    if (nextAppointment) {
      const pro = professionals.find((p) => p.id === nextAppointment.professionalId);
      items.push({
        message: t("dashboard.nextAppt", { client: nextAppointment.client ?? "—", pro: pro?.name ?? "—", time: nextAppointment.time }),
        icon: Clock,
        action: () => navigate("/agenda"),
        variant: "info",
      });
    }

    if (pendingConversations.length > 0) {
      items.push({
        message: t("dashboard.waitingConversations", { count: pendingConversations.length }),
        icon: MessageSquarePlus,
        action: () => navigate("/conversations"),
        variant: "warning",
      });
    }

    if (freeSlots > 6) {
      items.push({
        message: t("dashboard.openSlotsDetected", { count: freeSlots }),
        icon: AlertTriangle,
        action: () => navigate("/agenda"),
        variant: "warning",
      });
    }

    if (blockedSlots > 3) {
      items.push({
        message: t("dashboard.timeBlocksActive", { count: blockedSlots }),
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
  }, [nextAppointment, pendingConversations, freeSlots, blockedSlots, professionals, navigate]);

  const getPro = (id: string) => professionals.find((p) => p.id === id);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Intl.DateTimeFormat(language === "pt-BR" ? "pt-BR" : language === "es" ? "es" : "en-US", { weekday: "long", month: "long", day: "numeric" }).format(today)} — {bookedSlots.length} {t("dashboard.subtitle")}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: CalendarCheck,
            label: t("dashboard.appointments"),
            value: String(bookedSlots.length),
            sub: `${upcomingAppointments.length} ${t("dashboard.upcoming")}`,
            color: "text-primary",
            onClick: () => navigate("/agenda"),
          },
          {
            icon: Users,
            label: t("dashboard.conversations"),
            value: String(activeConversations.length),
            sub: `${pendingConversations.length} ${t("dashboard.pending")}`,
            color: "text-warning",
            onClick: () => navigate("/conversations"),
          },
          {
            icon: Activity,
            label: t("dashboard.openSlots"),
            value: String(freeSlots),
            sub: `${blockedSlots} ${t("dashboard.blocked")}`,
            color: "text-muted-foreground",
            onClick: () => navigate("/agenda"),
          },
          {
            icon: Zap,
            label: t("dashboard.aiStatus"),
            value: aiActive ? t("dashboard.active") : t("dashboard.paused"),
            sub: aiActive ? t("dashboard.autoScheduling") : t("dashboard.manualMode"),
            color: aiActive ? "text-success" : "text-destructive",
            onClick: toggleAi,
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
        {/* Left Column: Smart Panel + Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Smart Panel */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">{t("dashboard.nextActions")}</h2>
              <span className="text-xs text-muted-foreground">{suggestions.length} {t("dashboard.items")}</span>
            </div>
            <div className="divide-y divide-border">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={s.action}
                  className="flex items-center gap-4 px-5 py-3.5 w-full hover:bg-surface-hover/50 transition-colors group text-left"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                      s.variant === "warning" ? "bg-warning/10" : "bg-primary/10"
                    )}
                  >
                    <s.icon
                      className={cn(
                        "h-4 w-4",
                        s.variant === "warning" ? "text-warning" : "text-primary"
                      )}
                    />
                  </div>
                  <p className="text-sm text-foreground flex-1">{s.message}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Upcoming Timeline */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-sm font-semibold text-foreground">{t("dashboard.upcomingTimeline")}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 text-muted-foreground"
                onClick={() => navigate("/agenda")}
              >
                {t("dashboard.viewAgenda")} <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            {upcomingAppointments.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">{t("dashboard.noMoreAppointments")}</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[29px] top-4 bottom-4 w-px bg-border" />
                <div className="divide-y divide-border">
                  {upcomingAppointments.map((apt, i) => {
                    const pro = getPro(apt.professionalId);
                    const isNext = i === 0;
                    return (
                      <div
                        key={`${apt.time}-${apt.professionalId}`}
                        className={cn(
                          "flex items-center gap-4 px-5 py-3.5 transition-colors",
                          isNext && "bg-primary/5"
                        )}
                      >
                        {/* Timeline dot */}
                        <div className="relative z-10 shrink-0">
                          <div
                            className={cn(
                              "h-3 w-3 rounded-full border-2",
                              isNext
                                ? "bg-primary border-primary animate-pulse"
                                : "bg-card border-border"
                            )}
                          />
                        </div>

                        {/* Time */}
                        <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{apt.time}</span>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{apt.client}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {apt.service} · {pro?.name ?? "—"}
                          </p>
                        </div>

                        {/* Badge */}
                        {isNext && (
                          <span className="text-xs font-medium text-primary shrink-0">{t("dashboard.next")}</span>
                        )}
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
              <Button
                variant="glow"
                className="w-full justify-start gap-2.5 text-sm"
                onClick={() => navigate("/agenda")}
              >
                <CalendarPlus className="h-4 w-4" /> {t("dashboard.newAppointment")}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2.5 text-sm"
                onClick={() => navigate("/conversations")}
              >
                <MessageSquarePlus className="h-4 w-4" /> {t("dashboard.openConversations")}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2.5 text-sm"
                onClick={() => navigate("/agenda")}
              >
                <Ban className="h-4 w-4" /> {t("dashboard.blockTime")}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-2.5 text-sm"
                onClick={toggleAi}
              >
                {aiActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {aiActive ? t("dashboard.pauseAi") : t("dashboard.activateAi")}
              </Button>
            </div>
          </div>

          {/* Live Status Panel */}
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
                <StatusBadge status="connected" label={t("status.connected")} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
