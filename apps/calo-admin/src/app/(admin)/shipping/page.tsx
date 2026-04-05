'use client'

import { useState } from 'react'
import { Truck, Info } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Field } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

export default function ShippingPage() {
  const { toast } = useToast()
  const [form, setForm] = useState({
    pricePerKm: process.env.NEXT_PUBLIC_PRICE_PER_KM ?? '0.5',
    minimumPrice: process.env.NEXT_PUBLIC_MINIMUM_PRICE ?? '10',
    sellerAddress: process.env.NEXT_PUBLIC_SELLER_ADDRESS ?? '',
    freeShippingAbove: '0',
  })
  const [saving, setSaving] = useState(false)

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 600))
    setSaving(false)
    toast('Configurações de frete salvas! Atualize o .env da VPS para aplicar em produção.')
  }

  const example = Number(form.pricePerKm) * 100 * 1.3
  const final = Math.max(example, Number(form.minimumPrice))

  return (
    <div>
      <Header title="Frete" subtitle="Regras de cálculo automático por distância" />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Info */}
        <div className="flex gap-3 p-4 bg-accent/5 border border-accent/20 rounded-xl text-sm text-accent">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Como funciona</p>
            <p className="text-accent/70">O frete é calculado pela distância real entre o endereço do criador e o cliente via Nominatim (OpenStreetMap) + fórmula Haversine com fator de rota 1.3×.</p>
            <p className="mt-1 text-accent/70">Fórmula: <code className="font-mono bg-accent/10 px-1 rounded">max(mínimo, km × preço/km × 1.3)</code></p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-bg-secondary border border-white/[0.06] rounded-xl p-6 space-y-5">
          <Field label="Endereço base do criador (origem do frete)">
            <Input value={form.sellerAddress} onChange={f('sellerAddress')}
              placeholder="Rua Exemplo, 100, Campinas, SP, Brasil" />
            <p className="text-xs text-text-muted mt-1">Usado quando o filhote não tem criador associado.</p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Preço por km (R$)">
              <Input type="number" step="0.01" value={form.pricePerKm} onChange={f('pricePerKm')} />
            </Field>
            <Field label="Frete mínimo (R$)">
              <Input type="number" step="0.01" value={form.minimumPrice} onChange={f('minimumPrice')} />
            </Field>
          </div>

          <Field label="Frete grátis acima de (R$) — 0 para desativar">
            <Input type="number" step="1" value={form.freeShippingAbove} onChange={f('freeShippingAbove')} />
          </Field>

          {/* Preview */}
          <div className="bg-bg-primary rounded-lg p-4 text-sm space-y-1">
            <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-2">Simulação — 100 km</p>
            <div className="flex justify-between">
              <span className="text-text-secondary">Distância calculada</span>
              <span className="text-text-primary">100 km × 1.3 = 130 km efetivos</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Custo bruto</span>
              <span className="text-text-primary">R$ {(Number(form.pricePerKm) * 130).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-text-secondary">Frete cobrado</span>
              <span className="text-accent">R$ {final.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Truck size={15} />
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </Button>
        </div>

        <div className="bg-bg-secondary border border-white/[0.06] rounded-xl p-5">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-3">Para aplicar em produção</p>
          <p className="text-sm text-text-secondary mb-2">Atualize as variáveis no <code className="text-accent font-mono">.env</code> da VPS:</p>
          <pre className="bg-bg-primary rounded-lg p-3 text-xs text-text-secondary font-mono overflow-x-auto">
{`PRICE_PER_KM=${form.pricePerKm}
MINIMUM_PRICE=${form.minimumPrice}
SELLER_ADDRESS="${form.sellerAddress}"`}
          </pre>
        </div>
      </div>
    </div>
  )
}
