import { useMemo } from "react";
import type { OnboardingFormState } from "@/hooks/useOnboardingForm";

export interface ConfigGap {
  id: string;
  severity: "critical" | "important";
  title: string;
  description: string;
  fieldId: string;
}

export function useConfigGaps(form: OnboardingFormState, t: (key: string, params?: Record<string, string | number>) => string) {
  const gaps = useMemo(() => {
    const result: ConfigGap[] = [];

    if (!form.workingHoursStart || !form.workingHoursEnd) {
      result.push({
        id: "no-hours",
        severity: "critical",
        title: t("gaps.noHours"),
        description: t("gaps.noHoursDesc"),
        fieldId: "field-working-hours",
      });
    }

    if (form.faqs.every(f => !f.question.trim() || !f.answer.trim())) {
      result.push({
        id: "no-faq",
        severity: "critical",
        title: t("gaps.noFaq"),
        description: t("gaps.noFaqDesc"),
        fieldId: "field-faqs",
      });
    } else {
      const answered = form.faqs.filter(f => f.question.trim() && f.answer.trim());
      if (answered.length < 3) {
        result.push({
          id: "few-faqs",
          severity: "important",
          title: t("gaps.fewFaqs", { count: answered.length }),
          description: t("gaps.fewFaqsDesc"),
          fieldId: "field-faqs",
        });
      }
    }

    if (!form.businessType) {
      result.push({
        id: "no-type",
        severity: "critical",
        title: t("gaps.noType"),
        description: t("gaps.noTypeDesc"),
        fieldId: "field-business-type",
      });
    }

    const descLen = form.description.trim().length;
    if (descLen === 0) {
      result.push({
        id: "no-desc",
        severity: "critical",
        title: "Prompt do assistente não gerado",
        description: 'Complete as configurações (tipo de negócio, tom, identidade) e clique em "Regenerar Prompt" no aviso laranja no topo da página.',
        fieldId: "field-business-type",
      });
    } else if (descLen <= 40) {
      result.push({
        id: "weak-desc",
        severity: "important",
        title: "Prompt muito curto",
        description: 'Adicione mais informações (serviços, profissionais, FAQ) e clique em "Regenerar Prompt" para enriquecer o assistente.',
        fieldId: "field-business-type",
      });
    }

    if (form.keywords.length < 2) {
      result.push({
        id: "few-keywords",
        severity: "important",
        title: t("gaps.fewKeywords"),
        description: t("gaps.fewKeywordsDesc"),
        fieldId: "field-keywords",
      });
    }

    if (!form.businessName.trim()) {
      result.push({
        id: "no-name",
        severity: "critical",
        title: t("gaps.noName"),
        description: t("gaps.noNameDesc"),
        fieldId: "field-business-name",
      });
    }

    if (!form.assistantName.trim()) {
      result.push({
        id: "no-assistant-name",
        severity: "important",
        title: t("gaps.noAssistantName"),
        description: t("gaps.noAssistantNameDesc"),
        fieldId: "field-assistant-name",
      });
    }

    return result
      .sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1))
      .slice(0, 5);
  }, [form, t]);

  return gaps;
}
