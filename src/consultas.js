import { supabase } from './supabase'

// Os blocos de um treino, com os exercícios e os alvos (e a configuração dos blocos de condicionamento)
const SELECT_BLOCOS =
  'blocos(id, ordem, tipo, voltas, notas, duracao_seg, intervalo_seg, tempo_seg, ' +
  'bloco_exercicios(id, ordem, exercicio_id, reps_alvo, peso_alvo, segundos_alvo, exercicios(id, nome, peso_corporal)))'

// Um treino com as relações aninhadas: treinos → blocos → bloco_exercicios, e treinos → series.
// Os exercícios vêm com peso_corporal, para a carga efetiva (ver pesoCorporal.js).
export const SELECT_TREINO =
  `id, data, duracao_min, notas, favorito, nome_favorito, ${SELECT_BLOCOS}, ` +
  'series(id, bloco_id, volta, exercicio_id, ordem, repeticoes, peso_kg, duracao_seg, aquecimento, exercicios(id, nome, peso_corporal))'

// Um exercício com os seus músculos (e se é de peso corporal)
export const SELECT_EXERCICIO = 'id, nome, peso_corporal, exercicio_musculos(musculo, principal)'

// O Supabase devolve no máximo 1000 linhas por pedido. Para estatísticas que precisam de todas,
// pede página a página. criarConsulta() tem de devolver uma consulta nova, com uma ordem estável.
export async function buscarTudo(criarConsulta, tamanhoPagina = 1000) {
  const linhas = []
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await criarConsulta().range(inicio, inicio + tamanhoPagina - 1)
    if (error) return { erro: error.message }
    linhas.push(...data)
    if (data.length < tamanhoPagina) return { linhas }
  }
}

// Todos os exercícios com os músculos
export function buscarExercicios() {
  return buscarTudo(() => supabase.from('exercicios').select(SELECT_EXERCICIO).order('id'))
}

// Todos os treinos terminados com as séries, para as estatísticas. Cada série traz se o exercício é
// de peso corporal (sem o nome), para a carga efetiva.
export function buscarTreinosTerminados() {
  return buscarTudo(() =>
    supabase
      .from('treinos')
      .select(
        'id, data, duracao_min, series(id, exercicio_id, ordem, repeticoes, peso_kg, duracao_seg, aquecimento, exercicios(peso_corporal))'
      )
      .not('duracao_min', 'is', null)
      .order('id')
  )
}

// Todas as medições corporais (InBody)
export function buscarMedicoes() {
  return buscarTudo(() => supabase.from('medicoes').select('*').order('id'))
}

// Só a data e o peso de cada medição: chega para saber o peso corporal numa data
export function buscarPesosCorporais() {
  return buscarTudo(() => supabase.from('medicoes').select('id, data, peso_kg').order('id'))
}

// Tabelas incluídas na exportação (com select('*'), por isso as colunas novas entram sozinhas), com uma coluna para ordenar as páginas de forma estável
const TABELAS_EXPORTACAO = [
  ['perfil', 'user_id'],
  ['exercicios', 'id'],
  ['exercicio_musculos', 'id'],
  ['treinos', 'id'],
  ['blocos', 'id'],
  ['bloco_exercicios', 'id'],
  ['series', 'id'],
  ['medicoes', 'id'],
]

// Todos os dados do utilizador (o RLS garante que só vêm os dele), prontos a guardar em JSON
export async function exportarTodosOsDados() {
  const resultados = await Promise.all(
    TABELAS_EXPORTACAO.map(([tabela, ordem]) =>
      buscarTudo(() => supabase.from(tabela).select('*').order(ordem))
    )
  )
  const falhou = resultados.find((r) => r.erro)
  if (falhou) return { erro: falhou.erro }
  return {
    dados: {
      app: 'workout-app',
      versao: 1,
      exportado_em: new Date().toISOString(),
      tabelas: Object.fromEntries(TABELAS_EXPORTACAO.map(([tabela], i) => [tabela, resultados[i].linhas])),
    },
  }
}

// Um treino completo, no mesmo formato que a lista do Histórico usa
export async function buscarTreino(id) {
  const { data, error } = await supabase
    .from('treinos')
    .select(SELECT_TREINO)
    .eq('id', id)
    .order('ordem', { referencedTable: 'series' })
    .single()
  if (error) return { erro: error.message }
  return { treino: data }
}

// O treino em curso (duracao_min null, o mais recente) completo, ou null se não houver
export async function buscarTreinoEmCurso() {
  const { data, error } = await supabase
    .from('treinos')
    .select('id')
    .is('duracao_min', null)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { erro: error.message }
  if (!data) return { treino: null }
  return buscarTreino(data.id)
}

// Os últimos treinos terminados que têm blocos, para copiar a estrutura
export async function buscarTreinosParaCopiar(limite = 30) {
  const { data, error } = await supabase
    .from('treinos')
    .select(`id, data, ${SELECT_BLOCOS}`)
    .not('duracao_min', 'is', null)
    .order('data', { ascending: false })
    .limit(limite)
  if (error) return { erro: error.message }
  return { treinos: data.filter((t) => t.blocos.length > 0) }
}

// Os treinos favoritos, com a estrutura (blocos, exercícios e alvos), do mais recente para o mais antigo
export async function buscarFavoritos() {
  const { data, error } = await supabase
    .from('treinos')
    .select(`id, data, nome_favorito, ${SELECT_BLOCOS}`)
    .eq('favorito', true)
    .order('data', { ascending: false })
  if (error) return { erro: error.message }
  return { favoritos: data }
}
