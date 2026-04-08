'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Dna, Pencil, Trash2, Upload, X } from 'lucide-react'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Field, Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const ADMIN_KEY = process.env.NEXT_PUBLIC_CALO_ADMIN_KEY ?? ''
const EMPTY = { name: '', gender: 'male', mutation: '', breeder_id: '' }

async function uploadParentPhoto(parentId: string, file: File): Promise<string[]> {
  const body = new FormData()
  body.append('photo', file)
  const res = await fetch(`${BASE}/calo/admin/uploads/parent/${parentId}`, {
    method: 'POST',
    headers: { 'X-Calo-Admin-Key': ADMIN_KEY },
    body,
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error ?? `HTTP ${res.status}`) }
  return (await res.json()).photos as string[]
}

async function deleteParentPhoto(parentId: string, url: string): Promise<string[]> {
  const res = await fetch(`${BASE}/calo/admin/uploads/parent/${parentId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'X-Calo-Admin-Key': ADMIN_KEY },
    body: JSON.stringify({ url }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error ?? `HTTP ${res.status}`) }
  return (await res.json()).photos as string[]
}

export default function ParentsPage() {
  const { toast } = useToast()
  const [parents, setParents] = useState<any[]>([])
  const [breeders, setBreeders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    setPhotos(p.photos ?? [])
    setModal('edit')
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selected) return
    setUploading(true)
    try {
      const updated = await uploadParentPhoto(selected.id, file)
      setPhotos(updated)
      toast('Foto adicionada!')
    } catch (err: any) { toast(err.message, 'error') }
    finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDeletePhoto = async (url: string) => {
    if (!selected) return
    try {
      const updated = await deleteParentPhoto(selected.id, url)
      setPhotos(updated)
      toast('Foto removida.')
    } catch (err: any) { toast(err.message, 'error') }
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

          {modal === 'edit' && (
            <Field label="Fotos">
              <div className="space-y-3">
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((url) => (
                      <div key={url} className="relative group">
                        <Image src={url} alt="foto" width={80} height={80} className="rounded-lg object-cover w-20 h-20 border border-white/[0.08]" />
                        <button
                          onClick={() => handleDeletePhoto(url)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={11} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-white/[0.15] text-sm text-text-muted hover:border-accent/50 hover:text-text-secondary transition-colors disabled:opacity-50"
                >
                  <Upload size={14} />
                  {uploading ? 'Enviando...' : 'Adicionar foto'}
                </button>
              </div>
            </Field>
          )}
          {modal === 'create' && (
            <p className="text-xs text-text-muted bg-white/[0.03] rounded-lg px-3 py-2">
              Salve primeiro, depois abra a edição para adicionar fotos.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </Modal>
    </div>
  )
}
