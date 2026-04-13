'use client'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import { type MetricaDiaria } from '@/lib/api'
import { fmtDate } from '@/lib/utils'

export function MetricasChart({ data }: { data: MetricaDiaria[] }) {
  const chartData = data.map((m) => ({
    data: fmtDate(m.data_referencia),
    'CPL (R$)': m.cpl_crm ?? 0,
    'Leads CRM': m.leads_crm,
    'Conversas': m.conversas_iniciadas,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 11 }} />
        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: '#1e2333', border: '1px solid #ffffff10', borderRadius: 6 }}
          labelStyle={{ color: '#e2e8f0' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        <Line type="monotone" dataKey="CPL (R$)" stroke="#38bdf8" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Leads CRM" stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Conversas" stroke="#f59e0b" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
