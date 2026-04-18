import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Shield, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Settings } from "lucide-react";
import { useModules, type AppModule } from "@/contexts/ModulesContext";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const emptyForm = {
  module_name: "",
  short_description: "",
  status: "active" as "active" | "coming_soon" | "disabled",
  route_path: "",
  icon: "⚙️",
  highlight_badge: "",
  requires_plan: false,
  display_order: 0,
};

export default function ModulesManagerPage() {
  const { modules, addModule, updateModule, deleteModule } = useModules();
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sorted = [...modules].sort((a, b) => a.display_order - b.display_order);

  const openNew = () => {
    setForm({ ...emptyForm, display_order: modules.length + 1 });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (m: AppModule) => {
    setForm({
      module_name: m.module_name,
      short_description: m.short_description,
      status: m.status,
      route_path: m.route_path,
      icon: m.icon,
      highlight_badge: m.highlight_badge,
      requires_plan: m.requires_plan,
      display_order: m.display_order,
    });
    setEditingId(m.id);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.module_name.trim()) {
      toast({ title: t("mm.nameRequired"), variant: "destructive" });
      return;
    }
    if (!form.route_path.trim() || !form.route_path.startsWith("/")) {
      toast({ title: t("mm.routeRequired"), variant: "destructive" });
      return;
    }

    const data = {
      ...form,
      module_name: form.module_name.trim(),
      short_description: form.short_description.slice(0, 120),
      route_path: form.route_path.trim(),
    };

    if (editingId) {
      updateModule(editingId, data);
      toast({ title: t("mm.moduleUpdated") });
    } else {
      addModule(data);
      toast({ title: t("mm.moduleCreated") });
    }
    setShowModal(false);
  };

  const handleDelete = (id: string, name: string) => {
    deleteModule(id);
    toast({ title: t("mm.deleted", { name }) });
  };

  const cycleStatus = (m: AppModule) => {
    const next = m.status === "active" ? "coming_soon" : m.status === "coming_soon" ? "disabled" : "active";
    updateModule(m.id, { status: next });
    const statusLabel = next === "active" ? t("mm.active") : next === "coming_soon" ? t("mm.comingSoon") : t("mm.disabled");
    toast({ title: t("mm.statusChanged", { status: statusLabel }) });
  };

  const statusColor = (s: string) => {
    if (s === "active") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (s === "coming_soon") return "bg-muted text-muted-foreground";
    return "bg-destructive/20 text-destructive border-destructive/30";
  };

  const statusLabel = (s: string) => {
    if (s === "active") return t("mm.active");
    if (s === "coming_soon") return t("mm.comingSoon");
    return t("mm.disabled");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <Shield className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("mm.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("mm.subtitle")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5 text-primary" />
                  {t("mm.modules")}
                </CardTitle>
                <CardDescription>{t("mm.modulesDesc")}</CardDescription>
              </div>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" />
                {t("mm.addModule")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("mm.noModules")}
              </p>
            )}
            {sorted.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-4 space-y-2 transition-colors ${
                  m.status === "active"
                    ? "border-primary/30 bg-primary/5"
                    : m.status === "disabled"
                    ? "border-destructive/20 bg-destructive/5 opacity-60"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{m.icon}</span>
                    <span className="font-medium text-foreground">{m.module_name}</span>
                    {m.highlight_badge && (
                      <Badge variant="secondary" className="text-xs">
                        {m.highlight_badge}
                      </Badge>
                    )}
                    {m.requires_plan && (
                      <Badge variant="outline" className="text-xs">🔒 PRO</Badge>
                    )}
                  </div>
                  <Badge variant="secondary" className={`text-xs ${statusColor(m.status)}`}>
                    {statusLabel(m.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{m.short_description}</p>
                <p className="text-xs text-muted-foreground/70 font-mono">{m.route_path}</p>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> {t("mm.edit")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => cycleStatus(m)}>
                    {m.status === "active" ? (
                      <ToggleRight className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <ToggleLeft className="h-3.5 w-3.5 mr-1" />
                    )}
                    {t("mm.toggle")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(m.id, m.module_name)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("mm.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={(open) => !open && setShowModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("mm.editModule") : t("mm.newModule")}</DialogTitle>
            <DialogDescription>
              {editingId ? t("mm.editModuleDesc") : t("mm.newModuleDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-3">
              <div className="space-y-2">
                <Label>{t("mm.icon")}</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                  className="text-center text-xl"
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("mm.moduleName")}</Label>
                <Input
                  value={form.module_name}
                  onChange={(e) => setForm((f) => ({ ...f, module_name: e.target.value }))}
                  placeholder={t("mm.moduleNamePlaceholder")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("mm.shortDesc")}</Label>
              <Textarea
                value={form.short_description}
                onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value.slice(0, 120) }))}
                placeholder={t("mm.shortDescPlaceholder")}
                rows={2}
              />
              <p className="text-xs text-muted-foreground text-right">{form.short_description.length}/120</p>
            </div>
            <div className="space-y-2">
              <Label>{t("mm.routePath")}</Label>
              <Input
                value={form.route_path}
                onChange={(e) => setForm((f) => ({ ...f, route_path: e.target.value }))}
                placeholder="/finance"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("mm.status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "coming_soon" | "disabled" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("mm.active")}</SelectItem>
                    <SelectItem value="coming_soon">{t("mm.comingSoon")}</SelectItem>
                    <SelectItem value="disabled">{t("mm.disabled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("mm.displayOrder")}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("mm.highlightBadge")}</Label>
              <Select
                value={form.highlight_badge || "_none"}
                onValueChange={(v) => setForm((f) => ({ ...f, highlight_badge: v === "_none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder={t("mm.none")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("mm.none")}</SelectItem>
                  <SelectItem value="NEW">NEW</SelectItem>
                  <SelectItem value="BETA">BETA</SelectItem>
                  <SelectItem value="PRO">PRO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>{t("mm.requiresPlan")}</Label>
                <p className="text-xs text-muted-foreground">{t("mm.requiresPlanDesc")}</p>
              </div>
              <Switch
                checked={form.requires_plan}
                onCheckedChange={(v) => setForm((f) => ({ ...f, requires_plan: v }))}
              />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editingId ? t("mm.updateModule") : t("mm.createModule")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
