import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function BillingCancelPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="mx-auto max-w-md flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardContent className="pt-8 pb-6 px-8 text-center space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">
              {t("billing.cancelTitle")}
            </h1>
            <p className="text-muted-foreground">
              {t("billing.cancelDesc")}
            </p>
            <Button onClick={() => navigate("/account")} className="w-full">
              {t("billing.backToAccount")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
