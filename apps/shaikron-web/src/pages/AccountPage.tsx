import { useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [phoneError, setPhoneError] = useState("");
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("trial");

  const aiUserCount = professionals.filter(p => p.aiAccess).length;
  const additionalCost = aiUserCount * pricing.pricePerUser;
  const total = pricing.basePrice + additionalCost;

  const handlePhoneChange = (value: string) => {
    setManagerPhone(value);
    if (value && !/^\+?\d[\d\s\-()]{7,}$/.test(value.trim())) {
      setPhoneError(t("account.phoneError"));
    } else {
      setPhoneError("");
    }
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toFixed(2).replace(".", ",")}`;

  const toggleAiAccess = (id: string, current: boolean) => {
    updateProfessional(id, { aiAccess: !current });
  };

  const navigate = useNavigate();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeBase64: string; expiresAt: string; valor: number } | null>(null);
  const [boletoData, setBoletoData] = useState<{ url: string; barcode: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [cpfPendingMethod, setCpfPendingMethod] = useState<"pix" | "boleto" | null>(null);
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");

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
      const data = await api.post<any>("/app/billing/checkout", { successUrl, cancelUrl, paymentMethod, userCpf });
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
  }, [t]);

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

  const statusConfig: Record<AccountStatus, { label: string; detail: string; variant: "default" | "secondary" | "destructive" }> = {
    trial: { label: t("account.trialActive"), detail: t("account.daysRemaining"), variant: "default" },
    active: { label: t("account.subscriptionActive"), detail: t("account.nextBillingDays"), variant: "secondary" },
    inactive: { label: t("account.subscriptionInactive"), detail: t("account.renewPlan"), variant: "destructive" },
  };

  const status = statusConfig[accountStatus];
  const aiProfessionals = professionals.filter(p => p.aiAccess);

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("account.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("account.subtitle")}
          </p>
        </div>

        {/* Account Status */}
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
            <Badge variant={status.variant} className="text-sm px-3 py-1">
              {status.label}
            </Badge>
          </CardContent>
        </Card>

        {/* Billing & Payment */}
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
                <div className="flex items-center gap-2">
                  <Badge variant={accountStatus === "trial" ? "default" : "destructive"} className="text-xs">
                    {accountStatus === "trial" ? t("account.trialActive") : t("account.inactive")}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-foreground">
                  {accountStatus === "trial" ? t("account.inTrial") : t("account.noSubscription")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Escolha como deseja pagar — R$ 97/mês
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={cpfPendingMethod === "pix" ? "default" : "outline"}
                    className="flex flex-col h-auto py-3 gap-1 border-primary/40 hover:border-primary hover:bg-primary/5"
                    onClick={() => handlePixOrBoleto("pix")}
                    disabled={!!checkoutLoading}
                  >
                    <QrCode className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">PIX</span>
                    <span className="text-[10px] text-muted-foreground">Aprovação imediata</span>
                  </Button>

                  <Button
                    variant={cpfPendingMethod === "boleto" ? "default" : "outline"}
                    className="flex flex-col h-auto py-3 gap-1 border-primary/40 hover:border-primary hover:bg-primary/5"
                    onClick={() => handlePixOrBoleto("boleto")}
                    disabled={!!checkoutLoading}
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">Boleto</span>
                    <span className="text-[10px] text-muted-foreground">Vence em 3 dias</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="flex flex-col h-auto py-3 gap-1 border-primary/40 hover:border-primary hover:bg-primary/5"
                    onClick={() => handleActivateSubscription("card_br")}
                    disabled={!!checkoutLoading}
                  >
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">Cartão</span>
                    <span className="text-[10px] text-muted-foreground">Renovação automática</span>
                  </Button>
                </div>

                {/* CPF input — aparece ao selecionar PIX ou Boleto */}
                {cpfPendingMethod && !checkoutLoading && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-medium text-foreground">
                      Informe seu CPF para gerar o {cpfPendingMethod === "pix" ? "QR Code PIX" : "Boleto"}
                    </p>
                    <div className="space-y-1">
                      <Input
                        placeholder="CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)"
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        className={`text-sm ${cpfError ? "border-destructive" : ""}`}
                        onKeyDown={(e) => e.key === "Enter" && handleConfirmCpf()}
                        autoFocus
                      />
                      {cpfError && <p className="text-xs text-destructive">{cpfError}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setCpfPendingMethod(null)}>
                        Cancelar
                      </Button>
                      <Button size="sm" className="flex-1 text-xs" onClick={handleConfirmCpf} disabled={cpf.replace(/\D/g, "").length !== 11 && cpf.replace(/\D/g, "").length !== 14}>
                        Gerar {cpfPendingMethod === "pix" ? "PIX" : "Boleto"}
                      </Button>
                    </div>
                  </div>
                )}

                {checkoutLoading && (
                  <p className="text-xs text-center text-muted-foreground animate-pulse">
                    {checkoutLoading === "pix" ? "Gerando QR Code..." :
                     checkoutLoading === "boleto" ? "Gerando boleto..." :
                     "Redirecionando para o checkout..."}
                  </p>
                )}

                {/* PIX QR Code */}
                {pixData && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
                    <p className="text-xs font-medium text-green-400">PIX gerado — escaneie o QR code ou copie o código</p>
                    {pixData.qrCodeBase64 && (
                      <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="mx-auto w-40 h-40" />
                    )}
                    <div className="rounded bg-muted/60 px-3 py-2 text-[11px] font-mono break-all text-muted-foreground select-all">
                      {pixData.qrCode}
                    </div>
                    <Button
                      size="sm"
                      variant={copied ? "default" : "outline"}
                      className="w-full text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.qrCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      }}
                    >
                      {copied ? "Código copiado!" : "Copiar código PIX"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Expira em: {new Date(pixData.expiresAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}

                {/* Boleto */}
                {boletoData && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
                    <p className="text-xs font-medium text-yellow-400">Boleto gerado</p>
                    <div className="rounded bg-muted/60 px-3 py-2 text-[11px] font-mono break-all text-muted-foreground select-all">
                      {boletoData.barcode}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => navigator.clipboard.writeText(boletoData.barcode)}>
                        Copiar código
                      </Button>
                      <Button size="sm" className="flex-1 text-xs" onClick={() => window.open(boletoData.url, "_blank")}>
                        Ver boleto
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Vencimento: {new Date(boletoData.expiresAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {accountStatus === "active" && (
              <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{t("account.active")}</Badge>
                </div>
                <p className="text-sm font-medium text-foreground">{t("account.subscriptionActive")}</p>
                <p className="text-xs text-muted-foreground">{t("account.nextBilling")}</p>
                <Button variant="outline" className="w-full">
                  {t("account.manageSubscription")}
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Manager Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5 text-primary" />
              {t("account.managerAccess")}
            </CardTitle>
            <CardDescription>
              {t("account.managerDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="manager-phone">{t("account.managerPhone")}</Label>
              <Input
                id="manager-phone"
                type="tel"
                placeholder="+55 11 99999-9999"
                value={managerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className={phoneError ? "border-destructive" : ""}
              />
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Plan Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              {t("account.planOverview")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{pricing.planName}</p>
                <p className="text-sm text-muted-foreground">{t("account.monthlySubscription")}</p>
              </div>
              <Badge variant="secondary" className="text-base px-3 py-1">
                {formatCurrency(pricing.basePrice)} {t("account.perMonth")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("account.currentPricing")}: {formatCurrency(pricing.basePrice)} ({pricing.planName})
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {t("account.planDesc")}
            </p>
          </CardContent>
        </Card>

        {/* Team Access */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  {t("account.teamAccess")}
                </CardTitle>
                <CardDescription className="mt-1.5">
                  {t("account.teamDesc")}
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowTeamModal(true)}>
                <Plus className="h-4 w-4" />
                {t("account.addTeamMember")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {accountStatus !== "active" && aiProfessionals.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  {t("account.aiAccessWarning")}
                </p>
              </div>
            )}
            {aiProfessionals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("account.noAiProfessionals")}
              </p>
            ) : (
              aiProfessionals.map(pro => (
                <div
                  key={pro.id}
                  className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `hsl(${pro.color})` }}
                    >
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{pro.name}</p>
                      <p className="text-xs text-muted-foreground">{pro.phone || t("account.noPhone")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {formatCurrency(pricing.pricePerUser)}
                    </Badge>
                    <Switch
                      checked={pro.aiAccess}
                      onCheckedChange={() => toggleAiAccess(pro.id, pro.aiAccess)}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Monthly Summary */}
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
              <span className="text-sm text-foreground">
                {formatCurrency(pricing.basePrice)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("account.additionalUsers")} ({aiUserCount} × {formatCurrency(pricing.pricePerUser)})
              </span>
              <span className="text-sm text-foreground">
                {formatCurrency(additionalCost)}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{t("account.totalMonthly")}</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(total)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              {t("account.simulationNote")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Activation Modal */}
      <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("account.enableAiAccess")}</DialogTitle>
            <DialogDescription>
              {t("account.enableAiDesc")} {formatCurrency(pricing.pricePerUser)}{t("account.perMonth")}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {professionals.map(pro => (
              <div
                key={pro.id}
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  pro.aiAccess ? "border-primary/30 bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full"
                    style={{ backgroundColor: `hsl(${pro.color})` }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{pro.name}</p>
                    <p className="text-xs text-muted-foreground">{pro.phone || t("account.noPhoneSet")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pro.aiAccess && (
                    <Badge variant="secondary" className="text-xs">{t("account.aiEnabled")}</Badge>
                  )}
                  <Button
                    size="sm"
                    variant={pro.aiAccess ? "outline" : "default"}
                    onClick={() => toggleAiAccess(pro.id, pro.aiAccess)}
                  >
                    {pro.aiAccess ? t("account.disable") : t("account.enable")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
