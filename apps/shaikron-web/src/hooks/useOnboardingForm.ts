import { useState, useCallback, useMemo } from "react";

export interface FAQ {
  question: string;
  answer: string;
}

export type AiAvailabilityMode = "same" | "24/7" | "custom";
export type AssistantIdentity = "virtual" | "human";

export interface OnboardingFormState {
  businessName: string;
  businessType: string;
  description: string;
  tone: string;
  keywords: string[];
  faqs: FAQ[];
  workingHoursStart: string;
  workingHoursEnd: string;
  aiAvailability: AiAvailabilityMode;
  aiCustomStart: string;
  aiCustomEnd: string;
  assistantIdentity: AssistantIdentity;
  assistantName: string;
  cmdTakeover: string;
  cmdPause: string;
  cmdResume: string;
  cmdCustom: string[];
  autoResumeMinutes: number;
}

export type OnboardingField = keyof OnboardingFormState;

const INITIAL_STATE: OnboardingFormState = {
  businessName: "",
  businessType: "",
  description: "",
  tone: "Professional",
  keywords: ["wellness", "health"],
  faqs: [{ question: "", answer: "" }],
  workingHoursStart: "08:00",
  workingHoursEnd: "18:00",
  aiAvailability: "same",
  aiCustomStart: "00:00",
  aiCustomEnd: "23:59",
  assistantIdentity: "virtual",
  assistantName: "",
  cmdTakeover: "atendente",
  cmdPause: "pausar",
  cmdResume: "voltar",
  cmdCustom: [],
  autoResumeMinutes: 10,
};

const FIELD_WEIGHTS: Record<string, number> = {
  businessName: 14,
  businessType: 14,
  description: 19,
  tone: 9,
  keywords: 14,
  faqs: 14,
  workingHours: 9,
  assistantName: 7,
};

export function useOnboardingForm() {
  const [form, setForm] = useState<OnboardingFormState>(INITIAL_STATE);

  const update = useCallback(<K extends OnboardingField>(field: K, value: OnboardingFormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback((partial: Partial<OnboardingFormState>) => {
    setForm(prev => ({ ...prev, ...partial }));
  }, []);

  const progress = useMemo(() => {
    let score = 0;
    if (form.businessName.trim()) score += FIELD_WEIGHTS.businessName;
    if (form.businessType) score += FIELD_WEIGHTS.businessType;
    if (form.description.trim().length > 20) score += FIELD_WEIGHTS.description;
    if (form.tone) score += FIELD_WEIGHTS.tone;
    if (form.keywords.length >= 2) score += FIELD_WEIGHTS.keywords;
    if (form.faqs.some(f => f.question.trim() && f.answer.trim())) score += FIELD_WEIGHTS.faqs;
    if (form.workingHoursStart && form.workingHoursEnd) score += FIELD_WEIGHTS.workingHours;
    if (form.assistantName.trim()) score += FIELD_WEIGHTS.assistantName;
    return score;
  }, [form]);

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!form.businessName.trim()) missing.push("businessName");
    if (!form.businessType) missing.push("businessType");
    if (form.description.trim().length <= 20) missing.push("description");
    if (form.faqs.every(f => !f.question.trim() || !f.answer.trim())) missing.push("faqs");
    if (form.keywords.length < 2) missing.push("keywords");
    return missing;
  }, [form]);

  return { form, update, reset, progress, missingFields };
}
