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
