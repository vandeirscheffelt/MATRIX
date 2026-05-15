import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Phone, CreditCard, Users, Calculator, ShieldCheck, Plus, Bot, Zap, AlertTriangle, QrCode, FileText } from "lucide-react";
import { useProfessionalsContext } from "@/contexts/ProfessionalsContext";
import { usePricingContext } from "@/contexts/PricingContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/apiClient";

type AccountStatus = "trial" | "active" | "inactive";

export default function AccountPage() {
  const { professionals, updateProfessional } = useProfessionalsContext();
  const { pricing } = usePricingContext();
  const { t } = useLanguage();
  const [managerPhone, setManagerPhone] = useState("");
  const [savedPhone, setSavedPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("trial");
  const [paymentGateway, setPaymentGateway] = useState<string>("stripe");
  const [confirmDowngradeModal, setConfirmDowngradeModal] = useState<{ isOpen: boolean; professionalId: string | null }>({ isOpen: false, professionalId: null });
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  const [periodEndsAt, setPeriodEndsAt] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeBase64: string; expiresAt: string; valor: number } | null>(null);
  const [boletoData, setBoletoData] = useState<{ url: string; barcode: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [cpfPendingMethod, setCpfPendingMethod] = useState<"pix" | "boleto" | null>(null);
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [showCoupon, setShowCoupon] = useState(false);
  const [validatedCoupon, setValidatedCoupon] = useState<{ code: string; discountType: "percent" | "fixed"; discountValue: number; description?: string } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState("");

  const aiUserCount = professionals.filter(p => p.aiAccess).length;
  const additionalCost = aiUserCount * pricing.pricePerUser;
  const subtotal = pricing.basePrice + additionalCost;
  
  let discountAmount = 0;
  if (validatedCoupon) {
    if (validatedCoupon.discountType === "percent") {
      discountAmount = subtotal * (validatedCoupon.discountValue / 100);
    } else {
      discountAmount = validatedCoupon.discountValue;
    }
  }
  
  const total = subtotal - discountAmount;

  const handlePhoneChange = (value: string) => {
    // Aceita apenas dígitos
    const digits = value.replace(/\D/g, '');
    setManagerPhone(digits);
    if (digits && (digits.length < 10 || digits.length > 15)) {
      setPhoneError("Digite entre 10 e 15 dígitos (ex: 5511999999999)");
    } else {
      setPhoneError("");
    }
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toFixed(2).replace(".", ",")}`;

  const handleDisableAccess = (id: string) => {
    if (accountStatus === "active") {
      setConfirmDowngradeModal({ isOpen: true, professionalId: id });
    } else {
      toggleAiAccess(id, false);
    }
  };

  const confirmDowngrade = async () => {
    if (confirmDowngradeModal.professionalId) {
      await toggleAiAccess(confirmDowngradeModal.professionalId, false);
      setConfirmDowngradeModal({ isOpen: false, professionalId: null });
    }
  };

  const handleEnableAccess = (id: string) => {
    if (accountStatus === "active") {
      alert("Sua conta paga via PIX ou Boleto está ativa. Para adicionar membros no meio do ciclo, aguarde a próxima renovação.");
      return;
    }
    toggleAiAccess(id, true);
  };

  const toggleAiAccess = async (id: string, value: boolean) => {
    try {
      const updated = await api.patch(`/app/professionals/${id}`, { aiAccess: value });
      updateProfessional(updated.data);
    } catch (err) {
      console.error(err);
    }
  };

  const navigate = useNavigate();

  // Carrega status real da assinatura da API
  useEffect(() => {
    api.get<any>("/app/billing/status").then(data => {
      if (data?.status === "TRIAL") setAccountStatus("trial");
      else if (data?.status === "ACTIVE") setAccountStatus("active");
      else if (["CANCELED", "PAST_DUE"].includes(data?.status)) setAccountStatus("inactive");
      
      if (data?.dias_restantes != null) setDiasRestantes(data.dias_restantes);
      if (data?.period_ends_at) setPeriodEndsAt(data.period_ends_at);
      else if (data?.trial_ends_at) setPeriodEndsAt(data.trial_ends_at);
      if (data?.gateway) setPaymentGateway(data.gateway);
    }).catch(() => {});
  }, []);

  // Carrega número do gerente salvo
  useEffect(() => {
    api.get<any[]>("/app/gerente").then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setManagerPhone(data[0].telefone);
        setSavedPhone(data[0].telefone);
      }
    }).catch(() => {});
  }, []);

  const handleSavePhone = async () => {
    if (phoneError || !managerPhone.trim()) return;
    setPhoneSaving(true);
    try {
      await api.post("/app/gerente", { telefone: managerPhone.trim() });
      setSavedPhone(managerPhone.trim());
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setPhoneSaving(false);
    }
  };

  // Validação de cupom
  useEffect(() => {
    const code = couponCode.trim().toUpperCase();
    if (code.length < 3) {
      setValidatedCoupon(null);
      setCouponError("");
      return;
    }

    const timer = setTimeout(async () => {
      setCouponValidating(true);
      setCouponError("");
      try {
        const data = await api.get<any>(`/app/billing/validate-coupon?code=${code}`);
        if (data.valid) {
          setValidatedCoupon(data);
        } else {
          setValidatedCoupon(null);
          setCouponError("Cupom inválido");
        }
      } catch (err: any) {
        setValidatedCoupon(null);
        setCouponError(err?.response?.data?.error || "Cupom inválido");
      } finally {
        setCouponValidating(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [couponCode]);


  const formatDocument = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const handleCpfChange = (value: string) => {
    const formatted = formatDocument(value);
    setCpf(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length > 0 && digits.length !== 11 && digits.length !== 14) {
      setCpfError("Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido");
    } else {
      setCpfError("");
    }
  };

  const handleActivateSubscription = useCallback(async (paymentMethod: "pix" | "boleto" | "card_br" | "card_intl", userCpf?: string) => {
    setCheckoutLoading(paymentMethod);
    setPixData(null);
    setBoletoData(null);
    try {
      const successUrl = `${window.location.origin}/billing/success`;
      const cancelUrl = `${window.location.origin}/account`;
      const data = await api.post<any>("/app/billing/checkout", {
        successUrl, cancelUrl, paymentMethod, userCpf,
        usuariosExtras: aiUserCount,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      });
      if (data.url) {
        window.location.href = data.url;
      } else if (data.pix) {
        setPixData(data.pix);
      } else if (data.boleto) {
        setBoletoData(data.boleto);
      } else {
        throw new Error(data.error ?? "Erro ao iniciar checkout");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t("billing.errorRedirect"));
    } finally {
      setCheckoutLoading(null);
      setCpfPendingMethod(null);
      setCpf("");
    }
  }, [t, aiUserCount, couponCode]);

  const handlePixOrBoleto = (method: "pix" | "boleto") => {
    setPixData(null);
    setBoletoData(null);
    setCpf("");
    setCpfError("");
    setCpfPendingMethod(method);
  };

  const handleConfirmCpf = () => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      setCpfError("Digite um CPF (11 dígitos) ou CNPJ (14 dígitos) válido");
      return;
    }
    handleActivateSubscription(cpfPendingMethod!, digits);
  };

  const handleCancelPlan = async () => {
    try {
      setCancelLoading(true);
      const res = await api.post<{ message: string }>("/app/billing/cancel", {});
      alert(res.message);
      setShowCancelModal(false);
      // Se quiser atualizar a tela para forçar re-leitura do status:
      window.location.reload();
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erro ao tentar cancelar a assinatura.");
    } finally {
      setCancelLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const statusConfig: Record<AccountStatus, { label: string; detail: string; variant: "default" | "secondary" | "destructive" }> = {
    trial: { label: t("account.trialActive"), detail: diasRestantes != null ? `${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""} restante${diasRestantes !== 1 ? "s" : ""}` : t("account.daysRemaining"), variant: "default" },
    active: { 
      label: "Assinatura Ativa", 
      detail: periodEndsAt ? `Vencimento: ${formatDate(periodEndsAt)} • Valor: ${formatCurrency(total)}/mês` : `Valor: ${formatCurrency(total)}/mês`, 
      variant: "secondary" 
    },
    inactive: { label: t("account.subscriptionInactive"), detail: t("account.renewPlan"), variant: "destructive" },
  };

  const status = statusConfig[accountStatus];
  const activeProfessionals = professionals.filter(p => p.aiAccess);
  const inactiveProfessionals = professionals.filter(p => !p.aiAccess);

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("account.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("account.subtitle")}</p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">{t("account.managerPhone")}:</span>
              <div className="flex items-center gap-2">
                <Input
                  id="manager-phone"
                  type="tel"
                  placeholder="5511999999999"
                  value={managerPhone}
                  onChange={(e) => { handlePhoneChange(e.target.value); setPhoneSaved(false); }}
                  className={`h-8 text-sm w-48 ${phoneError ? "border-destructive" : savedPhone && managerPhone === savedPhone ? "border-green-500 focus-visible:ring-green-500" : ""}`}
                />
                <Button
                  size="sm"
                  variant={phoneSaved ? "default" : "outline"}
                  className={`h-8 px-3 text-xs transition-all ${phoneSaved ? "bg-green-600 hover:bg-green-700 text-white border-green-600" : ""}`}
                  onClick={handleSavePhone}
                  disabled={phoneSaving || !!phoneError || !managerPhone.trim() || managerPhone.trim() === savedPhone}
                >
                  {phoneSaving ? "..." : phoneSaved ? "✓ Salvo" : "Salvar"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              DDI + DDD + número, sem espaços ou símbolos. Ex: <span className="font-mono text-foreground/70">5511999999999</span>
            </p>
            {phoneError && <p className="text-xs text-destructive pl-6">{phoneError}</p>}
          </div>
        </div>

        {/* 1. Status da Conta */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t("account.accountStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{status.label}</p>
              <p className="text-sm text-muted-foreground">{status.detail}</p>
            </div>
            <Badge 
              variant={status.variant as any} 
              className={`text-sm px-3 py-1 ${accountStatus === 'active' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
            >
              {status.label}
            </Badge>
          </CardContent>
        </Card>

        {/* 2. Visão do Plano */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              {t("account.planOverview")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-foreground">Plano Atual</p>
                <p className="text-sm text-muted-foreground">Valor total base + membros adicionais</p>
              </div>
              <Badge variant="default" className="text-lg px-3 py-1 bg-primary text-primary-foreground">
                {formatCurrency(subtotal)} /mês
              </Badge>
            </div>
            
            <div className="bg-muted/30 p-3 rounded-md mt-2 flex items-center justify-between border border-border/50">
              <div>
                <p className="text-sm font-medium text-foreground">{pricing.planName} (Base)</p>
                <p className="text-xs text-muted-foreground">{t("account.planDesc")}</p>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{formatCurrency(pricing.basePrice)}</span>
            </div>
            
            {activeProfessionals.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-foreground mb-3">Membros Inclusos na Assinatura ({activeProfessionals.length})</p>
                  <div className="space-y-2">
                    {activeProfessionals.map(pro => (
                      <div key={pro.id} className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `hsl(${pro.color})` }}>
                            <Bot className="h-4 w-4 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{pro.name}</p>
                            <p className="text-xs text-muted-foreground">{pro.phone || t("account.noPhone")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">{formatCurrency(pricing.pricePerUser)}</Badge>
                          <Button variant="outline" size="sm" className="text-xs border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground h-7 px-2" onClick={() => handleDisableAccess(pro.id)}>
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 3. Membros Sem Acesso à IA (Inativos) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  {t("account.teamAccess")}
                </CardTitle>
                <CardDescription className="mt-1.5">Membros da equipe que não possuem acesso à inteligência artificial.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {inactiveProfessionals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Todos os membros da equipe já estão inclusos na sua assinatura.</p>
            ) : (
              inactiveProfessionals.map(pro => (
                <div key={pro.id} className="flex items-center justify-between rounded-lg border border-border p-3 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `hsl(${pro.color})` }}>
                      <span className="text-primary-foreground font-medium text-xs">{pro.name.substring(0, 2).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{pro.name}</p>
                      <p className="text-xs text-muted-foreground">{pro.phone || t("account.noPhone")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="text-xs h-7 px-3" onClick={() => handleEnableAccess(pro.id)}>
                      Ativar Acesso (+ {formatCurrency(pricing.pricePerUser)})
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 4. Resumo Mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calculator className="h-5 w-5 text-primary" />
              {t("account.monthlySummary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{pricing.planName}</span>
              <span className="text-sm text-foreground">{formatCurrency(pricing.basePrice)}</span>
            </div>
            {aiUserCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("account.additionalUsers")} ({aiUserCount} × {formatCurrency(pricing.pricePerUser)})
                </span>
                <span className="text-sm text-foreground">{formatCurrency(additionalCost)}</span>
              </div>
            )}
            {/* Campo de cupom de desconto */}
            <div className="space-y-1">
              <button
                type="button"
                className="text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => { 
                  setShowCoupon(v => !v); 
                  setCouponCode(""); 
                  setValidatedCoupon(null);
                  setCouponError("");
                }}
              >
                {showCoupon ? "Cancelar cupom" : "Tenho um cupom de desconto"}
              </button>
              {showCoupon && (
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Input
                      id="coupon-code"
                      placeholder="Código do cupom"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className={`h-8 text-sm font-mono tracking-widest ${couponError ? "border-destructive" : ""}`}
                      maxLength={32}
                    />
                    {couponValidating && (
                      <div className="absolute right-2 top-2 h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {validatedCoupon && (
                    <span className="text-xs text-green-500 whitespace-nowrap">✓ {validatedCoupon.discountType === "percent" ? `${validatedCoupon.discountValue}%` : formatCurrency(validatedCoupon.discountValue)}</span>
                  )}
                </div>
              )}
              {couponError && <p className="text-[10px] text-destructive font-medium">{couponError}</p>}
            </div>

            {validatedCoupon && (
              <div className="flex items-center justify-between text-green-500">
                <span className="text-sm">
                  Desconto Cupom ({validatedCoupon.code})
                </span>
                <span className="text-sm font-medium">- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{t("account.totalMonthly")}</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 5. Faturamento e Pagamento */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-primary" />
              {t("account.billing")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(accountStatus === "trial" || accountStatus === "inactive") && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
                <p className="text-sm font-medium text-foreground">
                  {accountStatus === "trial" ? t("account.inTrial") : t("account.noSubscription")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total a pagar: <strong className="text-foreground">{formatCurrency(total)}/mês</strong>
                  {aiUserCount > 0 && <span className="ml-1 text-muted-foreground">(plano base + {aiUserCount} usuário{aiUserCount > 1 ? "s" : ""} com IA)</span>}
                </p>


                <div className="grid grid-cols-3 gap-2">
                  <Button variant={cpfPendingMethod === "pix" ? "default" : "outline"} className="flex flex-col h-auto py-3 gap-1 border-primary/40 hover:border-primary hover:bg-primary/5" onClick={() => handlePixOrBoleto("pix")} disabled={!!checkoutLoading}>
                    <QrCode className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">PIX</span>
                    <span className="text-[10px] text-muted-foreground">Aprovação imediata</span>
                  </Button>
                  <Button variant={cpfPendingMethod === "boleto" ? "default" : "outline"} className="flex flex-col h-auto py-3 gap-1 border-primary/40 hover:border-primary hover:bg-primary/5" onClick={() => handlePixOrBoleto("boleto")} disabled={!!checkoutLoading}>
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">Boleto</span>
                    <span className="text-[10px] text-muted-foreground">Vence em 3 dias</span>
                  </Button>
                  <Button variant="outline" className="flex flex-col h-auto py-3 gap-1 border-primary/40 hover:border-primary hover:bg-primary/5" onClick={() => handleActivateSubscription("card_br")} disabled={!!checkoutLoading}>
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">Cartão</span>
                    <span className="text-[10px] text-muted-foreground">Renovação automática</span>
                  </Button>
                </div>

                {cpfPendingMethod && !checkoutLoading && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-medium text-foreground">
                      Informe seu CPF ou CNPJ para gerar o {cpfPendingMethod === "pix" ? "QR Code PIX" : "Boleto"}
                    </p>
                    <div className="space-y-1">
                      <Input placeholder="CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)" value={cpf} onChange={(e) => handleCpfChange(e.target.value)} className={`text-sm ${cpfError ? "border-destructive" : ""}`} onKeyDown={(e) => e.key === "Enter" && handleConfirmCpf()} autoFocus />
                      {cpfError && <p className="text-xs text-destructive">{cpfError}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setCpfPendingMethod(null)}>Cancelar</Button>
                      <Button size="sm" className="flex-1 text-xs" onClick={handleConfirmCpf} disabled={cpf.replace(/\D/g, "").length !== 11 && cpf.replace(/\D/g, "").length !== 14}>
                        Gerar {cpfPendingMethod === "pix" ? "PIX" : "Boleto"}
                      </Button>
                    </div>
                  </div>
                )}

                {checkoutLoading && (
                  <p className="text-xs text-center text-muted-foreground animate-pulse">
                    {checkoutLoading === "pix" ? "Gerando QR Code..." : checkoutLoading === "boleto" ? "Gerando boleto..." : "Redirecionando para o checkout..."}
                  </p>
                )}

                {pixData && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
                    <p className="text-xs font-medium text-green-400">PIX gerado — escaneie o QR code ou copie o código</p>
                    {pixData.qrCodeBase64 && (
                      <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto w-40 h-40" />
                    )}
                    <div className="rounded bg-muted/60 px-3 py-2 text-[11px] font-mono break-all text-muted-foreground select-all">{pixData.qrCode}</div>
                    <Button size="sm" variant={copied ? "default" : "outline"} className="w-full text-xs" onClick={() => { navigator.clipboard.writeText(pixData.qrCode); setCopied(true); setTimeout(() => setCopied(false), 2500); }}>
                      {copied ? "Código copiado!" : "Copiar código PIX"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">Expira em: {new Date(pixData.expiresAt).toLocaleString("pt-BR")}</p>
                  </div>
                )}

                {boletoData && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
                    <p className="text-xs font-medium text-yellow-400">Boleto gerado</p>
                    <div className="rounded bg-muted/60 px-3 py-2 text-[11px] font-mono break-all text-muted-foreground select-all">{boletoData.barcode}</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => navigator.clipboard.writeText(boletoData.barcode)}>Copiar código</Button>
                      <Button size="sm" className="flex-1 text-xs" onClick={() => window.open(boletoData.url, "_blank")}>Ver boleto</Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">Vencimento: {new Date(boletoData.expiresAt).toLocaleString("pt-BR")}</p>
                  </div>
                )}
              </div>
            )}

            {accountStatus === "active" && (
              <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4 space-y-3">
                <Badge variant="secondary" className="text-xs">{t("account.active")}</Badge>
                <p className="text-sm font-medium text-foreground">{t("account.subscriptionActive")}</p>
                <p className="text-xs text-muted-foreground">
                  Sua conta está em dia. A próxima cobrança ou renovação ocorrerá em {periodEndsAt ? formatDate(periodEndsAt) : "breve"}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* 6. Cancelar Assinatura (Rodapé) */}
      {accountStatus === "active" && (
        <div className="flex justify-center pt-2 pb-10">
          <button 
            type="button" 
            className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors underline underline-offset-4"
            onClick={() => setShowCancelModal(true)}
          >
            Deseja cancelar sua assinatura?
          </button>
        </div>
      )}

      {/* Team Activation Modal */}
      <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("account.enableAiAccess")}</DialogTitle>
            <DialogDescription>{t("account.enableAiDesc")} {formatCurrency(pricing.pricePerUser)}{t("account.perMonth")}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {professionals.map(pro => (
              <div key={pro.id} className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${pro.aiAccess ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full" style={{ backgroundColor: `hsl(${pro.color})` }} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{pro.name}</p>
                    <p className="text-xs text-muted-foreground">{pro.phone || t("account.noPhoneSet")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pro.aiAccess && <Badge variant="secondary" className="text-xs">{t("account.aiEnabled")}</Badge>}
                  <Button size="sm" variant={pro.aiAccess ? "outline" : "default"} onClick={() => toggleAiAccess(pro.id, pro.aiAccess)}>
                    {pro.aiAccess ? t("account.disable") : t("account.enable")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {/* Modal de Confirmação de Downgrade */}
      <Dialog open={confirmDowngradeModal.isOpen} onOpenChange={(open) => !open && setConfirmDowngradeModal({ isOpen: false, professionalId: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Atenção: Ação Irreversível
            </DialogTitle>
            <DialogDescription className="pt-3 pb-2 text-base text-foreground font-medium">
              Você está prestes a remover o acesso à IA deste profissional.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-md border border-destructive/20 mt-2">
            <p><strong>Aviso Importante:</strong> O valor já pago por esta licença durante o ciclo atual <strong>não é estornável</strong> em caso de pagamento via PIX/Boleto.</p>
            <p className="mt-2">Se você decidir adicionar este ou outro membro novamente, poderá ser necessária uma nova cobrança de {formatCurrency(pricing.pricePerUser)}.</p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setConfirmDowngradeModal({ isOpen: false, professionalId: null })}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDowngrade}>Sim, quero remover</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Cancelamento do Plano Inteiro */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Cancelar Assinatura
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {paymentGateway === "stripe" ? (
              <>
                <p className="text-sm text-foreground">
                  Tem certeza que deseja cancelar sua assinatura? Você perderá o acesso à inteligência artificial para toda a sua equipe após o dia <strong>{periodEndsAt ? formatDate(periodEndsAt) : "de vencimento"}</strong>.
                </p>
                <div className="flex justify-end gap-3 mt-6">
                  <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={cancelLoading}>Não, voltar</Button>
                  <Button variant="destructive" onClick={handleCancelPlan} disabled={cancelLoading}>
                    {cancelLoading ? "Processando..." : "Sim, cancelar renovação"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground">
                  Sua assinatura foi realizada via <strong>PIX ou Boleto</strong> e <span className="font-semibold text-destructive">não possui renovação automática</span>.
                </p>
                <p className="text-sm text-foreground">
                  Fique tranquilo, você não receberá nenhuma cobrança surpresa. Seu acesso permanecerá ativo até o dia <strong>{periodEndsAt ? formatDate(periodEndsAt) : "de vencimento"}</strong> e depois será suspenso.
                </p>
                <div className="flex justify-end mt-6">
                  <Button variant="outline" onClick={() => setShowCancelModal(false)}>Entendi, obrigado</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
