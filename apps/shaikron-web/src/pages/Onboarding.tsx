import { useState, useCallback, useEffect, useRef, Component, type ReactNode } from "react";
import { X, Plus, Trash2, Bot, Clock, Shield, Wand2, Loader2, AlertCircle, User, Cpu, Sparkles, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";
import AICopilot from "@/components/onboarding/AICopilot";
import AISuggestionCard from "@/components/onboarding/AISuggestionCard";
import { expandDescription, generateDescription, improveAnswer, improveQuestion, generateKeywords } from "@/components/onboarding/copilot/generators";
import WhatsAppConnection from "@/components/onboarding/WhatsAppConnection";
import ServicesManager from "@/components/onboarding/ServicesManager";
import ProfessionalSettings from "@/components/onboarding/ProfessionalSettings";
import { useLanguage, LanguageConsumer, type LanguageCode } from "@/contexts/LanguageContext";

// Error boundary to prevent Copilot crashes from breaking the whole page
class CopilotErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("Copilot crashed:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <LanguageConsumer>
          {({ t }) => (
            <div className="rounded-xl border border-border bg-card p-5 sticky top-24">
              <p className="text-sm text-muted-foreground text-center">
                {t("error.copilotCrash")}
              </p>
              <button
                onClick={() => this.setState({ hasError: false })}
                className="mt-3 w-full text-xs text-primary hover:underline"
              >
                {t("error.tryAgain")}
              </button>
            </div>
          )}
        </LanguageConsumer>
      );
    }
    return this.props.children;
  }
}

const businessTypes = ["Restaurant", "Clinic", "Salon", "Gym", "Real Estate", "Consulting", "E-commerce", "Other"];
const toneOptions = ["Professional", "Friendly", "Casual", "Formal", "Empathetic", "Energetic"];
const IMPROVE_ERROR_MESSAGE = "Couldn't improve the text. Try again.";
const AI_TIMEOUT_MS = 4000;

interface PendingSuggestion {
  field: string;
  label: string;
  original: string;
  suggested: string;
  originalQuestion?: string;
  suggestedQuestion?: string;
}

interface ImproveErrorState {
  field: string;
  message: string;
}

interface SuggestionJob {
  field: string;
  label: string;
  original: string;
  noChangesMessage: string;
  delay?: number;
  run: () => string;
}

function isSuggestionText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function simulateAiSuggestion(task: () => string, delay = 700, timeout = AI_TIMEOUT_MS) {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let workTimer = 0;
    let timeoutTimer = 0;

    const cleanup = () => {
      window.clearTimeout(workTimer);
      window.clearTimeout(timeoutTimer);
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error("AI suggestion failed"));
    };

    const succeed = (value: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    workTimer = window.setTimeout(() => {
      try {
        const result = task();
        if (!isSuggestionText(result)) {
          fail(new Error("AI returned an empty suggestion"));
          return;
        }

        succeed(result);
      } catch (error) {
        fail(error);
      }
    }, delay);

    timeoutTimer = window.setTimeout(() => {
      fail(new Error("AI suggestion timed out"));
    }, timeout);
  });
}

import { toast } from "sonner";

const LANGUAGE_OPTIONS: { value: LanguageCode; label: string }[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

export default function Onboarding() {
  const { language, setLanguage, t } = useLanguage();
  const { form, update, progress, missingFields } = useOnboardingForm();
  const [keywordInput, setKeywordInput] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [improvingField, setImprovingField] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);
  const [improveError, setImproveError] = useState<ImproveErrorState | null>(null);
  const latestFormRef = useRef(form);
  const requestIdRef = useRef(0);
  const requestLockRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestLockRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const queueSuggestion = useCallback((suggestion: PendingSuggestion, noChangesMessage: string) => {
    const originalText = suggestion.original.trim();
    const suggestedText = suggestion.suggested.trim();

    if (!suggestedText || suggestedText === originalText) {
      toast(noChangesMessage);
      setPendingSuggestion(null);
      return;
    }

    setImproveError(null);
    setPendingSuggestion(suggestion);
  }, []);

  const buildFormSnapshot = useCallback(() => {
    const current = latestFormRef.current;

    return {
      ...current,
      keywords: [...current.keywords],
      faqs: current.faqs.map((faq) => ({ ...faq })),
    };
  }, []);

  const runImproveRequest = useCallback(async ({
    field,
    label,
    original,
    noChangesMessage,
    delay = 700,
    run,
  }: SuggestionJob) => {
    if (requestLockRef.current || improvingField || pendingSuggestion) return;

    requestLockRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setImproveError(null);
    setImprovingField(field);

    try {
      const suggested = await simulateAiSuggestion(run, delay);

      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      queueSuggestion({
        field,
        label,
        original,
        suggested,
      }, noChangesMessage);
    } catch (error) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      console.error(`AI improve failed for ${field}:`, error);
      setPendingSuggestion(null);
      setImproveError({ field, message: t("error.improveText") });
      toast.error(t("error.improveText"));
    } finally {
      if (requestId === requestIdRef.current) {
        requestLockRef.current = false;
      }

      if (isMountedRef.current && requestId === requestIdRef.current) {
        setImprovingField(null);
      }
    }
  }, [improvingField, pendingSuggestion, queueSuggestion]);

  const addKeyword = () => {
    if (keywordInput.trim() && !form.keywords.includes(keywordInput.trim())) {
      update("keywords", [...form.keywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  const handleImproveDescription = useCallback(() => {
    const formSnapshot = buildFormSnapshot();

    void runImproveRequest({
      field: "description",
      label: "Business Description",
      original: formSnapshot.description,
      noChangesMessage: t("suggest.descLooksGood"),
      delay: 800,
      run: () => (
        formSnapshot.description.trim().length > 20
          ? expandDescription(formSnapshot)
          : generateDescription(formSnapshot)
      ),
    });
  }, [buildFormSnapshot, runImproveRequest]);

  const handleImproveFaq = useCallback((index: number) => {
    const formSnapshot = buildFormSnapshot();
    const faq = formSnapshot.faqs[index];

    if (!faq || (!faq.question.trim() && !faq.answer.trim())) return;
    if (requestLockRef.current || improvingField || pendingSuggestion) return;

    requestLockRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const field = `faq-${index}`;

    setImproveError(null);
    setImprovingField(field);

    const run = async () => {
      try {
        const [improvedAnswer, improvedQ] = await Promise.all([
          simulateAiSuggestion(() => improveAnswer(faq, formSnapshot), 600),
          simulateAiSuggestion(() => improveQuestion(faq, formSnapshot), 400),
        ]);

        if (!isMountedRef.current || requestId !== requestIdRef.current) return;

        const answerText = typeof improvedAnswer === "string" ? improvedAnswer.trim() : "";
        const questionText = typeof improvedQ === "string" ? improvedQ.trim() : "";

        if (!answerText && !questionText) {
          toast(t("suggest.faqLooksGood"));
          setPendingSuggestion(null);
        } else {
          setImproveError(null);
          setPendingSuggestion({
            field,
            label: `FAQ #${index + 1}`,
            original: faq.answer,
            suggested: answerText || faq.answer,
            originalQuestion: faq.question,
            suggestedQuestion: questionText || faq.question,
          });
        }
      } catch (error) {
        if (!isMountedRef.current || requestId !== requestIdRef.current) return;
        console.error(`AI improve failed for ${field}:`, error);
        setPendingSuggestion(null);
        setImproveError({ field, message: t("error.improveText") });
        toast.error(t("error.improveText"));
      } finally {
        if (requestId === requestIdRef.current) requestLockRef.current = false;
        if (isMountedRef.current && requestId === requestIdRef.current) setImprovingField(null);
      }
    };

    void run();
  }, [buildFormSnapshot, improvingField, pendingSuggestion]);

  const handleApplySuggestion = useCallback((text: string, question?: string) => {
    if (!pendingSuggestion) return;

    const suggestionText = typeof text === "string" ? text.trim() : "";
    if (!suggestionText) {
      toast.error(t("error.improveText"));
      return;
    }

    const { field } = pendingSuggestion;
    const currentForm = latestFormRef.current;

    if (field === "description") {
      update("description", suggestionText);
    } else if (field.startsWith("faq-")) {
      const index = parseInt(field.split("-")[1], 10);
      if (Number.isNaN(index) || !currentForm.faqs[index]) {
        setPendingSuggestion(null);
        toast.error(t("suggest.faqChanged"));
        return;
      }

      const appliedQuestion = question?.trim() || pendingSuggestion.suggestedQuestion?.trim() || currentForm.faqs[index].question;
      const updated = currentForm.faqs.map((faq, faqIndex) => {
        if (faqIndex !== index) return faq;
        return { ...faq, answer: suggestionText, question: appliedQuestion };
      });
      update("faqs", updated);
    }

    setImproveError(null);
    setPendingSuggestion(null);
    toast.success(t("suggest.applied"));
  }, [pendingSuggestion, update]);

  const handleDismissSuggestion = useCallback(() => {
    setPendingSuggestion(null);
    toast(t("suggest.kept"));
  }, []);

  const isSuggestionLocked = Boolean(improvingField || pendingSuggestion);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Form — 3 cols */}
        <div className="lg:col-span-3 space-y-5">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            {/* Language */}
            <div id="field-language">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                {t("language.label")}
              </label>
              <Select value={language} onValueChange={(v) => setLanguage(v as LanguageCode)}>
                <SelectTrigger className="bg-secondary border-border w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">{t("language.helper")}</p>
            </div>

            {/* Business Name */}
            <div id="field-business-name">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {t("label.businessName")}
              </label>
              <Input
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder={t("placeholder.businessName")}
                className="bg-secondary border-border"
              />
            </div>

            {/* Business Type */}
            <div id="field-business-type">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {t("label.businessType")}
              </label>
              <div className="flex flex-wrap gap-2">
                {businessTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => update("businessType", type)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      form.businessType === type
                        ? "border-primary bg-primary/15 text-primary glow-blue"
                        : "border-border bg-secondary text-secondary-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    {t(`type.${type}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div id="field-description">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {t("label.operationalContext")}
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                {t("label.operationalContextDesc")}
              </p>
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder={t("placeholder.description")}
                className="bg-secondary border-border min-h-[100px] resize-none"
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
                onClick={handleImproveDescription}
                disabled={isSuggestionLocked}
              >
                {improvingField === "description" ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {t("btn.improving")}</>
                ) : (
                  <><Wand2 className="h-3 w-3 mr-1" /> {t("btn.improveWithAi")}</>
                )}
              </Button>
              {improveError?.field === "description" && !improvingField && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {improveError.message}
                </div>
              )}
              {pendingSuggestion?.field === "description" && (
                <div className="mt-2">
                  <AISuggestionCard
                    key={`${pendingSuggestion.field}-${pendingSuggestion.suggested}`}
                    fieldLabel={pendingSuggestion.label}
                    original={pendingSuggestion.original}
                    suggested={pendingSuggestion.suggested}
                    onApply={handleApplySuggestion}
                    onDismiss={handleDismissSuggestion}
                  />
                </div>
              )}
            </div>

            {/* Tone */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {t("label.tone")}
              </label>
              <div className="flex flex-wrap gap-2">
                {toneOptions.map((tone) => (
                  <button
                    key={tone}
                    onClick={() => update("tone", tone)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      form.tone === tone
                        ? "border-primary bg-primary/15 text-primary glow-blue"
                        : "border-border bg-secondary text-secondary-foreground hover:border-primary/50"
                    }`}
                  >
                    {t(`tone.${tone}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div id="field-keywords">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {t("label.keywords")}
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2.5 py-1 text-xs font-medium"
                  >
                    {kw}
                    <button onClick={() => {
                      update("keywords", form.keywords.filter((k) => k !== kw));
                      setSuggestedKeywords(prev => prev.filter(s => s.toLowerCase() !== kw.toLowerCase()));
                    }}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  placeholder={t("placeholder.addKeyword")}
                  className="bg-secondary border-border flex-1"
                />
                <Button variant="outline" size="sm" onClick={addKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1.5 text-xs text-primary hover:text-primary hover:bg-primary/10 h-7 px-2"
                onClick={() => {
                  try {
                    const suggestions = generateKeywords(form, language);
                    setSuggestedKeywords(suggestions.slice(0, 10));
                    if (suggestions.length === 0) toast(t("keywords.noNew"));
                  } catch { toast.error(t("keywords.genError")); }
                }}
              >
                <Sparkles className="h-3 w-3 mr-1" /> {t("btn.suggestKeywords")}
              </Button>

              {suggestedKeywords.length > 0 && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" /> {t("keywords.suggested")}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-primary hover:bg-primary/10"
                      onClick={() => {
                        const existing = new Set(form.keywords.map(k => k.toLowerCase()));
                        const toAdd = suggestedKeywords.filter(k => !existing.has(k.toLowerCase()));
                        if (toAdd.length > 0) {
                          update("keywords", [...form.keywords, ...toAdd]);
                          setSuggestedKeywords([]);
                          toast.success(t("keywords.added", { count: toAdd.length }));
                        }
                      }}
                    >
                      {t("keywords.addAll")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedKeywords.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => {
                          if (!form.keywords.some(k => k.toLowerCase() === kw.toLowerCase())) {
                            update("keywords", [...form.keywords, kw]);
                          }
                          setSuggestedKeywords(prev => prev.filter(s => s !== kw));
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-background px-2.5 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Plus className="h-2.5 w-2.5" /> {kw}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSuggestedKeywords([])}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t("keywords.dismiss")}
                  </button>
                </div>
              )}
            </div>

            {/* AI Control Commands */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                  {t("cmd.title")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t("cmd.subtitle")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t("cmd.takeoverLabel")}
                  </label>
                  <Input
                    value={form.cmdTakeover}
                    onChange={(e) => update("cmdTakeover", e.target.value)}
                    placeholder="e.g. atendente"
                    className="bg-secondary border-border"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t("cmd.resumeLabel")}
                  </label>
                  <Input
                    value={form.cmdResume}
                    onChange={(e) => update("cmdResume", e.target.value)}
                    placeholder="e.g. voltar"
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {t("cmd.customLabel")}
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.cmdCustom.map((cmd) => (
                    <span
                      key={cmd}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2.5 py-1 text-xs font-medium"
                    >
                      {cmd}
                      <button onClick={() => update("cmdCustom", form.cmdCustom.filter((c) => c !== cmd))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    id="custom-cmd-input"
                    placeholder={t("cmd.customPlaceholder")}
                    className="bg-secondary border-border flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !form.cmdCustom.includes(val)) {
                          update("cmdCustom", [...form.cmdCustom, val]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById("custom-cmd-input") as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val && !form.cmdCustom.includes(val)) {
                        update("cmdCustom", [...form.cmdCustom, val]);
                        input.value = "";
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {t("cmd.autoResumeLabel")}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={form.autoResumeMinutes}
                  onChange={(e) => update("autoResumeMinutes", Number(e.target.value))}
                  placeholder="e.g. 10"
                  className="bg-secondary border-border w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("cmd.autoResumeDesc")}
                </p>
              </div>
            </div>

            {/* FAQ */}
            <div id="field-faqs">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {t("faq.title")}
              </label>
              <div className="space-y-3">
                {form.faqs.map((faq, i) => (
                  <div key={i} className="rounded-lg border border-border bg-secondary p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={faq.question}
                        onChange={(e) => {
                          const updated = [...form.faqs];
                          updated[i] = { ...updated[i], question: e.target.value };
                          update("faqs", updated);
                        }}
                        placeholder={t("faq.questionPlaceholder")}
                        className="bg-muted border-border text-sm flex-1"
                      />
                      <button
                        onClick={() => update("faqs", form.faqs.filter((_, idx) => idx !== i))}
                        disabled={isSuggestionLocked}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Input
                      value={faq.answer}
                      onChange={(e) => {
                        const updated = [...form.faqs];
                        updated[i] = { ...updated[i], answer: e.target.value };
                        update("faqs", updated);
                      }}
                      placeholder={t("faq.answerPlaceholder")}
                      className="bg-muted border-border text-sm"
                    />
                    {(faq.question.trim() || faq.answer.trim()) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-primary hover:text-primary hover:bg-primary/10 h-6 px-2"
                        onClick={() => handleImproveFaq(i)}
                        disabled={isSuggestionLocked}
                      >
                        {improvingField === `faq-${i}` ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {t("btn.improving")}</>
                        ) : (
                          <><Wand2 className="h-3 w-3 mr-1" /> {t("btn.improveWithAi")}</>
                        )}
                      </Button>
                    )}
                    {improveError?.field === `faq-${i}` && !improvingField && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        {improveError.message}
                      </div>
                    )}
                    {pendingSuggestion?.field === `faq-${i}` && (
                      <div className="mt-1">
                        <AISuggestionCard
                          key={`${pendingSuggestion.field}-${pendingSuggestion.suggested}`}
                          fieldLabel={pendingSuggestion.label}
                          original={pendingSuggestion.original}
                          suggested={pendingSuggestion.suggested}
                          originalQuestion={pendingSuggestion.originalQuestion}
                          suggestedQuestion={pendingSuggestion.suggestedQuestion}
                          onApply={handleApplySuggestion}
                          onDismiss={handleDismissSuggestion}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update("faqs", [...form.faqs, { question: "", answer: "" }])}
                  className="w-full"
                  disabled={isSuggestionLocked}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> {t("faq.addFaq")}
                </Button>
              </div>
            </div>

            {/* Assistant Identity */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                <Bot className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                {t("identity.title")}
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                {t("identity.subtitle")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: "virtual" as const, icon: Cpu, label: t("identity.virtual"), desc: t("identity.virtualDesc") },
                  { value: "human" as const, icon: User, label: t("identity.human"), desc: t("identity.humanDesc") },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update("assistantIdentity", opt.value)}
                    className={`text-left rounded-lg border p-3 transition-all ${
                      form.assistantIdentity === opt.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-secondary hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <opt.icon className={`h-4 w-4 ${form.assistantIdentity === opt.value ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${form.assistantIdentity === opt.value ? "text-primary" : "text-foreground"}`}>
                        {opt.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Working Hours */}
            <div id="field-working-hours">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                <Clock className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                {t("hours.title")}
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="time"
                  value={form.workingHoursStart}
                  onChange={(e) => update("workingHoursStart", e.target.value)}
                  className="bg-secondary border-border w-32"
                />
                <span className="text-xs text-muted-foreground">{t("hours.to")}</span>
                <Input
                  type="time"
                  value={form.workingHoursEnd}
                  onChange={(e) => update("workingHoursEnd", e.target.value)}
                  className="bg-secondary border-border w-32"
                />
              </div>
            </div>

            {/* AI Availability */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                <Bot className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                {t("aiAvail.title")}
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                {t("aiAvail.subtitle")}
              </p>
              <div className="space-y-2">
                {([
                  { value: "same" as const, label: t("aiAvail.same"), desc: t("aiAvail.sameDesc") },
                  { value: "24/7" as const, label: t("aiAvail.247"), desc: t("aiAvail.247Desc") },
                  { value: "custom" as const, label: t("aiAvail.custom"), desc: t("aiAvail.customDesc") },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update("aiAvailability", opt.value)}
                    className={`w-full text-left rounded-lg border p-3 transition-all ${
                      form.aiAvailability === opt.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-secondary hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full border-2 flex items-center justify-center ${
                        form.aiAvailability === opt.value ? "border-primary" : "border-muted-foreground/40"
                      }`}>
                        {form.aiAvailability === opt.value && (
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                      <span className={`text-sm font-medium ${
                        form.aiAvailability === opt.value ? "text-primary" : "text-foreground"
                      }`}>{opt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {form.aiAvailability === "custom" && (
                <div className="flex items-center gap-3 mt-3 ml-5">
                  <Input
                    type="time"
                    value={form.aiCustomStart}
                    onChange={(e) => update("aiCustomStart", e.target.value)}
                    className="bg-secondary border-border w-32"
                  />
                  <span className="text-xs text-muted-foreground">{t("hours.to")}</span>
                  <Input
                    type="time"
                    value={form.aiCustomEnd}
                    onChange={(e) => update("aiCustomEnd", e.target.value)}
                    className="bg-secondary border-border w-32"
                  />
                </div>
              )}

              {form.aiAvailability !== "same" && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    <span className="text-primary font-medium">{t("aiAvail.outsideHours")}</span> — {t("aiAvail.outsideMsg")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <ServicesManager />
          <ProfessionalSettings />
          <WhatsAppConnection />

          <Button variant="glow" size="lg" className="w-full">
            {t("btn.saveAndContinue")}
          </Button>
        </div>

        {/* RIGHT: AI Copilot — 2 cols */}
        <div className="lg:col-span-2">
          <CopilotErrorBoundary>
            <AICopilot
              form={form}
              progress={progress}
              missingFields={missingFields}
              onApplyDescription={(desc) => update("description", desc)}
              onApplyFaqs={(faqs) => update("faqs", faqs)}
              onApplyTone={(tone) => update("tone", tone)}
              onApplyKeywords={(kws) => update("keywords", kws)}
              onApplyField={update}
            />
          </CopilotErrorBoundary>
        </div>
      </div>
    </div>
  );
}
