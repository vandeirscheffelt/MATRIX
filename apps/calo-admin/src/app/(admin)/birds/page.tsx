'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Bird, Pencil, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Field } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

const EMPTY_FORM = {
  name: '', mutation: '', gender: 'unknown', price_cents: '',
  description: '', birth_date: '', breeder_id: '', father_id: '', mother_id: '',
}

export default function BirdsPage() {
  const { toast } = useToast()
  const [birds, setBirds] = useState<any[]>([])
  const [breeders, setBreeders] = useState<any[]>([])
  const [parents, setParents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    const params: any = {}
    if (statusFilter) params.status = statusFilter
    if (search) params.mutation = search
    api.birds.list(params).then(r => setBirds(r.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter])
  useEffect(() => {
    api.breeders.list().then(r => setBreeders(r.data ?? []))
    api.parents.list().then(r => setParents(r.data ?? []))
  }, [])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, breeder_id: breeders[0]?.id ?? '' })
    setSelected(null)
    setModal('create')
  }

  const openEdit = (bird: any) => {
    setForm({
      name: bird.name ?? '',
      mutation: bird.mutation,
      gender: bird.gender,
      price_cents: String(bird.price_cents),
      description: bird.description ?? '',
      birth_date: bird.birth_date ?? '',
      breeder_id: bird.breeder_id,
      father_id: bird.father_id ?? '',
      mother_id: bird.mother_id ?? '',
    })
    setSelected(bird)
    setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, price_cents: Number(form.price_cents) }
      if (modal === 'create') await api.birds.create(payload)
      else await api.birds.update(selected.id, payload)
      toast(modal === 'create' ? 'Filhote cadastrado!' : 'Filhote atualizado!')
      setModal(null)
      load()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este filhote?')) return
    try {
      await api.birds.delete(id)
      toast('Filhote removido.')
      load()
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const f = (k: string) => (e: any) => setForm((p: any) => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <Header
        title="Filhotes"
        subtitle="Gerencie o catálogo de filhotes disponíveis"
        action={<Button onClick={openCreate}><Plus size={15} /> Novo filhote</Button>}
      />

      <div className="p-6 space-y-4">
        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Buscar por mutação..." className="pl-9"
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()} />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-bg-secondary border border-white/[0.08] text-text-secondary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent/50"
          >
            <option value="">Todos os status</option>
            <option value="available">Disponível</option>
            <option value="reserved">Reservado</option>
            <option value="sold">Vendido</option>
          </select>
        </div>

        {/* Tabela */}
        <div className="bg-bg-secondary border border-white/[0.06] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-secondary text-sm">Carregando...</div>
          ) : birds.length === 0 ? (
            <EmptyState icon={Bird} title="Nenhum filhote encontrado"
              description="Cadastre o primeiro filhote para começar."
              action={<Button onClick={openCreate}><Plus size={14} /> Novo filhote</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Foto', 'Nome', 'Mutação', 'Gênero', 'Preço', 'Status', 'Ações'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-text-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {birds.map((b: any) => (
                  <tr key={b.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      {b.photos?.[0]
                        ? <Image src={b.photos[0]} alt={b.name ?? ''} width={40} height={40} className="rounded-lg object-cover w-10 h-10" />
                        : <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center"><Bird size={16} className="text-text-muted" /></div>
                      }
                    </td>
                    <td className="px-5 py-3 text-text-primary font-medium">{b.name ?? '—'}</td>
                    <td className="px-5 py-3 text-text-secondary">{b.mutation}</td>
                    <td className="px-5 py-3"><StatusBadge status={b.gender} /></td>
                    <td className="px-5 py-3 text-text-primary">{formatCurrency(b.price_cents)}</td>
                    <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)}><Trash2 size={14} className="text-red-400" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal criar/editar */}
      <Modal open={modal !== null} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Novo filhote' : 'Editar filhote'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome"><Input placeholder="Ex: Bolinha" value={form.name} onChange={f('name')} /></Field>
          <Field label="Mutação *"><Input placeholder="Ex: Lutino" value={form.mutation} onChange={f('mutation')} /></Field>
          <Field label="Preço (centavos) *"><Input type="number" placeholder="45000" value={form.price_cents} onChange={f('price_cents')} /></Field>
          <Field label="Data de nascimento"><Input type="date" value={form.birth_date} onChange={f('birth_date')} /></Field>
          <Field label="Gênero">
            <select value={form.gender} onChange={f('gender')} className="w-full bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50">
              <option value="unknown">Indefinido</option>
              <option value="male">Macho</option>
              <option value="female">Fêmea</option>
            </select>
          </Field>
          <Field label="Criador">
            <select value={form.breeder_id} onChange={f('breeder_id')} className="w-full bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50">
              {breeders.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Pai">
            <select value={form.father_id} onChange={f('father_id')} className="w-full bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50">
              <option value="">— Sem pai —</option>
              {parents.filter((p: any) => p.gender === 'male').map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Mãe">
            <select value={form.mother_id} onChange={f('mother_id')} className="w-full bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50">
              <option value="">— Sem mãe —</option>
              {parents.filter((p: any) => p.gender === 'female').map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Descrição">
              <textarea value={form.description} onChange={f('description')} rows={3}
                className="w-full bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none" />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </Modal>
    </div>
  )
}
