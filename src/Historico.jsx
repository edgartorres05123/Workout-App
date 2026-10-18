import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Layers, Timer, Weight, X } from 'lucide-react'
import { supabase } from './supabase'
import { resumoSessao, sessoesDoTreino } from './cardio'
import { SELECT_TREINO } from './consultas'
import DetalheTreino from './DetalheTreino'
import { useCarga } from './contextoPesoCorporal'
import Esqueleto from './Esqueleto'
import EstadoVazio from './EstadoVazio'
import IconeAtividade from './IconeAtividade'
import {
  agruparPorExercicio,
  calcularVolume,
  chaveDia,
  formatarDataExtenso,
  formatarHora,
  formatarMes,
  formatarMinutos,
  formatarPeso,
} from './formatar'

const TAMANHO_PAGINA = 20
const MAX_NOMES = 3
const DIAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

// Treinos terminados, do mais recente para o mais antigo.
// dia: "2026-10-17" para ver só esse dia; antesDe: data do último treino já carregado (página seguinte).
async function buscarTreinos({ dia = null, antesDe = null }) {
  let consulta = supabase.from('treinos').select(SELECT_TREINO).not('duracao_min', 'is', null)

  if (dia) {
    const [ano, mes, d] = dia.split('-').map(Number)
    consulta = consulta
      .gte('data', new Date(ano, mes - 1, d).toISOString())
      .lt('data', new Date(ano, mes - 1, d + 1).toISOString())
  } else if (antesDe) {
    consulta = consulta.lt('data', antesDe)
  }

  consulta = consulta
    .order('data', { ascending: false })
    .order('ordem', { referencedTable: 'series' })
  if (!dia) consulta = consulta.limit(TAMANHO_PAGINA)

  const { data, error } = await consulta
  if (error) return { erro: error.message }
  return { treinos: data }
}

function ordenarTreinos(treinos) {
  return [...treinos].sort((a, b) => new Date(b.data) - new Date(a.data))
}

// [{ mes: "outubro de 2026", treinos: [...] }]
function agruparPorMes(treinos) {
  const grupos = []
  for (const treino of treinos) {
    const mes = formatarMes(treino.data)
    if (grupos.at(-1)?.mes !== mes) grupos.push({ mes, treinos: [] })
    grupos.at(-1).treinos.push(treino)
  }
  return grupos
}

// Montado de novo sempre que o separador é aberto, por isso recarrega sozinho
export default function Historico() {
  const [treinos, setTreinos] = useState([])
  const [aCarregar, setACarregar] = useState(true)
  const [aCarregarMais, setACarregarMais] = useState(false)
  const [haMais, setHaMais] = useState(false)
  const [erro, setErro] = useState('')
  const [dia, setDia] = useState(null) // filtro do calendário
  const [abertoId, setAbertoId] = useState(null)
  const [versaoCalendario, setVersaoCalendario] = useState(0)
  const ultimoPedido = useRef(0)
  const scrollDaLista = useRef(0)

  // Só aplica a resposta do pedido mais recente (evita trocas se o utilizador tocar depressa)
  function pedir(filtros, acrescentar) {
    const id = ++ultimoPedido.current
    return buscarTreinos(filtros).then((resultado) => {
      if (id !== ultimoPedido.current) return
      if (resultado.erro) {
        setErro(resultado.erro)
      } else {
        setErro('')
        setTreinos((atuais) => (acrescentar ? [...atuais, ...resultado.treinos] : resultado.treinos))
        setHaMais(!filtros.dia && resultado.treinos.length === TAMANHO_PAGINA)
      }
      setACarregar(false)
      setACarregarMais(false)
    })
  }

  useEffect(() => {
    pedir({}, false)
  }, [])

  function escolherDia(chave) {
    const novo = chave === dia ? null : chave
    setDia(novo)
    setTreinos([])
    setHaMais(false)
    setACarregar(true)
    pedir({ dia: novo }, false)
  }

  function carregarMais() {
    setACarregarMais(true)
    pedir({ antesDe: treinos.at(-1).data }, true)
  }

  function abrir(id) {
    scrollDaLista.current = window.scrollY
    setAbertoId(id)
    window.scrollTo(0, 0)
  }

  function voltar() {
    setAbertoId(null)
    // A data do treino pode ter mudado no editor: o calendário volta a marcar os dias
    setVersaoCalendario((v) => v + 1)
    requestAnimationFrame(() => window.scrollTo(0, scrollDaLista.current))
  }

  // Atualiza um treino na lista depois de uma alteração no detalhe (já gravada no Supabase)
  function alterarTreino(id, atualizar) {
    setTreinos((atuais) => ordenarTreinos(atuais.map((t) => (t.id === id ? atualizar(t) : t))))
  }

  function treinoApagado(id) {
    setTreinos((atuais) => atuais.filter((t) => t.id !== id))
    setVersaoCalendario((v) => v + 1)
    voltar()
  }

  const aberto = treinos.find((t) => t.id === abertoId)

  return (
    <div>
      {/* A lista fica escondida (e não desmontada) enquanto o detalhe está aberto */}
      <div hidden={Boolean(aberto)}>

        <Calendario
          diaSelecionado={dia}
          onEscolherDia={escolherDia}
          versao={versaoCalendario}
        />

        {dia && (
          <div className="filtro-dia">
            <span>{formatarDataExtenso(dia + 'T12:00')}</span>
            <button className="com-icone" onClick={() => escolherDia(dia)}>
              <X size={16} />
              Ver todos
            </button>
          </div>
        )}

        {erro && <p className="erro">{erro}</p>}

        {aCarregar ? (
          <Esqueleto cartoes={4} linhas={3} />
        ) : treinos.length === 0 && !erro ? (
          dia ? (
            <p className="subtitulo">Não há treinos terminados neste dia.</p>
          ) : (
            <EstadoVazio
              icone={CalendarDays}
              titulo="Ainda não tens treinos terminados"
              texto="Vai ao separador Treino e começa o primeiro. Vai aparecer aqui quando o terminares."
            />
          )
        ) : (
          agruparPorMes(treinos).map((grupo) => (
            <section key={grupo.mes}>
              <h2 className="titulo-mes">{grupo.mes}</h2>
              {grupo.treinos.map((treino) => (
                <CartaoTreino key={treino.id} treino={treino} onAbrir={() => abrir(treino.id)} />
              ))}
            </section>
          ))
        )}

        {haMais && !aCarregar && (
          <button className="botao-secundario" onClick={carregarMais} disabled={aCarregarMais}>
            {aCarregarMais ? 'A carregar...' : 'Carregar mais'}
          </button>
        )}
      </div>

      {aberto && (
        <DetalheTreino
          key={aberto.id}
          treino={aberto}
          onVoltar={voltar}
          onAlterar={(atualizar) => alterarTreino(aberto.id, atualizar)}
          onApagado={() => treinoApagado(aberto.id)}
        />
      )}
    </div>
  )
}

// Um treino na lista. Só de cardio: o ícone e o resumo da atividade ("Corrida · 8,2 km · 42:10 · 5:08 /km");
// misto: o resumo do ginásio e uma linha por cada bloco de cardio.
function CartaoTreino({ treino, onAbrir }) {
  const carga = useCarga()
  const cardio = sessoesDoTreino(treino)
  const soCardio = treino.series.length === 0 && cardio.length > 0
  const numSeries = treino.series.filter((s) => !s.aquecimento).length
  const nomes = agruparPorExercicio(treino.series).map((g) => g.exercicio.nome)
  const resto = nomes.length - MAX_NOMES

  return (
    <button className="cartao cartao-treino" onClick={onAbrir}>
      <span className="cartao-treino-topo">
        <span className="cartao-treino-data">{formatarDataExtenso(treino.data)}</span>
        <span className="cartao-treino-hora com-icone">
          <Clock size={14} aria-hidden="true" />
          {formatarHora(treino.data)}
        </span>
      </span>
      {soCardio ? (
        cardio.map((sessao) => (
          <span key={sessao.bloco_id} className="cartao-treino-cardio so-cardio com-icone">
            <IconeAtividade atividade={sessao.atividade} size={18} />
            {resumoSessao(sessao)}
          </span>
        ))
      ) : (
        <>
          <span className="cartao-treino-numeros">
            <span className="com-icone">
              <Timer size={15} aria-hidden="true" />
              {formatarMinutos(treino.duracao_min)}
            </span>
            <span className="com-icone">
              <Weight size={15} aria-hidden="true" />
              {formatarPeso(calcularVolume(treino.series, (s) => carga(s, treino.data)))} kg
            </span>
            <span className="com-icone">
              <Layers size={15} aria-hidden="true" />
              {numSeries} {numSeries === 1 ? 'série' : 'séries'}
            </span>
          </span>
          {nomes.length > 0 && (
            <span className="cartao-treino-exercicios">
              {nomes.slice(0, MAX_NOMES).join(', ')}
              {resto > 0 && <span className="mais"> +{resto}</span>}
            </span>
          )}
          {cardio.map((sessao) => (
            <span key={sessao.bloco_id} className="cartao-treino-cardio com-icone">
              <IconeAtividade atividade={sessao.atividade} size={15} />
              {resumoSessao(sessao)}
            </span>
          ))}
        </>
      )}
    </button>
  )
}

function Calendario({ diaSelecionado, onEscolherDia, versao }) {
  const [hoje] = useState(() => new Date())
  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  // Dias com treino do mês carregado: { mes: "2026-10-01", dias: Set("2026-10-17", ...), soCardio: Set(...) }
  // (soCardio: os dias em que todos os treinos foram só de cardio)
  const [marcados, setMarcados] = useState({ mes: null, dias: new Set(), soCardio: new Set() })
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 1)
    supabase
      .from('treinos')
      .select('data, blocos(tipo)')
      .not('duracao_min', 'is', null)
      .gte('data', mes.toISOString())
      .lt('data', fim.toISOString())
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) return setErro(error.message)
        setErro('')
        const dias = new Set(data.map((t) => chaveDia(t.data)))
        const comGinasio = new Set(
          data.filter((t) => !(t.blocos.length > 0 && t.blocos.every((b) => b.tipo === 'cardio'))).map((t) => chaveDia(t.data))
        )
        setMarcados({ mes: chaveDia(mes), dias, soCardio: new Set([...dias].filter((d) => !comGinasio.has(d))) })
      })
    return () => {
      ativo = false
    }
  }, [mes, versao])

  const ano = mes.getFullYear()
  const numMes = mes.getMonth()
  const diasNoMes = new Date(ano, numMes + 1, 0).getDate()
  const vazios = (mes.getDay() + 6) % 7 // a semana começa à segunda-feira
  const doMes = marcados.mes === chaveDia(mes)
  const diasComTreino = doMes ? marcados.dias : new Set()
  const diasSoCardio = doMes ? marcados.soCardio : new Set()
  const ehMesAtual = ano === hoje.getFullYear() && numMes === hoje.getMonth()
  const chaveHoje = chaveDia(hoje)
  const titulo = formatarMes(mes)

  return (
    <div className="cartao calendario">
      <div className="calendario-topo">
        <button
          className="calendario-seta"
          onClick={() => setMes(new Date(ano, numMes - 1, 1))}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="calendario-titulo">{titulo.charAt(0).toUpperCase() + titulo.slice(1)}</span>
        <button
          className="calendario-seta"
          onClick={() => setMes(new Date(ano, numMes + 1, 1))}
          disabled={ehMesAtual}
          aria-label="Mês seguinte"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="calendario-grelha">
        {DIAS_SEMANA.map((letra, i) => (
          <span key={i} className="calendario-semana">
            {letra}
          </span>
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          <span key={`vazio-${i}`} />
        ))}
        {Array.from({ length: diasNoMes }, (_, i) => {
          const chave = chaveDia(new Date(ano, numMes, i + 1))
          const temTreino = diasComTreino.has(chave)
          const classes = ['calendario-dia']
          if (temTreino) classes.push(diasSoCardio.has(chave) ? 'com-treino so-cardio' : 'com-treino')
          if (chave === diaSelecionado) classes.push('selecionado')
          if (chave === chaveHoje) classes.push('hoje')
          return (
            <button
              key={chave}
              className={classes.join(' ')}
              onClick={() => onEscolherDia(chave)}
              disabled={!temTreino && chave !== diaSelecionado}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {diasSoCardio.size > 0 && (
        <p className="calendario-legenda">
          <span className="legenda-ponto" aria-hidden="true" /> Ginásio
          <span className="legenda-ponto so-cardio" aria-hidden="true" /> Só cardio
        </p>
      )}

      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
