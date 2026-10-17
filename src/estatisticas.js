// Cálculos de estatísticas. Recebem só dados de treinos terminados;
// as séries de aquecimento são sempre ignoradas.
import { calcular1RM, melhorSerie } from './formatar'

// treinos: [{ id, data, series: [{ exercicio_id, aquecimento }] }]
// Devolve Map(exercicio_id → { numTreinos, ultima })
export function estatisticasPorExercicio(treinos) {
  const mapa = new Map()
  for (const treino of treinos) {
    const feitos = new Set(treino.series.filter((s) => !s.aquecimento).map((s) => s.exercicio_id))
    for (const id of feitos) {
      const atual = mapa.get(id) ?? { numTreinos: 0, ultima: null }
      atual.numTreinos += 1
      if (!atual.ultima || new Date(treino.data) > new Date(atual.ultima)) atual.ultima = treino.data
      mapa.set(id, atual)
    }
  }
  return mapa
}

// series: séries de UM exercício, com o treino aninhado (s.treinos = { id, data }).
// Devolve null se não houver séries normais.
export function resumoExercicio(series) {
  const normais = series.filter((s) => !s.aquecimento)
  if (normais.length === 0) return null

  let recordePeso = normais[0]
  let maisReps = normais[0]
  let primeira = normais[0].treinos.data
  let ultima = normais[0].treinos.data

  for (const s of normais) {
    const peso = Number(s.peso_kg)
    const pesoRecorde = Number(recordePeso.peso_kg)
    // Em caso de empate no peso, conta a série com mais repetições (e vice-versa)
    if (peso > pesoRecorde || (peso === pesoRecorde && s.repeticoes > recordePeso.repeticoes)) {
      recordePeso = s
    }
    if (
      s.repeticoes > maisReps.repeticoes ||
      (s.repeticoes === maisReps.repeticoes && peso > Number(maisReps.peso_kg))
    ) {
      maisReps = s
    }
    if (new Date(s.treinos.data) < new Date(primeira)) primeira = s.treinos.data
    if (new Date(s.treinos.data) > new Date(ultima)) ultima = s.treinos.data
  }

  const melhor = melhorSerie(normais)
  return {
    numTreinos: new Set(normais.map((s) => s.treino_id)).size,
    primeira,
    ultima,
    recordePeso,
    maisReps,
    melhor,
    melhor1RM: calcular1RM(melhor.repeticoes, melhor.peso_kg),
  }
}

// Agrupa as séries de um exercício por treino, do mais recente para o mais antigo:
// [{ treino: { id, data }, series: [...] }] (com as de aquecimento, pela ordem do treino)
export function sessoesPorTreino(series) {
  const grupos = new Map()
  for (const s of series) {
    if (!grupos.has(s.treino_id)) grupos.set(s.treino_id, { treino: s.treinos, series: [] })
    grupos.get(s.treino_id).series.push(s)
  }
  const sessoes = [...grupos.values()]
  for (const sessao of sessoes) sessao.series.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  return sessoes.sort((a, b) => new Date(b.treino.data) - new Date(a.treino.data))
}
