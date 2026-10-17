import { useEffect, useState } from 'react'
import { buscarTreinosParaCopiar } from './consultas'
import { estruturaParaCopiar, resumoEstrutura } from './blocos'
import { dataParaInput, formatarDataExtenso } from './formatar'

// Janela para começar um treino ('aoVivo') ou registar um treino passado ('passado').
// Dá para começar vazio ou copiar a estrutura (blocos, exercícios e alvos) de um treino anterior.
// onCriar({ data, duracao_min, estrutura }) devolve uma mensagem de erro, ou null se correu bem.
export default function NovoTreino({ modo, onCriar, onFechar }) {
  const passado = modo === 'passado'
  const [agora] = useState(() => new Date())
  const [data, setData] = useState(() => {
    // Por omissão, um treino passado começou há uma hora
    const inicio = new Date(agora)
    inicio.setHours(inicio.getHours() - 1, 0, 0, 0)
    return dataParaInput(inicio)
  })
  const [duracao, setDuracao] = useState('60')
  const [anteriores, setAnteriores] = useState(null) // null = a carregar
  const [origem, setOrigem] = useState(null) // treino a copiar, ou null = vazio
  const [aCriar, setACriar] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    buscarTreinosParaCopiar().then((resultado) => {
      if (!ativo) return
      if (resultado.erro) {
        setErro(resultado.erro)
        setAnteriores([])
      } else {
        setAnteriores(resultado.treinos)
      }
    })
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    function teclaPremida(e) {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', teclaPremida)
    return () => window.removeEventListener('keydown', teclaPremida)
  }, [onFechar])

  async function criar(e) {
    e.preventDefault()
    setErro('')
    let inicio = new Date()
    let duracaoMin = null
    if (passado) {
      inicio = new Date(data)
      duracaoMin = Number(duracao.trim())
      if (!data || Number.isNaN(inicio.getTime())) return setErro('Indica a data e a hora de início.')
      if (inicio > new Date()) return setErro('A data de início não pode ser no futuro.')
      if (!Number.isInteger(duracaoMin) || duracaoMin < 1 || duracaoMin > 1440) {
        return setErro('A duração tem de ser um número inteiro de minutos (mínimo 1).')
      }
    }
    setACriar(true)
    const mensagem = await onCriar({
      data: inicio.toISOString(),
      duracao_min: duracaoMin,
      estrutura: origem ? estruturaParaCopiar(origem) : [],
    })
    setACriar(false)
    if (mensagem) setErro(mensagem)
  }

  return (
    <div className="sheet-fundo" onClick={onFechar}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={passado ? 'Registar treino passado' : 'Começar treino'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-topo">
          <h2>{passado ? 'Registar treino passado' : 'Começar treino'}</h2>
          <button className="botao-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <form className="sheet-lista" onSubmit={criar}>
          {passado && (
            <div className="campos-treino sem-margem-topo">
              <label>
                <span>Data e hora de início</span>
                <input
                  type="datetime-local"
                  value={data}
                  max={dataParaInput(agora)}
                  onChange={(e) => setData(e.target.value)}
                />
              </label>
              <label>
                <span>Duração (min)</span>
                <input type="text" inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
              </label>
            </div>
          )}

          <h3 className="opcoes-titulo">Estrutura</h3>
          <div className="lista-origens">
            <button
              type="button"
              className={origem === null ? 'origem ativa' : 'origem'}
              onClick={() => setOrigem(null)}
              aria-pressed={origem === null}
            >
              <span className="origem-titulo">Treino vazio</span>
              <span className="origem-detalhe">Adicionas os blocos à medida que treinas.</span>
            </button>

            {anteriores === null && <p className="nota">A carregar os treinos anteriores...</p>}
            {anteriores?.length > 0 && <p className="nota">Ou copia os blocos, os exercícios e os alvos de um treino anterior:</p>}
            {anteriores?.map((t) => (
              <button
                key={t.id}
                type="button"
                className={origem?.id === t.id ? 'origem ativa' : 'origem'}
                onClick={() => setOrigem(t)}
                aria-pressed={origem?.id === t.id}
              >
                <span className="origem-titulo">{formatarDataExtenso(t.data)}</span>
                <span className="origem-detalhe">{resumoEstrutura(t)}</span>
              </button>
            ))}
          </div>

          {erro && <p className="erro">{erro}</p>}
          <button type="submit" className="botao-criar-bloco" disabled={aCriar}>
            {aCriar ? 'A preparar...' : passado ? 'Registar treino' : 'Começar treino'}
          </button>
        </form>
      </div>
    </div>
  )
}
