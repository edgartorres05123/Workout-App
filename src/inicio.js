// Cálculos do ecrã de início do separador Treino. Funções puras (o "agora" vem por argumento).
import { inicioSemana, sequenciasSemanas, serieTemporal, somarDias } from './estatisticas'
import { chaveDia } from './formatar'

// "Bom dia" (5h–12h), "Boa tarde" (12h–20h) ou "Boa noite"
export function saudacao(agora) {
  const hora = agora.getHours()
  if (hora >= 5 && hora < 12) return 'Bom dia'
  if (hora >= 12 && hora < 20) return 'Boa tarde'
  return 'Boa noite'
}

// "Edgar Torres" → "Edgar"; vazio → null
export function primeiroNome(nome) {
  const limpo = (nome ?? '').trim()
  return limpo ? limpo.split(/\s+/)[0] : null
}

const LETRAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

// Os 7 dias da semana atual (segunda a domingo): [{ chave, letra, dia, temTreino, hoje, futuro }]
export function diasDaSemanaAtual(treinos, agora) {
  const inicio = inicioSemana(agora)
  const comTreino = new Set(treinos.map((t) => chaveDia(t.data)))
  const hoje = chaveDia(agora)
  return LETRAS.map((letra, i) => {
    const data = somarDias(inicio, i)
    const chave = chaveDia(data)
    return { chave, letra, dia: data.getDate(), temTreino: comTreino.has(chave), hoje: chave === hoje, futuro: chave > hoje }
  })
}

// Treinos esta semana, sequência atual de semanas seguidas e volume desta semana.
// carga(serie, data): carga efetiva (por omissão, o peso da série)
export function resumoSemana(treinos, agora, carga) {
  const { treinosEstaSemana, atual } = sequenciasSemanas(treinos, agora)
  const [semana] = serieTemporal(treinos, 'volume', 'semana', agora, 1, carga)
  return { treinos: treinosEstaSemana, sequencia: atual, volume: semana.valor }
}

// Calorias desta semana: a soma das estimativas (ou das do relógio) dos treinos terminados desta semana.
// estimar(treino) → { kcal } (ver calorias.js). null se nenhum treino tiver valor (por exemplo, sem peso).
export function kcalDaSemana(treinos, agora, estimar) {
  const inicio = inicioSemana(agora)
  const fim = somarDias(inicio, 7)
  let total = 0
  let algum = false
  for (const t of treinos) {
    const data = new Date(t.data)
    if (data < inicio || data >= fim) continue
    const { kcal } = estimar(t)
    if (kcal === null) continue
    total += kcal
    algum = true
  }
  return algum ? total : null
}

// O treino mais recente, ou null
export function treinoMaisRecente(treinos) {
  return treinos.reduce((maisRecente, t) => (!maisRecente || new Date(t.data) > new Date(maisRecente.data) ? t : maisRecente), null)
}
