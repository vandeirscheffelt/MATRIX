import { supabase } from './supabaseClient.js';
import { config } from './config.js';

const db = supabase.schema('03_prospecta');

async function seedDatabase() {
  console.log('🚀 Iniciando o Seed do Banco de Dados `03_prospecta`...');

  // 1. Inserir Categorias
  console.log('\n📦 Inserindo Categorias...');
  const catArray = config.categories.map(c => ({ nome: c }));

  const { data: categoriasResult, error: errCat } = await db
    .from('categorias')
    .upsert(catArray, { onConflict: 'nome' })
    .select();

  if (errCat) { console.error('Erro (Categorias):', errCat); return; }
  console.log(`✅ ${categoriasResult?.length || 0} Categorias processadas.`);

  // 2. Inserir Localidades
  console.log('\n🌎 Inserindo Bairros/Cidades...');
  const locArray = config.locations.map(loc => {
    // Ex: "Pinheiros, São Paulo, SP"
    const partes = loc.split(',').map(s => s.trim());
    return {
      pais_codigo: 'BR',
      estado: partes[2] || 'SP',
      cidade: partes[1] || 'São Paulo',
      bairro: partes[0],
      termo_busca: loc,
      status: 'pendente'
    };
  });

  const { data: localidadesResult, error: errLoc } = await db
    .from('localidades')
    .upsert(locArray, { onConflict: 'termo_busca' })
    .select();

  if (errLoc) { console.error('Erro (Localidades):', errLoc); return; }
  console.log(`✅ ${localidadesResult?.length || 0} Localidades processadas.`);

  // 3. Montar as Filas (Execuções)
  console.log('\n⚙️ Montando Fila de Execuções (Bairro x Categoria)...');

  // Pegar as listas atuais pra garantir que temos os IDs do banco
  // Busca em páginas de 1000 para suportar 41k+ localidades
  let locRow = [];
  let locPage = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await db.from('localidades').select('id, termo_busca').range(locPage * PAGE_SIZE, (locPage + 1) * PAGE_SIZE - 1);
    if (error) { console.error('Erro ao buscar localidades:', error); return; }
    if (!data || data.length === 0) break;
    locRow = locRow.concat(data);
    if (data.length < PAGE_SIZE) break;
    locPage++;
  }

  const { data: catRow } = await db.from('categorias').select('id, nome');

  console.log(`  > ${locRow.length} localidades × ${catRow.length} categorias = ${locRow.length * catRow.length} combinações totais`);

  // Monta e insere em lotes de 500 com upsert (ignora duplicatas via unique constraint)
  const LOTE_SIZE = 500;
  let inseridas = 0;
  let ignoradas = 0;
  let loteNum = 0;

  const todasCombinacoes = [];
  locRow.forEach(local => {
    catRow.forEach(categoria => {
      todasCombinacoes.push({
        localidade_id: local.id,
        categoria_id: categoria.id,
        status: 'pendente',
        dias_semana: [1, 2, 3, 4, 5, 6, 7]
      });
    });
  });

  for (let i = 0; i < todasCombinacoes.length; i += LOTE_SIZE) {
    const lote = todasCombinacoes.slice(i, i + LOTE_SIZE);
    loteNum++;

    const { error: errExec } = await db
      .from('execucoes')
      .upsert(lote, { onConflict: 'localidade_id,categoria_id', ignoreDuplicates: true });

    if (errExec) {
      console.error(`Erro no lote ${loteNum}:`, errExec.message);
    } else {
      inseridas += lote.length;
    }

    if (loteNum % 50 === 0) {
      console.log(`  > Lote ${loteNum} processado... (${inseridas}/${todasCombinacoes.length})`);
    }
  }

  console.log(`✅ Fila de execuções completa: ${inseridas} combinações enviadas (duplicatas ignoradas automaticamente).`);

  console.log('\n🎉 SEED COMPLETO! O banco está pronto para o Worker começar a puxar jobs.');
  process.exit(0);
}

seedDatabase();
