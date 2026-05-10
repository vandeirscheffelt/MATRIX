import { useState, useCallback, useEffect, useRef, Component, type ReactNode } from "react";
import { api } from "@/lib/apiClient";
import { X, Plus, Trash2, Bot, Clock, Shield, Wand2, Loader2, AlertCircle, User, Cpu, Sparkles, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnboardingForm } from "@/hooks/useOnboardingForm";
import AICopilot from "@/components/onboarding/AICopilot";
import AISuggestionCard from "@/components/onboarding/AISuggestionCard";
import { expandDescription, generateDescription, generateKeywords } from "@/components/onboarding/copilot/generators";
import WhatsAppConnection from "@/components/onboarding/WhatsAppConnection";
import ServicesManager from "@/components/onboarding/ServicesManager";
import ProfessionalSettings from "@/components/onboarding/ProfessionalSettings";
import FeriadosPanel from "@/components/onboarding/FeriadosPanel";
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
  const { form, update, reset, progress, missingFields } = useOnboardingForm();
  const [keywordInput, setKeywordInput] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [improvingField, setImprovingField] = useState<string | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);
  const [improveError, setImproveError] = useState<ImproveErrorState | null>(null);
  const [faqClarification, setFaqClarification] = useState<{ field: string; index: number; question: string; faq: { question: string; answer: string } } | null>(null);
  const [faqClarificationInput, setFaqClarificationInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [promptDesatualizado, setPromptDesatualizado] = useState(false);
  const [regenerandoPrompt, setRegenerandoPrompt] = useState(false);
  const [contextoDesatualizado, setContextoDesatualizado] = useState(false);
  const latestFormRef = useRef(form);
  const requestIdRef = useRef(0);
  const requestLockRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  // Auto-save: persiste os campos principais 1s após parar de digitar
  const saveFaqs = useCallback((faqs: typeof form.faqs) => {
    const valid = faqs.filter(f => f.question.trim() && f.answer.trim()).map(f => ({ pergunta: f.question, resposta: f.answer }));
    api.put("/app/faq", valid).catch(() => null);
  }, []);

  const autoSaveInitRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const doSave = useCallback(() => {
    const f = latestFormRef.current;
    if (f.businessName?.trim()) api.put("/app/empresa", { nome: f.businessName.trim() }).catch(() => null);
    if (f.businessType) api.patch("/app/config/tipo-negocio", { tipoNegocio: f.businessType }).catch(() => null);
    if (f.description?.trim()) api.patch("/app/config/contexto-operacional", { contexto: f.description.trim() }).catch(() => null);
    if (f.tone) api.patch("/app/config/tom", { tom: f.tone === "Formal" || f.tone === "Professional" ? "FORMAL" : "INFORMAL", tomDisplay: f.tone }).catch(() => null);
    if (f.cmdTakeover?.trim() || f.cmdResume?.trim()) api.patch("/app/config/comandos-controle", { palavraPausa: f.cmdTakeover, palavraRetorno: f.cmdResume }).catch(() => null);
    if (f.autoResumeMinutes) api.patch("/app/config/auto-retomada", { tempoRetornoMin: f.autoResumeMinutes }).catch(() => null);
    if (Array.isArray(f.keywords)) {
      api.get<any[]>("/app/config/keywords").then(existing => {
        const existingWords = (existing ?? []).map((k: any) => k.palavra as string);
        const toAdd = f.keywords.filter((k: string) => !existingWords.includes(k));
        const toRemove = (existing ?? []).filter((k: any) => !f.keywords.includes(k.palavra));
        toAdd.forEach((k: string) => api.post("/app/config/keywords", { palavra: k }).catch(() => null));
        toRemove.forEach((k: any) => api.delete(`/app/config/keywords/${k.id}`).catch(() => null));
      }).catch(() => null);
    }
    pendingSaveRef.current = false;
  }, []);
  useEffect(() => {
    if (!autoSaveInitRef.current) { autoSaveInitRef.current = true; return; }
    pendingSaveRef.current = true;
    const timer = setTimeout(doSave, 1000);
    return () => { clearTimeout(timer); };
  }, [form.businessName, form.businessType, form.description, form.tone, form.keywords, form.cmdTakeover, form.cmdResume, form.autoResumeMinutes, doSave]);
  // Salva ao sair da página se houver mudanças pendentes
  useEffect(() => {
    return () => { if (pendingSaveRef.current) doSave(); };
  }, [doSave]);

  useEffect(() => {
    isMountedRef.current = true;
    // Carrega configurações existentes do banco
    Promise.all([
      api.get<any>("/app/config").catch(() => null),
      api.get<any>("/app/empresa").catch(() => null),
      api.get<any[]>("/app/config/keywords").catch(() => []),
      api.get<any[]>("/app/faq").catch(() => []),
    ]).then(([config, empresa, keywords, faqs]) => {
      if (!isMountedRef.current) return;
      const partial: Record<string, any> = {};
      if (empresa?.nome) partial.businessName = empresa.nome;
      if (config?.tipoNegocio) partial.businessType = config.tipoNegocio;
      if (config?.contextoOperacional) partial.description = config.contextoOperacional;
      if (config?.tomDisplay) partial.tone = config.tomDisplay;
      else if (config?.tom) partial.tone = config.tom === "FORMAL" ? "Formal" : "Informal";
      if (config?.horarioInicio) partial.workingHoursStart = config.horarioInicio;
      if (config?.horarioFim) partial.workingHoursEnd = config.horarioFim;
      if (config?.disponibilidade) partial.aiAvailability = config.disponibilidade === "horario_comercial" ? "same" : config.disponibilidade === "24_7" ? "24/7" : "custom";
      if (config?.identidade) partial.assistantIdentity = config.identidade === "assistente_virtual" ? "virtual" : "human";
      if (config?.nomeAssistente) partial.assistantName = config.nomeAssistente;
      if (config?.palavraPausa) partial.cmdTakeover = config.palavraPausa;
      if (config?.palavraRetorno) partial.cmdResume = config.palavraRetorno;
      if (config?.tempoRetornoMin) partial.autoResumeMinutes = config.tempoRetornoMin;
      if (config?.confirmacaoAntecedenciaHoras) partial.confirmacaoAntecedenciaHoras = config.confirmacaoAntecedenciaHoras;
      if (config?.coletarCadastroCompleto !== undefined) partial.coletarCadastroCompleto = config.coletarCadastroCompleto;
      if (config?.generoAssistente) partial.assistantGender = config.generoAssistente;
      if (config?.promptAtualizado === false) setPromptDesatualizado(true);
      if (Array.isArray(keywords) && keywords.length > 0) partial.keywords = keywords.map((k: any) => k.palavra ?? k);
      if (Array.isArray(faqs) && faqs.length > 0) partial.faqs = faqs.map((f: any) => ({ question: f.pergunta, answer: f.resposta }));
      reset(partial);
    });

    return () => {
      isMountedRef.current = false;
      requestLockRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const f = latestFormRef.current;
      await Promise.all([
        api.put("/app/empresa", { nome: f.businessName }).catch(() => null),
        api.patch("/app/config/tipo-negocio", { tipoNegocio: f.businessType }).catch(() => null),
        api.patch("/app/config/contexto-operacional", { contexto: f.description }).catch(() => null),
        api.patch("/app/config/tom", { tom: f.tone === "Formal" || f.tone === "Professional" ? "FORMAL" : "INFORMAL" }).catch(() => null),
        api.patch("/app/config/identidade", { identidade: f.assistantIdentity === "virtual" ? "assistente_virtual" : "atendente_humano" }).catch(() => null),
        api.patch("/app/config/horario-comercial", { horarioInicio: f.workingHoursStart, horarioFim: f.workingHoursEnd }).catch(() => null),
        api.patch("/app/config/disponibilidade-ia", { disponibilidade: f.aiAvailability === "same" ? "horario_comercial" : f.aiAvailability === "24/7" ? "24_7" : "personalizado" }).catch(() => null),
        api.patch("/app/config/comandos-controle", { palavraPausa: f.cmdTakeover, palavraRetorno: f.cmdResume }).catch(() => null),
        api.patch("/app/config/auto-retomada", { tempoRetornoMin: f.autoResumeMinutes }).catch(() => null),
        f.assistantName.trim() ? api.patch("/app/config/nome-assistente", { nomeAssistente: f.assistantName.trim() }).catch(() => null) : Promise.resolve(),
        api.put("/app/faq", f.faqs.filter(faq => faq.question.trim() && faq.answer.trim()).map(faq => ({ pergunta: faq.question, resposta: faq.answer }))).catch(() => null),
      ]);
      toast.success("Configurações salvas com sucesso!");
    } catch {
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
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
    const kw = keywordInput.trim();
    if (kw && !form.keywords.includes(kw)) {
      update("keywords", [...form.keywords, kw]);
      api.post("/app/config/keywords", { palavra: kw }).catch(() => null);
      setKeywordInput("");
    }
  };

  const handleGerarContexto = useCallback(async () => {
    if (improvingField) return;
    setImprovingField("description");
    setImproveError(null);
    try {
      const result = await api.post<{ contexto: string }>("/app/copiloto/gerar-contexto", {});
      if (!result?.contexto) throw new Error("Sem retorno");
      update("description", result.contexto);
      toast.success("Perfil do assistente gerado com sucesso!");
    } catch {
      setImproveError({ field: "description", message: "Não foi possível gerar. Preencha tipo de negócio e nome antes de tentar." });
    } finally {
      setImprovingField(null);
    }
  }, [improvingField, update]);

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

    const run = async (contextoAdicional?: string) => {
      try {
        const result = await api.post<any>("/app/faq/melhorar", {
          pergunta: faq.question,
          resposta: faq.answer,
          ...(contextoAdicional ? { contexto_adicional: contextoAdicional } : {}),
        });

        if (!isMountedRef.current || requestId !== requestIdRef.current) return;

        if (result?.needs_clarification) {
          setFaqClarification({ field, index, question: result.question, faq: { question: faq.question, answer: faq.answer } });
          setFaqClarificationInput("");
          return;
        }

        setFaqClarification(null);
        const answerText = result?.resposta?.trim() ?? "";
        const questionText = result?.pergunta?.trim() ?? "";

        if (answerText === faq.answer.trim() && questionText === faq.question.trim()) {
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

  const handleImproveFaqWithContext = useCallback((index: number, contextoAdicional: string) => {
    const formSnapshot = buildFormSnapshot();
    const faq = formSnapshot.faqs[index];
    if (!faq) return;

    requestLockRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const field = `faq-${index}`;

    setImproveError(null);
    setImprovingField(field);

    const run = async () => {
      try {
        const result = await api.post<any>("/app/faq/melhorar", {
          pergunta: faq.question,
          resposta: faq.answer,
          contexto_adicional: contextoAdicional,
        });

        if (!isMountedRef.current || requestId !== requestIdRef.current) return;

        if (result?.needs_clarification) {
          setFaqClarification({ field, index, question: result.question, faq: { question: faq.question, answer: faq.answer } });
          setFaqClarificationInput("");
          return;
        }

        setFaqClarification(null);
        const answerText = result?.resposta?.trim() ?? "";
        const questionText = result?.pergunta?.trim() ?? "";

        setImproveError(null);
        setPendingSuggestion({
          field,
          label: `FAQ #${index + 1}`,
          original: faq.answer,
          suggested: answerText || faq.answer,
          originalQuestion: faq.question,
          suggestedQuestion: questionText || faq.question,
        });
      } catch {
        if (!isMountedRef.current || requestId !== requestIdRef.current) return;
        setImproveError({ field, message: t("error.improveText") });
        toast.error(t("error.improveText"));
      } finally {
        if (requestId === requestIdRef.current) requestLockRef.current = false;
        if (isMountedRef.current && requestId === requestIdRef.current) setImprovingField(null);
      }
    };

    void run();
  }, [buildFormSnapshot, t]);

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
      api.patch("/app/config/contexto-operacional", { contexto: suggestionText }).catch(() => null);
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

      {promptDesatualizado && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-400 shrink-0" />
            <p className="text-sm text-orange-300">
              Configurações alteradas — regenere o prompt do assistente para aplicar as mudanças.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-orange-500/50 text-orange-300 hover:bg-orange-500/20 hover:text-orange-200 h-8 text-xs"
            disabled={regenerandoPrompt}
            onClick={async () => {
              setRegenerandoPrompt(true);
              try {
                const result = await api.post<{ prompt: string }>("/app/config/gerar-prompt", {});
                if (result?.prompt) {
                  await api.put("/app/config", { prompt: result.prompt });
                  await api.patch("/app/config/prompt-confirmado", {});
                  setPromptDesatualizado(false);
                  toast.success("Prompt do assistente atualizado com sucesso!");
                }
              } catch {
                toast.error("Erro ao regenerar o prompt. Tente novamente.");
              } finally {
                setRegenerandoPrompt(false);
              }
            }}
          >
            {regenerandoPrompt ? (
              <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Gerando...</>
            ) : (
              <><Sparkles className="h-3 w-3 mr-1.5" /> Regenerar Prompt</>
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Form — 3 cols (order-2 on mobile so Copilot appears first) */}
        <div className="lg:col-span-3 space-y-5 order-2 lg:order-1">
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
                    onClick={() => { update("businessType", type); api.patch("/app/config/tipo-negocio", { tipoNegocio: type }).catch(() => null); setPromptDesatualizado(true); setContextoDesatualizado(true); }}
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

            {/* Description — gerado pela IA03, não editável pelo usuário */}
            <div id="field-description">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {t("label.operationalContext")}
              </label>
              <p className="text-xs text-muted-foreground mb-1.5">
                Perfil gerado automaticamente pelo Copiloto com base nas suas configurações.
              </p>
              <div className={`min-h-[100px] rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground leading-relaxed ${!form.description ? "text-muted-foreground italic" : ""}`}>
                {form.description || "Clique em \"Gerar com IA\" para criar o perfil do seu assistente automaticamente."}
              </div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`text-xs h-7 px-2 ${contextoDesatualizado ? "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 border border-orange-500/30" : "text-primary hover:text-primary hover:bg-primary/10"}`}
                  onClick={async () => { await handleGerarContexto(); setContextoDesatualizado(false); }}
                  disabled={!!improvingField}
                >
                  {improvingField === "description" ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Gerando...</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" /> {form.description ? "Regenerar com IA" : "Gerar com IA"}</>
                  )}
                </Button>
                {contextoDesatualizado && !improvingField && (
                  <span className="text-[10px] text-orange-400">
                    ⚠ Configurações alteradas — regenere para atualizar
                  </span>
                )}
              </div>
              {improveError?.field === "description" && !improvingField && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {improveError.message}
                </div>
              )}
              {false && pendingSuggestion?.field === "description" && (
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
                    onClick={() => { update("tone", tone); api.patch("/app/config/tom", { tom: tone === "Formal" || tone === "Professional" ? "FORMAL" : "INFORMAL", tomDisplay: tone }).catch(() => null); setPromptDesatualizado(true); setContextoDesatualizado(true); }}
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
              <p className="text-xs text-muted-foreground mt-2">
                O tom é aplicado automaticamente pelo assistente, independente das instruções acima.
              </p>
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
                      api.get<any[]>("/app/config/keywords").then(existing => {
                        const found = (existing ?? []).find((k: any) => k.palavra === kw);
                        if (found) api.delete(`/app/config/keywords/${found.id}`).catch(() => null);
                      }).catch(() => null);
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
                          toAdd.forEach((k: string) => api.post("/app/config/keywords", { palavra: k }).catch(() => null));
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
                            api.post("/app/config/keywords", { palavra: kw }).catch(() => null);
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
                    onBlur={(e) => { if (e.target.value.trim()) api.patch("/app/config/comandos-controle", { palavraPausa: e.target.value.trim(), palavraRetorno: latestFormRef.current.cmdResume }).catch(() => null); }}
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
                    onBlur={(e) => { if (e.target.value.trim()) api.patch("/app/config/comandos-controle", { palavraPausa: latestFormRef.current.cmdTakeover, palavraRetorno: e.target.value.trim() }).catch(() => null); }}
                    placeholder="e.g. voltar"
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Antecedência para confirmação de agendamento
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={48}
                    value={form.confirmacaoAntecedenciaHoras ?? 2}
                    onChange={(e) => update("confirmacaoAntecedenciaHoras", Number(e.target.value))}
                    onBlur={(e) => { const v = Number(e.target.value); if (v >= 1) api.patch("/app/config/confirmacao-antecedencia", { confirmacaoAntecedenciaHoras: v }).catch(() => null); }}
                    className="bg-secondary border-border w-32"
                  />
                  <span className="text-sm text-muted-foreground">horas antes da consulta</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  A IA enviará uma confirmação via WhatsApp este tempo antes do agendamento
                </p>
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
                  onBlur={(e) => { const v = Number(e.target.value); if (v > 0) api.patch("/app/config/auto-retomada", { tempoRetornoMin: v }).catch(() => null); }}
                  placeholder="e.g. 10"
                  className="bg-secondary border-border w-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("cmd.autoResumeDesc")}
                </p>
              </div>
            </div>

            {/* Coleta de Dados */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Coleta de Dados do Cliente
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: false, label: "Só agenda", sub: "Nome + Telefone" },
                  { value: true,  label: "Cadastro CRM", sub: "Campos do perfil do cliente" },
                ] as const).map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => { update("coletarCadastroCompleto", opt.value); api.patch("/app/config/coleta-dados", { coletarCadastroCompleto: opt.value }).catch(() => null); setPromptDesatualizado(true); }}
                    className={`rounded-lg border px-4 py-3 text-left transition-all ${form.coletarCadastroCompleto === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-foreground hover:border-primary/40"}`}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="text-xs opacity-60 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
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
                        onBlur={() => saveFaqs(latestFormRef.current.faqs)}
                        placeholder={t("faq.questionPlaceholder")}
                        className="bg-muted border-border text-sm flex-1"
                      />
                      <button
                        onClick={() => { const updated = form.faqs.filter((_, idx) => idx !== i); update("faqs", updated); saveFaqs(updated); }}
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
                      onBlur={() => saveFaqs(latestFormRef.current.faqs)}
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
                    {faqClarification?.field === `faq-${i}` && (
                      <div className="mt-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                          <div className="space-y-1.5 flex-1">
                            <p className="text-xs font-medium text-yellow-300">A IA precisa de mais contexto</p>
                            <p className="text-xs text-yellow-200/80">{faqClarification.question}</p>
                            <Input
                              value={faqClarificationInput}
                              onChange={(e) => setFaqClarificationInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && faqClarificationInput.trim()) {
                                  setFaqClarification(null);
                                  handleImproveFaqWithContext(i, faqClarificationInput.trim());
                                }
                              }}
                              placeholder="Responda aqui..."
                              className="bg-yellow-950/40 border-yellow-500/30 text-yellow-100 placeholder:text-yellow-500/50 text-xs h-8"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-yellow-500 hover:bg-yellow-400 text-black"
                                onClick={() => {
                                  if (!faqClarificationInput.trim()) return;
                                  setFaqClarification(null);
                                  handleImproveFaqWithContext(i, faqClarificationInput.trim());
                                }}
                              >
                                Gerar sugestão
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-yellow-400 hover:text-yellow-300"
                                onClick={() => { setFaqClarification(null); setFaqClarificationInput(""); }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </div>
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
                    onClick={() => {
                      update("assistantIdentity", opt.value);
                      api.patch("/app/config/identidade", { identidade: opt.value === "virtual" ? "assistente_virtual" : "atendente_humano" }).catch(() => null);
                      setPromptDesatualizado(true);
                      setContextoDesatualizado(true);
                    }}
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

            {/* Assistant Name */}
            <div id="field-assistant-name">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                <Bot className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                {t("assistantName.title")}
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                {t("assistantName.subtitle")}
              </p>
              <Input
                id="input-assistant-name"
                placeholder={t("assistantName.placeholder")}
                value={form.assistantName}
                onChange={(e) => update("assistantName", e.target.value)}
                onBlur={(e) => { if (e.target.value.trim()) { api.patch("/app/config/nome-assistente", { nomeAssistente: e.target.value.trim() }).catch(() => null); setPromptDesatualizado(true); setContextoDesatualizado(true); } }}
                maxLength={50}
                className="bg-secondary border-border"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Gênero</span>
                {(["feminino", "masculino", "neutro"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      update("assistantGender", g);
                      api.patch("/app/config/genero-assistente", { generoAssistente: g }).catch(() => null);
                      setPromptDesatualizado(true);
                    }}
                    className={`rounded-full border px-3 py-0.5 text-[11px] font-medium transition-all capitalize ${
                      form.assistantGender === g
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {g}
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
                  onBlur={() => api.patch("/app/config/horario-comercial", { horarioInicio: form.workingHoursStart, horarioFim: form.workingHoursEnd }).catch(() => null)}
                  className="bg-secondary border-border w-32"
                />
                <span className="text-xs text-muted-foreground">{t("hours.to")}</span>
                <Input
                  type="time"
                  value={form.workingHoursEnd}
                  onChange={(e) => update("workingHoursEnd", e.target.value)}
                  onBlur={() => api.patch("/app/config/horario-comercial", { horarioInicio: form.workingHoursStart, horarioFim: form.workingHoursEnd }).catch(() => null)}
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
                    onClick={() => {
                      update("aiAvailability", opt.value);
                      api.patch("/app/config/disponibilidade-ia", { disponibilidade: opt.value === "same" ? "horario_comercial" : opt.value === "24/7" ? "24_7" : "personalizado" }).catch(() => null);
                    }}
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
          <FeriadosPanel />
          <WhatsAppConnection />

          <Button type="button" variant="glow" size="lg" className="w-full relative z-50" onClick={() => { console.log("SAVE CLICKED"); handleSave(); }} disabled={saving}>
            {saving ? "Salvando..." : t("btn.saveAndContinue")}
          </Button>
        </div>

        {/* RIGHT: AI Copilot — 2 cols (order-1 on mobile so it appears at top) */}
        <div className="lg:col-span-2 order-1 lg:order-2">
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
              promptDesatualizado={promptDesatualizado}
              contextoDesatualizado={contextoDesatualizado}
            />
          </CopilotErrorBoundary>
        </div>
      </div>
    </div>
  );
}
