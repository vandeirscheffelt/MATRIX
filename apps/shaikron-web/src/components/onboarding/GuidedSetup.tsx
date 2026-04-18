import { useState, useCallback } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import type { OnboardingFormState, FAQ } from "@/hooks/useOnboardingForm";
import { generateDescription, generateFAQs, getToneRecommendation, generateKeywords } from "./copilot/generators";

interface GuidedStep {
  id: string;
  questionKey: string;
  field: keyof OnboardingFormState | "special";
  placeholderKey: string;
}

const GUIDED_STEPS: GuidedStep[] = [
  { id: "name", questionKey: "guided.businessNameQ", field: "businessName", placeholderKey: "guided.businessNamePh" },
  { id: "what", questionKey: "guided.whatDoesQ", field: "description", placeholderKey: "guided.whatDoesPh" },
  { id: "diff", questionKey: "guided.differentialQ", field: "special", placeholderKey: "guided.differentialPh" },
  { id: "appt", questionKey: "guided.appointmentsQ", field: "special", placeholderKey: "guided.appointmentsPh" },
];

interface Props {
  form: OnboardingFormState;
  onApplyDescription: (desc: string) => void;
  onApplyFaqs: (faqs: FAQ[]) => void;
  onApplyTone: (tone: string) => void;
  onApplyKeywords: (kws: string[]) => void;
  onApplyField: (field: keyof OnboardingFormState, value: any) => void;
  onClose: () => void;
}

export default function GuidedSetup({ form, onApplyDescription, onApplyFaqs, onApplyTone, onApplyKeywords, onApplyField, onClose }: Props) {
  const { language, t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState("");
  const [completed, setCompleted] = useState(false);

  const step = GUIDED_STEPS[currentStep];

  const handleSubmitAnswer = useCallback(() => {
    if (!inputValue.trim()) return;

    const newAnswers = { ...answers, [step.id]: inputValue.trim() };
    setAnswers(newAnswers);

    if (step.field === "businessName") {
      onApplyField("businessName", inputValue.trim());
    }

    setInputValue("");

    if (currentStep < GUIDED_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      try {
        const tempForm = { ...form, businessName: newAnswers.name || form.businessName };
        
        const parts = [newAnswers.what, newAnswers.diff].filter(Boolean);
        const desc = parts.length > 0
          ? `${tempForm.businessName || "Our business"} ${parts[0]}. ${parts[1] ? parts[1] + ". " : ""}`
          : generateDescription(tempForm);
        onApplyDescription(desc);

        try {
          const faqs = generateFAQs(tempForm);
          if (Array.isArray(faqs) && faqs.length > 0) onApplyFaqs(faqs);
        } catch { /* skip */ }

        try {
          const tone = getToneRecommendation(form.businessType) || "Professional";
          onApplyTone(tone);
        } catch { /* skip */ }

        try {
          const kws = generateKeywords(tempForm, language);
          if (Array.isArray(kws) && kws.length > 0) onApplyKeywords(kws);
        } catch { /* skip */ }
      } catch (error) {
        console.error("Guided setup generation failed:", error);
      }

      setCompleted(true);
    }
  }, [inputValue, step, currentStep, answers, form, onApplyField, onApplyDescription, onApplyFaqs, onApplyTone, onApplyKeywords]);

  if (completed) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-center">
          <Check className="h-6 w-6 text-green-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-400">{t("guided.setupComplete")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("guided.reviewAdjust")}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
          {t("guided.continueManually")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {GUIDED_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < currentStep ? "bg-primary" : i === currentStep ? "bg-primary/60" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="space-y-3">
        {Object.entries(answers).slice(-2).map(([key, val]) => (
          <div key={key} className="flex items-start gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="h-3 w-3 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">{val}</p>
          </div>
        ))}

        <div className="flex items-start gap-2">
          <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          </div>
          <p className="text-sm font-medium text-foreground">{t(step.questionKey)}</p>
        </div>

        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitAnswer()}
            placeholder={t(step.placeholderKey)}
            className="bg-secondary border-border text-sm flex-1"
            autoFocus
          />
          <Button size="sm" onClick={handleSubmitAnswer} disabled={!inputValue.trim()}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <button
        onClick={onClose}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {t("guided.skipSetup")}
      </button>
    </div>
  );
}
