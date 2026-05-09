import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Plus, X, Clock, User, Pencil, Trash2, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3004";

interface Agendamento {
  id: string;
  inicio: string;
  fim: string;
  status: string;
  servicoNome: string;
  profissional?: { nome: string };
}

interface Paciente {
  id: string;
  nome: string;
  whatsapp?: string;
  telefone?: string;
  email?: string;
  dataNascimento?: string;
  cpf?: string;
  endereco?: {
    rua?: string; numero?: string; bairro?: string;
    cidade?: string; estado?: string; cep?: string;
  } | null;
  convenio?: string;
  carteirinha?: string;
  alergias?: string;
  medicacoes?: string;
  historicoMedico?: string;
  observacoes?: string;
  origem?: string;
  criadoEm: string;
  agendamentos?: Agendamento[];
}

interface PacienteListItem {
  id: string;
  nome: string;
  whatsapp?: string;
  telefone?: string;
  email?: string;
  dataNascimento?: string;
  convenio?: string;
  origem?: string;
  criadoEm: string;
  agendamentos: { inicio: string; status: string; servicoNome: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  AGENDADO: "bg-blue-500/20 text-blue-400",
  CONFIRMADO: "bg-green-500/20 text-green-400",
  CANCELADO: "bg-red-500/20 text-red-400",
  REALIZADO: "bg-purple-500/20 text-purple-400",
  FALTOU: "bg-orange-500/20 text-orange-400",
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function calcAge(dataNascimento?: string) {
  if (!dataNascimento) return null;
  const diff = Date.now() - new Date(dataNascimento).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

// Converte "2000-05-15T..." → "2000-05-15" para o input date
function toDateInput(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

type EditForm = {
  nome: string;
  whatsapp: string;
  telefone: string;
  email: string;
  dataNascimento: string;
  cpf: string;
  convenio: string;
  carteirinha: string;
  alergias: string;
  medicacoes: string;
  historicoMedico: string;
  observacoes: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
};

function pacienteToEditForm(p: Paciente): EditForm {
  return {
    nome: p.nome ?? "",
    whatsapp: p.whatsapp ?? "",
    telefone: p.telefone ?? "",
    email: p.email ?? "",
    dataNascimento: toDateInput(p.dataNascimento),
    cpf: p.cpf ?? "",
    convenio: p.convenio ?? "",
    carteirinha: p.carteirinha ?? "",
    alergias: p.alergias ?? "",
    medicacoes: p.medicacoes ?? "",
    historicoMedico: p.historicoMedico ?? "",
    observacoes: p.observacoes ?? "",
    endereco_rua: p.endereco?.rua ?? "",
    endereco_numero: p.endereco?.numero ?? "",
    endereco_bairro: p.endereco?.bairro ?? "",
    endereco_cidade: p.endereco?.cidade ?? "",
    endereco_estado: p.endereco?.estado ?? "",
    endereco_cep: p.endereco?.cep ?? "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

export default function PacientesPage() {
  const { token } = useAuth();
  const [pacientes, setPacientes] = useState<PacienteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState<Paciente | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", contato: "", email: "" });
  const [creating, setCreating] = useState(false);

  const limit = 20;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchList = useCallback(async (search: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(limit) });
      if (search) params.set("q", search);
      const res = await fetch(`${API_BASE}/app/pacientes?${params}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPacientes(data.data);
      setTotal(data.total);
    } catch {
      toast.error("Erro ao carregar pacientes");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchList(q, page); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchList(q, 1);
  };

  const openProfile = async (id: string) => {
    setProfileOpen(true);
    setEditing(false);
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_BASE}/app/pacientes/${id}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelected(data);
      setEditForm(pacienteToEditForm(data));
    } catch {
      toast.error("Erro ao carregar perfil");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected || !editForm) return;
    setSaving(true);
    try {
      const body: any = {
        nome: editForm.nome,
        whatsapp: editForm.whatsapp || undefined,
        telefone: editForm.telefone || undefined,
        email: editForm.email || undefined,
        dataNascimento: editForm.dataNascimento || null,
        cpf: editForm.cpf || null,
        convenio: editForm.convenio || null,
        carteirinha: editForm.carteirinha || null,
        alergias: editForm.alergias || null,
        medicacoes: editForm.medicacoes || null,
        historicoMedico: editForm.historicoMedico || null,
        observacoes: editForm.observacoes || null,
      };
      const hasEndereco = editForm.endereco_rua || editForm.endereco_cidade || editForm.endereco_cep;
      if (hasEndereco) {
        body.endereco = {
          rua: editForm.endereco_rua || undefined,
          numero: editForm.endereco_numero || undefined,
          bairro: editForm.endereco_bairro || undefined,
          cidade: editForm.endereco_cidade || undefined,
          estado: editForm.endereco_estado || undefined,
          cep: editForm.endereco_cep || undefined,
        };
      }
      const res = await fetch(`${API_BASE}/app/pacientes/${selected.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSelected({ ...updated, agendamentos: selected.agendamentos });
      setEditForm(pacienteToEditForm({ ...updated, agendamentos: selected.agendamentos }));
      setEditing(false);
      toast.success("Dados atualizados");
      fetchList(q, page);
    } catch {
      toast.error("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Excluir ${selected.nome}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/app/pacientes/${selected.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error();
      toast.success("Paciente excluído");
      setProfileOpen(false);
      fetchList(q, page);
    } catch {
      toast.error("Erro ao excluir paciente");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.nome.trim()) return;
    setCreating(true);
    try {
      // Detecta se contato parece WhatsApp (só números) ou telefone com formatação
      const contato = newForm.contato.replace(/\D/g, "");
      const body: any = { nome: newForm.nome };
      if (contato) {
        // Se tem 10+ dígitos, vai como whatsapp; senão como telefone
        if (contato.length >= 10) body.whatsapp = contato;
        else body.telefone = newForm.contato;
      }
      if (newForm.email) body.email = newForm.email;

      const res = await fetch(`${API_BASE}/app/pacientes`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Paciente cadastrado");
      setNewOpen(false);
      setNewForm({ nome: "", contato: "", email: "" });
      fetchList(q, 1);
    } catch {
      toast.error("Erro ao cadastrar paciente");
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const ef = editForm;
  const setEf = (field: keyof EditForm, val: string) =>
    setEditForm(prev => prev ? { ...prev, [field]: val } : prev);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} {total === 1 ? "paciente" : "pacientes"} cadastrados
            </p>
          </div>
          <Button onClick={() => setNewOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo paciente
          </Button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, WhatsApp, email, CPF..."
              className="pl-9"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">Buscar</Button>
          {q && (
            <Button type="button" variant="ghost" onClick={() => { setQ(""); setPage(1); fetchList("", 1); }}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </form>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-card">
                <TableHead>Nome</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Convênio</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Último agendamento</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : pacientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum paciente encontrado</TableCell>
                </TableRow>
              ) : pacientes.map(p => {
                const ultimo = p.agendamentos?.[0];
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openProfile(p.id)}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.whatsapp || p.telefone || p.email || "—"}</TableCell>
                    <TableCell className="text-sm">{p.convenio || "—"}</TableCell>
                    <TableCell>
                      {p.origem === "whatsapp"
                        ? <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">WhatsApp</Badge>
                        : <Badge variant="outline" className="text-xs">Manual</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ultimo ? (
                        <div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(ultimo.inicio)}</div>
                          <Badge className={`text-xs mt-0.5 ${STATUS_COLORS[ultimo.status] ?? ""}`}>{ultimo.servicoNome}</Badge>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(p.criadoEm)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Profile Dialog ── */}
      <Dialog open={profileOpen} onOpenChange={open => { setProfileOpen(open); if (!open) setEditing(false); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selected?.nome ?? "Carregando..."}
                {selected?.origem === "whatsapp" && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20 ml-1">WhatsApp</Badge>
                )}
              </DialogTitle>
              {!profileLoading && selected && (
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditForm(pacienteToEditForm(selected)); }}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="gap-1">
                        <Check className="h-3.5 w-3.5" />
                        {saving ? "Salvando..." : "Salvar"}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          {profileLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando perfil...</div>
          ) : selected && ef ? (
            <div className="space-y-6 pt-2">

              {/* ─ Dados básicos ─ */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados básicos</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome completo">
                    {editing
                      ? <Input value={ef.nome} onChange={e => setEf("nome", e.target.value)} />
                      : <p className="text-sm text-foreground">{selected.nome || "—"}</p>}
                  </Field>
                  <Field label="Data de nascimento">
                    {editing
                      ? <Input type="date" value={ef.dataNascimento} onChange={e => setEf("dataNascimento", e.target.value)} />
                      : <p className="text-sm text-foreground">
                          {selected.dataNascimento ? `${formatDate(selected.dataNascimento)} (${calcAge(selected.dataNascimento)} anos)` : "—"}
                        </p>}
                  </Field>
                  <Field label="CPF">
                    {editing
                      ? <Input value={ef.cpf} onChange={e => setEf("cpf", e.target.value)} placeholder="000.000.000-00" />
                      : <p className="text-sm text-foreground">{selected.cpf || "—"}</p>}
                  </Field>
                  <Field label="E-mail">
                    {editing
                      ? <Input type="email" value={ef.email} onChange={e => setEf("email", e.target.value)} />
                      : <p className="text-sm text-foreground">{selected.email || "—"}</p>}
                  </Field>
                  <Field label="WhatsApp">
                    {editing
                      ? <Input value={ef.whatsapp} onChange={e => setEf("whatsapp", e.target.value)} placeholder="5561..." />
                      : <p className="text-sm text-foreground">{selected.whatsapp || "—"}</p>}
                  </Field>
                  <Field label="Telefone">
                    {editing
                      ? <Input value={ef.telefone} onChange={e => setEf("telefone", e.target.value)} />
                      : <p className="text-sm text-foreground">{selected.telefone || "—"}</p>}
                  </Field>
                </div>
              </section>

              {/* ─ Convênio ─ */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Convênio</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Convênio">
                    {editing
                      ? <Input value={ef.convenio} onChange={e => setEf("convenio", e.target.value)} />
                      : <p className="text-sm text-foreground">{selected.convenio || "—"}</p>}
                  </Field>
                  <Field label="Carteirinha">
                    {editing
                      ? <Input value={ef.carteirinha} onChange={e => setEf("carteirinha", e.target.value)} />
                      : <p className="text-sm text-foreground">{selected.carteirinha || "—"}</p>}
                  </Field>
                </div>
              </section>

              {/* ─ Dados clínicos ─ */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados clínicos</h3>
                <div className="space-y-3">
                  <Field label="Alergias">
                    {editing
                      ? <Textarea value={ef.alergias} onChange={e => setEf("alergias", e.target.value)} rows={2} placeholder="Ex: dipirona, látex..." />
                      : <p className="text-sm text-foreground">{selected.alergias || "—"}</p>}
                  </Field>
                  <Field label="Medicações em uso">
                    {editing
                      ? <Textarea value={ef.medicacoes} onChange={e => setEf("medicacoes", e.target.value)} rows={2} />
                      : <p className="text-sm text-foreground">{selected.medicacoes || "—"}</p>}
                  </Field>
                  <Field label="Histórico médico">
                    {editing
                      ? <Textarea value={ef.historicoMedico} onChange={e => setEf("historicoMedico", e.target.value)} rows={3} />
                      : <p className="text-sm text-foreground">{selected.historicoMedico || "—"}</p>}
                  </Field>
                  <Field label="Observações">
                    {editing
                      ? <Textarea value={ef.observacoes} onChange={e => setEf("observacoes", e.target.value)} rows={2} />
                      : <p className="text-sm text-foreground">{selected.observacoes || "—"}</p>}
                  </Field>
                </div>
              </section>

              {/* ─ Endereço ─ */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Endereço</h3>
                {editing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CEP">
                      <Input value={ef.endereco_cep} onChange={e => setEf("endereco_cep", e.target.value)} placeholder="00000-000" />
                    </Field>
                    <Field label="Estado">
                      <Input value={ef.endereco_estado} onChange={e => setEf("endereco_estado", e.target.value)} placeholder="UF" maxLength={2} />
                    </Field>
                    <Field label="Cidade">
                      <Input value={ef.endereco_cidade} onChange={e => setEf("endereco_cidade", e.target.value)} />
                    </Field>
                    <Field label="Bairro">
                      <Input value={ef.endereco_bairro} onChange={e => setEf("endereco_bairro", e.target.value)} />
                    </Field>
                    <Field label="Rua">
                      <Input value={ef.endereco_rua} onChange={e => setEf("endereco_rua", e.target.value)} />
                    </Field>
                    <Field label="Número">
                      <Input value={ef.endereco_numero} onChange={e => setEf("endereco_numero", e.target.value)} />
                    </Field>
                  </div>
                ) : (
                  <p className="text-sm text-foreground">
                    {selected.endereco?.rua
                      ? `${selected.endereco.rua}${selected.endereco.numero ? ", " + selected.endereco.numero : ""} — ${selected.endereco.bairro ?? ""}, ${selected.endereco.cidade ?? ""} / ${selected.endereco.estado ?? ""} — CEP ${selected.endereco.cep ?? ""}`
                      : "—"}
                  </p>
                )}
              </section>

              {/* ─ Histórico de agendamentos ─ */}
              {selected.agendamentos && selected.agendamentos.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> Histórico de agendamentos
                  </h3>
                  <div className="space-y-2">
                    {selected.agendamentos.map(ag => (
                      <div key={ag.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium text-foreground">{ag.servicoNome}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(ag.inicio)}{ag.profissional ? ` · ${ag.profissional.nome}` : ""}
                          </div>
                        </div>
                        <Badge className={`text-xs ${STATUS_COLORS[ag.status] ?? ""}`}>{ag.status}</Badge>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ─ Danger zone ─ */}
              {!editing && (
                <div className="flex justify-end pt-2 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir paciente
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── New patient dialog ── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo paciente</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Pacientes criados via WhatsApp pela IA são cadastrados automaticamente.
          </p>
          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <Field label="Nome *">
              <Input value={newForm.nome} onChange={e => setNewForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" required />
            </Field>
            <Field label="Contato (WhatsApp ou telefone)">
              <Input value={newForm.contato} onChange={e => setNewForm(f => ({ ...f, contato: e.target.value }))} placeholder="61 9 9999-9999" />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={creating}>{creating ? "Salvando..." : "Cadastrar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
