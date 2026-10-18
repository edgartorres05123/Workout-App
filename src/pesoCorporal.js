// Exercícios de peso corporal (elevações, fundos, flexões...). Nestes exercícios, series.peso_kg é o
// PESO EXTRA (0, positivo com cinto ou colete, negativo quando é assistido). O peso corporal não fica
// na série: vem das medições, na data do treino. Funções puras, para poderem ser testadas.
import { chaveDia, formatarPeso } from './formatar'

const arredondar = (valor) => Math.round(valor * 100) / 100

// Peso corporal numa data: o da medição mais recente com data igual ou anterior; se não houver
// nenhuma anterior, o da mais antiga que existir; sem medições, null (desconhecido).
// No mesmo dia, conta a medição criada por último. medicoes: [{ id, data: "2026-10-17", peso_kg }]
export function pesoCorporalNaData(medicoes, data) {
  if (!medicoes?.length) return null
  const dia = chaveDia(data)
  let anterior = null
  let maisAntiga = null
  for (const m of medicoes) {
    if (m.peso_kg === null || m.peso_kg === undefined) continue
    const depoisDe = (a, b) => a.data > b.data || (a.data === b.data && Number(a.id) > Number(b.id))
    if (!maisAntiga || depoisDe(maisAntiga, m)) maisAntiga = m
    if (m.data <= dia && (!anterior || depoisDe(m, anterior))) anterior = m
  }
  const escolhida = anterior ?? maisAntiga
  return escolhida ? Number(escolhida.peso_kg) : null
}

// Carga sem peso corporal: o que está na série (é o que os exercícios normais sempre usaram)
export const cargaSimples = (serie) => Number(serie.peso_kg)

// Carga efetiva de uma série = peso_kg + (exercício de peso corporal ? peso corporal : 0).
// Com o peso corporal desconhecido (null), conta só o extra (um extra negativo, assistido, conta 0:
// sem o peso do corpo não há como saber a carga, e o volume nunca fica negativo).
export function cargaEfetiva(serie, exercicio, pesoCorporal) {
  const extra = Number(serie.peso_kg)
  if (!exercicio?.peso_corporal) return extra
  if (pesoCorporal === null || pesoCorporal === undefined) return Math.max(0, extra)
  return arredondar(extra + Number(pesoCorporal))
}

// Cria a função carga(serie, dataDoTreino) usada nos cálculos (volume, recordes, 1RM, ...).
// ehPesoCorporal(serie) diz se o exercício da série é de peso corporal; por omissão lê
// serie.exercicios.peso_corporal (as consultas trazem-no aninhado).
export function criarCarga(medicoes, ehPesoCorporal = (serie) => Boolean(serie.exercicios?.peso_corporal)) {
  const porDia = new Map()
  return (serie, data) => {
    if (!ehPesoCorporal(serie)) return Number(serie.peso_kg)
    const dia = chaveDia(data)
    if (!porDia.has(dia)) porDia.set(dia, pesoCorporalNaData(medicoes, data))
    return cargaEfetiva(serie, { peso_corporal: true }, porDia.get(dia))
  }
}

// ---------- Textos ----------

// O peso de uma série: "60 kg"; de peso corporal: "PC", "PC + 10 kg" ou "PC − 20 kg"
export function textoCarga(pesoKg, pesoCorporal = false) {
  const peso = Number(pesoKg)
  if (!pesoCorporal) return `${formatarPeso(peso)} kg`
  if (!peso) return 'PC'
  return `PC ${peso > 0 ? '+' : '−'} ${formatarPeso(Math.abs(peso))} kg`
}

// Uma série: "10 × 60 kg", "10 × PC", "10 × PC + 10 kg", "10 × PC − 20 kg"
export function textoSerie(repeticoes, pesoKg, pesoCorporal = false) {
  return `${repeticoes} × ${textoCarga(pesoKg, pesoCorporal)}`
}

// Só a decomposição: "PC 74,5 + 10", "PC 74,5", "PC 74,5 − 20"; sem peso corporal conhecido, null
export function decomposicaoCarga(extraKg, pesoCorporalKg) {
  if (pesoCorporalKg === null || pesoCorporalKg === undefined) return null
  const extra = Number(extraKg)
  const parcela = extra === 0 ? '' : ` ${extra > 0 ? '+' : '−'} ${formatarPeso(Math.abs(extra))}`
  return `PC ${formatarPeso(Number(pesoCorporalKg))}${parcela}`
}

// A carga efetiva com a decomposição: "84,5 kg (PC 74,5 + 10)", "74,5 kg (PC 74,5)",
// "54,5 kg (PC 74,5 − 20)". Sem peso corporal conhecido: "PC + 10 kg".
export function textoCargaEfetiva(extraKg, pesoCorporalKg) {
  const extra = Number(extraKg)
  if (pesoCorporalKg === null || pesoCorporalKg === undefined) return textoCarga(extra, true)
  const total = arredondar(Number(pesoCorporalKg) + extra)
  return `${formatarPeso(total)} kg (${decomposicaoCarga(extra, pesoCorporalKg)})`
}
