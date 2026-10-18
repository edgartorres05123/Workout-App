// Cronómetro dos blocos de condicionamento, baseado em marcas de tempo (Date.now()) e não na contagem
// de intervalos: se a app for para segundo plano ou o ecrã bloquear, o tempo continua certo ao voltar.
// Funções puras (o "agora", em milissegundos, vem por argumento), para poderem ser testadas.
//   estado: { aCorrer, inicio (ms do último "Começar"/"Retomar", ou null), acumulado (ms antes disso), terminado }

export const CRONOMETRO_PARADO = { aCorrer: false, inicio: null, acumulado: 0, terminado: false }

// Tempo decorrido (ms): o acumulado mais o tempo desde o último "Começar", se estiver a correr
export function tempoDecorrido(estado, agora) {
  const desde = estado.aCorrer && estado.inicio !== null ? Math.max(0, agora - estado.inicio) : 0
  return Math.max(0, estado.acumulado + desde)
}

export function comecar(estado, agora) {
  if (estado.aCorrer) return estado
  return { ...estado, aCorrer: true, inicio: agora, terminado: false }
}

export function pausar(estado, agora) {
  if (!estado.aCorrer) return estado
  return { ...estado, aCorrer: false, inicio: null, acumulado: tempoDecorrido(estado, agora) }
}

// Para no tempo dado (por omissão, o atual) e marca como terminado
export function terminar(estado, agora, tempoFinal = null) {
  const acumulado = tempoFinal ?? tempoDecorrido(estado, agora)
  return { aCorrer: false, inicio: null, acumulado, terminado: true }
}

// Contagem decrescente: o que falta (ms), nunca abaixo de 0
export function tempoRestante(estado, agora, totalMs) {
  return Math.max(0, totalMs - tempoDecorrido(estado, agora))
}

// EMOM: em que intervalo vai (1..intervalos), quanto falta nele (ms) e se já acabaram todos
export function intervaloAtual(decorridoMs, intervaloMs, intervalos) {
  const total = intervaloMs * intervalos
  if (decorridoMs >= total) return { numero: intervalos, restanteMs: 0, acabou: true }
  const indice = Math.floor(decorridoMs / intervaloMs)
  return { numero: indice + 1, restanteMs: (indice + 1) * intervaloMs - decorridoMs, acabou: false }
}

// Segundos a mostrar: na contagem decrescente arredonda para cima ("0:03" até faltar 2 s)
export const segundosAMostrar = (ms, decrescente) => (decrescente ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))

// Os sons a tocar entre duas leituras do tempo decorrido (ms). fronteiras: os fins (ms) — o fim do AMRAP,
// o de cada intervalo do EMOM ou o limite do circuito. Devolve um Set com 'contagem' (os bipes 3, 2, 1
// antes de cada fim), 'intervalo' (fim de um intervalo que não é o último) e 'fim' (o último).
// Depois de um salto grande (a app esteve em segundo plano), não toca a contagem: só o fim, se passou.
export function sonsEntre(antesMs, depoisMs, fronteiras) {
  const sons = new Set()
  if (depoisMs <= antesMs || fronteiras.length === 0) return sons
  const ultima = Math.max(...fronteiras)
  const salto = depoisMs - antesMs > 2000
  for (const fim of fronteiras) {
    if (!salto) {
      for (const antes of [3000, 2000, 1000]) {
        const momento = fim - antes
        if (momento > 0 && antesMs < momento && depoisMs >= momento) sons.add('contagem')
      }
    }
    if (antesMs < fim && depoisMs >= fim) sons.add(fim === ultima ? 'fim' : 'intervalo')
  }
  return sons
}

// Lê o estado guardado (texto JSON do localStorage); inválido ou vazio → parado
export function lerEstado(texto) {
  try {
    const e = JSON.parse(texto)
    if (!e || typeof e !== 'object') return CRONOMETRO_PARADO
    const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    const inicio = numero(e.inicio)
    const aCorrer = e.aCorrer === true && inicio !== null
    return { aCorrer, inicio: aCorrer ? inicio : null, acumulado: Math.max(0, numero(e.acumulado) ?? 0), terminado: e.terminado === true }
  } catch {
    return CRONOMETRO_PARADO
  }
}
