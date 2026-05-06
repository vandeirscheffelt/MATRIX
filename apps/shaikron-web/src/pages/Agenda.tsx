import { useState, useMemo, useCallback, useEffect } from "react";
import { useServices } from "@/hooks/api/useServices";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Clock, User, CalendarDays, Ban, Plus, Lock, Unlock, ArrowRightLeft, X, Users, Sparkles, Zap, CheckCircle2, Loader2, AlertCircle, AlertTriangle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, addDays, subDays, isToday, isTomorrow, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAiMode } from "@/contexts/AiModeContext";
import { useLanguage } from "@/contexts/LanguageContext";
const getLocale = (lang: string) => lang === "pt-BR" ? "pt-BR" : lang === "es" ? "es" : "en-US";
import { useAppointments, HOURS, type TimeSlot, type SlotStatus, type AiSuggestion } from "@/hooks/api";

// Status labels are resolved via t() at render time
const statusBadgeMap: Record<SlotStatus, "active" | "pending" | "paused"> = {
  booked: "active",
  free: "pending",
  blocked: "paused",
};

type ViewMode = "day" | "week";
type ZoomLevel = 15 | 30 | 60;
type ModalMode = "default" | "create-manual" | "create-ai" | "create-pick" | "confirm" | "auto-input" | "auto-result";

const timeToMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const minToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default function Agenda() {
  const isMobile = useIsMobile();
  const { t, language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [zoom, setZoom] = useState<ZoomLevel>(30);
  const [filterPro, setFilterPro] = useState<string>("all");
  const [showProColumn, setShowProColumn] = useState(!isMobile);
  const [modalSlot, setModalSlot] = useState<{ slot: TimeSlot; date: Date } | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("default");
  const [newClient, setNewClient] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newService, setNewService] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const { services, fetchServices } = useServices();
  useEffect(() => { fetchServices().catch(() => null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [pickedPro, setPickedPro] = useState<string>("");
  const [pickedTime, setPickedTime] = useState<string>("");
  const [originalPickedTime, setOriginalPickedTime] = useState<string>("");
  const [confirmSource, setConfirmSource] = useState<"ai" | "manual">("manual");
  const [actionLoading, setActionLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const { toast } = useToast();
  const { aiActive } = useAiMode();

  const api = useAppointments();
  const { professionals, getProfessional, getSlotsForDate, loading: apiLoading, error: apiError, clearError } = api;

  // Services available for the currently selected professional (filtered by their linked services)
  // Falls back to all services when professional has no restrictions configured
  const proServices = useMemo(() => {
    const pro = professionals.find(p => p.id === pickedPro);
    if (!pro || pro.services.length === 0) return services;
    return services.filter(s => pro.services.includes(s.id));
  }, [pickedPro, professionals, services]);

  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const daySlots = getSlotsForDate(selectedDate);

  // Grid is always 15-min granularity; zoom only controls row height
  const fineTimeSlots = useMemo(() => {
    const result: string[] = [];
    for (let min = 6 * 60; min < 23 * 60; min += 15) result.push(minToTime(min));
    return result;
  }, []);

  const ROW_H = zoom === 15 ? 20 : zoom === 30 ? 32 : 48;

  const filteredPros = filterPro === "all" ? professionals : professionals.filter(p => p.id === filterPro);

  // Fast lookup: "time__proId" → status (only slots returned by API = within working hours)
  const slotStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    daySlots.forEach(s => map.set(`${s.time}__${s.professionalId}`, s.status));
    return map;
  }, [daySlots]);

  const openSlot = useCallback(async (slot: TimeSlot, date: Date) => {
    setModalSlot({ slot, date });
    setModalMode("default");
    setNewClient("");
    setNewPhone("");
    setNewService("");
    setSelectedServiceId("");
    setPickedPro(slot.professionalId);
    setPickedTime(slot.time);
    setAiSuggestions([]);
    clearError();
  }, [clearError]);

  const closeModal = useCallback(() => {
    setModalSlot(null);
    clearError();
  }, [clearError]);

  // Refresh modal slot from API state
  const currentModalSlot = modalSlot
    ? { ...modalSlot, slot: getSlotsForDate(modalSlot.date).find(s => s.time === modalSlot.slot.time && s.professionalId === modalSlot.slot.professionalId) ?? modalSlot.slot }
    : null;

  const pro = currentModalSlot ? getProfessional(currentModalSlot.slot.professionalId) : null;

  // Load AI suggestions when entering AI mode
  const loadSuggestions = useCallback(async (date: Date) => {
    try {
      const suggestions = await api.getAiSuggestions(date);
      setAiSuggestions(suggestions);
    } catch {
      // error is handled by hook
    }
  }, [api]);

  // ── Actions with loading states ──
  const handleAutoBook = useCallback(async () => {
    if (!newClient.trim() || !currentModalSlot) return;
    setActionLoading(true);
    const requestedTime = pickedTime;
    setOriginalPickedTime(requestedTime);
    try {
      const selectedSvc = services.find(s => s.id === selectedServiceId);
      const result = await api.autoScheduleAppointment({
        date: currentModalSlot.date,
        client: newClient.trim(),
        phone: newPhone.trim() || undefined,
        service: newService.trim() || t("agenda.appointment"),
        servicoId: selectedServiceId || undefined,
        durationMin: selectedSvc?.duration ?? 60,
        preferredTime: requestedTime,
        preferredProfessionalId: pickedPro,
      });
      setPickedPro(result.professionalId);
      setPickedTime(result.time);
      setModalMode("auto-result");
    } catch (e: any) {
      toast({ title: t("agenda.schedulingFailed"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [newClient, newService, currentModalSlot, api, toast]);

  const handleManualBook = useCallback(async () => {
    if (!newClient.trim() || !currentModalSlot) return;
    setActionLoading(true);
    try {
      const selectedSvc = services.find(s => s.id === selectedServiceId);
      await api.createAppointment({
        date: currentModalSlot.date,
        time: pickedTime,
        professionalId: pickedPro,
        client: newClient.trim(),
        phone: newPhone.trim() || undefined,
        service: newService.trim() || t("agenda.appointment"),
        servicoId: selectedServiceId || undefined,
        durationMin: selectedSvc?.duration ?? 60,
      });
      toast({
        title: t("agenda.appointmentSuccess"),
        description: `${getProfessional(pickedPro).name} · ${pickedTime} · ${format(currentModalSlot.date, "MMM d")}`,
      });
      closeModal();
    } catch (e: any) {
      toast({ title: t("agenda.bookingFailed"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [newClient, newService, currentModalSlot, pickedPro, pickedTime, api, toast, closeModal]);

  const handleCancel = useCallback(async (date: Date, time: string, proId: string, appointmentId?: string) => {
    setActionLoading(true);
    try {
      await api.cancelAppointment(date, time, proId, appointmentId);
      toast({ title: t("agenda.appointmentCancelled"), description: `${getProfessional(proId).name} · ${time} · ${format(date, "MMM d")}` });
      closeModal();
    } catch (e: any) {
      toast({ title: t("agenda.cancelFailed"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [api, toast, closeModal]);

  const handleBlock = useCallback(async (date: Date, time: string, proId: string) => {
    setActionLoading(true);
    try {
      await api.blockSlot(date, time, proId);
      toast({ title: t("agenda.timeBlockedSuccess"), description: `${getProfessional(proId).name} · ${time} · ${format(date, "MMM d")}` });
      closeModal();
    } catch (e: any) {
      toast({ title: t("agenda.blockFailed"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [api, toast, closeModal]);

  const handleUnblock = useCallback(async (date: Date, time: string, proId: string, bloqueioId?: string) => {
    setActionLoading(true);
    try {
      await api.unblockSlot(date, time, proId, bloqueioId);
      toast({ title: t("agenda.timeUnblocked"), description: `${getProfessional(proId).name} · ${time} · ${format(date, "MMM d")}` });
      closeModal();
    } catch (e: any) {
      toast({ title: t("agenda.unblockFailed"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [api, toast, closeModal]);

  const handleRescheduleFromAutoResult = useCallback(async () => {
    if (!currentModalSlot) return;
    setActionLoading(true);
    try {
      await api.cancelAppointment(currentModalSlot.date, pickedTime, pickedPro);
      setModalMode("create-manual");
    } catch (e: any) {
      toast({ title: t("admin.error"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [currentModalSlot, pickedTime, pickedPro, api, toast]);

  const handleCancelFromAutoResult = useCallback(async () => {
    if (!currentModalSlot) return;
    setActionLoading(true);
    try {
      await api.cancelAppointment(currentModalSlot.date, pickedTime, pickedPro);
      toast({ title: t("agenda.appointmentCancelled"), description: `${getProfessional(pickedPro).name} · ${pickedTime}` });
      closeModal();
    } catch (e: any) {
      toast({ title: t("agenda.cancelFailed"), description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  }, [currentModalSlot, pickedTime, pickedPro, api, toast, closeModal]);

  const goToConfirm = (proId: string, time: string, source: "ai" | "manual") => {
    setPickedPro(proId);
    setPickedTime(time);
    setConfirmSource(source);
    setModalMode("confirm");
  };

  const bookWithSuggestion = (suggestion: AiSuggestion) => {
    if (!newClient.trim() || !currentModalSlot) return;
    goToConfirm(suggestion.professionalId, suggestion.time, "ai");
  };

  const confirmManual = () => {
    if (!newClient.trim() || !currentModalSlot) return;
    const targetSlots = getSlotsForDate(currentModalSlot.date);
    const target = targetSlots.find(s => s.time === pickedTime && s.professionalId === pickedPro);
    if (target && target.status !== "free") {
      toast({ title: t("agenda.conflictDetected"), description: t("agenda.notAvailableAt", { name: getProfessional(pickedPro).name, time: pickedTime }), variant: "destructive" });
      return;
    }
    goToConfirm(pickedPro, pickedTime, "manual");
  };

  const isActionBusy = actionLoading || apiLoading;

  // ── Loading overlay component ──
  const LoadingOverlay = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("agenda.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("agenda.subtitle")}</p>
      </div>

      {/* Error banner */}
      {apiError && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive flex-1">{apiError}</p>
          <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={clearError}>{t("agenda.dismiss")}</Button>
        </div>
      )}

      {/* Navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => subDays(d, viewMode === "week" ? 7 : 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[180px] text-center">
            {viewMode === "day"
              ? new Intl.DateTimeFormat(getLocale(language), { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(selectedDate)
              : `${new Intl.DateTimeFormat(getLocale(language), { month: "short", day: "numeric" }).format(weekDays[0])} – ${new Intl.DateTimeFormat(getLocale(language), { month: "short", day: "numeric", year: "numeric" }).format(weekDays[6])}`}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => addDays(d, viewMode === "week" ? 7 : 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowProColumn(v => !v)}
            title={showProColumn ? "Recolher profissionais" : "Expandir profissionais"}
          >
            {showProColumn ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <Button variant={isToday(selectedDate) ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setSelectedDate(new Date())}>{t("agenda.today")}</Button>
          <Button variant={isTomorrow(selectedDate) ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setSelectedDate(addDays(new Date(), 1))}>{t("agenda.tomorrow")}</Button>
          <div className="ml-2 flex rounded-lg border border-border overflow-hidden">
            <button className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} onClick={() => setViewMode("day")}>{t("agenda.day")}</button>
            <button className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} onClick={() => setViewMode("week")}>{t("agenda.week")}</button>
          </div>
          {viewMode === "day" && (
            <div className="flex rounded-lg border border-border overflow-hidden">
              {([15, 30, 60] as ZoomLevel[]).map(z => (
                <button key={z} className={cn("px-2.5 py-1.5 text-xs font-medium transition-colors", zoom === z ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} onClick={() => setZoom(z)}>{z}m</button>
              ))}
            </div>
          )}
          <Select value={filterPro} onValueChange={setFilterPro}>
            <SelectTrigger className={cn("h-8 text-xs border-border bg-card", isMobile ? "w-[120px]" : "w-[160px]")}>
              <Users className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("agenda.allProfessionals")}</SelectItem>
              {professionals.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${p.color})` }} />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Day View — grid com profissionais nas colunas e horários nas linhas */}
      {viewMode === "day" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header fixo */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-card">
            <h2 className="text-sm font-semibold text-foreground">{t("agenda.dailySchedule")}</h2>
            <div className="flex items-center gap-2">
              {aiActive && <span className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary"><Sparkles className="h-3 w-3" /> {t("ai.active")}</span>}
              {isToday(selectedDate) && <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20">{t("agenda.today")}</span>}
            </div>
          </div>

          {/* Área scrollável */}
          <div className="overflow-auto max-h-[70vh]">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `64px repeat(${filteredPros.length}, minmax(120px, 1fr))`,
                gridTemplateRows: `48px repeat(${fineTimeSlots.length}, ${ROW_H}px)`,
                minWidth: filteredPros.length > 0 ? `${64 + filteredPros.length * 120}px` : undefined,
              }}
            >
              {/* Canto superior esquerdo */}
              <div className="sticky top-0 left-0 z-30 bg-card border-b border-r border-border" />

              {/* Cabeçalho dos profissionais */}
              {filteredPros.map((p, pIdx) => (
                <div
                  key={p.id}
                  className="sticky top-0 z-20 bg-card border-b border-r border-border flex flex-col items-center justify-center gap-0.5 px-2"
                  style={{ gridColumn: pIdx + 2, gridRow: 1 }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: `hsl(${p.color})` }} />
                    <span className="text-xs font-semibold text-foreground truncate">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/70">
                    {p.schedule?.workingHoursStart && p.schedule?.workingHoursEnd
                      ? `${p.schedule.workingHoursStart}–${p.schedule.workingHoursEnd}`
                      : "–"}
                  </span>
                </div>
              ))}

              {/* Células de fundo + labels de hora */}
              {fineTimeSlots.map((time, tIdx) => {
                const isHour = time.endsWith(":00");
                const isHalf = time.endsWith(":30");
                const rowIdx = tIdx + 2;
                return [
                  // Label da hora (sticky left)
                  <div
                    key={`time-${time}`}
                    className="sticky left-0 z-10 bg-card border-r border-border flex items-start justify-end pr-2 pt-0.5"
                    style={{ gridColumn: 1, gridRow: rowIdx }}
                  >
                    {isHour && <span className="text-[10px] font-mono text-muted-foreground">{time}</span>}
                    {isHalf && <span className="text-[9px] font-mono text-muted-foreground/40">{time}</span>}
                  </div>,
                  // Células de fundo por profissional
                  ...filteredPros.map((p, pIdx) => {
                    const key = `${time}__${p.id}`;
                    const status = slotStatusMap.get(key);
                    const inHours = status !== undefined; // slot exists in API = within working hours
                    const isFreeSlot = status === "free";
                    const freeSlot: TimeSlot = { time, professionalId: p.id, status: "free" };
                    return (
                      <div
                        key={`bg-${time}-${p.id}`}
                        className={cn(
                          "border-r border-border/40 transition-colors relative overflow-hidden",
                          isHour ? "border-t border-t-border/60" : isHalf ? "border-t border-t-border/30" : "border-t border-t-border/10",
                          inHours && isFreeSlot && "cursor-pointer hover:bg-primary/5",
                          !inHours && "bg-muted/10 cursor-default",
                        )}
                        style={{ gridColumn: pIdx + 2, gridRow: rowIdx }}
                        onClick={() => inHours && isFreeSlot && openSlot(freeSlot, selectedDate)}
                      >
                        {isFreeSlot && ROW_H >= 32 && (
                          <span className="absolute inset-0 flex items-center justify-center text-[9px] text-muted-foreground/30 select-none pointer-events-none">
                            disponível
                          </span>
                        )}
                      </div>
                    );
                  }),
                ];
              })}

              {/* Blocos de agendamento (sobrepostos na grade) */}
              {filteredPros.map((p, pIdx) => {
                const proSlots = daySlots.filter(s => s.professionalId === p.id && s.status !== "free");
                return proSlots.map(slot => {
                  const startRowIdx = fineTimeSlots.findIndex(t => t === slot.time);
                  if (startRowIdx === -1) {
                    // Procura a linha mais próxima (arredonda para baixo)
                    const slotMin = timeToMin(slot.time);
                    const idx = fineTimeSlots.findIndex((t, i) => {
                      const next = fineTimeSlots[i + 1];
                      return timeToMin(t) <= slotMin && (!next || timeToMin(next) > slotMin);
                    });
                    if (idx === -1) return null;
                  }
                  const rowStart = (startRowIdx === -1 ? fineTimeSlots.findIndex((t, i) => { const next = fineTimeSlots[i + 1]; return timeToMin(t) <= timeToMin(slot.time) && (!next || timeToMin(next) > timeToMin(slot.time)); }) : startRowIdx) + 2;
                  const duration = slot.duration ?? 15;
                  const spanRows = Math.max(1, Math.round(duration / 15));
                  const isBooked = slot.status === "booked";
                  const isBlocked = slot.status === "blocked";

                  return (
                    <div
                      key={`${slot.time}-${p.id}`}
                      className={cn(
                        "mx-0.5 my-0.5 rounded-md cursor-pointer overflow-hidden z-10 transition-opacity hover:opacity-90",
                        isBooked && "bg-primary/20 border border-primary/40 p-1.5",
                        isBlocked && "bg-muted/60 border border-dashed border-border/60 flex items-center px-1.5",
                      )}
                      style={{
                        gridColumn: pIdx + 2,
                        gridRow: `${rowStart} / span ${spanRows}`,
                      }}
                      onClick={() => openSlot(slot, selectedDate)}
                    >
                      {isBooked && (
                        <>
                          <p className="text-[11px] font-semibold text-primary leading-tight truncate">{slot.client}</p>
                          {spanRows > 1 && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{slot.service}</p>}
                          {spanRows > 2 && <p className="text-[10px] text-muted-foreground/60">{slot.time} · {duration}min</p>}
                        </>
                      )}
                      {isBlocked && (
                        <p className="text-[10px] text-muted-foreground/50 italic truncate">bloqueado</p>
                      )}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-xs font-medium text-muted-foreground w-16" />
                {weekDays.map(day => (
                  <th key={day.toISOString()} className={cn("px-2 py-3 text-center", isToday(day) && "bg-primary/5")}>
                    <span className="text-xs text-muted-foreground">{format(day, "EEE")}</span>
                    <span className={cn("block text-sm font-semibold mt-0.5", isToday(day) ? "text-primary" : "text-foreground")}>{format(day, "d")}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...new Set(weekDays.flatMap(day => getSlotsForDate(day).filter(s => filteredPros.some(p => p.id === s.professionalId)).map(s => s.time)))].sort().map(hour => (
                <tr key={hour} className="divide-x divide-border">
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground align-top pt-3">{hour}</td>
                  {weekDays.map(day => {
                    const allSlots = getSlotsForDate(day);
                    const slotsHere = allSlots.filter(s => s.time === hour && filteredPros.some(p => p.id === s.professionalId));
                    return (
                      <td key={day.toISOString()} className={cn("px-1 py-1 align-top", isToday(day) && "bg-primary/5")}>
                        <div className="space-y-0.5">
                          {slotsHere.map(slot => {
                            const p = getProfessional(slot.professionalId);
                            return (
                              <div
                                key={slot.professionalId}
                                className={cn(
                                  "rounded px-1.5 py-1 cursor-pointer transition-colors text-[10px]",
                                  slot.status === "booked" && "bg-primary/10 border border-primary/20 hover:bg-primary/15",
                                  slot.status === "blocked" && "bg-muted hover:bg-muted/80",
                                  slot.status === "free" && "hover:bg-secondary/50",
                                )}
                                onClick={() => openSlot(slot, day)}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: `hsl(${p.color})` }} />
                                  <span className="font-medium text-muted-foreground truncate">{p.name}</span>
                                </div>
                                {slot.client && <p className="text-foreground truncate pl-2.5">{slot.client}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slot Modal */}
      {currentModalSlot && pro && (
        <Dialog open={!!currentModalSlot} onOpenChange={v => !v && closeModal()}>
          <DialogContent className="sm:max-w-lg border-border bg-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                {currentModalSlot.slot.time} — {format(currentModalSlot.date, "EEE, MMM d")}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-2 space-y-4">
              {/* Professional chip */}
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${pro.color})` }} />
                <span className="text-sm font-medium text-foreground">{pro.name}</span>
                <StatusBadge status={statusBadgeMap[currentModalSlot.slot.status]} label={t(`agenda.${currentModalSlot.slot.status}`)} />
              </div>

              {/* ── FREE: default actions ── */}
              {currentModalSlot.slot.status === "free" && modalMode === "default" && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("agenda.slotAvailable", { name: pro.name })}</p>
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" disabled={isActionBusy} onClick={() => {
                      if (aiActive) {
                        setModalMode("auto-input");
                      } else {
                        setModalMode("create-manual");
                      }
                    }}>
                      {aiActive ? <Sparkles className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {t("agenda.createAppointment")}
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2" disabled={isActionBusy} onClick={() => handleBlock(currentModalSlot.date, currentModalSlot.slot.time, pro.id)}>
                      {isActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {t("agenda.blockTime")}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── FREE → AUTO INPUT: just client info ── */}
              {currentModalSlot.slot.status === "free" && modalMode === "auto-input" && !actionLoading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 animate-pulse" />
                    <p className="text-xs text-primary font-medium">{t("agenda.aiWillFind")}</p>
                  </div>
                  <div className="space-y-2">
                    <Input placeholder={t("agenda.clientName")} value={newClient} onChange={e => setNewClient(e.target.value)} className="bg-secondary/30 border-border" autoFocus />
                    <Input placeholder="Telefone (opcional)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="bg-secondary/30 border-border" />
                    <Select
                      value={selectedServiceId || "_none"}
                      onValueChange={(v) => {
                        if (v === "_none") { setSelectedServiceId(""); setNewService(""); return; }
                        const svc = services.find(s => s.id === v);
                        setSelectedServiceId(v);
                        setNewService(svc?.name ?? "");
                      }}
                    >
                      <SelectTrigger className="bg-secondary/30 border-border text-sm h-9">
                        <SelectValue placeholder={t("agenda.serviceOptional")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t("agenda.serviceOptional")}</SelectItem>
                        {proServices.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color || "hsl(var(--primary))" }} />
                              {s.name} · {s.duration} min
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" variant="glow" disabled={!newClient.trim() || isActionBusy} onClick={handleAutoBook}>
                      <Zap className="h-4 w-4" /> {t("agenda.scheduleAuto")}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setModalMode("create-manual")}>
                      Manual
                    </Button>
                  </div>
                </div>
              )}

              {/* ── AUTO BOOKING LOADING STATE ── */}
              {modalMode === "auto-input" && actionLoading && (
                <LoadingOverlay message={t("agenda.schedulingAuto")} />
              )}

              {/* ── FREE → AUTO RESULT: show what AI booked ── */}
              {modalMode === "auto-result" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-primary">{t("agenda.appointmentScheduled")}</p>
                      <p className="text-xs text-primary/70 mt-0.5">{t("agenda.aiSelectedOptimal")}</p>
                    </div>
                  </div>

                  {originalPickedTime && pickedTime !== originalPickedTime && (
                    <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5">
                      <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-300">
                        Horário solicitado ({originalPickedTime}) indisponível — agendado para o próximo horário livre às {pickedTime}. Cancele se preferir outro horário.
                      </p>
                    </div>
                  )}

                  <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("agenda.client")}</p>
                        <p className="text-sm font-medium text-foreground">{newClient}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("agenda.service")}</p>
                        <p className="text-sm font-medium text-foreground">{newService || t("agenda.appointment")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("agenda.professional")}</p>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${getProfessional(pickedPro).color})` }} />
                          <p className="text-sm font-medium text-foreground">{getProfessional(pickedPro).name}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("agenda.dateTime")}</p>
                        <p className="text-sm font-medium text-foreground">{pickedTime} · {format(currentModalSlot.date, "EEE, MMM d")}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" disabled={isActionBusy} onClick={handleRescheduleFromAutoResult}>
                      {isActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} {t("agenda.reschedule")}
                    </Button>
                    <Button variant="destructive" className="flex-1 gap-2" disabled={isActionBusy} onClick={handleCancelFromAutoResult}>
                      {isActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} {t("agenda.cancel")}
                    </Button>
                  </div>

                  <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={closeModal}>
                    {t("agenda.done")}
                  </Button>
                </div>
              )}

              {currentModalSlot.slot.status === "free" && modalMode === "create-ai" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <Sparkles className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-primary">{t("agenda.aiAnalyzing")}</p>
                  </div>

                  <div className="space-y-2">
                    <Input placeholder={t("agenda.clientName")} value={newClient} onChange={e => setNewClient(e.target.value)} className="bg-secondary/30 border-border" />
                    <Input placeholder="Telefone (opcional)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="bg-secondary/30 border-border" />
                    <Select
                      value={selectedServiceId || "_none"}
                      onValueChange={(v) => {
                        if (v === "_none") { setSelectedServiceId(""); setNewService(""); return; }
                        const svc = services.find(s => s.id === v);
                        setSelectedServiceId(v);
                        setNewService(svc?.name ?? "");
                      }}
                    >
                      <SelectTrigger className="bg-secondary/30 border-border text-sm h-9">
                        <SelectValue placeholder={t("agenda.serviceOptional")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t("agenda.serviceOptional")}</SelectItem>
                        {proServices.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color || "hsl(var(--primary))" }} />
                              {s.name} · {s.duration} min
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {newClient.trim() && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("agenda.recommendedSlots")}</p>
                      {apiLoading && <LoadingOverlay message={t("agenda.analyzingAvailability")} />}
                      {!apiLoading && aiSuggestions.map((s, idx) => {
                        const sugPro = getProfessional(s.professionalId);
                        return (
                          <button
                            key={idx}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all hover:scale-[1.01]",
                              s.isBest
                                ? "border-primary/40 bg-primary/10 hover:bg-primary/15"
                                : "border-border bg-secondary/20 hover:bg-secondary/40"
                            )}
                            onClick={() => bookWithSuggestion(s)}
                          >
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                              s.isBest ? "bg-primary/20" : "bg-secondary"
                            )}>
                              {s.isBest ? <Zap className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: `hsl(${sugPro.color})` }} />
                                <span className="text-sm font-medium text-foreground">{sugPro.name} · {s.time}</span>
                                {s.isBest && (
                                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">{t("agenda.best")}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
                            </div>
                            <CheckCircle2 className={cn("h-4 w-4 shrink-0", s.isBest ? "text-primary" : "text-muted-foreground/40")} />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={() => setModalMode("create-manual")}>
                      <User className="h-3 w-3" /> {t("agenda.selectManually")}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setModalMode("default")}>{t("agenda.back")}</Button>
                  </div>
                </div>
              )}

              {/* ── FREE → MANUAL MODE: pick professional + time (also used for reschedule) ── */}
              {modalMode === "create-manual" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input placeholder={t("agenda.clientName")} value={newClient} onChange={e => setNewClient(e.target.value)} className="bg-secondary/30 border-border" />
                    <Input placeholder="Telefone (opcional)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="bg-secondary/30 border-border" />
                    <Select
                      value={selectedServiceId || "_none"}
                      onValueChange={(v) => {
                        if (v === "_none") { setSelectedServiceId(""); setNewService(""); return; }
                        const svc = services.find(s => s.id === v);
                        setSelectedServiceId(v);
                        setNewService(svc?.name ?? "");
                      }}
                    >
                      <SelectTrigger className="bg-secondary/30 border-border text-sm h-9">
                        <SelectValue placeholder={t("agenda.serviceOptional")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t("agenda.serviceOptional")}</SelectItem>
                        {proServices.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color || "hsl(var(--primary))" }} />
                              {s.name} · {s.duration} min
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t("agenda.professional")}</label>
                      <Select value={pickedPro} onValueChange={(v) => { setPickedPro(v); setSelectedServiceId(""); setNewService(""); }}>
                        <SelectTrigger className="h-9 text-xs border-border bg-secondary/30">
                          <SelectValue placeholder={t("agenda.select")} />
                        </SelectTrigger>
                        <SelectContent>
                          {professionals.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${p.color})` }} />
                                {p.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{t("agenda.time")}</label>
                      <Select value={pickedTime} onValueChange={setPickedTime}>
                        <SelectTrigger className="h-9 text-xs border-border bg-secondary/30">
                          <SelectValue placeholder={t("agenda.select")} />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map(h => {
                            const target = getSlotsForDate(currentModalSlot.date).find(s => s.time === h && s.professionalId === pickedPro);
                            const conflict = target && target.status !== "free";
                            return (
                              <SelectItem key={h} value={h} disabled={!!conflict}>
                                <span className="flex items-center gap-2">
                                  {h}
                                  {conflict && <span className="text-[10px] text-destructive">{t("agenda.unavailable")}</span>}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Conflict warning */}
                  {(() => {
                    const target = getSlotsForDate(currentModalSlot.date).find(s => s.time === pickedTime && s.professionalId === pickedPro);
                    if (target && target.status !== "free") {
                      return (
                        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                          <Ban className="h-4 w-4 text-destructive shrink-0" />
                          <p className="text-xs text-destructive">{t("agenda.notAvailableAt", { name: getProfessional(pickedPro).name, time: pickedTime })}</p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" onClick={confirmManual} disabled={!newClient.trim() || isActionBusy}>
                      {isActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("agenda.confirm")}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setModalMode(aiActive ? "create-ai" : "default")}>
                      {aiActive ? t("agenda.backToAi") : t("agenda.back")}
                    </Button>
                  </div>
                </div>
              )}

              {/* BOOKED */}
              {currentModalSlot.slot.status === "booked" && modalMode !== "auto-result" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {currentModalSlot.slot.client?.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{currentModalSlot.slot.client}</p>
                        <p className="text-xs text-muted-foreground">{currentModalSlot.slot.service}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {currentModalSlot.slot.time}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {format(currentModalSlot.date, "MMM d, yyyy")}</span>
                    </div>
                    {currentModalSlot.slot.phone && (
                      <a
                        href={`https://wa.me/${currentModalSlot.slot.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        {currentModalSlot.slot.phone}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" disabled={isActionBusy} onClick={async () => {
                      setActionLoading(true);
                      try {
                        setNewClient(currentModalSlot.slot.client ?? "");
                        setNewService(currentModalSlot.slot.service ?? "");
                        await api.cancelAppointment(currentModalSlot.date, currentModalSlot.slot.time, pro.id, currentModalSlot.slot.appointmentId);
                        setModalMode("create-manual");
                      } catch (e: any) {
                        toast({ title: t("admin.error"), description: e.message, variant: "destructive" });
                      } finally {
                        setActionLoading(false);
                      }
                    }}>
                      {isActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} {t("agenda.reschedule")}
                    </Button>
                    <Button variant="destructive" className="flex-1 gap-2" disabled={isActionBusy} onClick={() => handleCancel(currentModalSlot.date, currentModalSlot.slot.time, pro.id, currentModalSlot.slot.appointmentId)}>
                      {isActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} {t("agenda.cancel")}
                    </Button>
                  </div>
                </div>
              )}

              {/* CONFIRMATION SCREEN */}
              {modalMode === "confirm" && currentModalSlot.slot.status === "free" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-primary font-medium">{t("agenda.confirmReview")}</p>
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("agenda.client")}</p>
                        <p className="text-sm font-medium text-foreground">{newClient}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("agenda.service")}</p>
                        <p className="text-sm font-medium text-foreground">{newService || t("agenda.appointment")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("agenda.professional")}</p>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${getProfessional(pickedPro).color})` }} />
                          <p className="text-sm font-medium text-foreground">{getProfessional(pickedPro).name}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("agenda.dateTime")}</p>
                        <p className="text-sm font-medium text-foreground">{pickedTime} · {format(currentModalSlot.date, "EEE, MMM d")}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" variant="glow" disabled={isActionBusy} onClick={handleManualBook}>
                      {isActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t("agenda.confirmAppointment")}
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2" disabled={isActionBusy} onClick={() => setModalMode(confirmSource === "ai" ? "create-ai" : "create-manual")}>
                      <ArrowRightLeft className="h-4 w-4" /> {t("agenda.editSelection")}
                    </Button>
                  </div>
                </div>
              )}

              {/* BLOCKED */}
              {currentModalSlot.slot.status === "blocked" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
                    <Ban className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{t("agenda.timeBlocked", { name: pro.name })}</p>
                  </div>
                  <Button variant="outline" className="w-full gap-2" disabled={isActionBusy} onClick={() => handleUnblock(currentModalSlot.date, currentModalSlot.slot.time, pro.id, currentModalSlot.slot.appointmentId)}>
                    {isActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />} {t("agenda.removeBlock")}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
