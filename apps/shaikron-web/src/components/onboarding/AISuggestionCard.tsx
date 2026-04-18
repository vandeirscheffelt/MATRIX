import { useEffect, useState } from "react";
import { Check, X, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

interface AISuggestionCardProps {
  fieldLabel: string;
  original: string;
  suggested: string;
  originalQuestion?: string;
  suggestedQuestion?: string;
  onApply: (text: string, question?: string) => void;
  onDismiss: () => void;
}

export default function AISuggestionCard({
  fieldLabel,
  original,
  suggested,
  originalQuestion,
  suggestedQuestion,
  onApply,
  onDismiss,
}: AISuggestionCardProps) {
  const { t } = useLanguage();
  const safeOriginal = typeof original === "string" ? original : "";
  const safeSuggested = typeof suggested === "string" ? suggested : "";
  const safeOriginalQ = typeof originalQuestion === "string" ? originalQuestion : "";
  const safeSuggestedQ = typeof suggestedQuestion === "string" ? suggestedQuestion : "";

  const isFaqMode = Boolean(safeOriginalQ || safeSuggestedQ);

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(safeSuggested);
  const [editedQuestion, setEditedQuestion] = useState(safeSuggestedQ);

  useEffect(() => {
    setEditedText(safeSuggested);
    setEditedQuestion(safeSuggestedQ);
    setIsEditing(false);
  }, [safeSuggested, safeSuggestedQ]);

  const currentSuggestion = (isEditing ? editedText : safeSuggested).trim();
  const currentQuestion = (isEditing ? editedQuestion : safeSuggestedQ).trim();
  const originalText = safeOriginal.trim();

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {t("aiSugg.title", { field: fieldLabel })}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("aiSugg.subtitle")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Original */}
        <div className="rounded-lg border border-border bg-background/70 p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("aiSugg.originalText")}
          </p>
          {isFaqMode && (
            <div className="mb-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{t("aiSugg.question")}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {safeOriginalQ || "—"}
              </p>
            </div>
          )}
          <div>
            {isFaqMode && <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{t("aiSugg.answer")}</p>}
            <p className={`text-xs leading-relaxed ${originalText ? "text-muted-foreground" : "italic text-muted-foreground"}`}>
              {originalText || t("aiSugg.noOriginal")}
            </p>
          </div>
        </div>

        {/* Improved */}
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-primary">
            {t("aiSugg.improvedVersion")}
          </p>
          {isEditing ? (
            <div className="space-y-2">
              {isFaqMode && (
                <div>
                  <p className="text-[10px] font-medium text-primary mb-0.5">{t("aiSugg.question")}</p>
                  <Input
                    value={editedQuestion}
                    onChange={(e) => setEditedQuestion(e.target.value)}
                    className="border-primary/30 bg-background text-xs h-8"
                    autoFocus={isFaqMode}
                  />
                </div>
              )}
              <div>
                {isFaqMode && <p className="text-[10px] font-medium text-primary mb-0.5">{t("aiSugg.answer")}</p>}
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[80px] resize-none border-primary/30 bg-background text-xs"
                  autoFocus={!isFaqMode}
                />
              </div>
            </div>
          ) : safeSuggested ? (
            <div>
              {isFaqMode && safeSuggestedQ && (
                <div className="mb-2">
                  <p className="text-[10px] font-medium text-primary mb-0.5">{t("aiSugg.question")}</p>
                  <p className="text-xs leading-relaxed text-foreground">{safeSuggestedQ}</p>
                </div>
              )}
              <div>
                {isFaqMode && <p className="text-[10px] font-medium text-primary mb-0.5">{t("aiSugg.answer")}</p>}
                <p className="text-xs leading-relaxed text-foreground">{safeSuggested}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs italic leading-relaxed text-muted-foreground">
              {t("aiSugg.noSuggestion")}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => onApply(currentSuggestion, isFaqMode ? currentQuestion : undefined)}
          disabled={!currentSuggestion}
        >
          <Check className="h-3 w-3" />
          {t("aiSugg.apply")}
        </Button>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
            {t("aiSugg.edit")}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              setIsEditing(false);
              setEditedText(safeSuggested);
              setEditedQuestion(safeSuggestedQ);
            }}
          >
            {t("aiSugg.cancelEdit")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={onDismiss}
        >
          <X className="h-3 w-3" />
          {t("aiSugg.keepOriginal")}
        </Button>
      </div>
    </div>
  );
}