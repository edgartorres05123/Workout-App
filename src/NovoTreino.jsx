import { useEffect, useState } from 'react'
import { CalendarPlus, Play, Plus, Star } from 'lucide-react'
import { buscarFavoritos, buscarTreinosParaCopiar } from './consultas'
import Esqueleto from './Esqueleto'
import Janela from './Janela'
import { estruturaParaCopiar, resumoEstrutura } from './blocos'
import { dataParaInput, formatarDataExtenso } from './formatar'

// Janela para começar um treino ('aoVivo') ou registar um treino passado ('passado').
// Dá para começar vazio ou copiar a estrutura (blocos, exercícios e alvos) de um treino anterior;
// os favoritos aparecem primeiro. origemInicial: um treino já escolhido (vindo dos favoritos).
// onCriar({ data, duracao_min, estrutura }) devolve uma mensagem de erro, ou null se correu bem.
export default function NovoTreino({ modo, origemInicial = null, onCriar, onFechar }) {
  const passado = modo === 'passado'
  const [agora] = useState(() => new Date())
  const [data, setData] = useState(() => {
    // Por omissão, um treino passado começou há uma hora
    const inicio = new Date(agora)
    inicio.setHours(inicio.getHours() - 1, 0, 0, 0)
    return dataParaInput(inicio)
  })
  const [duracao, setDuracao] = useState('60')
  const [anteriores, setAnteriores] = useState(null) // { favoritos, recentes }; null = a carregar
  const [origem, setOrigem] = useState(origemInicial) // treino a copiar, ou null = vazio
  const [aCriar, setACriar] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    Promise.all([buscarFavoritos(), buscarTreinosParaCopiar()]).then(([favoritos, recentes]) => {
      if (!ativo) return
      const falhou = favoritos.erro ?? recentes.erro
      if (falhou) setErro(falhou)
      const listaFavoritos = (favoritos.favoritos ?? []).filter((t) => t.blocos.length > 0)
      const idsFavoritos = new Set(listaFavoritos.map((t) => t.id))
      setAnteriores({
        favoritos: listaFavoritos,
        // Os treinos recentes sem repetir os que já estão nos favoritos
        recentes: (recentes.treinos ?? []).filter((t) => !idsFavoritos.has(t.id)),
      })
    })
    return () => {
      ativo = false
    }
  }, [])

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
    <Janela titulo={passado ? 'Registar treino passado' : 'Começar treino'} onFechar={onFechar}>
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
              <label className="campo-duracao">
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
              <span className="origem-titulo com-icone">
                <Plus size={16} />
                Treino vazio
              </span>
              <span className="origem-detalhe">Adicionas os blocos à medida que treinas.</span>
            </button>

            {anteriores === null && <Esqueleto cartoes={3} linhas={2} />}

            {anteriores?.favoritos.length > 0 && (
              <p className="nota com-icone">
                <Star size={14} aria-hidden="true" />
                Favoritos
              </p>
            )}
            {anteriores?.favoritos.map((t) => (
              <BotaoOrigem key={t.id} treino={t} titulo={t.nome_favorito || formatarDataExtenso(t.data)} favorito origem={origem} onEscolher={setOrigem} />
            ))}

            {anteriores?.recentes.length > 0 && (
              <p className="nota">Ou copia os blocos, os exercícios e os alvos de um treino anterior:</p>
            )}
            {anteriores?.recentes.map((t) => (
              <BotaoOrigem key={t.id} treino={t} titulo={formatarDataExtenso(t.data)} origem={origem} onEscolher={setOrigem} />
            ))}
          </div>

          {erro && <p className="erro">{erro}</p>}
          <button type="submit" className="botao-criar-bloco com-icone" disabled={aCriar}>
            {passado ? <CalendarPlus size={18} /> : <Play size={18} />}
            {aCriar ? 'A preparar...' : passado ? 'Registar treino' : 'Começar treino'}
          </button>
        </form>
    </Janela>
  )
}

function BotaoOrigem({ treino, titulo, favorito = false, origem, onEscolher }) {
  const escolhido = origem?.id === treino.id
  return (
    <button
      type="button"
      className={escolhido ? 'origem ativa' : 'origem'}
      onClick={() => onEscolher(treino)}
      aria-pressed={escolhido}
    >
      <span className={favorito ? 'origem-titulo com-icone' : 'origem-titulo'}>
        {favorito && <Star size={15} className="estrela-favorito" aria-hidden="true" />}
        {titulo}
      </span>
      <span className="origem-detalhe">{resumoEstrutura(treino)}</span>
    </button>
  )
}
