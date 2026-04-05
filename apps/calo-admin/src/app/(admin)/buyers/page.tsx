'use client'

import { useEffect, useState } from 'react'
import { Plus, Store, Pencil, Trash2, Search } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Field } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'

const EMPTY = { company_name: '', cnpj: '', contact_name: '', email: '', phone: '', address: '' }

export default function BuyersPage() {
  const { toast } = useToast()
  const [buyers, setBuyers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = (s?: string) => {
    setLoading(true)
    const params: any = {}
    if (s) params.search = s
    api.buyers.list(params).then(r => setBuyers(r.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(EMPTY); setSelected(null); setModal('create') }
  const openEdit = (b: any) => {
    setForm({ company_name: b.company_name, cnpj: b.cnpj ?? '', contact_name: b.contact_name, email: b.email, phone: b.phone ?? '', address: b.address })
    setSelected(b); setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') await api.buyers.create(form)
      else await api.buyers.update(selected.id, form)
      toast(modal === 'create' ? 'Cliente cadastrado!' : 'Cliente atualizado!')
      setModal(null); load()
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este cliente?')) return
    try { await api.buyers.delete(id); toast('Removido.'); load() }
    catch (e: any) { toast(e.message, 'error') }
  }

  const f = (k: string) => (e: any) => setForm((p: any) => ({ ...p, [k]: e.target.value }))

  return (
    <div>
      <Header title="Clientes B2B" subtitle="Pet shops, agropecuárias e lojas parceiras"
        action={<Button onClick={openCreate}><Plus size={15} /> Novo cliente</Button>} />

      <div className="p-6 space-y-4">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input placeholder="Buscar cliente..." className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search)} />
        </div>

        <div className="bg-bg-secondary border border-white/[0.06] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-secondary text-sm">Carregando...</div>
          ) : buyers.length === 0 ? (
            <EmptyState icon={Store} title="Nenhum cliente cadastrado"
              action={<Button onClick={openCreate}><Plus size={14} /> Novo cliente</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Empresa', 'Contato', 'E-mail', 'Telefone', 'Endereço', 'Ações'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-text-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buyers.map((b: any) => (
                  <tr key={b.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-text-primary font-medium">{b.company_name}</td>
                    <td className="px-5 py-3 text-text-secondary">{b.contact_name}</td>
                    <td className="px-5 py-3 text-text-secondary">{b.email}</td>
                    <td className="px-5 py-3 text-text-secondary">{b.phone ?? '—'}</td>
                    <td className="px-5 py-3 text-text-secondary max-w-xs truncate">{b.address}</td>
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

      <Modal open={modal !== null} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Novo cliente' : 'Editar cliente'} size="md">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Empresa *"><Input value={form.company_name} onChange={f('company_name')} placeholder="Pet Shop Exemplo Ltda" /></Field></div>
          <Field label="CNPJ"><Input value={form.cnpj} onChange={f('cnpj')} placeholder="00.000.000/0001-00" /></Field>
          <Field label="Contato *"><Input value={form.contact_name} onChange={f('contact_name')} placeholder="João Silva" /></Field>
          <Field label="E-mail *"><Input type="email" value={form.email} onChange={f('email')} /></Field>
          <Field label="Telefone"><Input value={form.phone} onChange={f('phone')} placeholder="(11) 99999-0000" /></Field>
          <div className="col-span-2"><Field label="Endereço *"><Input value={form.address} onChange={f('address')} placeholder="Rua Exemplo, 100, São Paulo, SP" /></Field></div>
        </div>
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-white/[0.06]">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </Modal>
    </div>
  )
}
