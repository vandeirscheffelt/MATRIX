import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Plus, Pencil, Trash2, GraduationCap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { api } from "@/lib/apiClient";

interface Tutorial {
  id: string;
  titulo: string;
  descricao?: string;
  videoUrl: string;
  categoria: string;
  ordem: number;
  obrigatorio: boolean;
  ativo: boolean;
}

const CATEGORIAS = ["primeiros_passos", "configuracao", "whatsapp", "agenda", "relatorios"];

const emptyForm = {
  titulo: "",
  descricao: "",
  videoUrl: "",
  categoria: "primeiros_passos",
  ordem: 0,
  obrigatorio: false,
  ativo: true,
};

export default function TutorialsManagerPage() {
  const { t } = useLanguage();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = () =>
    api.get<Tutorial[]>("/admin/tutorials").then(setTutorials).catch(() => {});

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ ...emptyForm, ordem: tutorials.length + 1 });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (t: Tutorial) => {
    setForm({
      titulo: t.titulo,
      descricao: t.descricao ?? "",
      videoUrl: t.videoUrl,
      categoria: t.categoria,
      ordem: t.ordem,
      obrigatorio: t.obrigatorio,
      ativo: t.ativo,
    });
    setEditingId(t.id);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) { toast({ title: t("tm.nameRequired"), variant: "destructive" }); return; }
    if (!form.videoUrl.trim()) { toast({ title: t("tm.urlRequired"), variant: "destructive" }); return; }
    const payload = {
      ...form,
      videoUrl: form.videoUrl.startsWith("http") ? form.videoUrl : `https://${form.videoUrl}`,
    };
    try {
      if (editingId) {
        await api.patch(`/admin/tutorials/${editingId}`, payload);
      } else {
        await api.post("/admin/tutorials", payload);
      }
      toast({ title: t("tm.saved") });
      setShowModal(false);
      load();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/tutorials/${id}`);
      toast({ title: t("tm.deleted") });
      load();
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  };

  const sorted = [...tutorials].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.ordem - b.ordem);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <Shield className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("tm.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tm.subtitle")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  Tutoriais
                </CardTitle>
                <CardDescription>{t("tm.subtitle")}</CardDescription>
              </div>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> {t("tm.add")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("tm.noItems")}</p>
            )}
            {sorted.map((tut) => (
              <div
                key={tut.id}
                className={`rounded-lg border p-4 space-y-1 transition-colors ${
                  tut.ativo ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{tut.titulo}</span>
                    <Badge variant="outline" className="text-xs">{t(`tutorials.cat.${tut.categoria}`)}</Badge>
                    {tut.obrigatorio && (
                      <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">{t("tm.required")}</Badge>
                    )}
                  </div>
                  <Badge
                    variant={tut.ativo ? "default" : "secondary"}
                    className={`text-xs ${tut.ativo ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}`}
                  >
                    {tut.ativo ? t("tm.active") : t("tm.inactive")}
                  </Badge>
                </div>
                {tut.descricao && <p className="text-sm text-muted-foreground">{tut.descricao}</p>}
                <p className="text-xs text-muted-foreground/60 truncate">{tut.videoUrl}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(tut)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> {t("tm.edit")}
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleDelete(tut.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("tm.delete")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t("tm.edit_title") : t("tm.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("tm.titulo")}</Label>
              <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("tm.descricao")}</Label>
              <Textarea rows={2} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t("tm.videoUrl")}</Label>
              <Input value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} placeholder={t("tm.videoUrlPlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("tm.categoria")}</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>{t(`tutorials.cat.${c}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("tm.ordem")}</Label>
                <Input type="number" min="0" value={form.ordem} onChange={(e) => setForm((f) => ({ ...f, ordem: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="cursor-pointer">{t("tm.obrigatorio")}</Label>
              <Switch checked={form.obrigatorio} onCheckedChange={(v) => setForm((f) => ({ ...f, obrigatorio: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="cursor-pointer">{t("tm.ativo")}</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>
            <Button onClick={handleSave} className="w-full">{t("tm.save")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
