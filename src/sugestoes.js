// Ideias de treino: a sugestão automática (músculos-alvo, exercícios e estrutura em blocos).
// Funções puras: o "agora" e a semente do sorteio vêm por argumento, para a sugestão poder ser testada.
// O resultado é um "treino" só com blocos (como um favorito), pronto para estruturaParaCopiar().
import { MUSCULOS } from './musculos'
import { chaveDia } from './formatar'
import { mapaMusculos, progressoSemana, seriesDaSemana } from './semana'

export const HORAS_DESCANSO = 48
const REPS_PADRAO = 10
const REPS_AQUECIMENTO = 12
const DIA_MS = 24 * 60 * 60 * 1000

// ---------- Sorteio com semente ----------

// Gerador pseudo-aleatório (mulberry32): a mesma semente dá sempre os mesmos números
export function criarSorteio(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Semente do dia ("2026-10-18" → número): a sugestão de hoje é a mesma no início e na página
export function sementeDoDia(agora) {
  let h = 0
  for (const c of chaveDia(agora)) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0
  return h
}

// ---------- Histórico dos exercícios ----------

// O valor que mais se repete (empate: o mais perto de 10, depois o menor)
function moda(valores) {
  const contagem = new Map()
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1)
  let melhor = null
  for (const [v, n] of contagem) {
    const atual = melhor === null ? null : contagem.get(melhor)
    if (
      melhor === null ||
      n > atual ||
      (n === atual && (Math.abs(v - REPS_PADRAO) < Math.abs(melhor - REPS_PADRAO) ||
        (Math.abs(v - REPS_PADRAO) === Math.abs(melhor - REPS_PADRAO) && v < melhor)))
    ) {
      melhor = v
    }
  }
  return melhor
}

// Por exercício (só séries normais de treinos terminados): Map(exercicio_id → { numTreinos, ultima,
// repsHabituais (as reps mais feitas), repsUltima (as reps mais feitas no último treino) })
export function historicoExercicios(treinos) {
  const porExercicio = new Map()
  const ordenados = [...treinos].sort((a, b) => new Date(a.data) - new Date(b.data))
  for (const treino of ordenados) {
    const doTreino = new Map()
    for (const s of treino.series ?? []) {
      if (s.aquecimento) continue
      if (!doTreino.has(s.exercicio_id)) doTreino.set(s.exercicio_id, [])
      doTreino.get(s.exercicio_id).push(s.repeticoes)
    }
    for (const [id, reps] of doTreino) {
      const h = porExercicio.get(id) ?? { numTreinos: 0, ultima: null, todas: [], repsUltima: null }
      h.numTreinos += 1
      h.ultima = treino.data
      h.todas.push(...reps)
      h.repsUltima = moda(reps)
      porExercicio.set(id, h)
    }
  }
  return new Map(
    [...porExercicio].map(([id, { todas, ...h }]) => [id, { ...h, repsHabituais: moda(todas) }])
  )
}

// ---------- Músculos-alvo ----------

// Músculos com séries como PRINCIPAL nas últimas `horas` (treinos terminados e o treino em curso)
export function musculosRecentes(treinos, musculosPorExercicio, agora, treinoEmCurso = null, horas = HORAS_DESCANSO) {
  const desde = new Date(agora).getTime() - horas * 60 * 60 * 1000
  const lista = treinoEmCurso ? [...treinos.filter((t) => t.id !== treinoEmCurso.id), treinoEmCurso] : treinos
  const recentes = new Set()
  for (const treino of lista) {
    const quando = new Date(treino.data).getTime()
    if (quando < desde || quando > new Date(agora).getTime()) continue
    for (const s of treino.series ?? []) {
      if (s.aquecimento) continue
      for (const m of musculosPorExercicio.get(s.exercicio_id) ?? []) if (m.principal) recentes.add(m.musculo)
    }
  }
  return recentes
}

// Escolhe 2 ou 3 músculos-alvo: os mais longe do objetivo (em percentagem), sem os trabalhados como
// principal nas últimas 48 horas. 3 se houver pelo menos 3 abaixo do objetivo, senão 2.
// Se a regra das 48 horas excluir todos, é ignorada (ignorouDescanso = true).
// progresso: de progressoSemana (só os músculos acompanhados). Devolve { alvos: [id], ignorouDescanso }
export function escolherMusculosAlvo(progresso, recentes) {
  const ordem = new Map(MUSCULOS.map((m, i) => [m.id, i]))
  const ordenados = [...progresso].sort(
    (a, b) =>
      a.feitas / a.objetivo - b.feitas / b.objetivo ||
      b.objetivo - b.feitas - (a.objetivo - a.feitas) ||
      ordem.get(a.id) - ordem.get(b.id)
  )
  let candidatos = ordenados.filter((p) => !recentes.has(p.id))
  let ignorouDescanso = false
  if (candidatos.length === 0 && ordenados.length > 0) {
    candidatos = ordenados
    ignorouDescanso = true
  }
  const abaixo = candidatos.filter((p) => p.feitas < p.objetivo).length
  return { alvos: candidatos.slice(0, abaixo >= 3 ? 3 : 2).map((p) => p.id), ignorouDescanso }
}

// ---------- Exercícios ----------

// Os exercícios já feitos com o músculo como principal, do mais para o menos indicado: preferem-se os
// mais frequentes e os feitos há mais tempo; os de `evitar` (a sugestão anterior) vão para o fim.
// Devolve Map(musculo → [exercicio])
export function candidatosPorMusculo(alvos, exercicios, historico, { agora, semente = 1, evitar = new Set() } = {}) {
  const sorteio = criarSorteio(semente)
  const maxTreinos = Math.max(1, ...[...historico.values()].map((h) => h.numTreinos))
  const pontos = new Map()
  for (const e of exercicios) {
    const h = historico.get(e.id)
    if (!h) continue
    const frequencia = h.numTreinos / maxTreinos
    const antiguidade = Math.min(1, (new Date(agora) - new Date(h.ultima)) / (28 * DIA_MS))
    pontos.set(e.id, 0.5 * frequencia + 0.5 * antiguidade + 0.2 * sorteio() - (evitar.has(e.id) ? 2 : 0))
  }
  const porMusculo = new Map()
  for (const musculo of alvos) {
    porMusculo.set(
      musculo,
      exercicios
        .filter((e) => pontos.has(e.id) && (e.exercicio_musculos ?? []).some((m) => m.musculo === musculo && m.principal))
        .sort((a, b) => pontos.get(b.id) - pontos.get(a.id) || a.nome.localeCompare(b.nome, 'pt-PT'))
    )
  }
  return porMusculo
}

// 4 a 6 exercícios, alternando pelos músculos-alvo (2 alvos → 4, 3 alvos → 6), sem repetir.
// Devolve [{ exercicio, musculo }]
export function escolherExercicios(alvos, porMusculo) {
  const quantidade = Math.min(6, Math.max(4, alvos.length * 2))
  const itens = []
  const usados = new Set()
  const posicao = new Map(alvos.map((m) => [m, 0]))
  let avancou = true
  while (itens.length < quantidade && avancou) {
    avancou = false
    for (const musculo of alvos) {
      if (itens.length >= quantidade) break
      const lista = porMusculo.get(musculo) ?? []
      let i = posicao.get(musculo)
      while (i < lista.length && usados.has(lista[i].id)) i++
      posicao.set(musculo, i + 1)
      if (i < lista.length) {
        usados.add(lista[i].id)
        itens.push({ exercicio: lista[i], musculo })
        avancou = true
      }
    }
  }
  return itens
}

// "Trocar": o exercício seguinte da lista do mesmo músculo que ainda não esteja na sugestão
// (dá a volta à lista). Devolve os itens novos, ou null se não houver outro.
export function trocarExercicio(itens, indice, porMusculo) {
  const item = itens[indice]
  const lista = porMusculo.get(item.musculo) ?? []
  const naSugestao = new Set(itens.map((i) => i.exercicio.id))
  const atual = lista.findIndex((e) => e.id === item.exercicio.id)
  for (let passo = 1; passo <= lista.length; passo++) {
    const outro = lista[(atual + passo + lista.length) % lista.length]
    if (!naSugestao.has(outro.id)) return itens.map((x, i) => (i === indice ? { ...x, exercicio: outro } : x))
  }
  return null
}

// ---------- Estrutura ----------

// Junta pares de exercícios de músculos diferentes (pela ordem); os que sobram ficam sozinhos
export function agruparEmSuperSeries(itens) {
  const grupos = []
  const usados = new Set()
  itens.forEach((item, i) => {
    if (usados.has(i)) return
    usados.add(i)
    const par = itens.findIndex((outro, j) => !usados.has(j) && outro.musculo !== item.musculo)
    if (par === -1) return grupos.push([item])
    usados.add(par)
    grupos.push([item, itens[par]])
  })
  return grupos
}

// Um "treino" só com blocos (ids negativos, porque ainda não existem): Aquecimento com o primeiro
// exercício (2 voltas, 12 reps) e blocos Série de 3 voltas (ou Super séries, se superSeries) com as
// reps mais habituais de cada exercício. itens: [{ exercicio, musculo, reps? }]
export function montarEstrutura(itens, historico, { superSeries = false, titulo = 'Sugestão', agora } = {}) {
  let id = 0
  const proximoId = () => --id
  const linha = (item, ordem, reps) => ({
    id: proximoId(),
    ordem,
    exercicio_id: item.exercicio.id,
    reps_alvo: reps ?? item.reps ?? historico.get(item.exercicio.id)?.repsHabituais ?? REPS_PADRAO,
    peso_alvo: null,
    exercicios: item.exercicio,
  })
  const blocos = []
  if (itens.length > 0) {
    blocos.push({ id: proximoId(), ordem: 1, tipo: 'aquecimento', voltas: 2, notas: null, bloco_exercicios: [linha(itens[0], 1, REPS_AQUECIMENTO)] })
  }
  const grupos = superSeries ? agruparEmSuperSeries(itens) : itens.map((i) => [i])
  for (const grupo of grupos) {
    blocos.push({
      id: proximoId(),
      ordem: blocos.length + 1,
      tipo: grupo.length > 1 ? 'superserie' : 'serie',
      voltas: 3,
      notas: null,
      bloco_exercicios: grupo.map((item, j) => linha(item, j + 1)),
    })
  }
  return { id: 'ideia', data: agora ? new Date(agora).toISOString() : null, nome_favorito: titulo, blocos }
}

// ---------- Tudo junto ----------

// A sugestão automática. dados: { treinos (terminados, com séries), exercicios (com músculos),
// objetivos, agora, treinoEmCurso?, semente?, evitar? (ids da sugestão anterior), musculos? (escolhidos
// à mão: sem regra das 48 horas) }.
// Devolve { alvos, ignorouDescanso, manual, itens, porMusculo, insuficiente, historico, progresso }
export function gerarSugestao({ treinos, exercicios, objetivos, agora, treinoEmCurso = null, semente = 1, evitar = new Set(), musculos = null }) {
  const musculosPorExercicio = mapaMusculos(exercicios)
  const historico = historicoExercicios(treinos)
  const { valores } = seriesDaSemana(treinos, musculosPorExercicio, agora, treinoEmCurso)
  const progresso = progressoSemana(valores, objetivos)
  let alvos
  let ignorouDescanso = false
  const manual = Boolean(musculos?.length)
  if (manual) {
    alvos = musculos
  } else {
    const recentes = musculosRecentes(treinos, musculosPorExercicio, agora, treinoEmCurso)
    ;({ alvos, ignorouDescanso } = escolherMusculosAlvo(progresso, recentes))
  }
  const porMusculo = candidatosPorMusculo(alvos, exercicios, historico, { agora, semente, evitar })
  const itens = escolherExercicios(alvos, porMusculo)
  return { alvos, ignorouDescanso, manual, itens, porMusculo, insuficiente: itens.length < 4, historico, progresso }
}

