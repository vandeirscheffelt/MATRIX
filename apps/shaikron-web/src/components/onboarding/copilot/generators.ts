import type { OnboardingFormState, FAQ } from "@/hooks/useOnboardingForm";

type SupportedLanguage = "en" | "pt";

interface ToneStyle {
  adjectives: string[];
  closing: string;
}

const toneModifiers: Record<string, Record<SupportedLanguage, ToneStyle>> = {
  Professional: {
    en: {
      adjectives: ["structured", "consistent", "clear"],
      closing: "Responses follow a structured format with clear next steps.",
    },
    pt: {
      adjectives: ["estruturado", "consistente", "claro"],
      closing: "As respostas seguem um formato estruturado com próximos passos claros.",
    },
  },
  Friendly: {
    en: {
      adjectives: ["approachable", "direct", "helpful"],
      closing: "Keep responses conversational but always include actionable information.",
    },
    pt: {
      adjectives: ["acessível", "direto", "prestativo"],
      closing: "Mantenha respostas conversacionais, mas sempre inclua informações práticas.",
    },
  },
  Casual: {
    en: {
      adjectives: ["simple", "practical", "straightforward"],
      closing: "Use simple language and go straight to the point.",
    },
    pt: {
      adjectives: ["simples", "prático", "objetivo"],
      closing: "Use linguagem simples e vá direto ao ponto.",
    },
  },
  Formal: {
    en: {
      adjectives: ["precise", "detailed", "methodical"],
      closing: "Provide complete information with precise details.",
    },
    pt: {
      adjectives: ["preciso", "detalhado", "metódico"],
      closing: "Forneça informações completas com detalhes precisos.",
    },
  },
  Empathetic: {
    en: {
      adjectives: ["attentive", "patient", "understanding"],
      closing: "Acknowledge the client's situation before providing guidance.",
    },
    pt: {
      adjectives: ["atencioso", "paciente", "compreensivo"],
      closing: "Reconheça a situação do cliente antes de orientar.",
    },
  },
  Energetic: {
    en: {
      adjectives: ["proactive", "responsive", "action-oriented"],
      closing: "Respond quickly and suggest concrete next steps.",
    },
    pt: {
      adjectives: ["proativo", "ágil", "orientado a ação"],
      closing: "Responda rapidamente e sugira próximos passos concretos.",
    },
  },
};

const businessTypeLabels: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    Restaurant: "restaurant",
    Clinic: "clinic",
    Salon: "beauty studio",
    Gym: "fitness center",
    "Real Estate": "real estate agency",
    Consulting: "consulting firm",
    "E-commerce": "online store",
    Other: "business",
  },
  pt: {
    Restaurant: "restaurante",
    Clinic: "clínica",
    Salon: "estúdio de beleza",
    Gym: "academia",
    "Real Estate": "imobiliária",
    Consulting: "consultoria",
    "E-commerce": "loja online",
    Other: "negócio",
  },
};

function detectLanguageFromSamples(...samples: string[]): SupportedLanguage {
  const text = samples.join(" ").trim().toLowerCase();
  if (!text) return "pt"; // Default to Portuguese when no content

  const ptScore =
    (text.match(/[ãõáéíóúâêôç]/g) || []).length * 3 +
    (text.match(/\b(não|nao|você|voce|vocês|voces|para|com|uma|serviço|servicos|serviço|clínica|clinica|salão|salao|agendamento|horário|horario|atendimento|endereço|endereco|preço|preco|valor|reserva|bem-estar|saúde|saude|beleza|academia|imobiliária|imobiliaria|consultoria|entrega|compra|fale|conosco|cliente|clientes)\b/g) || []).length * 2;

  const enScore =
    (text.match(/\b(the|and|with|your|you|our|business|service|services|appointment|appointments|hours|schedule|delivery|location|price|booking|wellness|beauty|fitness|property|consulting|shop|store|customer|customers)\b/g) || []).length * 2;

  return ptScore > enScore ? "pt" : "en";
}

function detectFormLanguage(form: OnboardingFormState, ...priorityTexts: string[]): SupportedLanguage {
  return detectLanguageFromSamples(
    ...priorityTexts,
    form.description,
    form.businessName,
    form.keywords.join(" "),
    ...form.faqs.flatMap((faq) => [faq.question, faq.answer]),
  );
}

function getToneStyle(tone: string, language: SupportedLanguage) {
  return toneModifiers[tone]?.[language] || toneModifiers.Professional[language];
}

function getRelevantKeywords(keywords: string[]) {
  return keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 2).slice(0, 3);
}

function joinList(items: string[], language: SupportedLanguage) {
  if (items.length <= 1) return items[0] || "";
  const conjunction = language === "pt" ? "e" : "and";
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

function buildKeywordPhrase(keywords: string[], language: SupportedLanguage): string {
  const relevant = getRelevantKeywords(keywords);
  if (relevant.length === 0) return "";
  return language === "pt"
    ? `com foco em ${joinList(relevant, language)}`
    : `specializing in ${joinList(relevant, language)}`;
}

function appendSpecialization(intro: string, specialization: string) {
  return specialization ? `${intro} ${specialization}.` : `${intro}.`;
}

function getBusinessTypeLabel(businessType: string, language: SupportedLanguage) {
  return businessTypeLabels[language][businessType] || (language === "pt" ? "negócio" : "business");
}

export function generateDescription(form: OnboardingFormState): string {
  const language = detectFormLanguage(form, form.description, form.businessName);
  const name = form.businessName || (language === "pt" ? "Seu negócio" : "Your business");
  const specialization = buildKeywordPhrase(form.keywords, language);
  const isHuman = form.assistantIdentity === "human";

  const templates: Record<SupportedLanguage, Record<string, string>> = {
    en: {
      Restaurant: `${name} is a restaurant${specialization ? ` ${specialization}` : ""}. Customers can make reservations, ask about the menu, and check availability. ${isHuman ? "Respond naturally as a team member." : "You are a virtual assistant helping with reservations and inquiries."} Operating hours: ${form.workingHoursStart || "08:00"} to ${form.workingHoursEnd || "18:00"}.`,
      Clinic: `${name} is a clinic${specialization ? ` ${specialization}` : ""}. Patients can schedule appointments, ask about services, and get preparation instructions. ${isHuman ? "Respond as a receptionist." : "You are a virtual assistant managing appointments and patient inquiries."} Operating hours: ${form.workingHoursStart || "08:00"} to ${form.workingHoursEnd || "18:00"}.`,
      Salon: `${name} is a beauty studio${specialization ? ` ${specialization}` : ""}. Clients can book services, ask about treatments, and check pricing. ${isHuman ? "Respond as an attendant." : "You are a virtual assistant helping clients book and learn about services."} Operating hours: ${form.workingHoursStart || "08:00"} to ${form.workingHoursEnd || "18:00"}.`,
      Gym: `${name} is a fitness center${specialization ? ` ${specialization}` : ""}. Members can check class schedules, book sessions, and ask about plans. ${isHuman ? "Respond as a team member." : "You are a virtual assistant helping members with schedules and information."} Operating hours: ${form.workingHoursStart || "08:00"} to ${form.workingHoursEnd || "18:00"}.`,
      "Real Estate": `${name} is a real estate agency${specialization ? ` ${specialization}` : ""}. Clients can request property visits, ask about listings, and get neighborhood details. ${isHuman ? "Respond as a consultant." : "You are a virtual assistant helping clients find properties."} Operating hours: ${form.workingHoursStart || "08:00"} to ${form.workingHoursEnd || "18:00"}.`,
      Consulting: `${name} is a consulting firm${specialization ? ` ${specialization}` : ""}. Clients can schedule discovery calls, ask about services, and request proposals. ${isHuman ? "Respond as an advisor." : "You are a virtual assistant managing client inquiries."} Operating hours: ${form.workingHoursStart || "08:00"} to ${form.workingHoursEnd || "18:00"}.`,
      "E-commerce": `${name} is an online store${specialization ? ` ${specialization}` : ""}. Customers can track orders, ask about products, returns, and shipping. ${isHuman ? "Respond as support staff." : "You are a virtual assistant handling customer support."} Operating hours: ${form.workingHoursStart || "08:00"} to ${form.workingHoursEnd || "18:00"}.`,
    },
    pt: {
      Restaurant: `${name} é um restaurante${specialization ? ` ${specialization}` : ""}. Clientes podem fazer reservas, perguntar sobre o cardápio e verificar disponibilidade. ${isHuman ? "Responda naturalmente como membro da equipe." : "Você é um assistente virtual que ajuda com reservas e dúvidas."} Horário de funcionamento: ${form.workingHoursStart || "08:00"} às ${form.workingHoursEnd || "18:00"}.`,
      Clinic: `${name} é uma clínica${specialization ? ` ${specialization}` : ""}. Pacientes podem agendar consultas, perguntar sobre serviços e receber orientações. ${isHuman ? "Responda como recepcionista." : "Você é um assistente virtual que gerencia agendamentos e dúvidas."} Horário de funcionamento: ${form.workingHoursStart || "08:00"} às ${form.workingHoursEnd || "18:00"}.`,
      Salon: `${name} é um estúdio de beleza${specialization ? ` ${specialization}` : ""}. Clientes podem agendar serviços, perguntar sobre tratamentos e verificar preços. ${isHuman ? "Responda como atendente." : "Você é um assistente virtual que ajuda clientes a agendar e conhecer serviços."} Horário de funcionamento: ${form.workingHoursStart || "08:00"} às ${form.workingHoursEnd || "18:00"}.`,
      Gym: `${name} é uma academia${specialization ? ` ${specialization}` : ""}. Alunos podem consultar horários de aulas, agendar sessões e perguntar sobre planos. ${isHuman ? "Responda como membro da equipe." : "Você é um assistente virtual que ajuda alunos com agendas e informações."} Horário de funcionamento: ${form.workingHoursStart || "08:00"} às ${form.workingHoursEnd || "18:00"}.`,
      "Real Estate": `${name} é uma imobiliária${specialization ? ` ${specialization}` : ""}. Clientes podem solicitar visitas, perguntar sobre imóveis e obter detalhes da região. ${isHuman ? "Responda como consultor." : "Você é um assistente virtual que ajuda clientes a encontrar imóveis."} Horário de funcionamento: ${form.workingHoursStart || "08:00"} às ${form.workingHoursEnd || "18:00"}.`,
      Consulting: `${name} é uma consultoria${specialization ? ` ${specialization}` : ""}. Clientes podem agendar reuniões, perguntar sobre serviços e solicitar propostas. ${isHuman ? "Responda como consultor." : "Você é um assistente virtual que gerencia consultas de clientes."} Horário de funcionamento: ${form.workingHoursStart || "08:00"} às ${form.workingHoursEnd || "18:00"}.`,
      "E-commerce": `${name} é uma loja online${specialization ? ` ${specialization}` : ""}. Clientes podem rastrear pedidos, perguntar sobre produtos, trocas e entregas. ${isHuman ? "Responda como atendente de suporte." : "Você é um assistente virtual de suporte ao cliente."} Horário de funcionamento: ${form.workingHoursStart || "08:00"} às ${form.workingHoursEnd || "18:00"}.`,
    },
  };

  if (form.businessType && templates[language][form.businessType]) {
    return templates[language][form.businessType];
  }

  const type = form.businessType ? getBusinessTypeLabel(form.businessType, language) : "";
  if (language === "pt") {
    return `${name}${type ? ` atua como ${type}` : " é um negócio"}${specialization ? ` ${specialization}` : ""}. ${isHuman ? "Responda naturalmente como membro da equipe." : "Você é um assistente virtual que ajuda clientes com informações e agendamentos."} Horário de funcionamento: ${form.workingHoursStart || "08:00"} às ${form.workingHoursEnd || "18:00"}.`;
  }
  return `${name}${type ? ` is a ${type}` : " is a business"}${specialization ? ` ${specialization}` : ""}. ${isHuman ? "Respond naturally as a team member." : "You are a virtual assistant helping clients with information and scheduling."} Operating hours: ${form.workingHoursStart || "08:00"} to ${form.workingHoursEnd || "18:00"}.`;
}

export function expandDescription(form: OnboardingFormState): string {
  const current = form.description.trim();
  if (current.length <= 20) return generateDescription(form);

  const language = detectFormLanguage(form, current);
  const relevantKeywords = getRelevantKeywords(form.keywords);
  const currentLower = current.toLowerCase();
  const expansions: string[] = [];
  const isHuman = form.assistantIdentity === "human";

  // RULE: DO NOT ADD NEW INFORMATION. Only reorganize, clarify, and remove fluff.
  // Strip marketing language first
  const marketingPatterns = language === "pt"
    ? /\b(o melhor|os melhores|a melhor|excelente|excelência|incrível|extraordinári\w*|maravilhos\w*|incomparável|líder|referência no mercado|qualidade superior|somos referência)\b/gi
    : /\b(the best|amazing|incredible|extraordinary|unmatched|world-class|leading|top-notch|superior quality|cutting-edge|premier|excellence)\b/gi;

  let cleaned = current.replace(marketingPatterns, "").replace(/\s{2,}/g, " ").trim();
  if (cleaned.length < current.length * 0.5) cleaned = current; // fallback if too much removed

  // Only add keyword mention if they appear in the form but not in description (user-provided data only)
  if (relevantKeywords.length > 0 && !relevantKeywords.some((keyword) => currentLower.includes(keyword.toLowerCase()))) {
    expansions.push(
      language === "pt"
        ? `Áreas de atuação: ${joinList(relevantKeywords, language)}.`
        : `Areas of focus: ${joinList(relevantKeywords, language)}.`
    );
  }

  // Add identity instruction if missing (this is configuration, not invented info)
  const hasIdentity = currentLower.includes("assistant") || currentLower.includes("assistente") || currentLower.includes("equipe") || currentLower.includes("team");
  if (!hasIdentity) {
    expansions.push(
      isHuman
        ? (language === "pt" ? "Responda naturalmente como membro da equipe." : "Respond naturally as a team member.")
        : (language === "pt" ? "Você é um assistente virtual." : "You are a virtual assistant.")
    );
  }

  return expansions.length > 0 ? `${cleaned} ${expansions.join(" ")}` : cleaned;
}

export function generateFAQs(form: OnboardingFormState): FAQ[] {
  const language = detectFormLanguage(form);
  const type = form.businessType || "General";

  // RULE: Never invent specific hours, prices, policies, or durations.
  // Use safe phrasing that directs the customer to contact for details.

  const faqMap: Record<SupportedLanguage, Record<string, FAQ[]>> = {
    en: {
      Restaurant: [
        { question: "Do you accept reservations?", answer: "We recommend checking availability in advance. Please contact us to book a table." },
        { question: "Do you offer delivery?", answer: "Delivery may be available depending on your location. Please contact us to confirm coverage and estimated times." },
        { question: "Do you accommodate dietary restrictions?", answer: "We can guide you through available options based on your dietary needs. Please let us know when booking." },
      ],
      Clinic: [
        { question: "How do I schedule an appointment?", answer: "Appointments may be required depending on the service. Please contact us to check availability and find a suitable time." },
        { question: "Do you accept insurance?", answer: "We work with selected insurance providers. Please share your plan details so we can confirm coverage before your visit." },
        { question: "What should I bring to my first visit?", answer: "We recommend bringing your ID and any relevant medical records. Please contact us for specific preparation instructions." },
      ],
      Salon: [
        { question: "Do I need to book in advance?", answer: "We recommend booking ahead to secure your preferred time. Please contact us to check availability." },
        { question: "What services do you offer?", answer: "We offer a range of services. Please contact us for a complete list and recommendations based on your needs." },
        { question: "Can I cancel or reschedule?", answer: "Cancellations and rescheduling are possible. Please contact us in advance so we can help find a better time." },
      ],
      Gym: [
        { question: "Do you offer trial sessions?", answer: "Trial sessions may be available. Please contact us to learn about current options and schedule a visit." },
        { question: "Are personal trainers available?", answer: "We have trainers available for individual guidance. Please contact us for details on availability and plans." },
        { question: "What are your hours?", answer: "Please contact us to confirm our current operating hours, including any special schedules or holidays." },
      ],
      "Real Estate": [
        { question: "How do I schedule a property visit?", answer: "Please share the property you are interested in and we will arrange a visit at a convenient time." },
        { question: "Do you handle both sales and rentals?", answer: "We support different types of transactions. Please contact us to discuss your goals and preferences." },
        { question: "What areas do you cover?", answer: "We work across multiple areas. Please contact us with your preferences so we can recommend the best options." },
      ],
      Consulting: [
        { question: "What industries do you serve?", answer: "We support clients across different sectors. Please contact us to discuss how we can help with your specific context." },
        { question: "How does the engagement process work?", answer: "We typically begin with a discovery phase. Please contact us to learn more about the process and next steps." },
        { question: "Do you offer ongoing support?", answer: "Ongoing support may be available depending on the engagement. Please contact us to discuss your needs." },
      ],
      "E-commerce": [
        { question: "What is your shipping policy?", answer: "Shipping details vary by order. Please contact us or check our website for current shipping information." },
        { question: "Can I return or exchange products?", answer: "Returns and exchanges may be available. Please contact us to learn about the applicable conditions." },
        { question: "How can I track my order?", answer: "Tracking information is provided after your order ships. Please contact us if you need assistance." },
      ],
      General: [
        { question: "What are your working hours?", answer: "Please contact us to confirm our current operating hours and availability." },
        { question: "How can I contact you?", answer: "You can reach us via our available channels and we will guide you through the next steps." },
        { question: "Do you offer online services?", answer: "Depending on the service, remote options may be available. Please contact us to discuss the best format for you." },
      ],
    },
    pt: {
      Restaurant: [
        { question: "Vocês aceitam reservas?", answer: "Recomendamos verificar a disponibilidade com antecedência. Entre em contato conosco para reservar uma mesa." },
        { question: "Vocês fazem delivery?", answer: "O delivery pode estar disponível dependendo da sua localização. Entre em contato para confirmar cobertura e prazos." },
        { question: "Vocês atendem restrições alimentares?", answer: "Podemos orientar sobre as opções disponíveis conforme suas necessidades. Informe ao fazer a reserva." },
      ],
      Clinic: [
        { question: "Como faço para agendar uma consulta?", answer: "O agendamento pode ser necessário dependendo do serviço. Entre em contato para verificar disponibilidade." },
        { question: "Vocês aceitam convênio?", answer: "Trabalhamos com convênios selecionados. Envie os dados do seu plano para confirmarmos a cobertura." },
        { question: "O que devo levar na primeira consulta?", answer: "Recomendamos levar documento e registros relevantes. Entre em contato para orientações específicas." },
      ],
      Salon: [
        { question: "Preciso agendar com antecedência?", answer: "Recomendamos agendar antes para garantir o melhor horário. Entre em contato para verificar disponibilidade." },
        { question: "Quais serviços vocês oferecem?", answer: "Oferecemos uma variedade de serviços. Entre em contato para consultar as opções disponíveis." },
        { question: "Posso cancelar ou remarcar?", answer: "Cancelamentos e remarcações são possíveis. Entre em contato com antecedência para reorganizar." },
      ],
      Gym: [
        { question: "Vocês oferecem aula experimental?", answer: "Aulas experimentais podem estar disponíveis. Entre em contato para conhecer as opções atuais." },
        { question: "Há personal trainers disponíveis?", answer: "Temos profissionais disponíveis para orientação individual. Entre em contato para detalhes." },
        { question: "Qual é o horário de funcionamento?", answer: "Entre em contato para confirmar nossos horários de funcionamento atuais, incluindo feriados." },
      ],
      "Real Estate": [
        { question: "Como agendar uma visita ao imóvel?", answer: "Envie o imóvel de seu interesse e organizamos uma visita em horário conveniente." },
        { question: "Vocês trabalham com venda e locação?", answer: "Atendemos diferentes tipos de transação. Entre em contato para discutir seus objetivos." },
        { question: "Quais regiões vocês atendem?", answer: "Atuamos em diversas regiões. Entre em contato com suas preferências para recomendarmos as melhores opções." },
      ],
      Consulting: [
        { question: "Quais setores vocês atendem?", answer: "Atendemos diferentes segmentos. Entre em contato para discutir como podemos ajudar no seu contexto." },
        { question: "Como funciona o processo de consultoria?", answer: "Geralmente iniciamos com uma fase de diagnóstico. Entre em contato para saber mais sobre o processo." },
        { question: "Vocês oferecem suporte contínuo?", answer: "O suporte contínuo pode estar disponível conforme o projeto. Entre em contato para discutir suas necessidades." },
      ],
      "E-commerce": [
        { question: "Como funciona o envio dos pedidos?", answer: "Os detalhes de envio variam conforme o pedido. Entre em contato para informações atuais." },
        { question: "Posso trocar ou devolver um produto?", answer: "Trocas e devoluções podem estar disponíveis. Entre em contato para conhecer as condições aplicáveis." },
        { question: "Como acompanho meu pedido?", answer: "Informações de rastreamento são fornecidas após o envio. Entre em contato se precisar de ajuda." },
      ],
      General: [
        { question: "Qual é o horário de atendimento?", answer: "Entre em contato para confirmar nossos horários de funcionamento e disponibilidade." },
        { question: "Como posso entrar em contato?", answer: "Você pode nos contatar pelos canais disponíveis e orientaremos sobre os próximos passos." },
        { question: "Vocês atendem online?", answer: "Dependendo do serviço, opções remotas podem estar disponíveis. Entre em contato para discutir o melhor formato." },
      ],
    },
  };

  return faqMap[language][type] || faqMap[language].General;
}

export function getToneRecommendation(businessType: string): string | null {
  const map: Record<string, string> = {
    Restaurant: "Friendly",
    Clinic: "Empathetic",
    Salon: "Friendly",
    Gym: "Energetic",
    "Real Estate": "Professional",
    Consulting: "Formal",
    "E-commerce": "Casual",
  };
  return map[businessType] || null;
}

export function generateKeywords(form: OnboardingFormState, appLang?: string): string[] {
  const type = form.businessType || "General";
  const desc = form.description.toLowerCase();
  
  // Use app language as hint, falling back to form detection
  let language: SupportedLanguage;
  if (appLang === "pt-BR" || appLang === "es") {
    language = "pt";
  } else if (appLang === "en") {
    language = detectFormLanguage(form);
  } else {
    language = detectFormLanguage(form);
  }

  const mapEn: Record<string, string[]> = {
    Restaurant: ["reservation", "menu", "delivery", "dining", "cuisine", "takeout", "catering", "table booking"],
    Clinic: ["appointment", "consultation", "health", "treatment", "urgent care", "specialist", "patient care", "medical"],
    Salon: ["haircut", "styling", "beauty", "appointment", "hair treatment", "manicure", "skincare", "coloring"],
    Gym: ["fitness", "training", "workout", "membership", "personal trainer", "classes", "strength", "cardio"],
    "Real Estate": ["property", "rental", "investment", "house tour", "mortgage", "listing", "neighborhood", "valuation"],
    Consulting: ["strategy", "advisory", "growth", "analysis", "optimization", "planning", "roadmap", "audit"],
    "E-commerce": ["delivery", "online order", "payment", "shipping", "returns", "tracking", "support", "catalog"],
  };
  const mapPt: Record<string, string[]> = {
    Restaurant: ["reserva", "cardápio", "entrega", "refeição", "culinária", "pedido", "mesa", "delivery"],
    Clinic: ["agendamento", "consulta", "saúde", "tratamento", "urgência", "especialista", "paciente", "exame"],
    Salon: ["corte", "escova", "beleza", "agendamento", "tratamento capilar", "manicure", "coloração", "hidratação"],
    Gym: ["fitness", "treino", "musculação", "plano", "personal", "aulas", "matrícula", "cardio"],
    "Real Estate": ["imóvel", "aluguel", "investimento", "visita", "financiamento", "listagem", "região", "avaliação"],
    Consulting: ["estratégia", "consultoria", "crescimento", "análise", "otimização", "planejamento", "diagnóstico", "proposta"],
    "E-commerce": ["entrega", "pedido online", "pagamento", "frete", "troca", "rastreamento", "suporte", "catálogo"],
  };
  const mapEs: Record<string, string[]> = {
    Restaurant: ["reserva", "menú", "entrega", "comida", "cocina", "pedido", "mesa", "delivery"],
    Clinic: ["cita", "consulta", "salud", "tratamiento", "urgencia", "especialista", "paciente", "examen"],
    Salon: ["corte", "peinado", "belleza", "cita", "tratamiento capilar", "manicura", "coloración", "hidratación"],
    Gym: ["fitness", "entrenamiento", "musculación", "plan", "personal", "clases", "inscripción", "cardio"],
    "Real Estate": ["inmueble", "alquiler", "inversión", "visita", "financiamiento", "listado", "zona", "valoración"],
    Consulting: ["estrategia", "consultoría", "crecimiento", "análisis", "optimización", "planificación", "diagnóstico", "propuesta"],
    "E-commerce": ["entrega", "pedido online", "pago", "envío", "devolución", "seguimiento", "soporte", "catálogo"],
  };

  const map = appLang === "es" ? mapEs : language === "pt" ? mapPt : mapEn;
  const base = map[type] || (language === "pt"
    ? ["qualidade", "atendimento", "serviço", "confiança", "resultado", "suporte"]
    : appLang === "es"
    ? ["calidad", "atención", "servicio", "confianza", "resultado", "soporte"]
    : ["quality", "service", "support", "trust", "results", "experience"]);

  // Extract extra keywords from description
  const descKeywords: string[] = [];
  const descPatterns = language === "pt"
    ? ["agendamento", "consulta", "entrega", "pagamento", "suporte", "cancelamento", "preço", "horário", "reserva", "atendimento"]
    : ["appointment", "consultation", "delivery", "payment", "support", "cancellation", "pricing", "schedule", "booking", "service"];
  for (const word of descPatterns) {
    if (desc.includes(word) && !base.includes(word)) descKeywords.push(word);
  }

  const all = [...base, ...descKeywords];
  // Filter out already-added keywords
  const existing = new Set(form.keywords.map(k => k.toLowerCase()));
  return all.filter(k => !existing.has(k.toLowerCase()));
}

export function improveQuestion(faq: { question: string; answer: string }, form: OnboardingFormState): string {
  const language = detectFormLanguage(form, faq.question, faq.answer);
  const q = faq.question.trim();
  if (!q) return q;

  // Make question clearer and more natural based on tone
  const tone = getToneStyle(form.tone, language);

  // If question is very short or vague, expand it
  if (q.length < 15) {
    if (language === "pt") {
      if (q.toLowerCase().includes("preço") || q.toLowerCase().includes("valor")) return "Quais são os valores dos serviços oferecidos?";
      if (q.toLowerCase().includes("horário")) return "Qual é o horário de funcionamento?";
      if (q.toLowerCase().includes("onde") || q.toLowerCase().includes("endereço")) return "Onde vocês estão localizados?";
      if (q.toLowerCase().includes("cancelar") || q.toLowerCase().includes("cancelamento")) return "Como funciona a política de cancelamento?";
    } else {
      if (q.toLowerCase().includes("price") || q.toLowerCase().includes("cost")) return "What are the prices for your services?";
      if (q.toLowerCase().includes("hour")) return "What are your operating hours?";
      if (q.toLowerCase().includes("where") || q.toLowerCase().includes("location")) return "Where are you located?";
      if (q.toLowerCase().includes("cancel")) return "What is your cancellation policy?";
    }
  }

  // If it doesn't end with ?, add it
  const cleaned = q.endsWith("?") ? q : `${q}?`;

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function improveAnswer(faq: { question: string; answer: string }, form: OnboardingFormState): string {
  const language = detectFormLanguage(form, faq.question, faq.answer);
  const tone = getToneStyle(form.tone, language);

  // RULE: Never invent specific hours, prices, policies, durations, or guarantees.
  // Use safe phrasing that redirects to contact.

  if (faq.question.trim() && !faq.answer.trim()) {
    const q = faq.question.toLowerCase();
    if (q.includes("price") || q.includes("cost") || q.includes("preço") || q.includes("valor")) {
      return language === "pt"
        ? "Os valores variam conforme o serviço. Entre em contato informando o que precisa para que possamos orientar."
        : "Pricing varies depending on the service. Please contact us with what you need so we can guide you.";
    }
    if (q.includes("hour") || q.includes("horário") || q.includes("open") || q.includes("aberto")) {
      return language === "pt"
        ? "Entre em contato para confirmar nossos horários de funcionamento e disponibilidade."
        : "Please contact us to confirm our current operating hours and availability.";
    }
    if (q.includes("location") || q.includes("where") || q.includes("onde") || q.includes("endereço")) {
      return language === "pt"
        ? "Entre em contato e compartilharemos o endereço completo com orientações de acesso."
        : "Please contact us and we will share the full address along with directions.";
    }
    if (q.includes("cancel") || q.includes("cancelar") || q.includes("reschedule") || q.includes("remarcar")) {
      return language === "pt"
        ? "Cancelamentos e remarcações são possíveis. Entre em contato com antecedência para que possamos ajudar."
        : "Cancellations and rescheduling are possible. Please contact us in advance so we can assist you.";
    }
    return language === "pt"
      ? "Entre em contato informando o que precisa para que possamos orientar com mais precisão."
      : "Please contact us with what you need so we can guide you more precisely.";
  }

  const answer = faq.answer.trim();

  // Strip marketing/promotional language and make operational
  const marketingPatterns = language === "pt"
    ? /\b(melhor|excelente|incrível|extraordinári\w*|maravilhos\w*|incomparável|líder|referência no mercado|qualidade superior|somos referência)\b/gi
    : /\b(best|amazing|incredible|extraordinary|unmatched|world-class|leading|top-notch|superior quality|cutting-edge|premier|excellence)\b/gi;

  let cleaned = answer.replace(marketingPatterns, "").replace(/\s{2,}/g, " ").replace(/,\s*,/g, ",").trim();
  if (cleaned.length < answer.length * 0.5) cleaned = answer;

  if (cleaned.length < 30) {
    return language === "pt"
      ? `${cleaned} Para mais informações, entre em contato informando o que precisa.`
      : `${cleaned} For more details, please contact us with what you need.`;
  }

  return cleaned;
}
