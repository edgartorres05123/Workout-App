import { supabase } from './supabase'

// Um treino com as relações aninhadas: treinos → series → exercicios
export const SELECT_TREINO =
  'id, data, duracao_min, notas, series(id, exercicio_id, ordem, repeticoes, peso_kg, aquecimento, exercicios(id, nome))'

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
