import { supabase } from '../lib/supabase.js'
import { atualizarStatusAd, atualizarOrcamentoAdset } from '../lib/meta.js'
import pino from 'pino'

const log = pino({ name: 'scaler' })

// ─── Avalia todas as campanhas ativas e aplica regras ─────────────────────────

export async function executarScaler(): Promise<void> {
  log.info('Scaler iniciado')

  const { data: campanhas } = await supabase
    .from('campanhas')
    .select('id, campanha_codigo, janela_avaliacao_h, gasto_minimo_corte')
    .eq('status', 'ativa')

  if (!campanhas?.length) {
    log.info('Nenhuma campanha ativa para avaliar')
    return
  }

  for (const campanha of campanhas) {
    await avaliarCampanha(campanha.id, campanha.gasto_minimo_corte)
  }

  log.info('Scaler finalizado')
}

async function avaliarCampanha(campanhaId: string, gastoMinimo: number): Promise<void> {
  // Busca regras ativas da campanha
  const { data: regras } = await supabase
    .from('regras_scaler')
    .select('*')
    .eq('campanha_id', campanhaId)
    .eq('ativa', true)

  if (!regras?.length) return

  // Busca ads ativos da campanha
  const { data: ads } = await supabase
    .from('ads')
    .select('id, meta_ad_id, adset_id, nome')
    .eq('status', 'ativa')
    .in(
      'adset_id',
      (
        await supabase
          .from('adsets')
          .select('id')
          .eq('campanha_id', campanhaId)
      ).data?.map((a) => a.id) ?? []
    )

  if (!ads?.length) return

  for (const ad of ads) {
    // Pega métricas acumuladas do ad
    const { data: metricas } = await supabase
      .from('metricas_diarias')
      .select('gasto, cpl_crm, ctr, conversas_iniciadas, leads_crm')
      .eq('ad_id', ad.id)
      .order('data_referencia', { ascending: false })
      .limit(7)

    if (!metricas?.length) continue

    const gastoTotal = metricas.reduce((s, m) => s + (m.gasto ?? 0), 0)

    // Só age se atingiu gasto mínimo configurado
    if (gastoTotal < gastoMinimo) continue

    const ultima = metricas[0]

    for (const regra of regras) {
      const valorMetrica = ultima[regra.metrica as keyof typeof ultima] as number ?? 0
      const dispara = avaliarOperador(valorMetrica, regra.operador, regra.valor)

      if (!dispara) continue

      await executarAcao({
        acao: regra.tipo,
        ad,
        regra,
        valorAntes: valorMetrica,
      })
    }
  }
}

function avaliarOperador(valor: number, operador: string, threshold: number): boolean {
  if (operador === 'gt') return valor > threshold
  if (operador === 'lt') return valor < threshold
  if (operador === 'eq') return valor === threshold
  return false
}

async function executarAcao(params: {
  acao: string
  ad: { id: string; meta_ad_id: string | null; adset_id: string; nome: string }
  regra: { id: string; campanha_id: string; acao_valor: number | null }
  valorAntes: number
}): Promise<void> {
  const { acao, ad, regra, valorAntes } = params

  if (acao === 'PAUSA' || acao === 'CORTE') {
    if (ad.meta_ad_id) {
      await atualizarStatusAd(ad.meta_ad_id, 'PAUSED')
    }
    await supabase
      .from('ads')
      .update({ status: acao === 'CORTE' ? 'eliminada' : 'pausada' })
      .eq('id', ad.id)

    log.info({ ad: ad.nome, acao }, 'Ad pausado/cortado pelo scaler')
  }

  if (acao === 'ESCALA' && regra.acao_valor) {
    const { data: adset } = await supabase
      .from('adsets')
      .select('meta_adset_id, orcamento_diario')
      .eq('id', ad.adset_id)
      .single()

    if (adset?.meta_adset_id) {
      const novoOrcamento = adset.orcamento_diario * (1 + regra.acao_valor / 100)
      await atualizarOrcamentoAdset(adset.meta_adset_id, novoOrcamento)
      await supabase
        .from('adsets')
        .update({ orcamento_diario: novoOrcamento })
        .eq('id', ad.adset_id)

      log.info({ ad: ad.nome, novoOrcamento }, 'Orçamento escalado pelo scaler')
    }
  }

  // Registra no log
  await supabase.from('scaler_log').insert({
    campanha_id: regra.campanha_id,
    adset_id: ad.adset_id,
    ad_id: ad.id,
    acao,
    regra_id: regra.id,
    valor_antes: valorAntes,
    valor_depois: regra.acao_valor,
    motivo: `Regra automática: ${acao}`,
  })
}
