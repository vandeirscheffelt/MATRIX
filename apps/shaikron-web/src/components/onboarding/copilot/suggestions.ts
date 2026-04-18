import { Sparkles, Lightbulb, MessageSquare, FileText, Wand2, ArrowRight, TrendingUp } from "lucide-react";
import type { OnboardingFormState } from "@/hooks/useOnboardingForm";
import type { Suggestion } from "./types";
import { generateDescription, expandDescription, generateFAQs, getToneRecommendation, generateKeywords } from "./generators";

export function generateSuggestions(form: OnboardingFormState, missingFields: string[], t: (key: string, params?: Record<string, string | number>) => string, appLang?: string): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (missingFields.includes("description")) {
    if (!form.description.trim()) {
      suggestions.push({
        id: "desc-empty", type: "description", icon: FileText, label: t("copilot.contextBuilder"),
        message: t("copilot.noContext"),
        payload: generateDescription(form), priority: 1,
      });
    } else if (form.description.trim().length <= 20) {
      suggestions.push({
        id: "desc-short", type: "description", icon: FileText, label: t("copilot.contextBuilder"),
        message: t("copilot.descTooShort"),
        payload: expandDescription(form), priority: 2,
      });
    }
  } else if (form.description.trim().length > 20 && form.description.trim().length < 80) {
    suggestions.push({
      id: "desc-improve", type: "description", icon: Wand2, label: t("copilot.contextBuilder"),
      message: t("copilot.descImprove"),
      payload: expandDescription(form), priority: 5,
    });
  }

  if (missingFields.includes("faqs")) {
    suggestions.push({
      id: "faq-generate", type: "faq", icon: MessageSquare, label: t("copilot.knowledgeBase"),
      message: form.businessType
        ? t("copilot.noFaqMsgType", { type: form.businessType })
        : t("copilot.noFaqMsg"),
      payload: generateFAQs(form), priority: 2,
    });
  }

  if (form.businessType && form.tone === "Professional") {
    const recommended = getToneRecommendation(form.businessType);
    if (recommended && recommended !== form.tone) {
      suggestions.push({
        id: "tone-suggest", type: "tone", icon: Lightbulb, label: t("copilot.toneAdvisor"),
        message: t("copilot.toneMsg", { type: form.businessType.toLowerCase(), tone: recommended }),
        payload: recommended, priority: 3,
      });
    }
  }

  if (form.keywords.length < 3 && form.businessType) {
    suggestions.push({
      id: "keywords-suggest", type: "keywords", icon: TrendingUp, label: t("copilot.topicExpert"),
      message: t("copilot.keywordsMsg", { type: form.businessType.toLowerCase() }),
      payload: generateKeywords(form, appLang), priority: 4,
    });
  }

  if (missingFields.includes("businessName") && !form.businessName.trim()) {
    suggestions.push({
      id: "name-missing", type: "general", icon: ArrowRight, label: t("copilot.guide"),
      message: t("copilot.startWithName"),
      priority: 0,
    });
  }

  if (missingFields.includes("businessType") && form.businessName.trim()) {
    suggestions.push({
      id: "type-missing", type: "general", icon: ArrowRight, label: t("copilot.guide"),
      message: t("copilot.selectType"),
      priority: 1,
    });
  }

  return suggestions.sort((a, b) => a.priority - b.priority);
}
