import { useState, useRef, useEffect } from "react";
import { useConversations, type ConversationDetail, type DetectedIntent } from "@/hooks/api/useConversations";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Bot, User, Send, ArrowLeft, CalendarPlus, CheckCircle2,
  Pause, Play, Lightbulb, Loader2, MessageSquare, Sparkles,
  Zap, Clock, Search, Calendar, HelpCircle, RefreshCw, Info,
  Shield, AlertTriangle, Timer, Archive, ArchiveRestore, Trash2,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

type ListFilter = "active" | "archived";

const INTENT_ICONS: Record<DetectedIntent, { icon: typeof Calendar; color: string }> = {
  booking: { icon: Calendar, color: "text-primary" },
  question: { icon: HelpCircle, color: "text-warning" },
  reschedule: { icon: RefreshCw, color: "text-warning" },
  info: { icon: Info, color: "text-muted-foreground" },
  confirmation: { icon: CheckCircle2, color: "text-success" },
};

const INTENT_LABEL_KEYS: Record<DetectedIntent, string> = {
  booking: "conv.intentBooking",
  question: "conv.intentQuestion",
  reschedule: "conv.intentReschedule",
  info: "conv.intentInfo",
  confirmation: "conv.intentConfirmation",
};

export default function Conversations() {
  const { t } = useLanguage();
  const {
    conversations, toggleAiHandling, sendMessage, simulateClientMessage,
    executeManagerAction, markResolved, archiveConversation, unarchiveConversation,
    deleteConversation, loading,
  } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [msgText, setMsgText] = useState("");
  const [filter, setFilter] = useState<ListFilter>("active");
  const isMobile = useIsMobile();

  const filtered = conversations.filter(c => filter === "archived" ? c.archived : !c.archived);
  const selected = conversations.find(c => c.id === selectedId) ?? null;
  const showList = !isMobile || !selected;
  const showChat = !isMobile || !!selected;

  const handleSend = async (text?: string) => {
    const finalText = (text || msgText).trim();
    if (!finalText || !selectedId) return;
    await sendMessage(selectedId, finalText);
    setMsgText("");
  };

  const handleArchive = async (id: string) => {
    await archiveConversation(id);
    if (selectedId === id) setSelectedId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    if (selectedId === id) setSelectedId(null);
  };

  const pendingCount = filtered.filter(c => c.status === "pending").length;
  const archivedCount = conversations.filter(c => c.archived).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border bg-card">
      {/* ── LEFT: Conversation List ─────────────────── */}
      {showList && (
        <div className={cn(
          "flex flex-col border-r border-border transition-all duration-300",
          isMobile ? "w-full" : "w-[380px] min-w-[320px] shrink-0",
          selected && !isMobile && "opacity-80"
        )}>
          <div className="px-5 py-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{t("conv.conversations")}</h2>
                {filter === "active" && pendingCount > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-warning/20 text-warning text-[10px] font-bold animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{filtered.length}</span>
            </div>
            {/* Filter tabs */}
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-0.5">
              <button
                onClick={() => setFilter("active")}
                className={cn(
                  "flex-1 text-[11px] font-medium py-1.5 rounded-md transition-all duration-200",
                  filter === "active"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("conv.active")}
              </button>
              <button
                onClick={() => setFilter("archived")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1.5 rounded-md transition-all duration-200",
                  filter === "archived"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Archive className="h-3 w-3" />
                {t("conv.archived")}
                {archivedCount > 0 && (
                  <span className="text-[10px] bg-secondary rounded-full px-1.5">{archivedCount}</span>
                )}
              </button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                {filter === "archived" ? (
                  <>
                    <Archive className="h-8 w-8 opacity-30" />
                    <p className="text-xs">{t("conv.noArchived")}</p>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <p className="text-xs">{t("conv.noActive")}</p>
                  </>
                )}
              </div>
            ) : (
              filtered.map(c => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  isActive={c.id === selectedId}
                  isArchiveView={filter === "archived"}
                  onClick={() => setSelectedId(c.id)}
                  onQuickReply={() => setSelectedId(c.id)}
                  onQuickSchedule={() => toast.info(t("conv.scheduleFor") + " " + c.name)}
                  onQuickPause={() => toggleAiHandling(c.id)}
                  onArchive={() => handleArchive(c.id)}
                  onUnarchive={() => unarchiveConversation(c.id)}
                  onDelete={() => handleDelete(c.id)}
                />
              ))
            )}
          </ScrollArea>
        </div>
      )}

      {/* ── RIGHT: Active Conversation ───────────────── */}
      {showChat && (
        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300",
          selected && "bg-card"
        )}>
          {selected ? (
            <>
              <ChatHeader
                conversation={selected}
                onBack={() => setSelectedId(null)}
                onToggleAi={() => toggleAiHandling(selected.id)}
                onMarkResolved={() => markResolved(selected.id)}
                onSimulateKeyword={() => simulateClientMessage(selected.id, "Quero falar com um atendente")}
                onManagerAction={() => executeManagerAction(selected.id, "Agendamento atualizado externamente pelo gestor")}
                onArchive={() => handleArchive(selected.id)}
                onDelete={() => handleDelete(selected.id)}
              />
              <div className="flex-1 flex overflow-hidden">
                <MessageArea conversation={selected} />
                {!isMobile && selected.insights.length > 0 && (
                  <InsightsPanel conversation={selected} onSend={handleSend} />
                )}
              </div>
              <InputArea
                conversation={selected}
                msgText={msgText}
                setMsgText={setMsgText}
                onSend={handleSend}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MessageSquare className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t("conv.selectConversation")}</p>
              {pendingCount > 0 && (
                <p className="text-xs text-warning animate-pulse">
                  {t("conv.waitingAttention", { count: pendingCount })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Conversation List Item ──────────────────────────────────────────── */

function ConversationItem({ conversation: c, isActive, isArchiveView, onClick, onQuickReply, onQuickSchedule, onQuickPause, onArchive, onUnarchive, onDelete }: {
  conversation: ConversationDetail; isActive: boolean; isArchiveView: boolean;
  onClick: () => void; onQuickReply: () => void; onQuickSchedule: () => void;
  onQuickPause: () => void; onArchive: () => void; onUnarchive: () => void; onDelete: () => void;
}) {
  const { t } = useLanguage();
  const isPending = c.status === "pending";
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all duration-200 hover:bg-secondary/50 relative",
        isActive && "bg-secondary/70",
        isPending && !isArchiveView && "border-l-2 border-l-warning bg-warning/[0.03]",
        isArchiveView && "opacity-80",
      )}
    >
      {isPending && !isArchiveView && (
        <div className="absolute inset-0 bg-warning/[0.04] pointer-events-none rounded-r-lg" />
      )}
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
        isArchiveView ? "bg-muted text-muted-foreground" : isPending ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"
      )}>
        {c.name.split(" ").map(n => n[0]).join("")}
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
          <span className={cn(
            "text-[10px] shrink-0 ml-2",
            isPending ? "text-warning font-medium" : "text-muted-foreground"
          )}>{c.time}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
        {c.pausedByKeyword && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-warning">
            <AlertTriangle className="h-2.5 w-2.5" />
            {t("conv.pausedByKeyword")}
          </div>
        )}
        {c.autoResumeAt && !c.aiHandling && (
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
            <Timer className="h-2.5 w-2.5" />
            <AutoResumeCountdown resumeAt={c.autoResumeAt} />
          </div>
        )}
        {/* Quick Actions on hover */}
        <div className="hidden group-hover:flex items-center gap-1 mt-1.5">
          {isArchiveView ? (
            <>
              <button
                onClick={e => { e.stopPropagation(); onUnarchive(); }}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 bg-primary/10 rounded px-1.5 py-0.5 transition-colors"
              >
                <ArchiveRestore className="h-2.5 w-2.5" /> {t("conv.restore")}
              </button>
              <DeleteButton onDelete={onDelete} size="inline" />
            </>
          ) : (
            <>
              <button
                onClick={e => { e.stopPropagation(); onQuickReply(); }}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 bg-primary/10 rounded px-1.5 py-0.5 transition-colors"
              >
                <Zap className="h-2.5 w-2.5" /> {t("conv.reply")}
              </button>
              <button
                onClick={e => { e.stopPropagation(); onQuickSchedule(); }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground bg-secondary/70 rounded px-1.5 py-0.5 transition-colors"
              >
                <CalendarPlus className="h-2.5 w-2.5" /> {t("conv.schedule")}
              </button>
              {c.aiHandling && (
                <button
                  onClick={e => { e.stopPropagation(); onQuickPause(); }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground bg-secondary/70 rounded px-1.5 py-0.5 transition-colors"
                >
                  <Pause className="h-2.5 w-2.5" /> {t("conv.pause")}
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onArchive(); }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground bg-secondary/70 rounded px-1.5 py-0.5 transition-colors"
              >
                <Archive className="h-2.5 w-2.5" /> {t("conv.archive")}
              </button>
            </>
          )}
        </div>
      </div>
      <StatusBadge status={c.status} label={t(`status.${c.status}`)} className="shrink-0 text-[10px] px-1.5 py-0 relative z-10" />
    </button>
  );
}

/* ── Delete Button with Confirmation ─────────────────────────────────── */

function DeleteButton({ onDelete, size = "default" }: { onDelete: () => void; size?: "default" | "inline" }) {
  const { t } = useLanguage();
  if (size === "inline") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-destructive/70 hover:text-destructive bg-destructive/10 rounded px-1.5 py-0.5 transition-colors"
          >
            <Trash2 className="h-2.5 w-2.5" /> {t("conv.delete")}
          </button>
        </AlertDialogTrigger>
        <DeleteConfirmContent onConfirm={onDelete} />
      </AlertDialog>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="h-3 w-3" /> {t("conv.delete")}
        </Button>
      </AlertDialogTrigger>
      <DeleteConfirmContent onConfirm={onDelete} />
    </AlertDialog>
  );
}

function DeleteConfirmContent({ onConfirm }: { onConfirm: () => void }) {
  const { t } = useLanguage();
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("conv.deleteConfirmTitle")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("conv.deleteConfirmDesc")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("conv.cancelAction")}</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          {t("conv.deletePermanentlyAction")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

/* ── Auto Resume Countdown ───────────────────────────────────────────── */

function AutoResumeCountdown({ resumeAt }: { resumeAt: number }) {
  const { t } = useLanguage();
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((resumeAt - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.ceil((resumeAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [resumeAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return <span>{t("conv.aiResumeIn")} {mins}:{secs.toString().padStart(2, "0")}</span>;
}

/* ── Chat Header ─────────────────────────────────────────────────────── */

function ChatHeader({ conversation: c, onBack, onToggleAi, onMarkResolved, onSimulateKeyword, onManagerAction, onArchive, onDelete }: {
  conversation: ConversationDetail;
  onBack?: () => void;
  onToggleAi: () => void;
  onMarkResolved: () => void;
  onSimulateKeyword: () => void;
  onManagerAction: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const intentInfo = INTENT_ICONS[c.intent];
  const intentLabel = t(INTENT_LABEL_KEYS[c.intent]);
  const IntentIcon = intentInfo.icon;

  return (
    <div className="border-b border-border px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
            <p className="text-[11px] text-muted-foreground">{c.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className={cn("flex items-center gap-1 text-[10px] font-medium rounded-full bg-secondary/70 px-2 py-0.5", intentInfo.color)}>
            <IntentIcon className="h-2.5 w-2.5" />
            {intentLabel}
          </div>
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[11px] text-muted-foreground">IA</span>
            <Switch checked={c.aiHandling} onCheckedChange={onToggleAi} className="scale-[0.8]" />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onToggleAi}>
            {c.aiHandling ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {c.aiHandling ? t("conv.pause") : t("conv.resume")}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
            <CalendarPlus className="h-3 w-3" /> {t("conv.schedule")}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onMarkResolved}>
            <CheckCircle2 className="h-3 w-3" /> {t("conv.resolve")}
          </Button>

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onArchive} className="text-xs gap-2">
                <Archive className="h-3.5 w-3.5" />
                {c.archived ? t("conv.restoreConversation") : t("conv.archiveConversation")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSimulateKeyword} className="text-xs gap-2 text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("conv.simulateKeywordPause")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManagerAction} className="text-xs gap-2 text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                {t("conv.simulateManagerAction")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-xs gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("conv.deletePermanentlyAction")}
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <DeleteConfirmContent onConfirm={onDelete} />
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status banner */}
      <div className={cn(
        "flex items-center gap-1.5 text-[11px] rounded-md px-2.5 py-1 w-fit transition-all duration-300",
        c.aiHandling ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
      )}>
        {c.aiHandling ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
        {c.aiHandling ? t("conv.aiInControl") : t("conv.youAreResponding")}
      </div>

      {c.pausedByKeyword && !c.aiHandling && (
        <div className="flex items-center gap-1.5 text-[11px] rounded-md px-2.5 py-1.5 w-fit bg-warning/15 text-warning border border-warning/20 animate-in fade-in-0 slide-in-from-top-1 duration-300">
          <AlertTriangle className="h-3 w-3" />
          {t("conv.pausedByKeywordWhatsApp")}
        </div>
      )}

      {c.autoResumeAt && !c.aiHandling && (
        <div className="flex items-center gap-1.5 text-[11px] rounded-md px-2.5 py-1.5 w-fit bg-secondary/70 text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-300">
          <Timer className="h-3 w-3" />
          <AutoResumeCountdown resumeAt={c.autoResumeAt} />
          <span className="text-[10px] opacity-70">{t("conv.ifNoResponse")}</span>
        </div>
      )}

      {/* Archived banner */}
      {c.archived && (
        <div className="flex items-center gap-1.5 text-[11px] rounded-md px-2.5 py-1.5 w-fit bg-muted text-muted-foreground animate-in fade-in-0 slide-in-from-top-1 duration-300">
          <Archive className="h-3 w-3" />
          {t("conv.conversationArchived")}
        </div>
      )}
    </div>
  );
}

/* ── Message Area ────────────────────────────────────────────────────── */

function MessageArea({ conversation }: { conversation: ConversationDetail }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [conversation.messages.length]);

  return (
    <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
      <div className="space-y-3 max-w-2xl mx-auto">
        {conversation.messages.map(m => (
          m.sender === "system"
            ? <SystemMessage key={m.id} message={m} />
            : <MessageBubble key={m.id} sender={m.sender} text={m.text} time={m.time} />
        ))}
      </div>
    </ScrollArea>
  );
}

/* ── System Message ──────────────────────────────────────────────────── */

function SystemMessage({ message }: { message: { text: string; time: string; isManagerAction?: boolean } }) {
  return (
    <div className="flex justify-center animate-in fade-in-0 duration-300">
      <div className={cn(
        "flex items-center gap-1.5 text-[10px] rounded-full px-3 py-1",
        message.isManagerAction
          ? "bg-accent/50 text-accent-foreground border border-accent/30"
          : "bg-secondary/70 text-muted-foreground"
      )}>
        {message.isManagerAction ? <Shield className="h-2.5 w-2.5" /> : <Info className="h-2.5 w-2.5" />}
        {message.text}
        <span className="opacity-50 ml-1">{message.time}</span>
      </div>
    </div>
  );
}

/* ── Message Bubble ──────────────────────────────────────────────────── */

function MessageBubble({ sender, text, time }: { sender: string; text: string; time: string }) {
  const { t } = useLanguage();
  const isClient = sender === "client";
  return (
    <div className={cn("flex animate-in fade-in-0 slide-in-from-bottom-2 duration-300", isClient ? "justify-start" : "justify-end")}>
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-2.5 space-y-1",
        isClient
          ? "bg-secondary/70 text-foreground rounded-bl-md"
          : sender === "ai"
            ? "bg-primary/15 text-foreground rounded-br-md border border-primary/20"
            : "bg-primary text-primary-foreground rounded-br-md"
      )}>
        {!isClient && (
          <div className="flex items-center gap-1 text-[10px] opacity-70 font-medium">
            {sender === "ai" ? <Bot className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
            {sender === "ai" ? "IA" : t("conv.you")}
          </div>
        )}
        <p className="text-sm leading-relaxed">{text}</p>
        <p className={cn("text-[10px] opacity-50", isClient ? "text-left" : "text-right")}>{time}</p>
      </div>
    </div>
  );
}

/* ── Insights Panel ──────────────────────────────────────────────────── */

function InsightsPanel({ conversation: c, onSend }: { conversation: ConversationDetail; onSend: (text: string) => void }) {
  const { t } = useLanguage();
  return (
    <div className="w-[260px] border-l border-border p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Lightbulb className="h-3.5 w-3.5 text-warning" />
        {t("conv.intelligence")}
      </div>
      {c.insights.map((insight, i) => (
        <div key={i} className="rounded-lg bg-secondary/50 px-3 py-2.5 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{insight.text}</p>
          {insight.cta && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1 w-full"
              onClick={() => toast.info(insight.cta!.label)}
            >
              {insight.cta.action === "schedule" && <CalendarPlus className="h-2.5 w-2.5" />}
              {insight.cta.action === "followup" && <Send className="h-2.5 w-2.5" />}
              {insight.cta.action === "catalog" && <Search className="h-2.5 w-2.5" />}
              {insight.cta.label}
            </Button>
          )}
        </div>
      ))}

      {!c.aiHandling && c.suggestions.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("conv.suggestions")}
          </div>
          {c.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSend(s)}
              className="w-full text-left rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground hover:bg-primary/10 transition-colors"
            >
              {s}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

/* ── Input Area ──────────────────────────────────────────────────────── */

function InputArea({ conversation: c, msgText, setMsgText, onSend }: {
  conversation: ConversationDetail;
  msgText: string;
  setMsgText: (v: string) => void;
  onSend: (text?: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="border-t border-border px-4 py-3">
      {c.aiHandling ? (
        <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground py-1">
          <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
          {t("conv.aiRespondingAuto")}
        </div>
      ) : (
        <div className="space-y-2 max-w-2xl mx-auto">
          {c.suggestions.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {c.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSend(s)}
                  className="shrink-0 text-[11px] text-primary bg-primary/10 hover:bg-primary/20 rounded-full px-3 py-1 transition-colors"
                >
                  {s.length > 45 ? s.slice(0, 45) + "…" : s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={e => { e.preventDefault(); onSend(); }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder={t("conv.typePlaceholder")}
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              className="flex-1 bg-secondary/50 border-border"
            />
            <Button type="submit" size="icon" disabled={!msgText.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
