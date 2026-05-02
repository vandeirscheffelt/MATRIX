import { useState, useEffect, useCallback } from "react";
import { CalendarOff, Plus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/apiClient";
import { format } from "date-fns";

interface Feriado {
  id: string;
  data: string;
  nome: string;
}

const FERIADOS_NACIONAIS = [
  { data: "01-01", nome: "Confraternização Universal" },
  { data: "04-21", nome: "Tiradentes" },
  { data: "05-01", nome: "Dia do Trabalho" },
  { data: "09-07", nome: "Independência do Brasil" },
  { data: "10-12", nome: "Nossa Sra. Aparecida" },
  { data: "11-02", nome: "Finados" },
  { data: "11-15", nome: "Proclamação da República" },
  { data: "12-25", nome: "Natal" },
];

export default function FeriadosPanel() {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState("");
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<Feriado[]>("/app/bloqueios/feriados");
      setFeriados(res ?? []);
    } catch { /* silently fail */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!data || !nome.trim()) return;
    setSaving(true);
    try {
      await api.post("/app/bloqueios/feriados", { data, nome: nome.trim() });
      setOpen(false); setData(""); setNome("");
      await load();
    } finally { setSaving(false); }
  };

  const handleRemove = async (dataStr: string) => {
    await api.delete(`/app/bloqueios/feriados/${dataStr}`);
    setFeriados(prev => prev.filter(f => f.data !== dataStr));
  };

  const addNacional = async (dd_mm: string, nomeFeriado: string) => {
    const ano = new Date().getFullYear();
    const dataFull = `${ano}-${dd_mm}`;
    setSaving(true);
    try {
      await api.post("/app/bloqueios/feriados", { data: dataFull, nome: nomeFeriado });
      await load();
    } finally { setSaving(false); }
  };

  const fmt = (iso: string) => { try { return format(new Date(iso + "T12:00:00"), "dd/MM/yyyy"); } catch { return iso; } };

  const addedDates = new Set(feriados.map(f => f.data.slice(5))); // MM-DD

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-primary" />
            Feriados e Dias Bloqueados
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bloqueia a agenda de todos os profissionais no dia selecionado
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {/* Feriados nacionais como atalhos */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Feriados nacionais {new Date().getFullYear()}</p>
        <div className="flex flex-wrap gap-1.5">
          {FERIADOS_NACIONAIS.map(f => {
            const added = addedDates.has(f.data);
            return (
              <button
                key={f.data}
                disabled={saving}
                onClick={() => added ? handleRemove(`${new Date().getFullYear()}-${f.data}`) : addNacional(f.data, f.nome)}
                className={`text-[10px] font-medium px-2 py-1 rounded-full border transition-colors ${
                  added
                    ? "bg-destructive/10 border-destructive/30 text-destructive line-through"
                    : "bg-secondary border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {f.nome}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de feriados adicionados */}
      {feriados.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Dias bloqueados</p>
          <div className="space-y-1">
            {feriados.map(f => (
              <div key={f.id} className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-xs">
                <span className="text-foreground">
                  <span className="font-mono text-muted-foreground mr-2">{fmt(f.data)}</span>
                  {f.nome}
                </span>
                <button onClick={() => handleRemove(f.data)} className="text-muted-foreground hover:text-destructive transition-colors ml-2">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {feriados.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic">Nenhum feriado ou dia bloqueado cadastrado</p>
      )}

      {/* Modal para adicionar data personalizada */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Novo Dia Bloqueado</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data</label>
              <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nome / motivo</label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Carnaval, Corpus Christi..." className="h-9 text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAdd} disabled={!data || !nome.trim() || saving}>
                <Check className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
