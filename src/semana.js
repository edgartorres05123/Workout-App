// Séries por músculo na semana atual e objetivos semanais. Funções puras (o "agora" vem por argumento).
// Regras: a semana vai de segunda a domingo (hora local); contam os treinos terminados desta semana e
// as voltas já feitas (✓) no treino em curso; o aquecimento não conta; por cada série, cada músculo
// principal do exercício conta 1 e cada secundário 0,5. Os exercícios sem músculos ficam de fora.
import { inicioSemana, somarDias } from './estatisticas'
import { MUSCULOS } from './musculos'

export const OBJETIVO_PADRAO = 10
export const OBJETIVO_MAXIMO = 30

// ---------- Objetivos ----------

// Objetivos de todos os músculos ({ peito: 10, ... }), a partir dos guardados no user_metadata
// (só os diferentes do padrão). Valores inválidos voltam ao padrão.
export function lerObjetivos(guardados) {
  const objetivos = {}
  for (const { id } of MUSCULOS) {
    const valor = guardados?.[id]
    objetivos[id] =
      Number.isInteger(valor) && valor >= 0 && valor <= OBJETIVO_MAXIMO ? valor : OBJETIVO_PADRAO
  }
  return objetivos
}

// O que se grava no user_metadata: só os objetivos diferentes do padrão
export function objetivosParaGravar(objetivos) {
  return Object.fromEntries(
    MUSCULOS.filter(({ id }) => objetivos[id] !== undefined && objetivos[id] !== OBJETIVO_PADRAO).map(({ id }) => [
      id,
      objetivos[id],
    ])
  )
}

// ---------- Contagem ----------

// Map(exercicio_id → [{ musculo, principal }]) a partir dos exercícios com exercicio_musculos
export function mapaMusculos(exercicios) {
  return new Map(exercicios.map((e) => [e.id, e.exercicio_musculos ?? []]))
}

// Os treinos a contar: os terminados desta semana e o treino em curso (sem o repetir)
export function treinosDaSemana(treinos, agora, treinoEmCurso = null) {
  const inicio = inicioSemana(agora)
  const fim = somarDias(inicio, 7)
  const daSemana = treinos.filter((t) => {
    const data = new Date(t.data)
    return data >= inicio && data < fim && t.id !== treinoEmCurso?.id
  })
  return treinoEmCurso ? [...daSemana, treinoEmCurso] : daSemana
}

// Séries por músculo em vários treinos: { valores: Map(musculo → séries), semMusculos: Set(exercicio_id) }
export function contarSeriesPorMusculo(treinos, musculosPorExercicio) {
  const valores = new Map(MUSCULOS.map((m) => [m.id, 0]))
  const semMusculos = new Set()
  for (const treino of treinos) {
    for (const serie of treino.series ?? []) {
      if (serie.aquecimento) continue
      const musculos = musculosPorExercicio.get(serie.exercicio_id) ?? []
      if (musculos.length === 0) {
        semMusculos.add(serie.exercicio_id)
        continue
      }
      for (const m of musculos) {
        if (!valores.has(m.musculo)) continue
        valores.set(m.musculo, valores.get(m.musculo) + (m.principal ? 1 : 0.5))
      }
    }
  }
  return { valores, semMusculos }
}

// As séries por músculo desta semana (com o treino em curso, se houver)
export function seriesDaSemana(treinos, musculosPorExercicio, agora, treinoEmCurso = null) {
  return contarSeriesPorMusculo(treinosDaSemana(treinos, agora, treinoEmCurso), musculosPorExercicio)
}

// ---------- Progresso ----------

// Progresso de cada músculo acompanhado (objetivo > 0), pela ordem de musculos.js:
// [{ id, nome, feitas, objetivo, fracao (0..1), estado: 'vazio' | 'parcial' | 'completo' }]
export function progressoSemana(valores, objetivos) {
  return MUSCULOS.filter(({ id }) => (objetivos[id] ?? OBJETIVO_PADRAO) > 0).map(({ id, nome }) => {
    const objetivo = objetivos[id] ?? OBJETIVO_PADRAO
    const feitas = valores.get(id) ?? 0
    const estado = feitas >= objetivo ? 'completo' : feitas > 0 ? 'parcial' : 'vazio'
    return { id, nome, feitas, objetivo, fracao: Math.min(1, feitas / objetivo), estado }
  })
}

// Os músculos acompanhados ainda sem nenhuma série esta semana
export function musculosEmFalta(progresso) {
  return progresso.filter((p) => p.feitas === 0)
}

// true se todos os músculos acompanhados chegaram ao objetivo
export function semanaCompleta(progresso) {
  return progresso.length > 0 && progresso.every((p) => p.estado === 'completo')
}

// "Peito", "Peito e Costas", "Peito, Costas e Ombros"
export function juntarNomes(nomes) {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}

// Linha de resumo: "Faltam: Pernas, Ombros e Gémeos" ou "Semana completa 💪" (null se não houver nada a dizer)
export function resumoEmFalta(progresso) {
  if (semanaCompleta(progresso)) return 'Semana completa 💪'
  const falta = musculosEmFalta(progresso)
  if (falta.length === 0) return null
  return `${falta.length === 1 ? 'Falta' : 'Faltam'}: ${juntarNomes(falta.map((p) => p.nome))}`
}

// ---------- Exercícios de um músculo ----------

// Os meus exercícios que trabalham o músculo: primeiro os de músculo principal, depois pela última vez
// que os fiz (os nunca feitos no fim, por nome). estatisticas: Map(exercicio_id → { ultima, numTreinos })
// Devolve [{ exercicio, principal, ultima }]
export function exerciciosDoMusculo(exercicios, musculo, estatisticas) {
  return exercicios
    .map((exercicio) => {
      const ligacao = (exercicio.exercicio_musculos ?? []).find((m) => m.musculo === musculo)
      if (!ligacao) return null
      return { exercicio, principal: ligacao.principal, ultima: estatisticas.get(exercicio.id)?.ultima ?? null }
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.principal !== b.principal) return a.principal ? -1 : 1
      if (a.ultima && b.ultima) return new Date(b.ultima) - new Date(a.ultima)
      if (a.ultima || b.ultima) return a.ultima ? -1 : 1
      return a.exercicio.nome.localeCompare(b.exercicio.nome, 'pt-PT')
    })
}
