'use client'

import { Settings, Key, MapPin, Mail } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Field, Input } from '@/components/ui/Input'

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-bg-secondary border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/[0.06]">
        <Icon size={15} className="text-accent" />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div>
      <Header title="Configurações" subtitle="Parâmetros do sistema" />

      <div className="p-6 max-w-2xl space-y-5">
        <div className="p-4 bg-yellow-400/5 border border-yellow-400/20 rounded-xl text-sm text-yellow-300">
          ⚠️ Estas configurações são somente leitura. Para alterar, edite o <code className="font-mono">.env</code> na VPS e reinicie a API com <code className="font-mono">pm2 restart calo-api</code>.
        </div>

        <Section title="Stripe" icon={Key}>
          <Field label="STRIPE_SECRET_KEY">
            <Input value="sk_live_••••••••••••••••••••••••••••••" readOnly className="opacity-50 cursor-not-allowed" />
          </Field>
          <Field label="STRIPE_WEBHOOK_SECRET">
            <Input value="whsec_••••••••••••••••••••••••••••••••" readOnly className="opacity-50 cursor-not-allowed" />
          </Field>
          <Field label="Chave publicável">
            <Input value={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '—'} readOnly className="opacity-50 cursor-not-allowed" />
          </Field>
        </Section>

        <Section title="Supabase" icon={Key}>
          <Field label="SUPABASE_URL">
            <Input value={process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://tbapcaxbawruijrigafn.supabase.co'} readOnly className="opacity-50 cursor-not-allowed" />
          </Field>
        </Section>

        <Section title="Endereço base" icon={MapPin}>
          <Field label="SELLER_ADDRESS">
            <Input value={process.env.NEXT_PUBLIC_SELLER_ADDRESS ?? '—'} readOnly className="opacity-50 cursor-not-allowed" />
          </Field>
          <p className="text-xs text-text-muted">Usado como origem padrão no cálculo de frete.</p>
        </Section>

        <Section title="Geocodificação" icon={Mail}>
          <Field label="User-Agent Nominatim (e-mail)">
            <Input value="vandeir.professor@gmail.com" readOnly className="opacity-50 cursor-not-allowed" />
          </Field>
          <p className="text-xs text-text-muted">Identificação obrigatória para uso da API OpenStreetMap.</p>
        </Section>

        <Section title="Admin API" icon={Settings}>
          <Field label="URL da API">
            <Input value={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'} readOnly className="opacity-50 cursor-not-allowed" />
          </Field>
          <Field label="CALO_ADMIN_KEY">
            <Input value="••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••" readOnly className="opacity-50 cursor-not-allowed" />
          </Field>
        </Section>
      </div>
    </div>
  )
}
