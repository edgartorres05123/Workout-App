// Funções de formatação e cálculo partilhadas pelos ecrãs (treino, histórico, estatísticas)

const formatoPeso = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 })

// 62.5 -> "62,5"
export function formatarPeso(kg) {
  return formatoPeso.format(Number(kg))
}

// Valor para pôr num input (sem separador de milhares): 62.5 -> "62,5"
export function pesoParaInput(kg) {
  return String(Number(kg)).replace('.', ',')
}

// Lê um número escrito pelo utilizador, aceitando vírgula ou ponto. Devolve null se for inválido.
export function lerNumero(texto) {
  const limpo = String(texto).trim().replace(',', '.')
  if (limpo === '') return null
  const numero = Number(limpo)
  return Number.isFinite(numero) ? numero : null
}

// Soma de repetições × peso, sem contar as séries de aquecimento
export function calcularVolume(series) {
  return series
    .filter((s) => !s.aquecimento)
    .reduce((total, s) => total + s.repeticoes * Number(s.peso_kg), 0)
}

// 754 -> "12:34"; 3754 -> "1:02:34"
export function formatarCronometro(segundosTotais) {
  const s = Math.max(0, Math.floor(segundosTotais))
  const horas = Math.floor(s / 3600)
  const minutos = Math.floor((s % 3600) / 60)
  const segundos = s % 60
  const mmss = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`
  return horas > 0 ? `${horas}:${mmss}` : mmss
}

// 45 -> "45 min"; 75 -> "1 h 15 min"
export function formatarMinutos(minutosTotais) {
  const horas = Math.floor(minutosTotais / 60)
  const minutos = minutosTotais % 60
  if (horas === 0) return `${minutos} min`
  return minutos === 0 ? `${horas} h` : `${horas} h ${minutos} min`
}

// "Sábado, 17 de outubro de 2026"
export function formatarDataExtenso(data) {
  const texto = new Date(data).toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const formatoCompacto = new Intl.NumberFormat('pt-PT', { notation: 'compact', maximumFractionDigits: 1 })

// Números grandes abreviados: 9876 -> "9876"; 397600 -> "397,6 mil"; 2400000 -> "2,4 M"
export function abreviarNumero(numero) {
  const n = Number(numero)
  return Math.abs(n) < 10000 ? formatoPeso.format(Math.round(n)) : formatoCompacto.format(n)
}

// "17/10/2026"
export function formatarDataCurta(data) {
  return new Date(data).toLocaleDateString('pt-PT')
}

// Minúsculas e sem acentos, para pesquisar "supino" e encontrar "Supino" ou "Supíno"
export function normalizarTexto(texto) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

// Limpa um nome escrito pelo utilizador: "  Supino   plano " -> "Supino plano"
export function limparNome(texto) {
  return texto.trim().replace(/\s+/g, ' ')
}

// Dois nomes são o mesmo exercício se só diferirem em maiúsculas, acentos ou espaços
export function nomesIguais(a, b) {
  return normalizarTexto(limparNome(a)) === normalizarTexto(limparNome(b))
}

// "18:30"
export function formatarHora(data) {
  return new Date(data).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

// "outubro de 2026"
export function formatarMes(data) {
  return new Date(data).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

// Identifica um dia na hora local: "2026-10-17"
export function chaveDia(data) {
  const d = new Date(data)
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Valor para um input datetime-local, na hora local: "2026-10-17T18:30"
export function dataParaInput(data) {
  const d = new Date(data)
  const horas = String(d.getHours()).padStart(2, '0')
  const minutos = String(d.getMinutes()).padStart(2, '0')
  return `${chaveDia(d)}T${horas}:${minutos}`
}

// Agrupa as séries (com o exercício aninhado em s.exercicios) por exercício,
// pela ordem da primeira série de cada um: [{ exercicio, series }]
export function agruparPorExercicio(series) {
  const grupos = new Map()
  for (const s of [...series].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))) {
    if (!grupos.has(s.exercicio_id)) grupos.set(s.exercicio_id, { exercicio: s.exercicios, series: [] })
    grupos.get(s.exercicio_id).series.push(s)
  }
  return [...grupos.values()]
}

// As séries de aquecimento mostram "A" e não contam para a numeração: ['A', '1', '2']
export function rotulosSeries(series) {
  let contador = 0
  return series.map((s) => (s.aquecimento ? 'A' : String(++contador)))
}

// 1RM estimado pela fórmula de Epley; com 1 repetição é o próprio peso
export function calcular1RM(repeticoes, pesoKg) {
  const peso = Number(pesoKg)
  return repeticoes === 1 ? peso : peso * (1 + repeticoes / 30)
}

// A série (sem aquecimento) com maior 1RM estimado, ou null
export function melhorSerie(series) {
  let melhor = null
  for (const s of series) {
    if (s.aquecimento) continue
    if (!melhor || calcular1RM(s.repeticoes, s.peso_kg) > calcular1RM(melhor.repeticoes, melhor.peso_kg)) {
      melhor = s
    }
  }
  return melhor
}
