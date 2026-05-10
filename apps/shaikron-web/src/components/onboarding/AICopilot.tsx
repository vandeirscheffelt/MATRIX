import { useState, useEffect, useMemo, useCallback } from "react";
import { Sparkles, Wand2, CheckCircle2, MessageCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AICopilotProps, Suggestion } from "./copilot/types";
import { generateSuggestions } from "./copilot/suggestions";
import { useKnowledgeGaps } from "./copilot/useKnowledgeGaps";
import KnowledgeGapPanel from "./copilot/KnowledgeGapPanel";
import ConfigGapPanel from "./copilot/ConfigGapPanel";
import { useConfigGaps } from "./copilot/useConfigGaps";
import GuidedSetup from "./GuidedSetup";
import { toast } from "sonner";

interface ExtendedAICopilotProps extends AICopilotProps {
  onApplyField?: (field: any, value: any) => void;
}

export default function AICopilot({ form, progress, missingFields, onApplyDescription, onApplyFaqs, onApplyTone, onApplyKeywords, onApplyField, promptDesatualizado, contextoDesatualizado }: ExtendedAICopilotProps) {
  const { language, t } = useLanguage();
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [guidedMode, setGuidedMode] = useState(false);
  const { gaps, totalUnanswered, dismiss, generateFaqFromGap } = useKnowledgeGaps(form);
  const configGaps = useConfigGaps(form, t);

  const handleFixNow = useCallback((fieldId: string) => {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-xl");
    setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-background", "rounded-xl");
    }, 2500);
  }, []);

  const suggestions = useMemo(() => generateSuggestions(form, missingFields, t, language), [form, missingFields, t, language]);
  const visibleSuggestions = suggestions.filter(s => !appliedIds.has(s.id));

  const handleApply = (suggestion: Suggestion) => {
    switch (suggestion.type) {
      case "description":
        if (suggestion.payload) onApplyDescription(suggestion.payload);
        break;
      case "faq":
        if (suggestion.payload) onApplyFaqs(suggestion.payload);
        break;
      case "tone":
        if (suggestion.payload) onApplyTone(suggestion.payload);
        break;
      case "keywords":
        if (suggestion.payload) onApplyKeywords(suggestion.payload);
        break;
    }
    setAppliedIds(prev => new Set(prev).add(suggestion.id));
  };

  const handleAddGapAsFaq = (gap: Parameters<typeof generateFaqFromGap>[0]) => {
    const faq = generateFaqFromGap(gap);
    const existing = form.faqs.filter(f => f.question.trim() || f.answer.trim());
    onApplyFaqs([...existing, faq]);
    dismiss(gap.id);
    toast.success(t("knowledge.faqAdded"));
  };

  const handleGenerateAllGaps = () => {
    const newFaqs = gaps.map(g => generateFaqFromGap(g));
    const existing = form.faqs.filter(f => f.question.trim() || f.answer.trim());
    onApplyFaqs([...existing, ...newFaqs]);
    gaps.forEach(g => dismiss(g.id));
    toast.success(t("knowledge.faqsGenerated", { count: newFaqs.length }));
  };

  const progressMessage = useMemo(() => {
    if (progress === 100) return t("copilot.allSet");
    if (progress >= 80) return t("copilot.almostDone");
    if (progress >= 50) return t("copilot.keepGoing", { progress });
    if (progress >= 25) return t("copilot.goodStart");
    return t("copilot.letsSetup");
  }, [progress, t]);

  const scoreLabel = useMemo(() => {
    if (progress >= 90) return { text: t("copilot.excellent"), color: "text-green-400" };
    if (progress >= 70) return { text: t("copilot.good"), color: "text-primary" };
    if (progress >= 40) return { text: t("copilot.needsWork"), color: "text-yellow-400" };
    return { text: t("copilot.gettingStarted"), color: "text-muted-foreground" };
  }, [progress, t]);

  useEffect(() => {
    setAppliedIds(prev => {
      const currentIds = new Set(suggestions.map(s => s.id));
      const cleaned = new Set<string>();
      prev.forEach(id => { if (currentIds.has(id)) cleaned.add(id); });
      return cleaned;
    });
  }, [suggestions]);

  return (
    <div className="rounded-xl border border-primary/20 bg-card p-5 sticky top-24 glow-blue">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t("copilot.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("copilot.subtitle")}</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("copilot.configScore")}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${scoreLabel.color}`}>{scoreLabel.text}</span>
            <span className="text-xs font-bold text-primary">{progress}%</span>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
          {progress === 100 ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
          )}
          {progressMessage}
        </p>
      </div>

      {(promptDesatualizado || contextoDesatualizado) && (
        <div className="mb-4 space-y-2">
          {contextoDesatualizado && (
            <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/8 px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-orange-300 leading-snug">
                <span className="font-medium">Contexto desatualizado</span> — suas configurações mudaram. Use "Regenerar com IA" no campo Contexto Operacional.
              </p>
            </div>
          )}
          {promptDesatualizado && (
            <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/8 px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-orange-300 leading-snug">
                <span className="font-medium">Prompt desatualizado</span> — clique em "Regenerar Prompt" no aviso acima para aplicar as mudanças.
              </p>
            </div>
          )}
        </div>
      )}

      {!guidedMode && progress < 60 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mb-4 text-xs border-primary/30 hover:bg-primary/10 hover:text-primary"
          onClick={() => setGuidedMode(true)}
        >
          <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
          {t("copilot.guidedSetup")}
        </Button>
      )}

      {guidedMode && onApplyField && (
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <GuidedSetup
            form={form}
            onApplyDescription={onApplyDescription}
            onApplyFaqs={onApplyFaqs}
            onApplyTone={onApplyTone}
            onApplyKeywords={onApplyKeywords}
            onApplyField={onApplyField}
            onClose={() => setGuidedMode(false)}
          />
        </div>
      )}

      {!guidedMode && visibleSuggestions.length > 0 ? (
        <div className="space-y-3">
          {visibleSuggestions.slice(0, 3).map((suggestion) => (
            <div
              key={suggestion.id}
              className="rounded-lg border border-border bg-secondary/50 p-4 hover:border-primary/30 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex items-center gap-2 mb-2">
                <suggestion.icon className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{suggestion.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {suggestion.message}
              </p>
              {suggestion.payload && suggestion.type !== "general" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 opacity-70 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleApply(suggestion)}
                >
                  <Wand2 className="h-3 w-3 mr-1" /> {t("copilot.useThis")}
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : !guidedMode ? (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-green-400 mx-auto mb-2" />
          <p className="text-xs text-green-400 font-medium">{t("copilot.lookingGreat")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("copilot.allWellConfigured")}</p>
        </div>
      ) : null}

      {!guidedMode && configGaps.length > 0 && (
        <ConfigGapPanel gaps={configGaps} onFixNow={handleFixNow} />
      )}

      {!guidedMode && (
        <KnowledgeGapPanel
          gaps={gaps}
          totalUnanswered={totalUnanswered}
          onAddAsFaq={handleAddGapAsFaq}
          onDismiss={dismiss}
          onGenerateAll={handleGenerateAllGaps}
        />
      )}

      {missingFields.length > 0 && progress < 100 && !guidedMode && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{missingFields.length}</span>
            {" "}{missingFields.length === 1 ? t("copilot.stepRemaining") : t("copilot.stepsRemaining")}
          </p>
        </div>
      )}
    </div>
  );
}
