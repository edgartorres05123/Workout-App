// Blocos de condicionamento (Circuito, AMRAP e EMOM) e exercícios por tempo. Funções puras.
// Os resultados destes blocos são gravados como séries normais (uma por exercício e por volta ou
// intervalo), para o volume, os recordes, os músculos da semana e as sugestões continuarem a funcionar.
// Uma série por tempo tem repeticoes = 0 e duracao_seg > 0 (volume 0, mas conta como série).

export const TIPOS_CONDICIONAMENTO = ['circuito', 'amrap', 'emom']
export const ehCondicionamento = (tipo) => TIPOS_CONDICIONAMENTO.includes(tipo)

// Valores com que um bloco novo começa
export const DURACAO_AMRAP_INICIAL = 10 * 60
export const INTERVALO_EMOM_INICIAL = 60
export const SEGUNDOS_ALVO_INICIAIS = 30

// Um exercício do bloco é "por tempo" quando tem segundos_alvo (o reps_alvo é ignorado)
export const exercicioPorTempo = (be) => be?.segundos_alvo !== null && be?.segundos_alvo !== undefined

// Uma série é "por tempo" quando tem duração (e, nesse caso, repeticoes = 0)
export const seriePorTempo = (serie) => Number(serie?.duracao_seg) > 0

// ---------- Textos de tempo ----------

const dois = (n) => String(n).padStart(2, '0')

// Cronómetro: 754 → "12:34"; 3723 → "1:02:03"
export function formatarTempo(segundosTotais) {
  const total = Math.max(0, Math.floor(segundosTotais))
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const segundos = total % 60
  return horas > 0 ? `${horas}:${dois(minutos)}:${dois(segundos)}` : `${minutos}:${dois(segundos)}`
}

// Uma duração curta: 45 → "45 s"; 120 → "2 min"; 90 → "1 min 30 s"
export function textoSegundos(segundos) {
  const total = Math.round(Number(segundos))
  if (total < 60) return `${total} s`
  const minutos = Math.floor(total / 60)
  const resto = total % 60
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`
}

// ---------- EMOM ----------

// O exercício de cada intervalo (1, 2, 3...): com vários exercícios, alternam (A, B, C, A, B...)
export function exercicioDoIntervalo(exercicios, intervalo) {
  if (exercicios.length === 0) return null
  return exercicios[(intervalo - 1) % exercicios.length]
}

// A ordem dos intervalos: [{ intervalo, indice (do exercício), be }]
export function ordemEmom(exercicios, intervalos) {
  return Array.from({ length: intervalos }, (_, i) => {
    const indice = exercicios.length === 0 ? -1 : i % exercicios.length
    return { intervalo: i + 1, indice, be: exercicios[indice] ?? null }
  })
}

// Intervalos feitos (com séries) sobre o total: { feitos, total }
export function resultadoEmom(bloco, series) {
  const feitos = new Set(series.map((s) => s.volta)).size
  return { feitos, total: Math.max(bloco.voltas, feitos) }
}

// ---------- AMRAP ----------

const textoVoltas = (n) => `${n} ${n === 1 ? 'volta' : 'voltas'}`

// "7 voltas + 5 reps", "1 volta", "0 voltas + 5 reps"
export function textoResultadoAmrap({ voltas, repsExtra }) {
  return repsExtra > 0 ? `${textoVoltas(voltas)} + ${repsExtra} reps` : textoVoltas(voltas)
}

// Gera as séries de um AMRAP a partir de "voltas completas" e "reps extra" (texto escrito).
// exercicios: os bloco_exercicios pela ordem; pesos: Map(exercicio_id → kg) (por omissão, 0).
// Cada volta completa tem uma série por exercício (as reps-alvo, ou os segundos-alvo nos exercícios por
// tempo). As reps extra são a volta incompleta: distribuem-se pelos exercícios por reps, por ordem
// (os por tempo não entram nela). Devolve { series: [{ exercicio_id, volta, repeticoes, peso_kg,
// duracao_seg }], voltasBloco } ou { erro }. voltasBloco: as voltas registadas (mínimo 1).
export function gerarSeriesAmrap(exercicios, { voltas, repsExtra, pesos = new Map() }) {
  const textoVoltasEscritas = String(voltas ?? '').trim()
  const textoExtra = String(repsExtra ?? '').trim()
  const completas = textoVoltasEscritas === '' ? 0 : Number(textoVoltasEscritas)
  const extra = textoExtra === '' ? 0 : Number(textoExtra)
  if (!Number.isInteger(completas) || completas < 0 || completas > 500) {
    return { erro: 'As voltas completas têm de ser um número inteiro (0 ou mais).' }
  }
  if (!Number.isInteger(extra) || extra < 0) return { erro: 'As reps extra têm de ser um número inteiro (0 ou mais).' }
  if (completas === 0 && extra === 0) return { erro: 'Indica as voltas completas ou as reps extra.' }
  if (exercicios.length === 0) return { erro: 'O bloco não tem exercícios.' }

  const porReps = exercicios.filter((be) => !exercicioPorTempo(be))
  const repsPorVolta = porReps.reduce((soma, be) => soma + (be.reps_alvo ?? 0), 0)
  const temPorTempo = porReps.length < exercicios.length
  if (extra > 0 && repsPorVolta === 0) return { erro: 'Os exercícios deste AMRAP são por tempo: não há reps extra.' }
  if (extra > repsPorVolta || (extra === repsPorVolta && !temPorTempo)) {
    return { erro: `As reps extra são as da volta incompleta: menos de ${repsPorVolta} (uma volta completa).` }
  }

  const peso = (be) => Math.round(Number(pesos.get(be.exercicio_id) ?? be.peso_alvo ?? 0) * 100) / 100
  const series = []
  for (let volta = 1; volta <= completas; volta++) {
    for (const be of exercicios) {
      const tempo = exercicioPorTempo(be)
      series.push({
        exercicio_id: be.exercicio_id,
        volta,
        repeticoes: tempo ? 0 : be.reps_alvo,
        peso_kg: peso(be),
        duracao_seg: tempo ? be.segundos_alvo : null,
      })
    }
  }
  let restam = extra
  for (const be of porReps) {
    if (restam <= 0) break
    const reps = Math.min(restam, be.reps_alvo)
    series.push({ exercicio_id: be.exercicio_id, volta: completas + 1, repeticoes: reps, peso_kg: peso(be), duracao_seg: null })
    restam -= reps
  }
  return { series, voltasBloco: Math.max(1, completas + (extra > 0 ? 1 : 0)) }
}

// O resultado de um AMRAP a partir das séries gravadas: { voltas (completas), repsExtra } ou null.
// A última volta é a incompleta se lhe faltar algum exercício ou se tiver menos reps do que o alvo.
export function resultadoAmrap(bloco, series) {
  if (series.length === 0) return null
  const ultima = Math.max(...series.map((s) => s.volta ?? 0))
  const daUltima = series.filter((s) => s.volta === ultima)
  const incompleta = bloco.bloco_exercicios.some((be) => {
    const serie = daUltima.find((s) => s.exercicio_id === be.exercicio_id)
    if (!serie) return true
    return !exercicioPorTempo(be) && serie.repeticoes < be.reps_alvo
  })
  if (!incompleta) return { voltas: ultima, repsExtra: 0 }
  return { voltas: ultima - 1, repsExtra: daUltima.reduce((soma, s) => soma + s.repeticoes, 0) }
}
