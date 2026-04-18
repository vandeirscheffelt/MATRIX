import { useState, useMemo } from "react";
import type { OnboardingFormState, FAQ } from "@/hooks/useOnboardingForm";
import type { KnowledgeGap } from "./types";
import { useLanguage } from "@/contexts/LanguageContext";

// Simulated conversation gaps based on business type — per language
const SIMULATED_GAPS: Record<string, Record<string, KnowledgeGap[]>> = {
  "pt-BR": {
    Restaurant: [
      { id: "gap-1", question: "Vocês têm estacionamento?", frequency: 12, detectedAt: "2h atrás", suggestedAnswer: "Sim, temos estacionamento gratuito para até 30 veículos ao lado do restaurante." },
      { id: "gap-2", question: "Posso levar meu pet?", frequency: 8, detectedAt: "4h atrás", suggestedAnswer: "Aceitamos pets na área externa. A área interna é livre de animais para conforto de todos." },
      { id: "gap-3", question: "Vocês têm cardápio infantil?", frequency: 6, detectedAt: "1 dia atrás", suggestedAnswer: "Sim! Temos um cardápio especial com opções saudáveis e divertidas para crianças até 12 anos." },
    ],
    Clinic: [
      { id: "gap-1", question: "Vocês fazem consultas por telemedicina?", frequency: 15, detectedAt: "1h atrás", suggestedAnswer: "Sim, oferecemos consultas por telemedicina para retornos e casos não emergenciais. Agende online ou pelo WhatsApp." },
      { id: "gap-2", question: "Quais formas de pagamento vocês aceitam?", frequency: 10, detectedAt: "3h atrás", suggestedAnswer: "Aceitamos dinheiro, cartões de crédito/débito e transferências bancárias. Também trabalhamos com os principais convênios." },
      { id: "gap-3", question: "O local tem acessibilidade?", frequency: 5, detectedAt: "1 dia atrás", suggestedAnswer: "Sim, nossas instalações são totalmente acessíveis com rampas, elevadores e banheiros adaptados." },
    ],
    Salon: [
      { id: "gap-1", question: "Vocês fazem pacotes para noivas?", frequency: 9, detectedAt: "2h atrás", suggestedAnswer: "Sim! Temos pacotes exclusivos para noivas incluindo cabelo, maquiagem e unhas. Agende uma consulta gratuita para personalizar o seu." },
      { id: "gap-2", question: "Posso ver fotos de antes e depois?", frequency: 7, detectedAt: "5h atrás", suggestedAnswer: "Claro! Confira nossa galeria no Instagram ou peça para nossa equipe mostrar o portfólio durante sua visita." },
      { id: "gap-3", question: "Vocês usam produtos livres de crueldade animal?", frequency: 4, detectedAt: "1 dia atrás", suggestedAnswer: "Sim, todos os nossos produtos são livres de crueldade animal e oferecemos opções veganas sob demanda." },
    ],
    Gym: [
      { id: "gap-1", question: "Vocês oferecem aula experimental?", frequency: 18, detectedAt: "30 min atrás", suggestedAnswer: "Sim! Oferecemos 3 dias de experiência gratuita com acesso completo a todas as instalações e aulas." },
      { id: "gap-2", question: "Tem aulas em grupo?", frequency: 11, detectedAt: "2h atrás", suggestedAnswer: "Oferecemos mais de 20 aulas em grupo por semana incluindo yoga, HIIT, spinning e CrossFit." },
      { id: "gap-3", question: "Posso congelar minha matrícula?", frequency: 6, detectedAt: "1 dia atrás", suggestedAnswer: "Sim, você pode congelar sua matrícula por até 3 meses por ano sem custo adicional." },
    ],
  },
  es: {
    Restaurant: [
      { id: "gap-1", question: "¿Tienen estacionamiento?", frequency: 12, detectedAt: "hace 2h", suggestedAnswer: "Sí, tenemos estacionamiento gratuito para hasta 30 vehículos junto al restaurante." },
      { id: "gap-2", question: "¿Puedo llevar mi mascota?", frequency: 8, detectedAt: "hace 4h", suggestedAnswer: "Aceptamos mascotas en el área exterior. El interior es libre de animales para comodidad de todos." },
      { id: "gap-3", question: "¿Tienen menú infantil?", frequency: 6, detectedAt: "hace 1 día", suggestedAnswer: "¡Sí! Tenemos un menú especial con opciones saludables y divertidas para niños hasta 12 años." },
    ],
    Clinic: [
      { id: "gap-1", question: "¿Ofrecen consultas por telemedicina?", frequency: 15, detectedAt: "hace 1h", suggestedAnswer: "Sí, ofrecemos consultas por telemedicina para seguimientos y casos no urgentes. Agenda online o por WhatsApp." },
      { id: "gap-2", question: "¿Qué formas de pago aceptan?", frequency: 10, detectedAt: "hace 3h", suggestedAnswer: "Aceptamos efectivo, tarjetas de crédito/débito y transferencias bancarias. También trabajamos con los principales seguros." },
      { id: "gap-3", question: "¿El local tiene accesibilidad?", frequency: 5, detectedAt: "hace 1 día", suggestedAnswer: "Sí, nuestras instalaciones son totalmente accesibles con rampas, elevadores y baños adaptados." },
    ],
    Salon: [
      { id: "gap-1", question: "¿Hacen paquetes para novias?", frequency: 9, detectedAt: "hace 2h", suggestedAnswer: "¡Sí! Tenemos paquetes exclusivos para novias incluyendo cabello, maquillaje y uñas." },
      { id: "gap-2", question: "¿Puedo ver fotos de antes y después?", frequency: 7, detectedAt: "hace 5h", suggestedAnswer: "¡Claro! Revisa nuestra galería en Instagram o pide a nuestro equipo que te muestre el portafolio." },
      { id: "gap-3", question: "¿Usan productos libres de crueldad animal?", frequency: 4, detectedAt: "hace 1 día", suggestedAnswer: "Sí, todos nuestros productos son libres de crueldad animal y ofrecemos opciones veganas bajo demanda." },
    ],
    Gym: [
      { id: "gap-1", question: "¿Ofrecen clase de prueba?", frequency: 18, detectedAt: "hace 30 min", suggestedAnswer: "¡Sí! Ofrecemos 3 días de prueba gratuita con acceso completo a todas las instalaciones y clases." },
      { id: "gap-2", question: "¿Tienen clases grupales?", frequency: 11, detectedAt: "hace 2h", suggestedAnswer: "Ofrecemos más de 20 clases grupales por semana incluyendo yoga, HIIT, spinning y CrossFit." },
      { id: "gap-3", question: "¿Puedo congelar mi membresía?", frequency: 6, detectedAt: "hace 1 día", suggestedAnswer: "Sí, puedes congelar tu membresía hasta por 3 meses al año sin costo adicional." },
    ],
  },
  en: {
    Restaurant: [
      { id: "gap-1", question: "Do you have parking available?", frequency: 12, detectedAt: "2h ago", suggestedAnswer: "Yes, we have free parking for up to 30 vehicles right next to the restaurant." },
      { id: "gap-2", question: "Can I bring my pet?", frequency: 8, detectedAt: "4h ago", suggestedAnswer: "We welcome pets in our outdoor seating area. Indoor dining is pet-free for the comfort of all guests." },
      { id: "gap-3", question: "Do you have a kids menu?", frequency: 6, detectedAt: "1d ago", suggestedAnswer: "Yes! We have a special kids menu with fun, healthy options for children under 12." },
    ],
    Clinic: [
      { id: "gap-1", question: "Do you offer telemedicine consultations?", frequency: 15, detectedAt: "1h ago", suggestedAnswer: "Yes, we offer telemedicine consultations for follow-ups and non-emergency cases. Book online or via WhatsApp." },
      { id: "gap-2", question: "What payment methods do you accept?", frequency: 10, detectedAt: "3h ago", suggestedAnswer: "We accept cash, credit/debit cards, and bank transfers. We also work with most insurance providers." },
      { id: "gap-3", question: "Is there wheelchair access?", frequency: 5, detectedAt: "1d ago", suggestedAnswer: "Yes, our facility is fully accessible with ramps, elevators, and accessible restrooms." },
    ],
    Salon: [
      { id: "gap-1", question: "Do you offer bridal packages?", frequency: 9, detectedAt: "2h ago", suggestedAnswer: "Yes! We have exclusive bridal packages including hair, makeup, and nails. Book a free consultation to customize yours." },
      { id: "gap-2", question: "Can I see before and after photos?", frequency: 7, detectedAt: "5h ago", suggestedAnswer: "Absolutely! Check our Instagram gallery or ask our team to show you our portfolio during your visit." },
      { id: "gap-3", question: "Do you use cruelty-free products?", frequency: 4, detectedAt: "1d ago", suggestedAnswer: "Yes, all our products are cruelty-free and we offer vegan options upon request." },
    ],
    Gym: [
      { id: "gap-1", question: "Do you offer a free trial?", frequency: 18, detectedAt: "30m ago", suggestedAnswer: "Yes! We offer a 3-day free trial with full access to all facilities and classes." },
      { id: "gap-2", question: "Are there group classes?", frequency: 11, detectedAt: "2h ago", suggestedAnswer: "We offer over 20 group classes per week including yoga, HIIT, spinning, and CrossFit." },
      { id: "gap-3", question: "Can I freeze my membership?", frequency: 6, detectedAt: "1d ago", suggestedAnswer: "Yes, you can freeze your membership for up to 3 months per year at no extra cost." },
    ],
  },
};

const DEFAULT_GAPS: Record<string, KnowledgeGap[]> = {
  "pt-BR": [
    { id: "gap-1", question: "Quais são suas políticas de cancelamento?", frequency: 14, detectedAt: "1h atrás", suggestedAnswer: "Você pode cancelar ou remarcar com até 24 horas de antecedência sem custo." },
    { id: "gap-2", question: "Vocês oferecem descontos por indicação?", frequency: 9, detectedAt: "3h atrás", suggestedAnswer: "Sim! Indique um amigo e ambos ganham 10% de desconto no próximo serviço." },
    { id: "gap-3", question: "Como posso deixar uma avaliação?", frequency: 5, detectedAt: "1 dia atrás", suggestedAnswer: "Adoraríamos receber seu feedback! Você pode avaliar no Google ou diretamente pela nossa plataforma." },
  ],
  es: [
    { id: "gap-1", question: "¿Cuáles son sus políticas de cancelación?", frequency: 14, detectedAt: "hace 1h", suggestedAnswer: "Puedes cancelar o reprogramar con hasta 24 horas de anticipación sin cargo." },
    { id: "gap-2", question: "¿Ofrecen descuentos por referidos?", frequency: 9, detectedAt: "hace 3h", suggestedAnswer: "¡Sí! Refiere a un amigo y ambos obtienen 10% de descuento en el próximo servicio." },
    { id: "gap-3", question: "¿Cómo puedo dejar una reseña?", frequency: 5, detectedAt: "hace 1 día", suggestedAnswer: "¡Nos encantaría recibir tu opinión! Puedes dejar una reseña en Google o directamente en nuestra plataforma." },
  ],
  en: [
    { id: "gap-1", question: "What are your cancellation policies?", frequency: 14, detectedAt: "1h ago", suggestedAnswer: "You can cancel or reschedule up to 24 hours in advance with no charge." },
    { id: "gap-2", question: "Do you offer discounts for referrals?", frequency: 9, detectedAt: "3h ago", suggestedAnswer: "Yes! Refer a friend and both of you get 10% off your next service." },
    { id: "gap-3", question: "How can I leave a review?", frequency: 5, detectedAt: "1d ago", suggestedAnswer: "We'd love your feedback! You can leave a review on Google or directly through our platform." },
  ],
};

export function useKnowledgeGaps(form: OnboardingFormState) {
  const { language } = useLanguage();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const lang = language === "pt-BR" ? "pt-BR" : language === "es" ? "es" : "en";

  const gaps = useMemo(() => {
    const langGaps = SIMULATED_GAPS[lang] || SIMULATED_GAPS.en;
    const base = langGaps[form.businessType] || DEFAULT_GAPS[lang] || DEFAULT_GAPS.en;
    return base.filter(g => !dismissedIds.has(g.id));
  }, [form.businessType, dismissedIds, lang]);

  const totalUnanswered = useMemo(() => {
    const langGaps = SIMULATED_GAPS[lang] || SIMULATED_GAPS.en;
    const base = langGaps[form.businessType] || DEFAULT_GAPS[lang] || DEFAULT_GAPS.en;
    return base.length;
  }, [form.businessType, lang]);

  const dismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  };

  const generateFaqFromGap = (gap: KnowledgeGap): FAQ => ({
    question: gap.question,
    answer: gap.suggestedAnswer || "",
  });

  return { gaps, totalUnanswered, dismiss, generateFaqFromGap };
}
