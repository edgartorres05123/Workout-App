// Som dos cronómetros (Web Audio API) e ecrã sempre ligado (Screen Wake Lock API).
// Tudo com recurso silencioso: se o browser não suportar, não faz nada.

let contexto = null

// Cria (ou retoma) o áudio. Tem de ser chamado dentro de um toque (por exemplo, em "Começar"):
// no iPhone, o áudio só é desbloqueado assim. Toca um som vazio para acabar de o desbloquear.
export function desbloquearSom() {
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext
    if (!Contexto) return
    if (!contexto) contexto = new Contexto()
    if (contexto.state === 'suspended') contexto.resume()
    const vazio = contexto.createBuffer(1, 1, 22050)
    const fonte = contexto.createBufferSource()
    fonte.buffer = vazio
    fonte.connect(contexto.destination)
    fonte.start(0)
  } catch {
    // sem áudio
  }
}

// Um bipe: 'contagem' (curto, os 3, 2, 1), 'intervalo' (fim de um intervalo) ou 'fim' (longo e mais alto)
export function bipe(tipo = 'contagem') {
  if (!contexto) return
  try {
    const { frequencia, duracao } = {
      contagem: { frequencia: 660, duracao: 0.12 },
      intervalo: { frequencia: 990, duracao: 0.25 },
      fim: { frequencia: 990, duracao: 0.6 },
    }[tipo] ?? { frequencia: 660, duracao: 0.12 }
    const agora = contexto.currentTime
    const oscilador = contexto.createOscillator()
    const volume = contexto.createGain()
    oscilador.type = 'sine'
    oscilador.frequency.value = frequencia
    volume.gain.setValueAtTime(0.0001, agora)
    volume.gain.exponentialRampToValueAtTime(0.4, agora + 0.01)
    volume.gain.exponentialRampToValueAtTime(0.0001, agora + duracao)
    oscilador.connect(volume)
    volume.connect(contexto.destination)
    oscilador.start(agora)
    oscilador.stop(agora + duracao + 0.02)
  } catch {
    // sem áudio
  }
}

// Pede para o ecrã não desligar. Devolve uma função para o largar (ou nada, se não for suportado).
export async function manterEcraLigado() {
  try {
    if (!('wakeLock' in navigator)) return () => {}
    const bloqueio = await navigator.wakeLock.request('screen')
    return () => {
      bloqueio.release().catch(() => {})
    }
  } catch {
    return () => {}
  }
}
