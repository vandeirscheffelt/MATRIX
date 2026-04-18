import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="mx-auto max-w-md flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardContent className="pt-8 pb-6 px-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">
              {t("billing.successTitle")}
            </h1>
            <p className="text-muted-foreground">
              {t("billing.successDesc")}
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
