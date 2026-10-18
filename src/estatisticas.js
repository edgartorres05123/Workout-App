// Cálculos de estatísticas. Recebem só dados de treinos terminados;
// as séries de aquecimento são sempre ignoradas. Datas na hora local; semanas começam à segunda.
// As funções são puras (o "agora" vem por argumento) para poderem ser testadas.
// carga(serie, dataDoTreino): o peso a usar em cada série. Nos exercícios de peso corporal inclui o
// corpo (ver pesoCorporal.js > criarCarga); por omissão é o peso gravado, como sempre foi.
import { calcular1RM, calcularVolume, chaveDia, melhorSerie } from './formatar'
import { MUSCULOS } from './musculos'
import { cargaSimples } from './pesoCorporal'

// ---------- Datas ----------

export function somarDias(data, dias) {
  const d = new Date(data)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias)
}

// Segunda-feira (às 00:00) da semana da data
export function inicioSemana(data) {
  const d = new Date(data)
  return somarDias(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7))
}

// "2026-10-17" -> Date local
export function dataDeChave(chave) {
  const [ano, mes, dia] = chave.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

// Início do período ('30d', '3m', '6m', '1a', 'sempre'); null = desde sempre
export function inicioPeriodo(periodo, agora) {
  const d = new Date(agora)
  const meses = { '3m': 3, '6m': 6, '1a': 12 }[periodo]
  if (periodo === '30d') return somarDias(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -30)
  if (meses) return new Date(d.getFullYear(), d.getMonth() - meses, d.getDate())
  return null
}

// ---------- Métricas de um treino ----------

const seriesNormais = (series) => series.filter((s) => !s.aquecimento)

// metrica: 'treinos' | 'volume' | 'duracao' (minutos) | 'series' (sem aquecimento)
export function metricaTreino(treino, metrica, carga = cargaSimples) {
  if (metrica === 'treinos') return 1
  if (metrica === 'volume') return volumeTreino(treino, carga)
  if (metrica === 'duracao') return treino.duracao_min ?? 0
  return seriesNormais(treino.series).length
}

// Volume de um treino com a carga efetiva de cada série
export function volumeTreino(treino, carga = cargaSimples) {
  return calcularVolume(treino.series, (s) => carga(s, treino.data))
}

// Totais da métrica: { mes, ano, sempre } (este mês e este ano do "agora")
export function resumoPeriodos(treinos, metrica, agora, carga = cargaSimples) {
  const resumo = { mes: 0, ano: 0, sempre: 0 }
  for (const treino of treinos) {
    const d = new Date(treino.data)
    const valor = metricaTreino(treino, metrica, carga)
    resumo.sempre += valor
    if (d.getFullYear() === agora.getFullYear()) {
      resumo.ano += valor
      if (d.getMonth() === agora.getMonth()) resumo.mes += valor
    }
  }
  return resumo
}

// Soma da métrica nas últimas `quantidade` semanas ou meses (incluindo o atual), das mais antigas
// para as mais recentes, com zeros onde não houve treinos: [{ inicio: Date, valor }]
export function serieTemporal(treinos, metrica, unidade, agora, quantidade = 12, carga = cargaSimples) {
  const chave = (data) => {
    const d = new Date(data)
    return unidade === 'semana' ? chaveDia(inicioSemana(d)) : `${d.getFullYear()}-${d.getMonth()}`
  }
  const baldes = []
  for (let i = quantidade - 1; i >= 0; i--) {
    const inicio =
      unidade === 'semana'
        ? somarDias(inicioSemana(agora), -7 * i)
        : new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    baldes.push({ inicio, chave: chave(inicio), valor: 0 })
  }
  const porChave = new Map(baldes.map((b) => [b.chave, b]))
  for (const treino of treinos) {
    const balde = porChave.get(chave(treino.data))
    if (balde) balde.valor += metricaTreino(treino, metrica, carga)
  }
  return baldes.map(({ inicio, valor }) => ({ inicio, valor }))
}

// ---------- Consistência ----------

// Map("2026-10-17" → { volume, treinos: [...] })
export function treinosPorDia(treinos, carga = cargaSimples) {
  const mapa = new Map()
  for (const treino of treinos) {
    const chave = chaveDia(treino.data)
    const dia = mapa.get(chave) ?? { volume: 0, treinos: [] }
    dia.volume += volumeTreino(treino, carga)
    dia.treinos.push(treino)
    mapa.set(chave, dia)
  }
  return mapa
}

// Grelha do mapa de calor: colunas = semanas (segunda a domingo), dos últimos `meses` meses até
// à semana atual. Cada dia: { chave, data, fora } (fora = antes do período ou no futuro).
export function grelhaCalor(agora, meses = 6) {
  const hoje = chaveDia(agora)
  const limite = chaveDia(new Date(agora.getFullYear(), agora.getMonth() - meses, agora.getDate() + 1))
  const ultimaSemana = inicioSemana(agora)
  const semanas = []
  for (let s = inicioSemana(dataDeChave(limite)); s <= ultimaSemana; s = somarDias(s, 7)) {
    semanas.push(
      Array.from({ length: 7 }, (_, i) => {
        const data = somarDias(s, i)
        const chave = chaveDia(data)
        return { chave, data, fora: chave < limite || chave > hoje }
      })
    )
  }
  return semanas
}

// Nível de cor (0 a 4) de um dia, proporcional ao volume do dia com mais volume
export function nivelCalor(volume, volumeMaximo, temTreino) {
  if (!temTreino) return 0
  if (volumeMaximo <= 0 || volume <= 0) return 1
  return Math.max(1, Math.ceil((volume / volumeMaximo) * 4))
}

// { treinosEstaSemana, atual, melhor }: sequências de semanas seguidas com pelo menos um treino.
// A sequência atual não se perde enquanto a semana atual ainda não acabou.
export function sequenciasSemanas(treinos, agora) {
  const semanas = new Set(treinos.map((t) => chaveDia(inicioSemana(t.data))))
  const estaSemana = chaveDia(inicioSemana(agora))

  let cursor = inicioSemana(agora)
  if (!semanas.has(estaSemana)) cursor = somarDias(cursor, -7)
  let atual = 0
  while (semanas.has(chaveDia(cursor))) {
    atual += 1
    cursor = somarDias(cursor, -7)
  }

  let melhor = 0
  let corrida = 0
  let anterior = null
  for (const chave of [...semanas].sort()) {
    corrida = anterior && chaveDia(somarDias(dataDeChave(anterior), 7)) === chave ? corrida + 1 : 1
    melhor = Math.max(melhor, corrida)
    anterior = chave
  }

  return {
    treinosEstaSemana: treinos.filter((t) => chaveDia(inicioSemana(t.data)) === estaSemana).length,
    atual,
    melhor,
  }
}

// ---------- Recordes ----------

// Maior peso (empate: mais reps), mais reps (empate: mais peso), maior volume num treino e
// treino mais longo. Cada um é null se não houver dados. O maior peso e as mais reps trazem
// também `carga` (a carga efetiva da série).
export function recordesGerais(treinos, carga = cargaSimples) {
  let maiorPeso = null
  let maisReps = null
  let maiorVolume = null
  let maisLongo = null

  for (const treino of treinos) {
    const volume = volumeTreino(treino, carga)
    if (!maiorVolume || volume > maiorVolume.valor) maiorVolume = { treino, valor: volume }
    if (!maisLongo || (treino.duracao_min ?? 0) > maisLongo.valor) {
      maisLongo = { treino, valor: treino.duracao_min ?? 0 }
    }

    for (const serie of seriesNormais(treino.series)) {
      const peso = carga(serie, treino.data)
      if (
        !maiorPeso ||
        peso > maiorPeso.carga ||
        (peso === maiorPeso.carga && serie.repeticoes > maiorPeso.serie.repeticoes)
      ) {
        maiorPeso = { serie, treino, carga: peso }
      }
      if (
        !maisReps ||
        serie.repeticoes > maisReps.serie.repeticoes ||
        (serie.repeticoes === maisReps.serie.repeticoes && peso > maisReps.carga)
      ) {
        maisReps = { serie, treino, carga: peso }
      }
    }
  }
  return { maiorPeso, maisReps, maiorVolume, maisLongo }
}

// ---------- Músculos ----------

// Volume atribuído a cada músculo desde `desde` (null = sempre): o principal recebe 100% do
// volume da série e os secundários 50%. musculosPorExercicio: Map(exercicio_id → [{ musculo, principal }]).
// Devolve { valores: Map(musculo → volume), total, semMusculos: Set(exercicio_id) }
export function volumePorMusculo(treinos, musculosPorExercicio, desde = null, carga = cargaSimples) {
  const valores = new Map(MUSCULOS.map((m) => [m.id, 0]))
  const semMusculos = new Set()

  for (const treino of treinos) {
    if (desde && new Date(treino.data) < desde) continue
    for (const serie of seriesNormais(treino.series)) {
      const volume = serie.repeticoes * carga(serie, treino.data)
      if (volume <= 0) continue
      const musculos = musculosPorExercicio.get(serie.exercicio_id) ?? []
      if (musculos.length === 0) {
        semMusculos.add(serie.exercicio_id)
        continue
      }
      for (const m of musculos) {
        valores.set(m.musculo, (valores.get(m.musculo) ?? 0) + volume * (m.principal ? 1 : 0.5))
      }
    }
  }

  let total = 0
  for (const v of valores.values()) total += v
  return { valores, total, semMusculos }
}

// ---------- Evolução de um exercício ----------

// Um ponto por sessão (das mais antigas para as mais recentes): { treino, valor, serie, recorde }.
// metrica: '1rm' | 'peso' | 'volume' | 'reps'. `serie` é a melhor série (null para o volume).
// recorde = o valor bateu todos os anteriores no momento em que aconteceu (a 1.ª sessão não conta).
export function evolucaoExercicio(series, metrica, carga = cargaSimples) {
  const pontos = []
  let maximo = -Infinity

  for (const { treino, series: daSessao } of sessoesPorTreino(series).reverse()) {
    const normais = seriesNormais(daSessao)
    if (normais.length === 0) continue
    const pesoDe = (s) => carga(s, treino.data)

    let serie = null
    let valor
    if (metrica === 'volume') {
      valor = calcularVolume(normais, pesoDe)
    } else if (metrica === '1rm') {
      serie = melhorSerie(normais, pesoDe)
      valor = calcular1RM(serie.repeticoes, pesoDe(serie))
    } else {
      // 'peso': maior peso (empate: mais reps); 'reps': mais reps (empate: mais peso)
      const [principal, desempate] =
        metrica === 'peso' ? [pesoDe, (s) => s.repeticoes] : [(s) => s.repeticoes, pesoDe]
      serie = normais.reduce((melhor, s) =>
        principal(s) > principal(melhor) ||
        (principal(s) === principal(melhor) && desempate(s) > desempate(melhor))
          ? s
          : melhor
      )
      valor = principal(serie)
    }

    pontos.push({ treino, valor, serie, recorde: pontos.length > 0 && valor > maximo })
    maximo = Math.max(maximo, valor)
  }
  return pontos
}

// ---------- Repetição máxima estimada (eRM) ----------

// 1RM pela fórmula de Brzycki: peso × 36 / (37 − reps). Não é válida a partir de 37 reps (null).
export function calcular1RMBrzycki(repeticoes, pesoKg) {
  const peso = Number(pesoKg)
  if (repeticoes === 1) return peso
  if (repeticoes >= 37) return null
  return (peso * 36) / (37 - repeticoes)
}

// nRM estimado a partir de uma série, pelas duas fórmulas: primeiro o 1RM e depois a fórmula
// invertida para n repetições. Devolve { epley, brzycki, min, max } (brzycki pode ser null).
export function estimarRM(repeticoes, pesoKg, n) {
  const epley1RM = calcular1RM(repeticoes, pesoKg)
  const brzycki1RM = calcular1RMBrzycki(repeticoes, pesoKg)
  const epley = n === 1 ? epley1RM : epley1RM / (1 + n / 30)
  const brzycki = brzycki1RM === null ? null : n === 1 ? brzycki1RM : (brzycki1RM * (37 - n)) / 36
  const valores = brzycki === null ? [epley] : [epley, brzycki]
  return { epley, brzycki, min: Math.min(...valores), max: Math.max(...valores) }
}

// Precisão da estimativa conforme as reps da série de origem
export function precisaoEstimativa(repeticoes) {
  if (repeticoes <= 5) return 'alta'
  if (repeticoes <= 10) return 'media'
  return 'baixa'
}

// ---------- Exercícios ----------

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
// Devolve null se não houver séries normais. recordeCarga é a carga efetiva do recorde de peso.
export function resumoExercicio(series, carga = cargaSimples) {
  const normais = series.filter((s) => !s.aquecimento)
  if (normais.length === 0) return null
  const pesoDe = (s) => carga(s, s.treinos.data)

  let recordePeso = normais[0]
  let maisReps = normais[0]
  let primeira = normais[0].treinos.data
  let ultima = normais[0].treinos.data

  for (const s of normais) {
    const peso = pesoDe(s)
    const pesoRecorde = pesoDe(recordePeso)
    // Em caso de empate no peso, conta a série com mais repetições (e vice-versa)
    if (peso > pesoRecorde || (peso === pesoRecorde && s.repeticoes > recordePeso.repeticoes)) {
      recordePeso = s
    }
    if (
      s.repeticoes > maisReps.repeticoes ||
      (s.repeticoes === maisReps.repeticoes && peso > pesoDe(maisReps))
    ) {
      maisReps = s
    }
    if (new Date(s.treinos.data) < new Date(primeira)) primeira = s.treinos.data
    if (new Date(s.treinos.data) > new Date(ultima)) ultima = s.treinos.data
  }

  const melhor = melhorSerie(normais, pesoDe)
  return {
    numTreinos: new Set(normais.map((s) => s.treino_id)).size,
    primeira,
    ultima,
    recordePeso,
    recordeCarga: pesoDe(recordePeso),
    maisReps,
    melhor,
    melhor1RM: calcular1RM(melhor.repeticoes, pesoDe(melhor)),
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
