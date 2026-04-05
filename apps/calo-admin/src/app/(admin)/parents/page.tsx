'use client'

import { useEffect, useState } from 'react'
import { Plus, Dna, Pencil, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Field, Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'

const EMPTY = { name: '', gender: 'male', mutation: '', breeder_id: '' }

export default function ParentsPage() {
  const { toast } = useToast()
  const [parents, setParents] = useState<any[]>([])
  const [breeders, setBreeders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    api.parents.list().then(r => setParents(r.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.breeders.list().then(r => setBreeders(r.data ?? []))
  }, [])

  const openCreate = () => {
    setForm({ ...EMPTY, breeder_id: breeders[0]?.id ?? '' })
    setSelected(null)
    setModal('create')
  }

  const openEdit = (p: any) => {
    setForm({ name: p.name, gender: p.gender, mutation: p.mutation ?? '', breeder_id: p.breeder_id })
    setSelected(p)
    setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') await api.parents.create(form)
      else await api.parents.update(selected.id, form)
      toast(modal === 'create' ? 'Pai/mãe cadastrado!' : 'Atualizado!')
      setModal(null)
      load()
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este registro?')) return
    try {
      await api.parents.delete(id)
      toast('Removido.')
      load()
    } catch (e: any) { toast(e.message, 'error') }
  }

  const f = (k: string) => (e: any) => setForm((p: any) => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <Header title="Pais / Genética" subtitle="Cadastre os pais dos filhotes"
        action={<Button onClick={openCreate}><Plus size={15} /> Novo pai/mãe</Button>} />

      <div className="p-6">
        <div className="bg-bg-secondary border border-white/[0.06] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-secondary text-sm">Carregando...</div>
          ) : parents.length === 0 ? (
            <EmptyState icon={Dna} title="Nenhum pai/mãe cadastrado"
              action={<Button onClick={openCreate}><Plus size={14} /> Novo</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Foto', 'Nome', 'Gênero', 'Mutação', 'Criador', 'Ações'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-text-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parents.map((p: any) => (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      {p.photos?.[0]
                        ? <Image src={p.photos[0]} alt={p.name} width={40} height={40} className="rounded-lg object-cover w-10 h-10" />
                        : <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center"><Dna size={16} className="text-text-muted" /></div>
                      }
                    </td>
                    <td className="px-5 py-3 text-text-primary font-medium">{p.name}</td>
                    <td className="px-5 py-3"><StatusBadge status={p.gender} /></td>
                    <td className="px-5 py-3 text-text-secondary">{p.mutation ?? '—'}</td>
                    <td className="px-5 py-3 text-text-secondary">{p.breeder?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 size={14} className="text-red-400" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modal !== null} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Novo pai/mãe' : 'Editar'} size="sm">
        <div className="space-y-4">
          <Field label="Nome *"><Input value={form.name} onChange={f('name')} placeholder="Ex: Thor" /></Field>
          <Field label="Gênero *">
            <select value={form.gender} onChange={f('gender')} className="w-full bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50">
              <option value="male">Macho</option>
              <option value="female">Fêmea</option>
            </select>
          </Field>
          <Field label="Mutação"><Input value={form.mutation} onChange={f('mutation')} placeholder="Ex: Pied" /></Field>
          <Field label="Criador">
            <select value={form.breeder_id} onChange={f('breeder_id')} className="w-full bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50">
              {breeders.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </Modal>
    </div>
  )
}
