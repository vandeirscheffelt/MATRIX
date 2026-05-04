import { useState, useEffect, useCallback } from "react";
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
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface Module {
  id: string;
  nome: string;
  descricao: string;
  chave: string;
  icon: string;
  highlightBadge: string;
  routePath: string;
  displayOrder: number;
  status: "active" | "coming_soon" | "disabled";
  requiresPlan: boolean;
  ativo: boolean;
}

function mapApi(m: any): Module {
  return {
    id: m.id,
    nome: m.nome ?? "",
    descricao: m.descricao ?? "",
    chave: m.chave ?? "",
    icon: m.icon ?? "🧩",
    highlightBadge: m.highlightBadge ?? m.highlight_badge ?? "",
    routePath: m.routePath ?? m.route_path ?? "",
    displayOrder: m.displayOrder ?? m.display_order ?? 0,
    status: m.status ?? "active",
    requiresPlan: m.requiresPlan ?? m.requires_plan ?? false,
    ativo: m.ativo ?? true,
  };
}

const emptyForm = {
  nome: "",
  descricao: "",
  chave: "",
  icon: "⚙️",
  highlightBadge: "",
  routePath: "",
  displayOrder: 0,
  status: "active" as "active" | "coming_soon" | "disabled",
  requiresPlan: false,
};

export default function ModulesManagerPage() {
  const { t } = useLanguage();
  const [modules, setModules] = useState<Module[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<any[]>("/admin/modules");
      setModules((data ?? []).map(mapApi));
    } catch {
      toast({ title: "Erro ao carregar módulos", variant: "destructive" });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...modules].sort((a, b) => a.displayOrder - b.displayOrder);

  const openNew = () => {
    setForm({ ...emptyForm, displayOrder: modules.length + 1 });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (m: Module) => {
    setForm({
      nome: m.nome,
      descricao: m.descricao,
      chave: m.chave,
      icon: m.icon,
      highlightBadge: m.highlightBadge,
      routePath: m.routePath,
      displayOrder: m.displayOrder,
      status: m.status,
      requiresPlan: m.requiresPlan,
    });
    setEditingId(m.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: t("mm.nameRequired"), variant: "destructive" });
      return;
    }
    if (!editingId && !form.chave.trim()) {
      toast({ title: "Chave obrigatória", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        nome: form.nome.trim(),
        descricao: form.descricao.slice(0, 300),
        routePath: form.routePath.trim(),
      };
      if (editingId) {
        const updated = await api.patch<any>(`/admin/modules/${editingId}`, payload);
        setModules(prev => prev.map(m => m.id === editingId ? mapApi(updated) : m));
        toast({ title: t("mm.moduleUpdated") });
      } else {
        const created = await api.post<any>("/admin/modules", payload);
        setModules(prev => [...prev, mapApi(created)]);
        toast({ title: t("mm.moduleCreated") });
      }
      setShowModal(false);
    } catch (e: any) {
      toast({ title: e.message ?? "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    try {
      await api.delete(`/admin/modules/${id}`);
      setModules(prev => prev.filter(m => m.id !== id));
      toast({ title: t("mm.deleted", { name: nome }) });
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const cycleStatus = async (m: Module) => {
    const next = m.status === "active" ? "coming_soon" : m.status === "coming_soon" ? "disabled" : "active";
    try {
      const updated = await api.patch<any>(`/admin/modules/${m.id}`, { status: next });
      setModules(prev => prev.map(x => x.id === m.id ? mapApi(updated) : x));
    } catch {
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl">{m.icon}</span>
                    <span className="font-medium text-foreground">{m.nome}</span>
                    {m.highlightBadge && (
                      <Badge variant="secondary" className="text-xs">{m.highlightBadge}</Badge>
                    )}
                    {m.requiresPlan && (
                      <Badge variant="outline" className="text-xs">🔒 PRO</Badge>
                    )}
                  </div>
                  <Badge variant="secondary" className={`text-xs ${statusColor(m.status)}`}>
                    {statusLabel(m.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.descricao}</p>
                <p className="text-xs text-muted-foreground/70 font-mono">{m.routePath}</p>
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
                    size="sm" variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(m.id, m.nome)}
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
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder={t("mm.moduleNamePlaceholder")}
                />
              </div>
            </div>
            {!editingId && (
              <div className="space-y-2">
                <Label>Chave única (slug)</Label>
                <Input
                  value={form.chave}
                  onChange={(e) => setForm((f) => ({ ...f, chave: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-") }))}
                  placeholder="ex: transcritor-video"
                />
                <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e hífen. Não pode ser alterada depois.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("mm.shortDesc")}</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value.slice(0, 300) }))}
                placeholder={t("mm.shortDescPlaceholder")}
                rows={5}
              />
              <p className="text-xs text-muted-foreground text-right">{form.descricao.length}/300</p>
            </div>
            <div className="space-y-2">
              <Label>{t("mm.routePath")}</Label>
              <Input
                value={form.routePath}
                onChange={(e) => setForm((f) => ({ ...f, routePath: e.target.value }))}
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
                  type="number" min="0"
                  value={form.displayOrder}
                  onChange={(e) => setForm((f) => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("mm.highlightBadge")}</Label>
              <Select
                value={form.highlightBadge || "_none"}
                onValueChange={(v) => setForm((f) => ({ ...f, highlightBadge: v === "_none" ? "" : v }))}
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
                checked={form.requiresPlan}
                onCheckedChange={(v) => setForm((f) => ({ ...f, requiresPlan: v }))}
              />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? "Salvando..." : editingId ? t("mm.updateModule") : t("mm.createModule")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
