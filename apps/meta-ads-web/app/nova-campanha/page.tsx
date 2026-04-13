'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'

type Passo = 1 | 2 | 3

interface AdForm {
  drive_file_id: string
  video_codigo: string
  copy_variante: 'T1' | 'T2' | 'T3'
  copy_texto: string
}

interface PublicoConfig {
  pais: string
  idade_min: number
  idade_max: number
  genero: string // ALL | MALE | FEMALE
  interesses: string // texto livre por ora
}

interface AdsetForm {
  nome: string
  abordagem: string
  orcamento_diario: string
  publico: PublicoConfig
  ads: AdForm[]
}

interface CampanhaForm {
  campanha_codigo: string
  nome: string
  objetivo: 'MESSAGES' | 'CONVERSIONS'
  produto_codigo: string
  fase: 'F2' | 'F3' | 'F4'
  atelie_campanha_ref: string
  orcamento_total: string
  janela_avaliacao_h: string
  gasto_minimo_corte: string
}

const publicoDefault = (): PublicoConfig => ({
  pais: 'BR',
  idade_min: 25,
  idade_max: 55,
  genero: 'ALL',
  interesses: '',
})

const adDefault = (): AdForm => ({
  drive_file_id: '',
  video_codigo: '',
  copy_variante: 'T1',
  copy_texto: '',
})

const adsetDefault = (): AdsetForm => ({
  nome: '',
  abordagem: '',
  orcamento_diario: '2',
  publico: publicoDefault(),
  ads: [adDefault(), adDefault(), adDefault()],
})

function gerarNomeAd(adset: string, video_codigo: string, copy_variante: string): string {
  return `${adset}_${video_codigo || 'V00'}_${copy_variante}`
}

function montarPublicoConfig(p: PublicoConfig): Record<string, unknown> {
  const targeting: Record<string, unknown> = {
    geo_locations: { countries: [p.pais] },
    age_min: p.idade_min,
    age_max: p.idade_max,
  }
  if (p.genero === 'MALE') targeting.genders = [1]
  if (p.genero === 'FEMALE') targeting.genders = [2]
  if (p.interesses.trim()) {
    targeting.interests_note = p.interesses // salvo como referência; targeting real via API requer IDs
  }
  return targeting
}

export default function NovaCampanha() {
  const router = useRouter()
  const [passo, setPasso] = useState<Passo>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [campanha, setCampanha] = useState<CampanhaForm>({
    campanha_codigo: '',
    nome: '',
    objetivo: 'MESSAGES',
    produto_codigo: '',
    fase: 'F2',
    atelie_campanha_ref: '',
    orcamento_total: '',
    janela_avaliacao_h: '72',
    gasto_minimo_corte: '10',
  })

  const [adsets, setAdsets] = useState<AdsetForm[]>([adsetDefault()])

  function setAdset(i: number, patch: Partial<AdsetForm>) {
    setAdsets((prev) => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }

  function setPublico(i: number, patch: Partial<PublicoConfig>) {
    setAdsets((prev) => prev.map((a, idx) =>
      idx === i ? { ...a, publico: { ...a.publico, ...patch } } : a
    ))
  }

  function setAd(adsetIdx: number, adIdx: number, patch: Partial<AdForm>) {
    setAdsets((prev) => prev.map((a, i) =>
      i === adsetIdx
        ? { ...a, ads: a.ads.map((ad, j) => j === adIdx ? { ...ad, ...patch } : ad) }
        : a
    ))
  }

  async function lancar() {
    setLoading(true)
    setError('')
    try {
      const payload = {
        ...campanha,
        orcamento_total: campanha.orcamento_total ? parseFloat(campanha.orcamento_total) : undefined,
        janela_avaliacao_h: parseInt(campanha.janela_avaliacao_h),
        gasto_minimo_corte: parseFloat(campanha.gasto_minimo_corte),
        adsets: adsets.map((a) => ({
          nome: a.nome,
          abordagem: a.abordagem,
          orcamento_diario: parseFloat(a.orcamento_diario),
          publico_config: montarPublicoConfig(a.publico),
          ads: a.ads.map((ad) => ({
            nome: gerarNomeAd(a.nome, ad.video_codigo, ad.copy_variante),
            drive_file_id: ad.drive_file_id,
            video_codigo: ad.video_codigo,
            copy_variante: ad.copy_variante,
            copy_texto: ad.copy_texto,
          })),
        })),
      }
      const res = await api.campanhas.create(payload)
      router.push(`/campanhas/${res.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao lançar campanha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Nova Campanha</h1>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Passo[]).map((p) => (
          <div key={p} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${passo >= p ? 'bg-accent text-bg' : 'bg-card text-muted'}`}>
              {p}
            </div>
            <span className={`text-xs ${passo === p ? 'text-slate-200' : 'text-muted'}`}>
              {p === 1 ? 'Campanha' : p === 2 ? 'AdSets' : 'Anúncios'}
            </span>
            {p < 3 && <div className={`h-px w-8 ${passo > p ? 'bg-accent' : 'bg-white/10'}`} />}
          </div>
        ))}
      </div>

      {/* Passo 1 — Campanha */}
      {passo === 1 && (
        <Card className="space-y-4">
          <p className="text-sm font-medium text-slate-200">Dados da Campanha</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código (CPxx)">
              <Input
                value={campanha.campanha_codigo}
                onChange={(e) => setCampanha({ ...campanha, campanha_codigo: e.target.value })}
                placeholder="CP01"
              />
            </Field>
            <Field label="Nome">
              <Input
                value={campanha.nome}
                onChange={(e) => setCampanha({ ...campanha, nome: e.target.value })}
                placeholder="Progressiva Vegetal — F2"
              />
            </Field>
            <Field label="Objetivo">
              <Select
                value={campanha.objetivo}
                onChange={(e) => setCampanha({ ...campanha, objetivo: e.target.value as 'MESSAGES' | 'CONVERSIONS' })}
              >
                <option value="MESSAGES">Mensagens (WhatsApp)</option>
                <option value="CONVERSIONS">Conversões (site)</option>
              </Select>
            </Field>
            <Field label="Fase">
              <Select
                value={campanha.fase}
                onChange={(e) => setCampanha({ ...campanha, fase: e.target.value as 'F2' | 'F3' | 'F4' })}
              >
                <option value="F2">F2 — Exploração</option>
                <option value="F3">F3 — Seleção</option>
                <option value="F4">F4 — Escala</option>
              </Select>
            </Field>
            <Field label="Produto">
              <Input
                value={campanha.produto_codigo}
                onChange={(e) => setCampanha({ ...campanha, produto_codigo: e.target.value })}
                placeholder="a"
              />
            </Field>
            <Field label="Ref. Ateliê">
              <Input
                value={campanha.atelie_campanha_ref}
                onChange={(e) => setCampanha({ ...campanha, atelie_campanha_ref: e.target.value })}
                placeholder="CP01"
              />
            </Field>
            <Field label="Janela avaliação (h)">
              <Input
                value={campanha.janela_avaliacao_h}
                onChange={(e) => setCampanha({ ...campanha, janela_avaliacao_h: e.target.value })}
                type="number"
              />
            </Field>
            <Field label="Gasto mínimo p/ corte (R$)">
              <Input
                value={campanha.gasto_minimo_corte}
                onChange={(e) => setCampanha({ ...campanha, gasto_minimo_corte: e.target.value })}
                type="number"
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setPasso(2)} disabled={!campanha.campanha_codigo || !campanha.nome}>
              Próximo <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Passo 2 — AdSets + Público */}
      {passo === 2 && (
        <div className="space-y-4">
          {adsets.map((adset, i) => (
            <Card key={i} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-200">AdSet {i + 1}</p>
                {adsets.length > 1 && (
                  <button
                    onClick={() => setAdsets((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted hover:text-danger transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Dados do AdSet */}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Nome">
                  <Input
                    value={adset.nome}
                    onChange={(e) => setAdset(i, { nome: e.target.value })}
                    placeholder="CP01_Exploracao"
                  />
                </Field>
                <Field label="Abordagem">
                  <Select value={adset.abordagem} onChange={(e) => setAdset(i, { abordagem: e.target.value })}>
                    <option value="">Selecione</option>
                    <option value="Exploracao">Exploração</option>
                    <option value="Consideracao">Consideração</option>
                    <option value="Decisao">Decisão</option>
                    <option value="Transversal">Transversal</option>
                  </Select>
                </Field>
                <Field label="Orçamento diário (R$)">
                  <Input
                    value={adset.orcamento_diario}
                    onChange={(e) => setAdset(i, { orcamento_diario: e.target.value })}
                    type="number"
                    step="0.01"
                    min="0.01"
                  />
                </Field>
              </div>

              {/* Público */}
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-2">Público</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="País">
                    <Input
                      value={adset.publico.pais}
                      onChange={(e) => setPublico(i, { pais: e.target.value })}
                      placeholder="BR"
                    />
                  </Field>
                  <Field label="Gênero">
                    <Select
                      value={adset.publico.genero}
                      onChange={(e) => setPublico(i, { genero: e.target.value })}
                    >
                      <option value="ALL">Todos</option>
                      <option value="FEMALE">Feminino</option>
                      <option value="MALE">Masculino</option>
                    </Select>
                  </Field>
                  <Field label="Idade mínima">
                    <Input
                      value={adset.publico.idade_min}
                      onChange={(e) => setPublico(i, { idade_min: parseInt(e.target.value) })}
                      type="number"
                      min="18"
                      max="65"
                    />
                  </Field>
                  <Field label="Idade máxima">
                    <Input
                      value={adset.publico.idade_max}
                      onChange={(e) => setPublico(i, { idade_max: parseInt(e.target.value) })}
                      type="number"
                      min="18"
                      max="65"
                    />
                  </Field>
                  <Field label="Interesses (referência)">
                    <Input
                      value={adset.publico.interesses}
                      onChange={(e) => setPublico(i, { interesses: e.target.value })}
                      placeholder="ex: beleza, cabelo, cosméticos"
                      className="col-span-2"
                    />
                  </Field>
                </div>
              </div>
            </Card>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdsets((prev) => [...prev, adsetDefault()])}
          >
            <Plus size={13} className="mr-1" />Adicionar AdSet
          </Button>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setPasso(1)}>
              <ChevronLeft size={14} className="mr-1" />Voltar
            </Button>
            <Button onClick={() => setPasso(3)} disabled={adsets.some((a) => !a.nome)}>
              Próximo <ChevronRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Passo 3 — Anúncios */}
      {passo === 3 && (
        <div className="space-y-4">
          {adsets.map((adset, ai) => (
            <Card key={ai} className="space-y-3">
              <p className="text-sm font-medium text-slate-200">{adset.nome} — Anúncios</p>
              {adset.ads.map((ad, di) => (
                <div key={di} className="border border-white/5 rounded p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Anúncio {di + 1}</span>
                    {adset.ads.length > 1 && (
                      <button
                        onClick={() => setAdset(ai, { ads: adset.ads.filter((_, j) => j !== di) })}
                        className="text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>

                  {/* Preview do nome gerado */}
                  {ad.video_codigo && (
                    <p className="text-[10px] text-accent font-mono">
                      Nome: {gerarNomeAd(adset.nome, ad.video_codigo, ad.copy_variante)}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Drive File ID">
                      <Input
                        value={ad.drive_file_id}
                        onChange={(e) => setAd(ai, di, { drive_file_id: e.target.value })}
                        placeholder="1VtJALoCyOjq..."
                        className="text-xs"
                      />
                    </Field>
                    <Field label="Código do vídeo">
                      <Input
                        value={ad.video_codigo}
                        onChange={(e) => setAd(ai, di, { video_codigo: e.target.value })}
                        placeholder="CP01_F2_V01"
                        className="text-xs"
                      />
                    </Field>
                    <Field label="Variante">
                      <Select
                        value={ad.copy_variante}
                        onChange={(e) => setAd(ai, di, { copy_variante: e.target.value as 'T1' | 'T2' | 'T3' })}
                      >
                        <option value="T1">T1</option>
                        <option value="T2">T2</option>
                        <option value="T3">T3</option>
                      </Select>
                    </Field>
                    <Field label="Copy (texto do anúncio)">
                      <Input
                        value={ad.copy_texto}
                        onChange={(e) => setAd(ai, di, { copy_texto: e.target.value })}
                        placeholder="Texto do anúncio..."
                        className="text-xs"
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdset(ai, { ads: [...adset.ads, adDefault()] })}
              >
                <Plus size={12} className="mr-1" />Adicionar anúncio
              </Button>
            </Card>
          ))}

          {error && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setPasso(2)}>
              <ChevronLeft size={14} className="mr-1" />Voltar
            </Button>
            <Button onClick={lancar} disabled={loading}>
              {loading ? 'Lançando...' : 'Lançar no Meta'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted">{label}</label>
      {children}
    </div>
  )
}
