import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import CartaoBloco from './CartaoBloco'
import NotasTreino from './NotasTreino'
import NovoBloco from './NovoBloco'
import Numero from './Numero'
import OpcoesBloco from './OpcoesBloco'
import {
  REPS_ALVO_INICIAIS,
  VOLTAS_INICIAIS,
  normalizarTreino,
  numerarBlocos,
  proximaOrdem,
  proximaOrdemSerie,
  reordenar,
  resumoTreino,
  tipoAposMudarExercicios,
  tituloBloco,
} from './blocos'
import {
  calcularVolume,
  dataParaInput,
  formatarCronometro,
  formatarDataExtenso,
  formatarHora,
  formatarMinutos,
  formatarPeso,
} from './formatar'

const CAMPOS_SERIE = 'id, bloco_id, volta, exercicio_id, ordem, repeticoes, peso_kg, aquecimento, exercicios(id, nome)'
const CAMPOS_BLOCO_EXERCICIO = 'id, ordem, exercicio_id, reps_alvo, peso_alvo, exercicios(id, nome)'

// Editor de um treino organizado em blocos, usado em 3 modos:
//   'aoVivo'  — o treino em curso, com cronómetro (Terminar / Descartar)
//   'passado' — registar um treino passado, já terminado (Concluir / Apagar)
//   'editar'  — corrigir um treino terminado, a partir do Histórico (Concluir / Apagar)
// O treino pertence ao componente pai: cada alteração é gravada logo no Supabase e depois
// comunicada com onAlterar(atualizar). Os blocos e as séries são ordenados aqui, ao mostrar.
export default function EditorTreino({ modo, treino: treinoRecebido, onAlterar, onTerminado, onConcluido, onApagado }) {
  const treino = useMemo(() => normalizarTreino(treinoRecebido), [treinoRecebido])
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // null | 'apagar' | 'vazio'
  const [aCriarBloco, setACriarBloco] = useState(false)
  const [opcoesId, setOpcoesId] = useState(null)

  const numeros = numerarBlocos(treino.blocos)
  const seriesDoBloco = (blocoId) => treino.series.filter((s) => s.bloco_id === blocoId)
  const blocoComOpcoes = treino.blocos.find((b) => b.id === opcoesId)

  // ---------- Treino ----------

  async function guardarTreino(campos) {
    const { error } = await supabase.from('treinos').update(campos).eq('id', treino.id)
    if (error) return error.message
    onAlterar((t) => ({ ...t, ...campos }))
    return null
  }

  async function terminar() {
    if (treino.series.length === 0) return setConfirmar('vazio')
    const duracao = Math.max(1, Math.round((Date.now() - new Date(treino.data)) / 60000))
    setAGravar(true)
    setErro('')
    const mensagem = await guardarTreino({ duracao_min: duracao })
    setAGravar(false)
    if (mensagem) return setErro(mensagem)
    onTerminado(resumoTreino(treino.series, duracao))
  }

  async function apagarTreino() {
    setAGravar(true)
    setErro('')
    const { error } = await supabase.from('treinos').delete().eq('id', treino.id)
    setAGravar(false)
    if (error) return setErro(error.message)
    onApagado()
  }

  // ---------- Blocos ----------

  async function criarBloco(tipo, exercicios) {
    const { data: bloco, error } = await supabase
      .from('blocos')
      .insert({ treino_id: treino.id, ordem: proximaOrdem(treino.blocos), tipo, voltas: VOLTAS_INICIAIS[tipo] })
      .select('id, ordem, tipo, voltas, notas')
      .single()
    if (error) return error.message

    const { data: doBloco, error: erroExercicios } = await supabase
      .from('bloco_exercicios')
      .insert(
        exercicios.map((e, i) => ({ bloco_id: bloco.id, exercicio_id: e.id, ordem: i + 1, reps_alvo: REPS_ALVO_INICIAIS }))
      )
      .select(CAMPOS_BLOCO_EXERCICIO)
    onAlterar((t) => ({ ...t, blocos: [...t.blocos, { ...bloco, bloco_exercicios: doBloco ?? [] }] }))
    if (erroExercicios) return erroExercicios.message
    setACriarBloco(false)
    return null
  }

  async function atualizarBloco(blocoId, campos) {
    const { error } = await supabase.from('blocos').update(campos).eq('id', blocoId)
    if (error) return error.message
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.map((b) => (b.id === blocoId ? { ...b, ...campos } : b)),
      // A base de dados atualiza o aquecimento das séries quando o tipo muda; aqui faz-se o mesmo
      series: campos.tipo
        ? t.series.map((s) => (s.bloco_id === blocoId ? { ...s, aquecimento: campos.tipo === 'aquecimento' } : s))
        : t.series,
    }))
    return null
  }

  async function mudarVoltas(bloco, delta) {
    const voltas = bloco.voltas + delta
    if (voltas < 1) return null
    if (delta < 0 && seriesDoBloco(bloco.id).some((s) => s.volta > voltas)) {
      return 'A última volta já está feita. Desfá-la primeiro (toca no ✓) para a poder tirar.'
    }
    return atualizarBloco(bloco.id, { voltas })
  }

  async function apagarBloco(blocoId) {
    const { error } = await supabase.from('blocos').delete().eq('id', blocoId)
    if (error) return error.message
    setOpcoesId(null)
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.filter((b) => b.id !== blocoId),
      series: t.series.filter((s) => s.bloco_id !== blocoId),
    }))
    return null
  }

  // Guarda as novas ordens (só as que mudaram) e aplica as que ficaram gravadas
  async function guardarOrdens(tabela, alteracoes) {
    const resultados = await Promise.all(
      alteracoes.map(({ id, ordem }) => supabase.from(tabela).update({ ordem }).eq('id', id))
    )
    const gravadas = new Map(alteracoes.filter((_, i) => !resultados[i].error).map((a) => [a.id, a.ordem]))
    const falha = resultados.find((r) => r.error)
    return { gravadas, mensagem: falha ? falha.error.message : null }
  }

  async function moverBloco(blocoId, direcao) {
    const resultado = reordenar(treino.blocos, treino.blocos.findIndex((b) => b.id === blocoId), direcao)
    if (!resultado) return null
    const { gravadas, mensagem } = await guardarOrdens('blocos', resultado.alteracoes)
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.map((b) => (gravadas.has(b.id) ? { ...b, ordem: gravadas.get(b.id) } : b)),
    }))
    return mensagem
  }

  // ---------- Exercícios de um bloco ----------

  async function adicionarExercicio(bloco, exercicio) {
    const { data, error } = await supabase
      .from('bloco_exercicios')
      .insert({
        bloco_id: bloco.id,
        exercicio_id: exercicio.id,
        ordem: proximaOrdem(bloco.bloco_exercicios),
        reps_alvo: REPS_ALVO_INICIAIS,
      })
      .select(CAMPOS_BLOCO_EXERCICIO)
      .single()
    if (error) return error.message
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.map((b) => (b.id === bloco.id ? { ...b, bloco_exercicios: [...b.bloco_exercicios, data] } : b)),
    }))
    const tipo = tipoAposMudarExercicios(bloco.tipo, bloco.bloco_exercicios.length + 1)
    return tipo !== bloco.tipo ? atualizarBloco(bloco.id, { tipo }) : null
  }

  // Remove um exercício do bloco e as séries que já tinha neste bloco (a janela pede confirmação)
  async function removerExercicio(bloco, blocoExercicio) {
    const { error: erroSeries } = await supabase
      .from('series')
      .delete()
      .eq('bloco_id', bloco.id)
      .eq('exercicio_id', blocoExercicio.exercicio_id)
    if (erroSeries) return erroSeries.message
    const { error } = await supabase.from('bloco_exercicios').delete().eq('id', blocoExercicio.id)
    if (error) return error.message
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.map((b) =>
        b.id === bloco.id ? { ...b, bloco_exercicios: b.bloco_exercicios.filter((be) => be.id !== blocoExercicio.id) } : b
      ),
      series: t.series.filter((s) => !(s.bloco_id === bloco.id && s.exercicio_id === blocoExercicio.exercicio_id)),
    }))
    const tipo = tipoAposMudarExercicios(bloco.tipo, bloco.bloco_exercicios.length - 1)
    return tipo !== bloco.tipo ? atualizarBloco(bloco.id, { tipo }) : null
  }

  async function atualizarExercicio(blocoId, blocoExercicioId, campos) {
    const { error } = await supabase.from('bloco_exercicios').update(campos).eq('id', blocoExercicioId)
    if (error) return error.message
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.map((b) =>
        b.id === blocoId
          ? { ...b, bloco_exercicios: b.bloco_exercicios.map((be) => (be.id === blocoExercicioId ? { ...be, ...campos } : be)) }
          : b
      ),
    }))
    return null
  }

  async function moverExercicio(bloco, indice, direcao) {
    const resultado = reordenar(bloco.bloco_exercicios, indice, direcao)
    if (!resultado) return null
    const { gravadas, mensagem } = await guardarOrdens('bloco_exercicios', resultado.alteracoes)
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.map((b) =>
        b.id === bloco.id
          ? {
              ...b,
              bloco_exercicios: b.bloco_exercicios.map((be) =>
                gravadas.has(be.id) ? { ...be, ordem: gravadas.get(be.id) } : be
              ),
            }
          : b
      ),
    }))
    return mensagem
  }

  // ---------- Voltas e séries ----------

  // ✓: grava uma série por exercício com reps (o aquecimento vem do tipo do bloco, pela base de dados)
  async function gravarVolta(bloco, volta, lista) {
    const base = proximaOrdemSerie(treino.series)
    const { data, error } = await supabase
      .from('series')
      .insert(
        lista.map((s, i) => ({
          treino_id: treino.id,
          bloco_id: bloco.id,
          volta,
          exercicio_id: s.exercicio_id,
          ordem: base + i,
          repeticoes: s.repeticoes,
          peso_kg: s.peso_kg,
        }))
      )
      .select(CAMPOS_SERIE)
    if (error) return error.message
    onAlterar((t) => ({ ...t, series: [...t.series, ...data] }))
    return null
  }

  async function desfazerVolta(bloco, volta) {
    const { error } = await supabase.from('series').delete().eq('bloco_id', bloco.id).eq('volta', volta)
    if (error) return error.message
    onAlterar((t) => ({ ...t, series: t.series.filter((s) => !(s.bloco_id === bloco.id && s.volta === volta)) }))
    return null
  }

  // Corrige uma série de uma volta feita: dados = { repeticoes, peso_kg }, ou null para a apagar
  async function guardarSerie(bloco, volta, exercicioId, dados) {
    const existente = treino.series.find(
      (s) => s.bloco_id === bloco.id && s.volta === volta && s.exercicio_id === exercicioId
    )
    if (!dados) {
      if (!existente) return null
      const { error } = await supabase.from('series').delete().eq('id', existente.id)
      if (error) return error.message
      onAlterar((t) => ({ ...t, series: t.series.filter((s) => s.id !== existente.id) }))
      return null
    }
    if (existente) {
      const { data, error } = await supabase.from('series').update(dados).eq('id', existente.id).select(CAMPOS_SERIE).single()
      if (error) return error.message
      onAlterar((t) => ({ ...t, series: t.series.map((s) => (s.id === existente.id ? data : s)) }))
      return null
    }
    return gravarVolta(bloco, volta, [{ exercicio_id: exercicioId, ...dados }])
  }

  // ---------- Ecrã ----------

  const volume = calcularVolume(treino.series)

  return (
    <div className="editor-treino">
      {modo === 'aoVivo' ? (
        <div className="cartao treino-cabecalho">
          <p className="treino-data">{formatarDataExtenso(treino.data)}</p>
          <div className="numeros">
            <Cronometro inicio={treino.data} />
            <Numero valor={`${formatarPeso(volume)} kg`} rotulo="Volume" />
          </div>
        </div>
      ) : (
        <div className="cartao treino-cabecalho">
          <p className="treino-data">
            {formatarDataExtenso(treino.data)} · {formatarHora(treino.data)}
          </p>
          <div className="numeros">
            <Numero valor={formatarMinutos(treino.duracao_min ?? 0)} rotulo="Duração" />
            <Numero valor={`${formatarPeso(volume)} kg`} rotulo="Volume" />
          </div>
          <CamposTreino treino={treino} onGuardar={guardarTreino} />
        </div>
      )}

      {treino.blocos.length === 0 && (
        <p className="subtitulo">Adiciona o primeiro bloco: um aquecimento, uma série ou uma super série.</p>
      )}

      {treino.blocos.map((bloco, i) => (
        <CartaoBloco
          key={bloco.id}
          bloco={bloco}
          titulo={tituloBloco(bloco, numeros[i])}
          series={seriesDoBloco(bloco.id)}
          dataTreino={treino.data}
          onOpcoes={() => setOpcoesId(bloco.id)}
          onMudarVoltas={(delta) => mudarVoltas(bloco, delta)}
          onGravarVolta={(volta, lista) => gravarVolta(bloco, volta, lista)}
          onDesfazerVolta={(volta) => desfazerVolta(bloco, volta)}
          onGuardarSerie={(volta, exercicioId, dados) => guardarSerie(bloco, volta, exercicioId, dados)}
        />
      ))}

      <button className="botao-secundario" onClick={() => setACriarBloco(true)}>
        + Adicionar bloco
      </button>

      <NotasTreino key={treino.id} treino={treino} onGuardar={guardarTreino} />

      {erro && <p className="erro">{erro}</p>}

      {confirmar ? (
        <div className="cartao confirmacao">
          <p>
            {confirmar === 'vazio'
              ? 'Este treino ainda não tem séries feitas. Queres descartá-lo?'
              : modo === 'aoVivo'
                ? 'Descartar este treino? Os blocos e as séries serão apagados.'
                : 'Apagar este treino? Os blocos e as séries serão apagados e não é possível desfazer.'}
          </p>
          <button className="botao-perigo-cheio" onClick={apagarTreino} disabled={aGravar}>
            {modo === 'aoVivo' ? 'Descartar treino' : 'Apagar treino'}
          </button>
          <button className="botao-secundario" onClick={() => setConfirmar(null)}>
            {modo === 'aoVivo' ? 'Continuar a treinar' : 'Cancelar'}
          </button>
        </div>
      ) : (
        <div className="acoes-treino">
          {modo === 'aoVivo' ? (
            <button onClick={terminar} disabled={aGravar}>
              {aGravar ? 'A gravar...' : 'Terminar treino'}
            </button>
          ) : (
            <button onClick={() => onConcluido(resumoTreino(treino.series, treino.duracao_min ?? 0))}>Concluir</button>
          )}
          <button className="botao-perigo" onClick={() => setConfirmar('apagar')}>
            {modo === 'aoVivo' ? 'Descartar treino' : 'Apagar treino'}
          </button>
        </div>
      )}

      {aCriarBloco && <NovoBloco onCriar={criarBloco} onFechar={() => setACriarBloco(false)} />}

      {blocoComOpcoes && (
        <OpcoesBloco
          key={blocoComOpcoes.id}
          bloco={blocoComOpcoes}
          titulo={tituloBloco(blocoComOpcoes, numeros[treino.blocos.indexOf(blocoComOpcoes)])}
          series={seriesDoBloco(blocoComOpcoes.id)}
          primeiro={treino.blocos[0] === blocoComOpcoes}
          ultimo={treino.blocos.at(-1) === blocoComOpcoes}
          onAtualizar={(campos) => atualizarBloco(blocoComOpcoes.id, campos)}
          onMudarVoltas={(delta) => mudarVoltas(blocoComOpcoes, delta)}
          onMover={(direcao) => moverBloco(blocoComOpcoes.id, direcao)}
          onApagar={() => apagarBloco(blocoComOpcoes.id)}
          onAdicionarExercicio={(exercicio) => adicionarExercicio(blocoComOpcoes, exercicio)}
          onRemoverExercicio={(be) => removerExercicio(blocoComOpcoes, be)}
          onAtualizarExercicio={(beId, campos) => atualizarExercicio(blocoComOpcoes.id, beId, campos)}
          onMoverExercicio={(indice, direcao) => moverExercicio(blocoComOpcoes, indice, direcao)}
          onFechar={() => setOpcoesId(null)}
        />
      )}
    </div>
  )
}

// Componente à parte para só ele voltar a desenhar-se a cada segundo
function Cronometro({ inicio }) {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(intervalo)
  }, [])

  return <Numero valor={formatarCronometro((agora - new Date(inicio).getTime()) / 1000)} rotulo="Duração" />
}

// Data, hora e duração de um treino passado ou terminado. Grava ao sair de cada campo.
function CamposTreino({ treino, onGuardar }) {
  const [data, setData] = useState(dataParaInput(treino.data))
  const [duracao, setDuracao] = useState(String(treino.duracao_min ?? ''))
  const [erro, setErro] = useState('')

  async function guardarData() {
    const nova = new Date(data)
    if (!data || Number.isNaN(nova.getTime())) {
      setErro('Indica uma data e hora válidas.')
      setData(dataParaInput(treino.data))
      return
    }
    if (data === dataParaInput(treino.data)) return
    const mensagem = await onGuardar({ data: nova.toISOString() })
    setErro(mensagem ?? '')
    if (mensagem) setData(dataParaInput(treino.data))
  }

  async function guardarDuracao() {
    const minutos = Number(duracao.trim())
    // Nunca pode ficar vazia: um treino sem duração é um treino em curso
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 1440) {
      setErro('A duração tem de ser um número inteiro de minutos (mínimo 1).')
      setDuracao(String(treino.duracao_min ?? ''))
      return
    }
    if (minutos === treino.duracao_min) return
    const mensagem = await onGuardar({ duracao_min: minutos })
    setErro(mensagem ?? '')
    if (mensagem) setDuracao(String(treino.duracao_min ?? ''))
  }

  const sairComEnter = (e) => e.key === 'Enter' && e.currentTarget.blur()

  return (
    <div className="campos-treino">
      <label>
        <span>Data e hora de início</span>
        <input
          type="datetime-local"
          value={data}
          onChange={(e) => setData(e.target.value)}
          onBlur={guardarData}
          onKeyDown={sairComEnter}
        />
      </label>
      <label className="campo-duracao">
        <span>Duração (min)</span>
        <input
          type="text"
          inputMode="numeric"
          value={duracao}
          onChange={(e) => setDuracao(e.target.value)}
          onBlur={guardarDuracao}
          onKeyDown={sairComEnter}
        />
      </label>
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
