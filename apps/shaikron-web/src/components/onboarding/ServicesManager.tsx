import { useState } from "react";
import { Plus, Trash2, Clock, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServices } from "@/hooks/api/useServices";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export default function ServicesManager() {
  const { services, addService, updateService, removeService } = useServices();
  const { t } = useLanguage();
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    await addService({ name: newName.trim(), duration: newDuration });
    setNewName("");
    setNewDuration(60);
    setAdding(false);
    toast.success(t("svc.added"));
  };

  const handleRemove = async (id: string, name: string) => {
    await removeService(id);
    toast(t("svc.removed", { name }));
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
              style={{ background: svc.color ? `hsl(${svc.color})` : "hsl(var(--primary))" }}
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
        <div className="w-28">
          <label className="text-xs text-muted-foreground mb-1 block">{t("svc.duration")}</label>
          <select
            value={newDuration}
            onChange={(e) => setNewDuration(Number(e.target.value))}
            className="flex h-9 w-full rounded-md border border-border bg-secondary px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newName.trim() || adding}
          className="h-9"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
