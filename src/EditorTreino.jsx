import { useEffect, useMemo, useState } from 'react'
import { Check, Flag, Layers, Plus, Trash2 } from 'lucide-react'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import AvisoPesoCorporal from './AvisoPesoCorporal'
import CartaoBloco from './CartaoBloco'
import CartaoCardio from './CartaoCardio'
import { CAMPOS_CARDIO } from './consultas'
import { useCarga, usePesoCorporalNaData } from './contextoPesoCorporal'
import Confirmar from './Confirmar'
import EstadoVazio from './EstadoVazio'
import NotasTreino from './NotasTreino'
import NovoBloco from './NovoBloco'
import Numero from './Numero'
import OpcoesBloco from './OpcoesBloco'
import SemanaNoTreino from './SemanaNoTreino'
import {
  REPS_ALVO_INICIAIS,
  atividadeDoBloco,
  camposIniciais,
  linhasCardio,
  normalizarTreino,
  numerarBlocos,
  progressoVoltas,
  proximaOrdem,
  proximaOrdemSerie,
  reordenar,
  resumoTreino,
  tipoAposMudarExercicios,
  tituloBloco,
} from './blocos'
import { linhaFeita, resumoSessao, sessoesDoTreino } from './cardio'
import {
  calcularVolume,
  dataParaInput,
  formatarCronometro,
  formatarDataExtenso,
  formatarHora,
  formatarMinutos,
  formatarPeso,
} from './formatar'

const CAMPOS_SERIE =
  'id, bloco_id, volta, exercicio_id, ordem, repeticoes, peso_kg, duracao_seg, aquecimento, exercicios(id, nome, peso_corporal)'
const CAMPOS_BLOCO_EXERCICIO =
  'id, ordem, exercicio_id, reps_alvo, peso_alvo, segundos_alvo, exercicios(id, nome, peso_corporal)'
const CAMPOS_BLOCO = 'id, ordem, tipo, voltas, notas, duracao_seg, intervalo_seg, tempo_seg'

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
  const avisar = useAvisos()
  // Carga efetiva das séries (nos exercícios de peso corporal, inclui o peso do corpo nesta data)
  const carga = useCarga()
  const pesoCorporalKg = usePesoCorporalNaData(treinoRecebido.data)
  const cargaDaSerie = (s) => carga(s, treino.data)

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

  // O resumo do fim (o do ginásio e uma linha com o cardio, se houver)
  function resumoFinal(duracao) {
    const cardio = sessoesDoTreino(treino).map(resumoSessao).join(' · ')
    return { ...resumoTreino(treino.series, duracao, cargaDaSerie), cardio: cardio || null }
  }

  // Um treino sem séries e sem intervalos de cardio feitos está vazio
  const temCardioFeito = treino.blocos.some((b) => b.tipo === 'cardio' && linhasCardio(b).some(linhaFeita))

  async function terminar() {
    if (treino.series.length === 0 && !temCardioFeito) return setConfirmar('vazio')
    const duracao = Math.max(1, Math.round((Date.now() - new Date(treino.data)) / 60000))
    setAGravar(true)
    setErro('')
    const mensagem = await guardarTreino({ duracao_min: duracao })
    setAGravar(false)
    if (mensagem) return setErro(mensagem)
    avisar('Treino guardado')
    onTerminado(resumoFinal(duracao))
  }

  async function apagarTreino() {
    setAGravar(true)
    setErro('')
    const { error } = await supabase.from('treinos').delete().eq('id', treino.id)
    setAGravar(false)
    if (error) return setErro(error.message)
    avisar(modo === 'aoVivo' ? 'Treino descartado' : 'Treino apagado')
    onApagado()
  }

  // ---------- Blocos ----------

  // exercicios: [{ id, segundos_alvo? }] (com segundos_alvo, o exercício é por tempo);
  // repsAlvo: o alvo de cada exercício (por omissão, o inicial); config: { voltas, duracao_seg, intervalo_seg }
  async function criarBloco(tipo, exercicios, repsAlvo = REPS_ALVO_INICIAIS, config = {}) {
    const { data: bloco, error } = await supabase
      .from('blocos')
      .insert({ treino_id: treino.id, ordem: proximaOrdem(treino.blocos), tipo, ...camposIniciais(tipo), ...config })
      .select(CAMPOS_BLOCO)
      .single()
    if (error) return error.message

    const { data: doBloco, error: erroExercicios } = await supabase
      .from('bloco_exercicios')
      .insert(
        exercicios.map((e, i) => ({
          bloco_id: bloco.id,
          exercicio_id: e.id,
          ordem: i + 1,
          reps_alvo: repsAlvo,
          segundos_alvo: e.segundos_alvo ?? null,
        }))
      )
      .select(CAMPOS_BLOCO_EXERCICIO)
    onAlterar((t) => ({ ...t, blocos: [...t.blocos, { ...bloco, bloco_exercicios: doBloco ?? [] }] }))
    if (erroExercicios) return erroExercicios.message
    setACriarBloco(false)
    return null
  }

  // ---------- Cardio ----------

  // Um bloco de cardio com a atividade e um intervalo por fazer (duração 0)
  async function criarBlocoCardio(atividade) {
    const { data: bloco, error } = await supabase
      .from('blocos')
      .insert({ treino_id: treino.id, ordem: proximaOrdem(treino.blocos), tipo: 'cardio', voltas: 1 })
      .select(CAMPOS_BLOCO)
      .single()
    if (error) return error.message
    const { data: linha, error: erroLinha } = await supabase
      .from('atividades_cardio')
      .insert({ bloco_id: bloco.id, volta: 1, atividade, duracao_seg: 0 })
      .select(CAMPOS_CARDIO)
      .single()
    onAlterar((t) => ({ ...t, blocos: [...t.blocos, { ...bloco, bloco_exercicios: [], atividades_cardio: linha ? [linha] : [] }] }))
    if (erroLinha) return erroLinha.message
    setACriarBloco(false)
    return null
  }

  const mudarLinhasCardio = (blocoId, mudar) =>
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.map((b) => (b.id === blocoId ? { ...b, atividades_cardio: mudar(b.atividades_cardio ?? []) } : b)),
    }))

  async function guardarIntervalo(bloco, linha, campos) {
    const { data, error } = await supabase
      .from('atividades_cardio')
      .update(campos)
      .eq('id', linha.id)
      .select(CAMPOS_CARDIO)
      .single()
    if (error) return error.message
    mudarLinhasCardio(bloco.id, (linhas) => linhas.map((l) => (l.id === linha.id ? data : l)))
    return null
  }

  async function adicionarIntervalo(bloco) {
    const linhas = linhasCardio(bloco)
    const volta = linhas.reduce((maior, l) => Math.max(maior, l.volta ?? 1), 0) + 1
    const { data, error } = await supabase
      .from('atividades_cardio')
      .insert({ bloco_id: bloco.id, volta, atividade: atividadeDoBloco(bloco) ?? 'outra', duracao_seg: 0 })
      .select(CAMPOS_CARDIO)
      .single()
    if (error) return error.message
    mudarLinhasCardio(bloco.id, (atuais) => [...atuais, data])
    return null
  }

  async function removerIntervalo(bloco, linha) {
    const { error } = await supabase.from('atividades_cardio').delete().eq('id', linha.id)
    if (error) return error.message
    mudarLinhasCardio(bloco.id, (atuais) => atuais.filter((l) => l.id !== linha.id))
    return null
  }

  // Muda a atividade de todos os intervalos do bloco
  async function mudarAtividade(bloco, atividade) {
    const { error } = await supabase.from('atividades_cardio').update({ atividade }).eq('bloco_id', bloco.id)
    if (error) return error.message
    mudarLinhasCardio(bloco.id, (atuais) => atuais.map((l) => ({ ...l, atividade })))
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
    avisar('Bloco apagado')
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

  // Liga ou desliga o "peso corporal" de um exercício. Vale para o exercício em TODOS os treinos,
  // por isso também atualiza as cópias dele que estão neste treino.
  async function mudarPesoCorporal(exercicio, pesoCorporal) {
    const { error } = await supabase.from('exercicios').update({ peso_corporal: pesoCorporal }).eq('id', exercicio.id)
    if (error) return error.message
    const atualizar = (e) => (e?.id === exercicio.id ? { ...e, peso_corporal: pesoCorporal } : e)
    onAlterar((t) => ({
      ...t,
      blocos: t.blocos.map((b) => ({
        ...b,
        bloco_exercicios: b.bloco_exercicios.map((be) => ({ ...be, exercicios: atualizar(be.exercicios) })),
      })),
      series: t.series.map((s) => ({ ...s, exercicios: atualizar(s.exercicios) })),
    }))
    avisar(`${exercicio.nome}: peso corporal ${pesoCorporal ? 'ligado' : 'desligado'} (em todos os treinos)`)
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
          duracao_seg: s.duracao_seg ?? null,
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

  // AMRAP: substitui as séries do bloco pelas geradas a partir de "voltas + reps extra" e guarda as voltas
  // registadas. lista: [{ exercicio_id, volta, repeticoes, peso_kg, duracao_seg }]
  async function registarAmrap(bloco, lista, voltas) {
    const { error: erroApagar } = await supabase.from('series').delete().eq('bloco_id', bloco.id)
    if (erroApagar) return erroApagar.message
    onAlterar((t) => ({ ...t, series: t.series.filter((s) => s.bloco_id !== bloco.id) }))
    const base = proximaOrdemSerie(treino.series.filter((s) => s.bloco_id !== bloco.id))
    const { data, error } = await supabase
      .from('series')
      .insert(lista.map((s, i) => ({ treino_id: treino.id, bloco_id: bloco.id, ordem: base + i, ...s })))
      .select(CAMPOS_SERIE)
    if (error) return error.message
    onAlterar((t) => ({ ...t, series: [...t.series, ...data] }))
    return voltas !== bloco.voltas ? atualizarBloco(bloco.id, { voltas }) : null
  }

  // Corrige uma série de uma volta feita: dados = { repeticoes, peso_kg, duracao_seg }, ou null para a apagar
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

  const volume = calcularVolume(treino.series, cargaDaSerie)
  const temPesoCorporal = treino.blocos.some((b) => b.bloco_exercicios.some((be) => be.exercicios?.peso_corporal))
  const progresso = progressoVoltas(treino)

  return (
    <div className="editor-treino">
      <div className="cartao treino-cabecalho">
        <p className="treino-data">
          {formatarDataExtenso(treino.data)}
          {modo !== 'aoVivo' && ` · ${formatarHora(treino.data)}`}
        </p>
        <div className="numeros">
          {modo === 'aoVivo' ? (
            <Cronometro inicio={treino.data} />
          ) : (
            <Numero valor={formatarMinutos(treino.duracao_min ?? 0)} rotulo="Duração" />
          )}
          <Numero valor={`${formatarPeso(volume)} kg`} rotulo="Volume" />
        </div>
        {progresso.total > 0 && <BarraProgresso {...progresso} />}
        {modo !== 'aoVivo' && <CamposTreino treino={treino} onGuardar={guardarTreino} />}
        <AvisoPesoCorporal mostrar={temPesoCorporal} />
      </div>

      {treino.blocos.length === 0 && (
        <EstadoVazio
          icone={Layers}
          titulo="Ainda não há blocos"
          texto="Adiciona o primeiro: um aquecimento, uma série ou uma super série."
        />
      )}

      {treino.blocos.map((bloco, i) =>
        bloco.tipo === 'cardio' ? (
          <CartaoCardio
            key={bloco.id}
            bloco={bloco}
            titulo={tituloBloco(bloco, numeros[i])}
            aoVivo={modo === 'aoVivo'}
            onOpcoes={() => setOpcoesId(bloco.id)}
            onGuardarIntervalo={(linha, campos) => guardarIntervalo(bloco, linha, campos)}
            onAdicionarIntervalo={() => adicionarIntervalo(bloco)}
            onRemoverIntervalo={(linha) => removerIntervalo(bloco, linha)}
          />
        ) : (
          <CartaoBloco
            key={bloco.id}
            bloco={bloco}
            titulo={tituloBloco(bloco, numeros[i], seriesDoBloco(bloco.id))}
            series={seriesDoBloco(bloco.id)}
            dataTreino={treino.data}
            pesoCorporalKg={pesoCorporalKg}
            onOpcoes={() => setOpcoesId(bloco.id)}
            onMudarVoltas={(delta) => mudarVoltas(bloco, delta)}
            onGravarVolta={(volta, lista) => gravarVolta(bloco, volta, lista)}
            onDesfazerVolta={(volta) => desfazerVolta(bloco, volta)}
            onGuardarSerie={(volta, exercicioId, dados) => guardarSerie(bloco, volta, exercicioId, dados)}
            onAtualizar={(campos) => atualizarBloco(bloco.id, campos)}
            onRegistarAmrap={(lista, voltas) => registarAmrap(bloco, lista, voltas)}
          />
        )
      )}

      <button className="botao-secundario com-icone" onClick={() => setACriarBloco(true)}>
        <Plus size={20} />
        Adicionar bloco
      </button>

      {modo === 'aoVivo' && (
        <SemanaNoTreino
          treino={treino}
          onAdicionar={(exercicio, reps) => criarBloco('serie', [exercicio], reps ?? REPS_ALVO_INICIAIS)}
        />
      )}

      <NotasTreino key={treino.id} treino={treino} onGuardar={guardarTreino} />

      {erro && <p className="erro">{erro}</p>}

      <div className="acoes-treino">
        {modo === 'aoVivo' ? (
          <button className="botao-grande com-icone" onClick={terminar} disabled={aGravar}>
            <Flag size={20} />
            {aGravar ? 'A gravar...' : 'Terminar treino'}
          </button>
        ) : (
          <button
            className="botao-grande com-icone"
            onClick={() => {
              avisar('Treino guardado')
              onConcluido(resumoFinal(treino.duracao_min ?? 0))
            }}
          >
            <Check size={20} />
            Concluir
          </button>
        )}
        <button className="botao-perigo com-icone" onClick={() => setConfirmar('apagar')}>
          <Trash2 size={18} />
          {modo === 'aoVivo' ? 'Descartar treino' : 'Apagar treino'}
        </button>
      </div>

      {confirmar && (
        <Confirmar
          titulo={
            confirmar === 'vazio' ? 'Treino sem séries' : modo === 'aoVivo' ? 'Descartar treino?' : 'Apagar treino?'
          }
          textoConfirmar={modo === 'aoVivo' ? 'Descartar treino' : 'Apagar treino'}
          textoCancelar={modo === 'aoVivo' ? 'Continuar a treinar' : 'Cancelar'}
          aProcessar={aGravar}
          onConfirmar={apagarTreino}
          onCancelar={() => setConfirmar(null)}
        >
          <p>
            {confirmar === 'vazio'
              ? 'Este treino ainda não tem séries feitas. Queres descartá-lo?'
              : modo === 'aoVivo'
                ? 'Os blocos e as séries deste treino serão apagados.'
                : 'Os blocos e as séries deste treino serão apagados. Não é possível desfazer.'}
          </p>
          {treino.favorito && confirmar !== 'vazio' && <p>Este treino é um favorito: também sai dos favoritos.</p>}
          {erro && <p className="erro">{erro}</p>}
        </Confirmar>
      )}

      {aCriarBloco && (
        <NovoBloco
          onCriar={(tipo, exercicios, config) => criarBloco(tipo, exercicios, REPS_ALVO_INICIAIS, config)}
          onCriarCardio={criarBlocoCardio}
          onMudarPesoCorporal={mudarPesoCorporal} onFechar={() => setACriarBloco(false)} />
      )}

      {blocoComOpcoes && (
        <OpcoesBloco
          key={blocoComOpcoes.id}
          bloco={blocoComOpcoes}
          titulo={tituloBloco(
            blocoComOpcoes,
            numeros[treino.blocos.indexOf(blocoComOpcoes)],
            seriesDoBloco(blocoComOpcoes.id)
          )}
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
          onMudarPesoCorporal={mudarPesoCorporal}
          onMudarAtividade={(atividade) => mudarAtividade(blocoComOpcoes, atividade)}
          onFechar={() => setOpcoesId(null)}
        />
      )}
    </div>
  )
}

// Voltas feitas sobre o total do treino
function BarraProgresso({ feitas, total }) {
  const percentagem = Math.round((feitas / total) * 100)
  return (
    <div className="progresso">
      <div className="progresso-texto">
        <span>Voltas feitas</span>
        <span className="progresso-numeros">
          {feitas}/{total}
        </span>
      </div>
      <div
        className="progresso-barra"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={feitas}
        aria-label="Voltas feitas"
      >
        <span style={{ width: `${percentagem}%` }} />
      </div>
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

  return (
    <Numero valor={formatarCronometro((agora - new Date(inicio).getTime()) / 1000)} rotulo="Duração" destaque />
  )
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
