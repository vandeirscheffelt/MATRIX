import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Search, Plus, X, Phone, Mail, Calendar, Clock, User } from "lucide-react";
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

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ nome: "", whatsapp: "", telefone: "", email: "" });
  const [saving, setSaving] = useState(false);

  const limit = 20;

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetch_list = useCallback(async (search: string, pg: number) => {
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

  useEffect(() => {
    fetch_list(q, page);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetch_list(q, 1);
  };

  const openProfile = async (id: string) => {
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_BASE}/app/pacientes/${id}`, { headers });
      if (!res.ok) throw new Error();
      setSelected(await res.json());
    } catch {
      toast.error("Erro ao carregar perfil");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.nome.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/app/pacientes`, {
        method: "POST",
        headers,
        body: JSON.stringify(newForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Paciente cadastrado");
      setNewOpen(false);
      setNewForm({ nome: "", whatsapp: "", telefone: "", email: "" });
      fetch_list(q, 1);
    } catch {
      toast.error("Erro ao cadastrar paciente");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFromProfile = async () => {
    if (!selected) return;
    if (!confirm(`Excluir ${selected.nome}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/app/pacientes/${selected.id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error();
      toast.success("Paciente excluído");
      setProfileOpen(false);
      fetch_list(q, page);
    } catch {
      toast.error("Erro ao excluir paciente");
    }
  };

  const totalPages = Math.ceil(total / limit);

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
            <Button type="button" variant="ghost" onClick={() => { setQ(""); setPage(1); fetch_list("", 1); }}>
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
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : pacientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhum paciente encontrado
                  </TableCell>
                </TableRow>
              ) : pacientes.map(p => {
                const ultimo = p.agendamentos?.[0];
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => openProfile(p.id)}
                  >
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.whatsapp || p.telefone || p.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{p.convenio || "—"}</TableCell>
                    <TableCell>
                      {p.origem === "whatsapp" ? (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                          WhatsApp
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {ultimo ? (
                        <div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(ultimo.inicio)}</div>
                          <Badge className={`text-xs mt-0.5 ${STATUS_COLORS[ultimo.status] ?? ""}`}>
                            {ultimo.servicoNome}
                          </Badge>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selected?.nome ?? "Carregando..."}
            </DialogTitle>
          </DialogHeader>

          {profileLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando perfil...</div>
          ) : selected ? (
            <div className="space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selected.whatsapp && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" /> {selected.whatsapp}
                  </div>
                )}
                {selected.telefone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" /> {selected.telefone}
                  </div>
                )}
                {selected.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" /> {selected.email}
                  </div>
                )}
                {selected.dataNascimento && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(selected.dataNascimento)}
                    {calcAge(selected.dataNascimento) !== null && (
                      <span className="text-xs">({calcAge(selected.dataNascimento)} anos)</span>
                    )}
                  </div>
                )}
                {selected.cpf && (
                  <div className="text-muted-foreground">CPF: {selected.cpf}</div>
                )}
                {selected.convenio && (
                  <div className="text-muted-foreground">
                    Convênio: {selected.convenio}
                    {selected.carteirinha && ` — ${selected.carteirinha}`}
                  </div>
                )}
              </div>

              {/* Clinical info */}
              {(selected.alergias || selected.medicacoes || selected.historicoMedico) && (
                <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
                  {selected.alergias && (
                    <div><span className="font-medium text-foreground">Alergias:</span> <span className="text-muted-foreground">{selected.alergias}</span></div>
                  )}
                  {selected.medicacoes && (
                    <div><span className="font-medium text-foreground">Medicações:</span> <span className="text-muted-foreground">{selected.medicacoes}</span></div>
                  )}
                  {selected.historicoMedico && (
                    <div><span className="font-medium text-foreground">Histórico:</span> <span className="text-muted-foreground">{selected.historicoMedico}</span></div>
                  )}
                </div>
              )}

              {selected.observacoes && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Obs:</span> {selected.observacoes}
                </div>
              )}

              {/* Agendamentos */}
              {selected.agendamentos && selected.agendamentos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Histórico de agendamentos
                  </h3>
                  <div className="space-y-2">
                    {selected.agendamentos.map(ag => (
                      <div key={ag.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium text-foreground">{ag.servicoNome}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(ag.inicio)}
                            {ag.profissional && ` · ${ag.profissional.nome}`}
                          </div>
                        </div>
                        <Badge className={`text-xs ${STATUS_COLORS[ag.status] ?? ""}`}>
                          {ag.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="destructive" size="sm" onClick={handleDeleteFromProfile}>
                  Excluir paciente
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* New patient dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo paciente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome *</label>
              <Input
                value={newForm.nome}
                onChange={e => setNewForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">WhatsApp</label>
              <Input
                value={newForm.whatsapp}
                onChange={e => setNewForm(f => ({ ...f, whatsapp: e.target.value }))}
                placeholder="55119..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input
                value={newForm.telefone}
                onChange={e => setNewForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(11) 9 ..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail</label>
              <Input
                type="email"
                value={newForm.email}
                onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
