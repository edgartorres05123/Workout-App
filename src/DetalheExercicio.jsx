import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { buscarTreino, buscarTudo } from './consultas'
import DetalheTreino from './DetalheTreino'
import EscolherExercicio from './EscolherExercicio'
import Numero from './Numero'
import { resumoExercicio, sessoesPorTreino } from './estatisticas'
import {
  formatarDataCurta,
  formatarDataExtenso,
  formatarPeso,
  limparNome,
  nomesIguais,
} from './formatar'
import { MUSCULOS, proximoEstado } from './musculos'

const SESSOES_POR_PAGINA = 10

// Todas as séries deste exercício em treinos terminados (com as de aquecimento, para a lista de sessões)
function buscarSeries(exercicioId) {
  return buscarTudo(() =>
    supabase
      .from('series')
      .select('id, treino_id, ordem, repeticoes, peso_kg, aquecimento, treinos!inner(id, data)')
      .eq('exercicio_id', exercicioId)
      .not('treinos.duracao_min', 'is', null)
      .order('id')
  )
}

// Conta as séries do exercício em qualquer treino, incluindo o que estiver em curso
async function contarSeries(exercicioId) {
  const { count, error } = await supabase
    .from('series')
    .select('id', { count: 'exact', head: true })
    .eq('exercicio_id', exercicioId)
  return error ? { erro: error.message } : { total: count ?? 0 }
}

// Página de um exercício. O exercício vem da lista do separador Exercícios; as alterações são
// gravadas logo no Supabase e comunicadas com onAlterar(atualizar).
export default function DetalheExercicio({ exercicio, todos, onVoltar, onAlterar, onApagado, onJuntado }) {
  const [series, setSeries] = useState(null) // null = a carregar
  const [versao, setVersao] = useState(0) // muda para voltar a carregar as séries
  const [erro, setErro] = useState('')
  const [aEscolherDestino, setAEscolherDestino] = useState(false)
  // null | { tipo: 'juntar', destino, total } | { tipo: 'apagar' } | { tipo: 'bloqueado', total }
  const [painel, setPainel] = useState(null)
  const [aProcessar, setAProcessar] = useState(false)
  const [sessoesVisiveis, setSessoesVisiveis] = useState(SESSOES_POR_PAGINA)
  const [treinoAberto, setTreinoAberto] = useState(null)
  const scrollDoExercicio = useRef(0)
  const refPainel = useRef(null)

  // As confirmações aparecem no fundo da página: mostra-as quando abrem
  useEffect(() => {
    if (painel) refPainel.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [painel])

  useEffect(() => {
    let ativo = true
    buscarSeries(exercicio.id).then((resultado) => {
      if (!ativo) return
      if (resultado.erro) setErro(resultado.erro)
      else setSeries(resultado.linhas)
    })
    return () => {
      ativo = false
    }
  }, [exercicio.id, versao])

  async function iniciarJuntar(destino) {
    setAEscolherDestino(false)
    setErro('')
    const resultado = await contarSeries(exercicio.id)
    if (resultado.erro) return setErro(resultado.erro)
    setPainel({ tipo: 'juntar', destino, total: resultado.total })
  }

  // Sem transações no cliente, a ordem é pensada para nunca perder dados se algo falhar a meio:
  // 1) copia os músculos, 2) passa as séries para o destino, 3) só depois apaga este exercício.
  async function confirmarJuntar() {
    const { destino } = painel
    setAProcessar(true)
    setErro('')
    const falhar = (mensagem) => {
      setAProcessar(false)
      setErro(mensagem)
    }

    const { data: doDestino, error: erroLer } = await supabase
      .from('exercicio_musculos')
      .select('musculo')
      .eq('exercicio_id', destino.id)
    if (erroLer) return falhar(erroLer.message)

    const jaTem = new Set(doDestino.map((m) => m.musculo))
    const copiar = exercicio.exercicio_musculos
      .filter((m) => !jaTem.has(m.musculo))
      .map((m) => ({ exercicio_id: destino.id, musculo: m.musculo, principal: m.principal }))
    if (copiar.length > 0) {
      const { error } = await supabase.from('exercicio_musculos').insert(copiar)
      if (error) return falhar(error.message)
    }

    const { error: erroSeries } = await supabase
      .from('series')
      .update({ exercicio_id: destino.id })
      .eq('exercicio_id', exercicio.id)
    if (erroSeries) return falhar(erroSeries.message)

    const { error: erroApagar } = await supabase.from('exercicios').delete().eq('id', exercicio.id)
    if (erroApagar) return falhar(erroApagar.message)

    onJuntado(destino.id)
  }

  async function pedirApagar() {
    setErro('')
    const resultado = await contarSeries(exercicio.id)
    if (resultado.erro) return setErro(resultado.erro)
    setPainel(resultado.total > 0 ? { tipo: 'bloqueado', total: resultado.total } : { tipo: 'apagar' })
  }

  async function confirmarApagar() {
    setAProcessar(true)
    setErro('')
    const { error } = await supabase.from('exercicios').delete().eq('id', exercicio.id)
    setAProcessar(false)
    if (error) {
      // 23503: ainda há séries a apontar para este exercício (entretanto adicionadas)
      if (error.code === '23503') return setPainel({ tipo: 'bloqueado', total: null })
      return setErro(error.message)
    }
    onApagado()
  }

  async function abrirTreino(id) {
    setErro('')
    const resultado = await buscarTreino(id)
    if (resultado.erro) return setErro(resultado.erro)
    scrollDoExercicio.current = window.scrollY
    setTreinoAberto(resultado.treino)
    window.scrollTo(0, 0)
  }

  function fecharTreino() {
    setTreinoAberto(null)
    setVersao((v) => v + 1) // o treino pode ter sido editado ou apagado
    requestAnimationFrame(() => window.scrollTo(0, scrollDoExercicio.current))
  }

  const resumo = series && resumoExercicio(series)
  const sessoes = series ? sessoesPorTreino(series) : []

  return (
    <div>
      <div hidden={Boolean(treinoAberto)}>
        <div className="detalhe-topo">
          <button className="botao-voltar" onClick={onVoltar}>
            ‹ Voltar
          </button>
        </div>

        <h1 className="titulo-exercicio">{exercicio.nome}</h1>

        <CampoNome
          key={exercicio.nome}
          exercicio={exercicio}
          todos={todos}
          onAlterar={onAlterar}
          onJuntar={iniciarJuntar}
        />

        <Musculos exercicio={exercicio} onAlterar={onAlterar} />

        <div className="cartao">
          <h2>Resumo</h2>
          {series === null ? (
            <p className="subtitulo sem-margem">A carregar...</p>
          ) : !resumo ? (
            <p className="subtitulo sem-margem">Ainda não há séries deste exercício em treinos terminados.</p>
          ) : (
            <div className="estatisticas">
              <Numero valor={resumo.numTreinos} rotulo={resumo.numTreinos === 1 ? 'Treino' : 'Treinos'} />
              <Numero
                valor={`${formatarPeso(Math.round(resumo.melhor1RM * 10) / 10)} kg`}
                rotulo={`1RM estimado · ${resumo.melhor.repeticoes} × ${formatarPeso(resumo.melhor.peso_kg)} kg`}
              />
              <Numero
                valor={`${formatarPeso(resumo.recordePeso.peso_kg)} kg`}
                rotulo={`Recorde de peso · ${resumo.recordePeso.repeticoes} reps`}
              />
              <Numero
                valor={`${resumo.maisReps.repeticoes} reps`}
                rotulo={`Mais repetições · ${formatarPeso(resumo.maisReps.peso_kg)} kg`}
              />
              <Numero valor={formatarDataCurta(resumo.primeira)} rotulo="Primeira vez" />
              <Numero valor={formatarDataCurta(resumo.ultima)} rotulo="Última vez" />
            </div>
          )}
        </div>

        {sessoes.length > 0 && (
          <div className="cartao">
            <h2>Últimas sessões</h2>
            <ul className="lista">
              {sessoes.slice(0, sessoesVisiveis).map((sessao) => (
                <li key={sessao.treino.id} className="sessao">
                  <button className="botao-sessao" onClick={() => abrirTreino(sessao.treino.id)}>
                    <span className="sessao-data">{formatarDataExtenso(sessao.treino.data)}</span>
                    <span className="sessao-series">
                      {sessao.series.map((s, i) => (
                        <span key={s.id} className={s.aquecimento ? 'aquecimento' : undefined}>
                          {i > 0 && ' · '}
                          {s.aquecimento && 'A '}
                          {s.repeticoes} × {formatarPeso(s.peso_kg)}
                        </span>
                      ))}
                      {' kg'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {sessoes.length > sessoesVisiveis && (
              <button
                className="botao-secundario"
                onClick={() => setSessoesVisiveis((n) => n + SESSOES_POR_PAGINA)}
              >
                Mostrar mais
              </button>
            )}
          </div>
        )}

        {erro && <p className="erro">{erro}</p>}

        {painel ? (
          <Painel
            refPainel={refPainel}
            painel={painel}
            exercicio={exercicio}
            aProcessar={aProcessar}
            onConfirmarJuntar={confirmarJuntar}
            onConfirmarApagar={confirmarApagar}
            onEscolherDestino={() => {
              setPainel(null)
              setAEscolherDestino(true)
            }}
            onCancelar={() => setPainel(null)}
          />
        ) : (
          <div className="acoes-exercicio">
            <button className="botao-secundario" onClick={() => setAEscolherDestino(true)}>
              Juntar com outro exercício
            </button>
            <button className="botao-perigo" onClick={pedirApagar}>
              Apagar exercício
            </button>
          </div>
        )}

        {aEscolherDestino && (
          <EscolherExercicio
            titulo="Juntar com..."
            excluir={[exercicio.id]}
            permitirCriar={false}
            onEscolher={iniciarJuntar}
            onFechar={() => setAEscolherDestino(false)}
          />
        )}
      </div>

      {treinoAberto && (
        <DetalheTreino
          key={treinoAberto.id}
          treino={treinoAberto}
          onVoltar={fecharTreino}
          onAlterar={(atualizar) => setTreinoAberto((t) => atualizar(t))}
          onApagado={fecharTreino}
        />
      )}
    </div>
  )
}

function CampoNome({ exercicio, todos, onAlterar, onJuntar }) {
  const [nome, setNome] = useState(exercicio.nome)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const [duplicado, setDuplicado] = useState(null)

  async function guardar(e) {
    e.preventDefault()
    const novo = limparNome(nome)
    setErro('')
    setDuplicado(null)
    if (!novo) return setErro('O nome não pode ficar vazio.')
    if (novo === exercicio.nome) return setNome(novo)

    const outro = todos.find((ex) => ex.id !== exercicio.id && nomesIguais(ex.nome, novo))
    if (outro) return setDuplicado(outro)

    setAGravar(true)
    const { error } = await supabase.from('exercicios').update({ nome: novo }).eq('id', exercicio.id)
    setAGravar(false)
    if (error) {
      return setErro(
        error.code === '23505' ? `Já existe um exercício chamado «${novo}».` : error.message
      )
    }
    onAlterar((ex) => ({ ...ex, nome: novo }))
  }

  const mudou = limparNome(nome) !== exercicio.nome

  return (
    <form className="cartao" onSubmit={guardar}>
      <h2>Mudar nome</h2>
      <div className="linha sem-margem">
        <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do exercício" />
        <button type="submit" disabled={!mudou || aGravar}>
          {aGravar ? '...' : 'Guardar'}
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {duplicado && (
        <div className="aviso">
          <p>
            Já existe um exercício chamado «{duplicado.nome}». Se são o mesmo exercício, podes
            juntá-los: as séries deste passam para «{duplicado.nome}».
          </p>
          <button type="button" className="botao-secundario" onClick={() => onJuntar(duplicado)}>
            Juntar com «{duplicado.nome}»
          </button>
        </div>
      )}
    </form>
  )
}

// Os 13 músculos; cada toque alterna nenhum → principal → secundário → nenhum, gravando logo
function Musculos({ exercicio, onAlterar }) {
  const [aGravar, setAGravar] = useState(() => new Set())
  const [erro, setErro] = useState('')

  const estados = new Map(
    exercicio.exercicio_musculos.map((m) => [m.musculo, m.principal ? 'principal' : 'secundario'])
  )

  async function alternar(musculo) {
    const atual = estados.get(musculo) ?? null
    const proximo = proximoEstado(atual)
    setErro('')
    setAGravar((s) => new Set(s).add(musculo))

    const tabela = supabase.from('exercicio_musculos')
    const { error } =
      atual === null
        ? await tabela.insert({ exercicio_id: exercicio.id, musculo, principal: true })
        : proximo === 'secundario'
          ? await tabela.update({ principal: false }).eq('exercicio_id', exercicio.id).eq('musculo', musculo)
          : await tabela.delete().eq('exercicio_id', exercicio.id).eq('musculo', musculo)

    setAGravar((s) => {
      const novo = new Set(s)
      novo.delete(musculo)
      return novo
    })
    if (error) return setErro(error.message)

    onAlterar((ex) => {
      const outros = ex.exercicio_musculos.filter((m) => m.musculo !== musculo)
      return {
        ...ex,
        exercicio_musculos: proximo
          ? [...outros, { musculo, principal: proximo === 'principal' }]
          : outros,
      }
    })
  }

  return (
    <div className="cartao">
      <h2>Músculos</h2>
      <div className="grelha-musculos">
        {MUSCULOS.map((m) => {
          const estado = estados.get(m.id)
          return (
            <button
              key={m.id}
              className={estado ? `musculo ${estado}` : 'musculo'}
              onClick={() => alternar(m.id)}
              disabled={aGravar.has(m.id)}
              aria-pressed={Boolean(estado)}
            >
              {m.nome}
            </button>
          )
        })}
      </div>
      <p className="legenda">
        <span className="etiqueta etiqueta-principal">Principal</span>
        <span className="etiqueta etiqueta-secundario">Secundário</span>
        <span>Toca para alternar.</span>
      </p>
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

function Painel({
  refPainel,
  painel,
  exercicio,
  aProcessar,
  onConfirmarJuntar,
  onConfirmarApagar,
  onEscolherDestino,
  onCancelar,
}) {
  if (painel.tipo === 'juntar') {
    const { destino, total } = painel
    return (
      <div className="cartao confirmacao" ref={refPainel}>
        <p>
          Juntar «{exercicio.nome}» com «{destino.nome}»?
        </p>
        <ul className="explicacao">
          <li>
            {total === 1 ? 'A série' : `As ${total} séries`} de «{exercicio.nome}» passam para «
            {destino.nome}».
          </li>
          <li>Os músculos que «{destino.nome}» ainda não tem são copiados.</li>
          <li>«{exercicio.nome}» é apagado. Não é possível desfazer.</li>
        </ul>
        <button onClick={onConfirmarJuntar} disabled={aProcessar}>
          {aProcessar ? 'A juntar...' : 'Juntar'}
        </button>
        <button className="botao-secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    )
  }

  if (painel.tipo === 'bloqueado') {
    return (
      <div className="cartao confirmacao" ref={refPainel}>
        <p>
          Este exercício não pode ser apagado porque tem{' '}
          {painel.total === null
            ? 'séries registadas'
            : painel.total === 1
              ? '1 série registada'
              : `${painel.total} séries registadas`}
          . Se é igual a outro exercício, junta-os: as séries passam para o outro e este é apagado.
        </p>
        <button onClick={onEscolherDestino}>Juntar com outro exercício</button>
        <button className="botao-secundario" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="cartao confirmacao" ref={refPainel}>
      <p>Apagar «{exercicio.nome}»? Não tem séries registadas.</p>
      <button className="botao-perigo-cheio" onClick={onConfirmarApagar} disabled={aProcessar}>
        {aProcessar ? 'A apagar...' : 'Apagar exercício'}
      </button>
      <button className="botao-secundario" onClick={onCancelar}>
        Cancelar
      </button>
    </div>
  )
}
