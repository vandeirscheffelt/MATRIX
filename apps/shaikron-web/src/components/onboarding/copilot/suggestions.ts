import { Sparkles, Lightbulb, MessageSquare, FileText, Wand2, ArrowRight, TrendingUp } from "lucide-react";
import type { OnboardingFormState } from "@/hooks/useOnboardingForm";
import type { Suggestion } from "./types";
import { generateFAQs, getToneRecommendation, generateKeywords } from "./generators";

export function generateSuggestions(form: OnboardingFormState, missingFields: string[], t: (key: string, params?: Record<string, string | number>) => string, appLang?: string): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (missingFields.includes("description")) {
    if (!form.description.trim()) {
      suggestions.push({
        id: "desc-empty", type: "general", icon: FileText, label: "Contexto Operacional",
        message: 'Seu assistente ainda não tem contexto operacional. Preencha o tipo de negócio e o nome do assistente, depois clique em "Gerar com IA" na seção Contexto Operacional.',
        priority: 1,
      });
    } else if (form.description.trim().length <= 20) {
      suggestions.push({
        id: "desc-short", type: "general", icon: FileText, label: "Contexto Operacional",
        message: 'O contexto operacional está muito curto. Clique em "Regenerar com IA" para que o Copiloto recrie um perfil completo com base nas suas configurações.',
        priority: 2,
      });
    }
  } else if (form.description.trim().length > 20 && form.description.trim().length < 80) {
    suggestions.push({
      id: "desc-improve", type: "general", icon: Wand2, label: "Contexto Operacional",
      message: 'O contexto operacional pode ser mais detalhado. Se adicionou profissionais ou serviços, clique em "Regenerar com IA" para atualizar.',
      priority: 5,
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
