import type { Sparkles } from "lucide-react";
import type { FAQ } from "@/hooks/useOnboardingForm";

export interface Suggestion {
  id: string;
  type: "description" | "faq" | "tone" | "keywords" | "general" | "gap";
  icon: typeof Sparkles;
  label: string;
  message: string;
  payload?: any;
  priority: number;
}

export interface KnowledgeGap {
  id: string;
  question: string;
  frequency: number;
  detectedAt: string;
  suggestedAnswer?: string;
}

export interface AICopilotProps {
  form: import("@/hooks/useOnboardingForm").OnboardingFormState;
  progress: number;
  missingFields: string[];
  onApplyDescription: (desc: string) => void;
  onApplyFaqs: (faqs: FAQ[]) => void;
  onApplyTone: (tone: string) => void;
  onApplyKeywords: (keywords: string[]) => void;
}
