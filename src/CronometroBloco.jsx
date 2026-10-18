import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Flag, Maximize2, Minimize2, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { formatarTempo } from './condicionamento'
import {
  CRONOMETRO_PARADO,
  comecar,
  intervaloAtual,
  lerEstado,
  pausar,
  segundosAMostrar,
  sonsEntre,
  tempoDecorrido,
  tempoRestante,
  terminar,
} from './cronometro'
import { vibrar } from './movimento'
import { bipe, desbloquearSom, manterEcraLigado } from './som'

const CHAVE_MUDO = 'cronometro-mudo'

// localStorage com try/catch (pode não existir, por exemplo numa janela privada)
function ler(chave) {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}
function gravar(chave, valor) {
  try {
    if (valor === null) localStorage.removeItem(chave)
    else localStorage.setItem(chave, valor)
  } catch {
    // sem armazenamento: o cronómetro funciona na mesma, só não sobrevive a recarregar
  }
}

// Cronómetro dos blocos de condicionamento, com números grandes e um modo de ecrã cheio.
//   modo 'crescente': conta para cima até "Terminar" (circuito por tempo; totalSeg = limite opcional)
//   modo 'decrescente': conta para baixo a partir de totalSeg (AMRAP)
//   modo 'emom': intervalos de intervaloSeg, `intervalos` vezes; renderIntervalo(numero) mostra o
//   exercício desse intervalo
// O tempo vem de marcas de tempo (ver cronometro.js) e o estado fica no localStorage em `chave`, por isso
// sobrevive ao ecrã bloquear e a recarregar a página. Bipes 3, 2, 1 antes de cada fim e um bipe final
// (com botão para silenciar), vibração e ecrã sempre ligado enquanto corre.
// tipo: o tipo do bloco (para a cor, também em ecrã cheio).
// onFim(segundos): acabou o tempo (decrescente e emom) ou carregou-se em "Terminar" (crescente).
export default function CronometroBloco({
  chave,
  tipo,
  modo,
  totalSeg = null,
  intervaloSeg = 60,
  intervalos = 1,
  renderIntervalo,
  onFim,
  textoTerminar = 'Terminar',
}) {
  const [estado, setEstado] = useState(() => lerEstado(ler(chave)))
  const [agora, setAgora] = useState(() => Date.now())
  const [mudo, setMudo] = useState(() => ler(CHAVE_MUDO) === '1')
  const [ecraCheio, setEcraCheio] = useState(false)
  const anterior = useRef(null) // o tempo decorrido na leitura anterior (para saber que sons tocar)
  const refOnFim = useRef(onFim)
  const refMudo = useRef(mudo)

  useEffect(() => {
    refOnFim.current = onFim
    refMudo.current = mudo
  })

  const intervaloMs = intervaloSeg * 1000
  const totalMs = modo === 'emom' ? intervaloMs * intervalos : totalSeg ? totalSeg * 1000 : null

  // Guarda o estado (parado e a zero não ocupa espaço)
  useEffect(() => {
    const vazio = !estado.aCorrer && !estado.terminado && estado.acumulado === 0
    gravar(chave, vazio ? null : JSON.stringify(estado))
  }, [chave, estado])

  // A cada 200 ms (só enquanto corre): atualiza o ecrã, toca os sons e para no fim
  useEffect(() => {
    if (!estado.aCorrer) return
    const fronteiras =
      modo === 'emom'
        ? Array.from({ length: intervalos }, (_, i) => (i + 1) * intervaloMs)
        : totalMs !== null
          ? [totalMs]
          : []
    const id = setInterval(() => {
      const t = Date.now()
      const decorrido = tempoDecorrido(estado, t)
      const antes = anterior.current ?? decorrido
      anterior.current = decorrido
      const sons = sonsEntre(antes, decorrido, fronteiras)
      if (sons.size > 0) {
        const tipo = sons.has('fim') ? 'fim' : sons.has('intervalo') ? 'intervalo' : 'contagem'
        if (!refMudo.current) bipe(tipo)
        vibrar(tipo === 'fim' ? [200, 100, 200] : tipo === 'intervalo' ? 120 : 40)
      }
      if (modo !== 'crescente' && totalMs !== null && decorrido >= totalMs) {
        setEstado(terminar(estado, t, totalMs))
        refOnFim.current?.(Math.round(totalMs / 1000))
      }
      setAgora(t)
    }, 200)
    return () => clearInterval(id)
  }, [estado, modo, totalMs, intervaloMs, intervalos])

  // Ecrã sempre ligado enquanto corre (volta a pedir quando a app regressa ao primeiro plano)
  useEffect(() => {
    if (!estado.aCorrer) return
    let vivo = true
    let largar = null
    const pedir = () =>
      manterEcraLigado().then((f) => {
        if (!vivo) return f()
        largar?.()
        largar = f
      })
    pedir()
    const aoVoltar = () => document.visibilityState === 'visible' && pedir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      vivo = false
      largar?.()
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [estado.aCorrer])

  // Esc sai do ecrã cheio
  useEffect(() => {
    if (!ecraCheio) return
    const tecla = (e) => e.key === 'Escape' && setEcraCheio(false)
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ecraCheio])

  function iniciar() {
    desbloquearSom() // tem de ser dentro do toque, por causa do iPhone
    const t = Date.now()
    anterior.current = tempoDecorrido(estado, t)
    setEstado(comecar(estado, t))
    setAgora(t)
  }

  function parar() {
    const t = Date.now()
    setEstado(pausar(estado, t))
    setAgora(t)
  }

  function acabar() {
    const t = Date.now()
    const decorrido = tempoDecorrido(estado, t)
    setEstado(terminar(estado, t))
    setAgora(t)
    onFim?.(Math.round(decorrido / 1000))
  }

  function repor() {
    anterior.current = null
    setEstado(CRONOMETRO_PARADO)
  }

  function alternarSom() {
    const novo = !mudo
    setMudo(novo)
    gravar(CHAVE_MUDO, novo ? '1' : null)
  }

  const decorrido = tempoDecorrido(estado, agora)
  const intervalo = modo === 'emom' ? intervaloAtual(decorrido, intervaloMs, intervalos) : null
  const segundos =
    modo === 'emom'
      ? segundosAMostrar(intervalo.restanteMs, true)
      : modo === 'decrescente'
        ? segundosAMostrar(tempoRestante(estado, agora, totalMs ?? 0), true)
        : segundosAMostrar(decorrido, false)
  const comecado = decorrido > 0 || estado.aCorrer
  const passouLimite = modo === 'crescente' && totalMs !== null && decorrido >= totalMs
  const ultimos = (modo !== 'crescente' && estado.aCorrer && segundos <= 3 && segundos > 0) || passouLimite

  const conteudo = (
    <div
      className={`cronometro tipo-${tipo}${ecraCheio ? ' ecra-cheio' : ''}${estado.aCorrer ? ' a-correr' : ''}${estado.terminado ? ' terminado' : ''}`}
      role={ecraCheio ? 'dialog' : undefined}
      aria-modal={ecraCheio ? 'true' : undefined}
      aria-label={ecraCheio ? 'Cronómetro em ecrã cheio' : undefined}
    >
      {intervalo && (
        <p className="cronometro-intervalo">
          Intervalo <strong>{intervalo.numero}/{intervalos}</strong>
        </p>
      )}
      <p className={ultimos ? 'cronometro-tempo ultimos' : 'cronometro-tempo'} role="timer" aria-live="off">
        {formatarTempo(segundos)}
      </p>
      {intervalo && renderIntervalo?.(intervalo.numero)}
      {modo === 'crescente' && totalMs !== null && (
        <p className="cronometro-nota">
          {passouLimite ? 'Passou o limite de ' : 'Limite: '}
          {formatarTempo(totalMs / 1000)}
        </p>
      )}
      {estado.terminado && <p className="cronometro-nota">Terminado</p>}

      <div className="cronometro-botoes">
        {!estado.aCorrer && !estado.terminado && (
          <button className="cronometro-principal com-icone" onClick={iniciar}>
            <Play size={20} />
            {comecado ? 'Retomar' : 'Começar'}
          </button>
        )}
        {estado.aCorrer && (
          <button className="cronometro-principal secundario com-icone" onClick={parar}>
            <Pause size={20} />
            Pausa
          </button>
        )}
        {modo === 'crescente' && comecado && !estado.terminado && (
          <button className="cronometro-principal com-icone" onClick={acabar}>
            <Flag size={18} />
            {textoTerminar}
          </button>
        )}
        {modo !== 'crescente' && comecado && !estado.terminado && !estado.aCorrer && onFim && (
          <button className="botao-icone" onClick={acabar} aria-label="Terminar já" title="Terminar já">
            <Flag size={18} />
          </button>
        )}
        {comecado && !estado.aCorrer && (
          <button className="botao-icone" onClick={repor} aria-label="Pôr o cronómetro a zero" title="Pôr a zero">
            <RotateCcw size={18} />
          </button>
        )}
        <button
          className="botao-icone"
          onClick={alternarSom}
          aria-pressed={mudo}
          aria-label={mudo ? 'Ligar o som' : 'Silenciar'}
          title={mudo ? 'Ligar o som' : 'Silenciar'}
        >
          {mudo ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          className="botao-icone"
          onClick={() => setEcraCheio((e) => !e)}
          aria-label={ecraCheio ? 'Sair do ecrã cheio' : 'Ecrã cheio'}
          title={ecraCheio ? 'Sair do ecrã cheio' : 'Ecrã cheio'}
        >
          {ecraCheio ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </div>
  )

  // Em ecrã cheio, fica por cima de tudo (fora do cartão, para nada o cortar)
  return ecraCheio ? (
    <>
      <div className="cronometro cronometro-lugar" aria-hidden="true" />
      {createPortal(conteudo, document.body)}
    </>
  ) : (
    conteudo
  )
}
