import cron from 'node-cron'
import { supabase } from '../lib/supabase.js'
import { buscarMetricasAds } from '../lib/meta.js'
import { executarScaler } from '../services/scaler.js'
import pino from 'pino'

const log = pino({ name: 'cron-metricas' })

// Coleta métricas do Meta 1x por dia às 06:00 e roda o scaler em seguida
export function iniciarCronMetricas(): void {
  cron.schedule('0 6 * * *', async () => {
    log.info('Coletando métricas do Meta')

    try {
      const hoje = new Date().toISOString().slice(0, 10)
      const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

      // Busca todos os ads ativos com meta_ad_id
      const { data: ads } = await supabase
        .from('ads')
        .select('id, meta_ad_id, adset_id')
        .eq('status', 'ativa')
        .not('meta_ad_id', 'is', null)

      if (!ads?.length) return

      const adIds = ads.map((a) => a.meta_ad_id!)
      const metricas = await buscarMetricasAds(adIds, ontem, hoje)

      for (const m of metricas) {
        const ad = ads.find((a) => a.meta_ad_id === m.ad_id)
        if (!ad) continue

        const actions = (m.actions as Array<{ action_type: string; value: string }>) ?? []
        const conversas = actions.find((a) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value ?? 0

        const { data: adsetRow } = await supabase
          .from('adsets')
          .select('campanha_id')
          .eq('id', ad.adset_id)
          .single()

        await supabase
          .from('metricas_diarias')
          .upsert(
            {
              campanha_id: adsetRow?.campanha_id,
              adset_id: ad.adset_id,
              ad_id: ad.id,
              data_referencia: ontem,
              impressoes: Number(m.impressions ?? 0),
              cliques: Number(m.clicks ?? 0),
              gasto: Number(m.spend ?? 0),
              ctr: Number(m.ctr ?? 0),
              cpm: Number(m.cpm ?? 0),
              conversas_iniciadas: Number(conversas),
            },
            { onConflict: 'ad_id,data_referencia' }
          )
      }

      log.info({ total: metricas.length }, 'Métricas coletadas')

      // Roda scaler logo após coleta
      await executarScaler()
    } catch (err) {
      log.error(err, 'Erro ao coletar métricas')
    }
  })

  log.info('CRON de métricas agendado (06:00 diário)')
}
