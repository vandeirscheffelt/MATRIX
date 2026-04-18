import { AlertTriangle, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ConfigGap } from "./useConfigGaps";

interface ConfigGapPanelProps {
  gaps: ConfigGap[];
  onFixNow: (fieldId: string) => void;
}

export default function ConfigGapPanel({ gaps, onFixNow }: ConfigGapPanelProps) {
  const { t } = useLanguage();

  if (gaps.length === 0) return null;

  const criticalCount = gaps.filter(g => g.severity === "critical").length;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-destructive/15">
          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
        </div>
        <div className="flex-1">
          <h3 className="text-xs font-semibold text-foreground">{t("gaps.title")}</h3>
          <p className="text-[10px] text-muted-foreground">{t("gaps.subtitle")}</p>
        </div>
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {criticalCount} {t("gaps.critical")}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {gaps.map((gap) => (
          <div
            key={gap.id}
            className={`rounded-lg border p-3 transition-all animate-in fade-in slide-in-from-bottom-1 duration-200 ${
              gap.severity === "critical"
                ? "border-destructive/30 bg-destructive/5"
                : "border-amber-500/20 bg-amber-500/5"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <AlertTriangle className={`h-3 w-3 shrink-0 ${
                    gap.severity === "critical" ? "text-destructive" : "text-amber-400"
                  }`} />
                  <p className="text-xs font-medium text-foreground truncate">
                    {gap.title}
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed ml-[18px]">
                  {gap.description}
                </p>
              </div>
            </div>
            <div className="mt-2 ml-[18px]">
              <Button
                variant="outline"
                size="sm"
                className={`text-[10px] h-6 px-2 ${
                  gap.severity === "critical"
                    ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                    : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                }`}
                onClick={() => onFixNow(gap.fieldId)}
              >
                <ArrowRight className="h-2.5 w-2.5 mr-1" /> {t("gaps.fixNow")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
