import { useState, useEffect } from "react";
import { Plus, Trash2, Clock, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServices } from "@/hooks/api/useServices";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const CUSTOM_SENTINEL = 0;

const PALETTE = [
  "#38bdf8", // sky
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fb923c", // orange
  "#f472b6", // pink
  "#facc15", // yellow
  "#60a5fa", // blue
  "#4ade80", // green
];

export default function ServicesManager() {
  const { services, fetchServices, addService, removeService } = useServices();
  const { t } = useLanguage();
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [adding, setAdding] = useState(false);

  const isCustom = newDuration === CUSTOM_SENTINEL;
  const effectiveDuration = isCustom ? parseInt(customDuration, 10) : newDuration;
  const canAdd = !adding && newName.trim() && (isCustom ? parseInt(customDuration, 10) > 0 : true);

  useEffect(() => { fetchServices().catch(() => null); }, [fetchServices]);

  const handleAdd = async () => {
    if (!canAdd) return;
    setAdding(true);
    try {
      const color = PALETTE[services.length % PALETTE.length];
      await addService({ name: newName.trim(), duration: effectiveDuration, color });
      setNewName("");
      setNewDuration(60);
      setCustomDuration("");
      toast.success(t("svc.added"));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar serviço");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    try {
      await removeService(id);
      toast(t("svc.removed", { name }));
    } catch {
      toast.error("Erro ao remover serviço");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          {t("svc.title")}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("svc.subtitle")}
        </p>
      </div>

      {/* Service list */}
      <div className="space-y-2">
        {services.map((svc) => (
          <div
            key={svc.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-secondary p-3 group"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ background: svc.color || "hsl(var(--primary))" }}
            />
            <span className="text-sm font-medium text-foreground flex-1">{svc.name}</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-md px-2 py-0.5">
              <Clock className="h-3 w-3" />
              {svc.duration} min
            </span>
            <button
              onClick={() => handleRemove(svc.id, svc.name)}
              className="text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="flex items-end gap-2 pt-2 border-t border-border">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">{t("svc.nameLabel")}</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={t("svc.namePlaceholder")}
            className="bg-secondary border-border text-sm"
          />
        </div>
        <div className={isCustom ? "w-52" : "w-28"}>
          <label className="text-xs text-muted-foreground mb-1 block">{t("svc.duration")}</label>
          <div className="flex gap-1.5">
            <select
              value={newDuration}
              onChange={(e) => { setNewDuration(Number(e.target.value)); setCustomDuration(""); }}
              className="flex h-9 rounded-md border border-border bg-secondary px-2 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
              <option value={CUSTOM_SENTINEL}>Personalizado</option>
            </select>
            {isCustom && (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={480}
                  placeholder="min"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className="bg-secondary border-border text-sm h-9 w-16 text-center"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!canAdd}
          className="h-9"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
