import { supabase } from './supabaseClient.js';
import dotenv from 'dotenv';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────
const EVOLUTION_URL  = process.env.EVOLUTION_API_URL || 'https://evolutionapi.vps1069.panel.speedfy.host';
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME  = process.env.EVOLUTION_INSTANCE  || 'Claudia';
const BATCH_SIZE     = 50;   // números por requisição à API (máximo recomendado)
const DELAY_MS       = 3000; // pausa entre lotes (ms) — evita rate limit

if (!EVOLUTION_KEY) {
  console.error('❌ ERRO FATAL: EVOLUTION_API_KEY não configurada no .env');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Remove tudo que não for dígito e garante DDI 55 */
function normalizeNumber(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (!digits.startsWith('55')) digits = '55' + digits;
  return digits;
}

/** Verifica um lote de números na Evolution API */
async function checkBatch(numbers) {
  const res = await fetch(`${EVOLUTION_URL}/chat/whatsappNumbers/${INSTANCE_NAME}`, {
    method: 'POST',
    headers: {
      'apikey': EVOLUTION_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ numbers }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Evolution API ${res.status}: ${txt}`);
  }

  return res.json(); // [{ jid, exists, number }]
}

// ─── Worker principal ─────────────────────────────────────────────────────────

async function run() {
  console.log('🚀 wa-validator iniciado');
  console.log(`   Instância : ${INSTANCE_NAME}`);
  console.log(`   Lote       : ${BATCH_SIZE} números`);
  console.log(`   Pausa      : ${DELAY_MS}ms entre lotes\n`);

  let totalVerificados = 0;
  let totalValidos     = 0;
  let totalInvalidos   = 0;

  while (true) {
    // 1. Busca próximo lote ainda não verificado
    const { data: leads, error } = await supabase
      .from('lead_empresas')
      .select('id, telefone_wpp')
      .is('wpp_verificado', null)
      .not('telefone_wpp', 'is', null)
      .limit(BATCH_SIZE);

    if (error) {
      console.error('❌ Erro ao buscar leads:', error.message);
      await sleep(10_000);
      continue;
    }

    if (!leads || leads.length === 0) {
      console.log('✅ Todos os leads já foram verificados! Worker encerrado.');
      break;
    }

    console.log(`📦 Processando lote de ${leads.length} leads...`);

    // 2. Normaliza números e monta mapa id → número
    const mapa = {}; // numero_normalizado → id
    const numeros = [];

    for (const lead of leads) {
      const norm = normalizeNumber(lead.telefone_wpp);
      if (!norm) {
        await supabase
          .from('lead_empresas')
          .update({ wpp_verificado: false, wpp_verificado_em: new Date().toISOString() })
          .eq('id', lead.id);
        totalInvalidos++;
        continue;
      }
      // Se número duplicado no lote, marca o anterior como false e usa o mais recente
      if (mapa[norm]) {
        await supabase
          .from('lead_empresas')
          .update({ wpp_verificado: false, wpp_verificado_em: new Date().toISOString() })
          .eq('id', mapa[norm]);
        totalInvalidos++;
      } else {
        numeros.push(norm);
      }
      mapa[norm] = lead.id;
    }

    if (numeros.length === 0) {
      continue;
    }

    // 3. Chama a Evolution API
    let resultados;
    try {
      resultados = await checkBatch(numeros);
    } catch (err) {
      console.error('❌ Erro na Evolution API:', err.message);
      await sleep(15_000);
      continue;
    }

    // 4. Atualiza o banco em paralelo
    const updates = resultados.map(({ number, exists }) => {
      const id = mapa[number];
      if (!id) return Promise.resolve();

      const status = exists === true;
      if (status) totalValidos++; else totalInvalidos++;
      totalVerificados++;

      return supabase
        .from('lead_empresas')
        .update({
          wpp_verificado: status,
          wpp_verificado_em: new Date().toISOString(),
        })
        .eq('id', id);
    });

    await Promise.all(updates);

    console.log(
      `   ✔ Lote concluído — válidos: ${totalValidos} | inválidos: ${totalInvalidos} | total: ${totalVerificados}`
    );

    // 5. Pausa entre lotes
    await sleep(DELAY_MS);
  }

  console.log('\n📊 Resumo final:');
  console.log(`   Verificados : ${totalVerificados}`);
  console.log(`   WhatsApp OK : ${totalValidos}`);
  console.log(`   Sem WPP     : ${totalInvalidos}`);
}

run().catch(err => {
  console.error('💥 Erro crítico:', err);
  process.exit(1);
});
