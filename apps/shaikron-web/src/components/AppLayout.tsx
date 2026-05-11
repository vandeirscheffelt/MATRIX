import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { AiModeProvider } from "@/contexts/AiModeContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiClient";

interface AppLayoutProps {
  children: React.ReactNode;
}

// Páginas liberadas mesmo com trial expirado
const PUBLIC_PATHS = ["/account", "/billing/success", "/billing/cancel"];

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [bloqueado, setBloqueado] = useState(false);
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  // Verifica status da assinatura em cada mount
  useEffect(() => {
    api.get<any>("/app/billing/status")
      .then((data) => {
        setBloqueado(data?.bloqueado === true);
        if (data?.dias_restantes != null) setDiasRestantes(data.dias_restantes);
      })
      .catch(() => {})
      .finally(() => setStatusChecked(true));
  }, [location.pathname]);

  const isPublicPath = PUBLIC_PATHS.some((p) => location.pathname.startsWith(p));

  // Renderiza paywall se bloqueado e não está em página liberada
  if (statusChecked && bloqueado && !isPublicPath) {
    return (
      <AiModeProvider>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-6 text-center">
            {/* Ícone */}
            <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-10 w-10 text-primary" />
            </div>

            {/* Título */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Período de teste encerrado
              </h1>
              <p className="text-muted-foreground">
                Seu período gratuito de 3 dias chegou ao fim. Para continuar usando o Shaikron, ative sua assinatura agora.
              </p>
            </div>

            {/* Card de plano */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3 text-left">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">Plano Base Shaikron</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Agenda completa com IA</li>
                <li>✓ Gestão de profissionais ilimitados</li>
                <li>✓ Integração WhatsApp + n8n</li>
                <li>✓ Suporte prioritário</li>
              </ul>
              <div className="pt-1">
                <span className="text-2xl font-bold text-primary">R$ 97</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
            </div>

            {/* Ação */}
            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate("/account")}
              >
                Ativar minha assinatura
              </Button>
              <p className="text-xs text-muted-foreground">
                Aceitamos PIX, Boleto e Cartão de crédito
              </p>
            </div>
          </div>
        </div>
      </AiModeProvider>
    );
  }

  // Banner de aviso nos últimos dias de trial (visível mas não bloqueante)
  const showTrialBanner =
    !bloqueado &&
    diasRestantes !== null &&
    diasRestantes <= 2 &&
    !isPublicPath;

  return (
    <AiModeProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <div className={isMobile ? (sidebarOpen ? "fixed inset-y-0 left-0 z-40" : "hidden") : ""}>
          <AppSidebar />
        </div>

        <div className={isMobile ? "flex flex-col min-h-screen" : "ml-64 flex flex-col min-h-screen"}>
          {/* Banner de aviso de trial quase vencendo */}
          {showTrialBanner && (
            <div className="flex items-center justify-between gap-3 bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                ⏱️ Seu período de teste termina em{" "}
                <strong>{diasRestantes === 0 ? "menos de 1 dia" : `${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`}</strong>.
                {" "}Ative sua assinatura para não perder o acesso.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 text-xs border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10"
                onClick={() => navigate("/account")}
              >
                Assinar agora
              </Button>
            </div>
          )}

          {/* Mobile top bar */}
          {isMobile && (
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <span className="text-sm font-bold text-foreground">Schaikron</span>
            </div>
          )}
          <AppHeader />
          <main className={isMobile ? "flex-1 p-3" : "flex-1 p-6"}>{children}</main>
        </div>
      </div>
    </AiModeProvider>
  );
}
