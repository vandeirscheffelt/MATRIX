import { AlertTriangle, Brain, Plus, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { KnowledgeGap } from "./types";

interface KnowledgeGapPanelProps {
  gaps: KnowledgeGap[];
  totalUnanswered: number;
  onAddAsFaq: (gap: KnowledgeGap) => void;
  onDismiss: (id: string) => void;
  onGenerateAll: () => void;
}

export default function KnowledgeGapPanel({ gaps, totalUnanswered, onAddAsFaq, onDismiss, onGenerateAll }: KnowledgeGapPanelProps) {
  const { t } = useLanguage();

  if (gaps.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/15">
          <Brain className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-xs font-semibold text-foreground">{t("knowledge.title")}</h3>
          <p className="text-[10px] text-muted-foreground">{t("knowledge.subtitle")}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {totalUnanswered} {t("knowledge.unanswered")}
        </span>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-3">
        <p className="text-xs text-amber-300/90 leading-relaxed">
          <span className="font-medium text-amber-300">{t("knowledge.alertMsg", { count: totalUnanswered })}</span>
          {" "}{t("knowledge.alertQuestion")}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2 text-xs h-7 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
          onClick={onGenerateAll}
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          {t("knowledge.generateFaq")}
        </Button>
      </div>

      <div className="space-y-2">
        {gaps.map((gap) => (
          <div
            key={gap.id}
            className="rounded-lg border border-border bg-secondary/50 p-3 group hover:border-amber-500/30 transition-all animate-in fade-in slide-in-from-bottom-1 duration-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground leading-relaxed truncate">
                  "{gap.question}"
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {t("knowledge.asked", { freq: gap.frequency, time: gap.detectedAt })}
                  </span>
                </div>
              </div>
              <button
                onClick={() => onDismiss(gap.id)}
                className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {gap.suggestedAnswer && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                  <span className="font-medium text-primary/80">{t("knowledge.suggested")}</span> {gap.suggestedAnswer}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1.5 text-[10px] h-6 px-2 opacity-70 group-hover:opacity-100 transition-opacity"
                  onClick={() => onAddAsFaq(gap)}
                >
                  <Plus className="h-2.5 w-2.5 mr-1" /> {t("knowledge.addToFaq")}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
