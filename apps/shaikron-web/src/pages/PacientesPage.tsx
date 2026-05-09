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

// ─── Tipo de negócio → categoria + labels dinâmicos ───────────────────────
type NegocioCategory = "clinica" | "estetica" | "generico";

function detectCategory(tipoNegocio?: string | null): NegocioCategory {
  const t = (tipoNegocio ?? "").toLowerCase();
  if (/cl[ií]nica|sa[úu]de|m[ée]dic|odonto|fisio|nutri|psico|farmac/.test(t)) return "clinica";
  if (/sal[ãa]o|est[ée]tic|beleza|spa|nail|barber|manicure/.test(t)) return "estetica";
  return "generico";
}

// Rótulo da entidade (sidebar, título da página, botão "Novo")
function entityLabel(tipoNegocio?: string | null) {
  const t = (tipoNegocio ?? "").toLowerCase();
  if (/cl[ií]nica|sa[úu]de|m[ée]dic|odonto|fisio|nutri|psico|farmac/.test(t))
    return { singular: "Paciente", plural: "Pacientes" };
  if (/sal[ãa]o|est[ée]tic|beleza|spa|nail|barber|manicure/.test(t))
    return { singular: "Cliente", plural: "Clientes" };
  if (/imobili|im[oó]vel|alug/.test(t))
    return { singular: "Contato", plural: "Contatos" };
  return { singular: "Cliente", plural: "Clientes" };
}

// ─── Interfaces ───────────────────────────────────────────────────────────
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
  endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string } | null;
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

function toDateInput(iso?: string) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// ─── Edit form ────────────────────────────────────────────────────────────
type EditForm = {
  nome: string; whatsapp: string; telefone: string; email: string;
  dataNascimento: string; cpf: string;
  convenio: string; carteirinha: string;
  alergias: string; medicacoes: string; historicoMedico: string; observacoes: string;
  // estética
  tipoCabelo: string; tipoPele: string; procedimentosPreferidos: string;
  // endereço
  endereco_rua: string; endereco_numero: string; endereco_bairro: string;
  endereco_cidade: string; endereco_estado: string; endereco_cep: string;
};

function toEditForm(p: Paciente): EditForm {
  return {
    nome: p.nome ?? "", whatsapp: p.whatsapp ?? "", telefone: p.telefone ?? "",
    email: p.email ?? "", dataNascimento: toDateInput(p.dataNascimento), cpf: p.cpf ?? "",
    convenio: p.convenio ?? "", carteirinha: p.carteirinha ?? "",
    alergias: p.alergias ?? "", medicacoes: p.medicacoes ?? "",
    historicoMedico: p.historicoMedico ?? "", observacoes: p.observacoes ?? "",
    // campos estética ficam no observacoes por enquanto (usando JSON no campo)
    tipoCabelo: "", tipoPele: "", procedimentosPreferidos: "",
    endereco_rua: p.endereco?.rua ?? "", endereco_numero: p.endereco?.numero ?? "",
    endereco_bairro: p.endereco?.bairro ?? "", endereco_cidade: p.endereco?.cidade ?? "",
    endereco_estado: p.endereco?.estado ?? "", endereco_cep: p.endereco?.cep ?? "",
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

// ─── Componente principal ─────────────────────────────────────────────────
export default function PacientesPage() {
  const { token } = useAuth();
  const [pacientes, setPacientes] = useState<PacienteListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [tipoNegocio, setTipoNegocio] = useState<string | null>(null);
  const category = detectCategory(tipoNegocio);
  const labels = entityLabel(tipoNegocio);

  // Profile dialog
  const [selected, setSelected] = useState<Paciente | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // New patient dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", contato: "", email: "", dataNascimento: "" });
  const [creating, setCreating] = useState(false);

  const limit = 20;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Carregar tipoNegocio da config
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/app/config`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.tipoNegocio) setTipoNegocio(d.tipoNegocio); })
      .catch(() => {});
  }, [token]);

  const fetchList = useCallback(async (search: string, pg: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: String(limit) });
      if (search) params.set("q", search);
      const res = await fetch(`${API_BASE}/app/pacientes?${params}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }
      const data = await res.json();
      setPacientes(data.data);
      setTotal(data.total);
    } catch (e) {
      console.error("Erro listar pacientes:", e);
      toast.error("Erro ao carregar pacientes");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Aguarda o token estar disponível antes de buscar
  useEffect(() => {
    if (!token) return;
    fetchList(q, page);
  }, [token, page]);

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
      setEditForm(toEditForm(data));
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
      const ef = editForm;
      const body: any = {
        nome: ef.nome,
        whatsapp: ef.whatsapp || undefined,
        telefone: ef.telefone || undefined,
        email: ef.email || undefined,
        dataNascimento: ef.dataNascimento || null,
        cpf: ef.cpf || null,
        convenio: ef.convenio || null,
        carteirinha: ef.carteirinha || null,
        alergias: ef.alergias || null,
        medicacoes: ef.medicacoes || null,
        historicoMedico: ef.historicoMedico || null,
        observacoes: ef.observacoes || null,
      };
      const hasEndereco = ef.endereco_rua || ef.endereco_cidade || ef.endereco_cep;
      if (hasEndereco) {
        body.endereco = {
          rua: ef.endereco_rua || undefined,
          numero: ef.endereco_numero || undefined,
          bairro: ef.endereco_bairro || undefined,
          cidade: ef.endereco_cidade || undefined,
          estado: ef.endereco_estado || undefined,
          cep: ef.endereco_cep || undefined,
        };
      }
      const res = await fetch(`${API_BASE}/app/pacientes/${selected.id}`, {
        method: "PUT", headers, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSelected({ ...updated, agendamentos: selected.agendamentos });
      setEditForm(toEditForm({ ...updated, agendamentos: selected.agendamentos }));
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
      toast.error("Erro ao excluir");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.nome.trim()) return;
    setCreating(true);
    try {
      const digits = newForm.contato.replace(/\D/g, "");
      const body: any = { nome: newForm.nome };
      if (digits.length >= 10) body.whatsapp = digits;
      else if (newForm.contato.trim()) body.telefone = newForm.contato.trim();
      if (newForm.email.trim()) body.email = newForm.email.trim();
      if (newForm.dataNascimento) body.dataNascimento = newForm.dataNascimento;

      const res = await fetch(`${API_BASE}/app/pacientes`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Erro criar paciente:", err);
        throw new Error(JSON.stringify(err));
      }
      toast.success("Paciente cadastrado");
      setNewOpen(false);
      setNewForm({ nome: "", contato: "", email: "", dataNascimento: "" });
      fetchList(q, 1);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar paciente");
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const ef = editForm;
  const setEf = (field: keyof EditForm, val: string) =>
    setEditForm(prev => prev ? { ...prev, [field]: val } : prev);

  // ─── Labels dinâmicos ──────────────────────────────────────────────────
  const extraSectionLabel =
    category === "clinica" ? "Dados clínicos" :
    category === "estetica" ? "Perfil estético" :
    null;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{labels.plural}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total} {total === 1 ? "cadastrado" : "cadastrados"}
            </p>
          </div>
          <Button onClick={() => setNewOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo {labels.singular}
          </Button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={`Buscar ${labels.plural.toLowerCase()} por nome, WhatsApp, e-mail, CPF...`} className="pl-9"
              value={q} onChange={e => setQ(e.target.value)} />
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
                <TableHead>Aniversário</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Último agendamento</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : pacientes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum {labels.singular.toLowerCase()} encontrado</TableCell></TableRow>
              ) : pacientes.map(p => {
                const ultimo = p.agendamentos?.[0];
                const age = calcAge(p.dataNascimento);
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => openProfile(p.id)}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.whatsapp || p.telefone || p.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.dataNascimento ? (
                        <span>{formatDate(p.dataNascimento)}{age !== null && <span className="text-xs ml-1 text-muted-foreground/60">({age}a)</span>}</span>
                      ) : "—"}
                    </TableCell>
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
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditForm(toEditForm(selected)); }}>Cancelar</Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="gap-1">
                        <Check className="h-3.5 w-3.5" />{saving ? "Salvando..." : "Salvar"}
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
            <div className="py-10 text-center text-muted-foreground">Carregando...</div>
          ) : selected && ef ? (
            <div className="space-y-6 pt-2">

              {/* ─ Dados básicos ─ */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados básicos</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nome completo">
                    {editing ? <Input value={ef.nome} onChange={e => setEf("nome", e.target.value)} />
                    : <p className="text-sm">{selected.nome || "—"}</p>}
                  </Field>
                  <Field label="Data de nascimento">
                    {editing ? <Input type="date" value={ef.dataNascimento} onChange={e => setEf("dataNascimento", e.target.value)} />
                    : <p className="text-sm">{selected.dataNascimento ? `${formatDate(selected.dataNascimento)} (${calcAge(selected.dataNascimento)} anos)` : "—"}</p>}
                  </Field>
                  <Field label="CPF">
                    {editing ? <Input value={ef.cpf} onChange={e => setEf("cpf", e.target.value)} placeholder="000.000.000-00" />
                    : <p className="text-sm">{selected.cpf || "—"}</p>}
                  </Field>
                  <Field label="E-mail">
                    {editing ? <Input type="email" value={ef.email} onChange={e => setEf("email", e.target.value)} />
                    : <p className="text-sm">{selected.email || "—"}</p>}
                  </Field>
                  <Field label="WhatsApp">
                    {editing ? <Input value={ef.whatsapp} onChange={e => setEf("whatsapp", e.target.value)} placeholder="5561..." />
                    : <p className="text-sm">{selected.whatsapp || "—"}</p>}
                  </Field>
                  <Field label="Telefone">
                    {editing ? <Input value={ef.telefone} onChange={e => setEf("telefone", e.target.value)} />
                    : <p className="text-sm">{selected.telefone || "—"}</p>}
                  </Field>
                </div>
              </section>

              {/* ─ Seção extra dinâmica ─ */}
              {extraSectionLabel && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{extraSectionLabel}</h3>

                  {category === "clinica" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Convênio">
                          {editing ? <Input value={ef.convenio} onChange={e => setEf("convenio", e.target.value)} />
                          : <p className="text-sm">{selected.convenio || "—"}</p>}
                        </Field>
                        <Field label="Nº carteirinha">
                          {editing ? <Input value={ef.carteirinha} onChange={e => setEf("carteirinha", e.target.value)} />
                          : <p className="text-sm">{selected.carteirinha || "—"}</p>}
                        </Field>
                      </div>
                      <Field label="Alergias">
                        {editing ? <Textarea value={ef.alergias} onChange={e => setEf("alergias", e.target.value)} rows={2} placeholder="Ex: dipirona, látex..." />
                        : <p className="text-sm">{selected.alergias || "—"}</p>}
                      </Field>
                      <Field label="Medicações em uso">
                        {editing ? <Textarea value={ef.medicacoes} onChange={e => setEf("medicacoes", e.target.value)} rows={2} />
                        : <p className="text-sm">{selected.medicacoes || "—"}</p>}
                      </Field>
                      <Field label="Histórico médico">
                        {editing ? <Textarea value={ef.historicoMedico} onChange={e => setEf("historicoMedico", e.target.value)} rows={3} />
                        : <p className="text-sm">{selected.historicoMedico || "—"}</p>}
                      </Field>
                    </div>
                  )}

                  {category === "estetica" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Tipo de cabelo">
                          {editing ? <Input value={ef.tipoCabelo} onChange={e => setEf("tipoCabelo", e.target.value)} placeholder="Ex: liso, ondulado, cacheado..." />
                          : <p className="text-sm">{ef.tipoCabelo || "—"}</p>}
                        </Field>
                        <Field label="Tipo de pele">
                          {editing ? <Input value={ef.tipoPele} onChange={e => setEf("tipoPele", e.target.value)} placeholder="Ex: oleosa, mista, seca..." />
                          : <p className="text-sm">{ef.tipoPele || "—"}</p>}
                        </Field>
                      </div>
                      <Field label="Procedimentos preferidos">
                        {editing ? <Textarea value={ef.procedimentosPreferidos} onChange={e => setEf("procedimentosPreferidos", e.target.value)} rows={2} placeholder="Ex: escova progressiva, hidratação..." />
                        : <p className="text-sm">{ef.procedimentosPreferidos || "—"}</p>}
                      </Field>
                    </div>
                  )}
                </section>
              )}

              {/* ─ Observações (todos) ─ */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Observações</h3>
                <Field label="">
                  {editing ? <Textarea value={ef.observacoes} onChange={e => setEf("observacoes", e.target.value)} rows={3} placeholder="Preferências, restrições, anotações..." />
                  : <p className="text-sm">{selected.observacoes || "—"}</p>}
                </Field>
              </section>

              {/* ─ Endereço ─ */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Endereço</h3>
                {editing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CEP"><Input value={ef.endereco_cep} onChange={e => setEf("endereco_cep", e.target.value)} placeholder="00000-000" /></Field>
                    <Field label="UF"><Input value={ef.endereco_estado} onChange={e => setEf("endereco_estado", e.target.value)} maxLength={2} /></Field>
                    <Field label="Cidade"><Input value={ef.endereco_cidade} onChange={e => setEf("endereco_cidade", e.target.value)} /></Field>
                    <Field label="Bairro"><Input value={ef.endereco_bairro} onChange={e => setEf("endereco_bairro", e.target.value)} /></Field>
                    <Field label="Rua"><Input value={ef.endereco_rua} onChange={e => setEf("endereco_rua", e.target.value)} /></Field>
                    <Field label="Número"><Input value={ef.endereco_numero} onChange={e => setEf("endereco_numero", e.target.value)} /></Field>
                  </div>
                ) : (
                  <p className="text-sm">
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
                          <div className="font-medium">{ag.servicoNome}</div>
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

              {!editing && (
                <div className="flex justify-end pt-2 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
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
            <DialogTitle>Novo {labels.singular}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            {labels.plural} que chegam pelo WhatsApp são cadastrados automaticamente pela IA.
          </p>
          <form onSubmit={handleCreate} className="space-y-4 pt-1">
            <Field label="Nome *">
              <Input value={newForm.nome} onChange={e => setNewForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo" required autoFocus />
            </Field>
            <Field label="Contato (WhatsApp ou telefone)">
              <Input value={newForm.contato} onChange={e => setNewForm(f => ({ ...f, contato: e.target.value }))}
                placeholder="61 9 9999-9999" />
            </Field>
            <Field label="Data de nascimento">
              <Input type="date" value={newForm.dataNascimento}
                onChange={e => setNewForm(f => ({ ...f, dataNascimento: e.target.value }))} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com" />
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
