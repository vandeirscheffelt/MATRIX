import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
}

// Client dedicado ao schema 02_atelie (leitura de vídeos/criativos)
const supabaseAtelie = createClient(url, key, {
  auth: { persistSession: false },
  db: { schema: '02_atelie' },
})

export interface VideoAtelie {
  id: number
  video_codigo: string
  campanha_id: string
  abordagem_codigo: string
  drive_file_id: string
  primary_text: string | null
  headline: string | null
  status: string
  status_execucao: string | null
  plataforma_tipo: string | null
  bloco: string | null
  mensagem_wpp: string | null
}

export interface FiltrosAtelie {
  abordagem_codigo?: string
  bloco?: string
  max_videos?: number
}

// Busca vídeos prontos para lançamento no Meta
export async function buscarVideosParaCampanha(
  campanhaId: string,
  filtros?: FiltrosAtelie
): Promise<VideoAtelie[]> {
  let query = supabaseAtelie
    .from('videos')
    .select('id, video_codigo, campanha_id, abordagem_codigo, drive_file_id, primary_text, headline, status, status_execucao, plataforma_tipo, bloco, mensagem_wpp')
    .eq('campanha_id', campanhaId)
    .eq('plataforma_tipo', 'META_ADS')
    .not('drive_file_id', 'is', null)
    .in('status_execucao', ['planejado', null])

  if (filtros?.abordagem_codigo) {
    query = query.eq('abordagem_codigo', filtros.abordagem_codigo)
  }
  if (filtros?.bloco) {
    query = query.eq('bloco', filtros.bloco)
  }
  if (filtros?.max_videos) {
    query = query.limit(filtros.max_videos)
  }

  const { data, error } = await query

  if (error) throw new Error(`Erro ao buscar vídeos do ateliê: ${error.message}`)
  if (!data || data.length === 0) {
    throw new Error(`Nenhum vídeo encontrado para campanha ${campanhaId} com os filtros informados`)
  }

  return data as VideoAtelie[]
}

// Marca vídeo como executado após subir na Meta
export async function marcarVideoComoExecutado(
  videoCodigo: string,
  metaAdId: string
): Promise<void> {
  const { error } = await supabaseAtelie
    .from('videos')
    .update({
      status_execucao: 'publicado',
      executado_em: new Date().toISOString(),
    })
    .eq('video_codigo', videoCodigo)

  if (error) {
    // Não é crítico — só loga
    console.error(`[ATELIE] Falha ao marcar ${videoCodigo} como executado: ${error.message}`)
  } else {
    console.log(`[ATELIE] ${videoCodigo} marcado como executado (meta_ad_id: ${metaAdId})`)
  }
}
