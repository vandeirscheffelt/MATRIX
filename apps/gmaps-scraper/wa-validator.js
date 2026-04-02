import { supabase } from './supabaseClient.js';
import dotenv from 'dotenv';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────
const META_TOKEN       = process.env.META_TOKEN;
const META_PHONE_ID    = process.env.META_PHONE_ID || '973258712535207';
const BATCH_SIZE       = 50;   // Meta suporta até 50 por requisição
const DELAY_MS         = 2000; // 2 segundos entre lotes
const DAILY_LIMIT      = 1000; // limite conservador

if (!META_TOKEN) {
  console.error('❌ ERRO FATAL: META_TOKEN não configurado no .env');
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

/** Verifica um lote de números na Meta Cloud API */
async function checkBatch(numbers) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${META_PHONE_ID}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      blocking: 'no_wait',
      contacts: numbers,
      force_check: true,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Meta API ${res.status}: ${txt}`);
  }

  const json = await res.json();
  // Normaliza para o mesmo formato que o restante do código espera: [{ number, exists }]
  return (json.contacts || []).map(c => ({
    number: c.input.replace(/\D/g, ''),
    exists: c.status === 'valid',
  }));
}

// ─── Worker principal ─────────────────────────────────────────────────────────

/** Retorna quantos ms faltam para meia-noite */
function msAteMeiaNoite() {
  const agora = new Date();
  const meiaNoite = new Date(agora);
  meiaNoite.setHours(24, 0, 0, 0);
  return meiaNoite - agora;
}

async function run() {
  console.log('🚀 wa-validator iniciado (modo contínuo)');
  console.log(`   Lote        : ${BATCH_SIZE} números`);
  console.log(`   Pausa       : ${DELAY_MS / 1000}s entre lotes`);
  console.log(`   Limite/dia  : ${DAILY_LIMIT} validações\n`);

  while (true) {
    let totalVerificados = 0;
    let totalValidos     = 0;
    let totalInvalidos   = 0;

    console.log(`\n📅 Novo ciclo diário iniciado — ${new Date().toLocaleDateString('pt-BR')}`);

    while (totalVerificados < DAILY_LIMIT) {
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
        console.log('✅ Todos os leads pendentes foram verificados. Aguardando novos leads...');
        await sleep(msAteMeiaNoite());
        break;
      }

    console.log(`📦 Processando lote de ${leads.length} leads...`);

    // 2. Normaliza números e monta mapa id → número
    const mapa = {}; // numero_normalizado → id
    const numeros = [];
    const invalidosImediatos = []; // ids inválidos antes mesmo de chamar a API
    const agora2 = new Date().toISOString();

    for (const lead of leads) {
      const norm = normalizeNumber(lead.telefone_wpp);
      if (!norm) {
        invalidosImediatos.push({ id: lead.id, wpp_verificado: false, wpp_verificado_em: agora2 });
        totalInvalidos++;
        continue;
      }
      if (mapa[norm]) {
        invalidosImediatos.push({ id: mapa[norm], wpp_verificado: false, wpp_verificado_em: agora2 });
        totalInvalidos++;
      } else {
        numeros.push(norm);
      }
      mapa[norm] = lead.id;
    }

    // Persiste inválidos imediatos em massa
    if (invalidosImediatos.length > 0) {
      await supabase.from('lead_empresas').upsert(invalidosImediatos, { onConflict: 'id' });
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

    // 4. Atualiza o banco em massa (1 chamada)
    const agora = new Date().toISOString();
    const upsertPayload = [];

    for (const { number, exists } of resultados) {
      const id = mapa[number];
      if (!id) continue;

      const status = exists === true;
      if (status) totalValidos++; else totalInvalidos++;
      totalVerificados++;

      upsertPayload.push({ id, wpp_verificado: status, wpp_verificado_em: agora });
    }

    if (upsertPayload.length > 0) {
      await supabase
        .from('lead_empresas')
        .upsert(upsertPayload, { onConflict: 'id' });
    }

    console.log(
      `   ✔ Lote concluído — válidos: ${totalValidos} | inválidos: ${totalInvalidos} | total: ${totalVerificados}`
    );

      // 5. Pausa entre lotes
      await sleep(DELAY_MS);
    }

    // Resumo do dia
    console.log('\n📊 Resumo do dia:');
    console.log(`   Verificados : ${totalVerificados}`);
    console.log(`   WhatsApp OK : ${totalValidos}`);
    console.log(`   Sem WPP     : ${totalInvalidos}`);

    // Aguarda meia-noite para reiniciar o contador
    const espera = msAteMeiaNoite();
    console.log(`\n💤 Limite diário atingido. Reiniciando em ${Math.round(espera / 3600000)}h...\n`);
    await sleep(espera);
  }
}

run().catch(err => {
  console.error('💥 Erro crítico:', err);
  process.exit(1);
});
