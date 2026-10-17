import { supabase } from './supabase'

// Os blocos de um treino, com os exercícios e os alvos
const SELECT_BLOCOS =
  'blocos(id, ordem, tipo, voltas, notas, bloco_exercicios(id, ordem, exercicio_id, reps_alvo, peso_alvo, exercicios(id, nome)))'

// Um treino com as relações aninhadas: treinos → blocos → bloco_exercicios, e treinos → series
export const SELECT_TREINO =
  `id, data, duracao_min, notas, ${SELECT_BLOCOS}, ` +
  'series(id, bloco_id, volta, exercicio_id, ordem, repeticoes, peso_kg, aquecimento, exercicios(id, nome))'

// Um exercício com os seus músculos
export const SELECT_EXERCICIO = 'id, nome, exercicio_musculos(musculo, principal)'

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

// Todos os treinos terminados com as séries (sem os nomes dos exercícios), para as estatísticas
export function buscarTreinosTerminados() {
  return buscarTudo(() =>
    supabase
      .from('treinos')
      .select('id, data, duracao_min, series(id, exercicio_id, ordem, repeticoes, peso_kg, aquecimento)')
      .not('duracao_min', 'is', null)
      .order('id')
  )
}

// Todas as medições corporais (InBody)
export function buscarMedicoes() {
  return buscarTudo(() => supabase.from('medicoes').select('*').order('id'))
}

// Tabelas incluídas na exportação, com uma coluna para ordenar as páginas de forma estável
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
