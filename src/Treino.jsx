import { useEffect, useImperativeHandle, useState } from 'react'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import { estruturaParaCopiar } from './blocos'
import { resumoSessao } from './cardio'
import { buscarTreino, buscarTreinoEmCurso } from './consultas'
import EditorTreino from './EditorTreino'
import Esqueleto from './Esqueleto'
import InicioTreino from './InicioTreino'
import NovoTreino from './NovoTreino'
import RegistarAtividade from './RegistarAtividade'

// Copia a estrutura de um treino anterior (blocos, exercícios e alvos) para o treino novo
async function copiarEstrutura(treinoId, estrutura) {
  if (estrutura.length === 0) return null
  const { data: blocos, error } = await supabase
    .from('blocos')
    .insert(
      estrutura.map(({ ordem, tipo, voltas, notas, duracao_seg = null, intervalo_seg = null }) => ({
        treino_id: treinoId,
        ordem,
        tipo,
        voltas,
        notas,
        duracao_seg,
        intervalo_seg,
      }))
    )
    .select('id, ordem')
  if (error) return error.message

  const idPorOrdem = new Map(blocos.map((b) => [b.ordem, b.id]))

  // Blocos de cardio: um intervalo por fazer (duração 0) por cada um do original, com a atividade
  const cardio = estrutura.flatMap((b) =>
    (b.atividades ?? []).map(({ volta, atividade }) => ({ bloco_id: idPorOrdem.get(b.ordem), volta, atividade, duracao_seg: 0 }))
  )
  if (cardio.length > 0) {
    const { error: erroCardio } = await supabase.from('atividades_cardio').insert(cardio)
    if (erroCardio) return erroCardio.message
  }
  const linhas = estrutura.flatMap((b) =>
    b.exercicios.map((e) => ({ bloco_id: idPorOrdem.get(b.ordem), ...e }))
  )
  if (linhas.length === 0) return null
  const { error: erroExercicios } = await supabase.from('bloco_exercicios').insert(linhas)
  return erroExercicios ? erroExercicios.message : null
}

// Separador Início: retoma o treino em curso, ou mostra o ecrã de início para começar um treino,
// repetir o último ou registar um passado. O editor é o mesmo em todos os casos.
// nome: o nome do utilizador (para a saudação); ativo: o separador está visível;
// onCabecalho({ titulo, hero, emCurso }): informa o cabeçalho da app (título, imagem por baixo e
// se há um treino ao vivo, para o "Sair" avisar que o treino fica guardado).
// ref: expõe comecarComFavorito(modo, favorito), usado pelos favoritos e pelas ideias de treino,
// e motivoParaNaoComecar().
export default function Treino({ ref, nome, ativo = true, onCabecalho, onVerFavoritos }) {
  const [aCarregar, setACarregar] = useState(true)
  const [falhouCarregar, setFalhouCarregar] = useState(false)
  const [treino, setTreino] = useState(null)
  const [modo, setModo] = useState('aoVivo') // 'aoVivo' | 'passado'
  const [novo, setNovo] = useState(null) // null | 'aoVivo' | 'passado' (janela aberta)
  const [aRegistarAtividade, setARegistarAtividade] = useState(false)
  const [resumo, setResumo] = useState(null)
  const [erro, setErro] = useState('')
  const [aCriar, setACriar] = useState(false)
  const [versaoInicio, setVersaoInicio] = useState(0) // muda quando um treino acaba
  // Treino a copiar já escolhido quando a janela de novo treino abre (vindo de um favorito)
  const [origemInicial, setOrigemInicial] = useState(null)
  const avisar = useAvisos()

  // Com um treino aberto no editor, o cabeçalho mostra o título do treino (o ecrã de início trata do resto)
  const temTreino = Boolean(treino)
  useEffect(() => {
    if (!temTreino) return
    onCabecalho?.({
      titulo: modo === 'passado' ? 'Treino passado' : 'Treino em curso',
      hero: false,
      emCurso: modo === 'aoVivo',
    })
  }, [temTreino, modo, onCabecalho])

  function aplicarCarregamento(resultado) {
    if (resultado.erro) {
      setErro(resultado.erro)
      setFalhouCarregar(true)
    } else {
      setTreino(resultado.treino)
      setModo('aoVivo')
    }
    setACarregar(false)
  }

  useEffect(() => {
    let ativo = true
    buscarTreinoEmCurso().then((resultado) => {
      if (ativo) aplicarCarregamento(resultado)
    })
    return () => {
      ativo = false
    }
  }, [])

  function tentarNovamente() {
    setACarregar(true)
    setFalhouCarregar(false)
    setErro('')
    buscarTreinoEmCurso().then(aplicarCarregamento)
  }

  // Cria o treino (ao vivo: em curso; passado: já terminado) e copia a estrutura, se houver
  async function criarTreino({ data, duracao_min, estrutura }) {
    const { data: criado, error } = await supabase
      .from('treinos')
      .insert({ data, duracao_min })
      .select('id')
      .single()
    if (error) return error.message

    const erroCopia = await copiarEstrutura(criado.id, estrutura)
    const resultado = await buscarTreino(criado.id)
    if (resultado.erro) return resultado.erro

    setResumo(null)
    setNovo(null)
    setModo(duracao_min === null ? 'aoVivo' : 'passado')
    setTreino(resultado.treino)
    setErro(erroCopia ? `O treino foi criado, mas não foi possível copiar toda a estrutura: ${erroCopia}` : '')
    window.scrollTo(0, 0)
    return null
  }

  function fecharTreino(novoResumo) {
    setResumo(novoResumo)
    setTreino(null)
    setErro('')
    setVersaoInicio((v) => v + 1)
    window.scrollTo(0, 0)
  }

  // "Repetir último treino": começa logo um treino ao vivo com a estrutura copiada
  // Uma atividade sozinha (sem ginásio): um treino terminado só com um bloco de cardio. A duração do
  // treino é a da atividade, arredondada para cima ao minuto. Se algo falhar a meio, o treino é apagado.
  async function registarAtividade({ data, atividade, dados }) {
    const duracao = Math.max(1, Math.ceil(dados.duracao_seg / 60))
    const { data: criado, error } = await supabase
      .from('treinos')
      .insert({ data, duracao_min: duracao })
      .select('id')
      .single()
    if (error) return error.message
    const desfazer = async (mensagem) => {
      await supabase.from('treinos').delete().eq('id', criado.id)
      return mensagem
    }
    const { data: bloco, error: erroBloco } = await supabase
      .from('blocos')
      .insert({ treino_id: criado.id, ordem: 1, tipo: 'cardio', voltas: 1 })
      .select('id')
      .single()
    if (erroBloco) return desfazer(erroBloco.message)
    const { error: erroCardio } = await supabase
      .from('atividades_cardio')
      .insert({ bloco_id: bloco.id, volta: 1, atividade, ...dados })
    if (erroCardio) return desfazer(erroCardio.message)

    setARegistarAtividade(false)
    avisar('Atividade registada')
    fecharTreino({
      titulo: 'Atividade registada',
      duracao,
      volume: 0,
      numSeries: 0,
      numExercicios: 0,
      cardio: resumoSessao({ atividade, ...dados, intervalos: 1 }),
    })
    return null
  }

  // "Começar agora": um treino ao vivo só com o bloco de cardio (para cronometrar a atividade)
  async function comecarAtividade(atividade) {
    setARegistarAtividade(false)
    await repetir([
      { ordem: 1, tipo: 'cardio', voltas: 1, notas: null, exercicios: [], atividades: [{ volta: 1, atividade }] },
    ])
    return null
  }

  async function repetir(estrutura) {
    setACriar(true)
    setErro('')
    const mensagem = await criarTreino({ data: new Date().toISOString(), duracao_min: null, estrutura })
    setACriar(false)
    if (mensagem) setErro(mensagem)
  }

  function abrirNovo(modoNovo, origem = null) {
    setOrigemInicial(origem)
    setNovo(modoNovo)
  }

  // Mensagem se agora não der para começar outro treino (null se der)
  function motivoParaNaoComecar() {
    if (aCarregar) return 'Um momento: ainda estou a ver se há um treino em curso.'
    if (treino) {
      return modo === 'aoVivo'
        ? 'Já tens um treino em curso. Termina-o antes de começar outro.'
        : 'Conclui o treino que estás a registar antes de começar outro.'
    }
    return null
  }

  // Começar a partir de um favorito (ou de uma ideia de treino, com a mesma forma: um treino só com
  // blocos): ao vivo começa logo; passado abre a janela com ele escolhido.
  // Com um treino aberto no editor, não começa outro (o treino em curso nunca é posto de lado).
  function comecarComFavorito(modoNovo, favorito) {
    const motivo = motivoParaNaoComecar()
    if (motivo) {
      avisar(motivo, 'erro')
      return
    }
    if (modoNovo === 'aoVivo') repetir(estruturaParaCopiar(favorito))
    else abrirNovo('passado', favorito)
  }

  useImperativeHandle(ref, () => ({ comecarComFavorito, motivoParaNaoComecar }))

  if (aCarregar) return <Esqueleto titulo numeros={3} cartoes={2} />

  if (falhouCarregar) {
    return (
      <div>
        <p className="erro">{erro}</p>
        <button onClick={tentarNovamente}>Tentar novamente</button>
      </div>
    )
  }

  if (treino) {
    return (
      <div>
        {erro && <p className="erro">{erro}</p>}
        <EditorTreino
          modo={modo}
          treino={treino}
          onAlterar={(atualizar) => setTreino((atual) => atualizar(atual))}
          onTerminado={(r) => fecharTreino({ ...r, titulo: 'Treino terminado' })}
          onConcluido={(r) => fecharTreino({ ...r, titulo: 'Treino registado' })}
          onApagado={() => fecharTreino(null)}
        />
      </div>
    )
  }

  return (
    <div>
      {erro && <p className="erro">{erro}</p>}
      <InicioTreino
        onCabecalho={onCabecalho}
        nome={nome}
        ativo={ativo}
        recarregar={versaoInicio}
        resumo={resumo}
        aCriar={aCriar}
        onComecar={() => abrirNovo('aoVivo')}
        onRepetir={repetir}
        onRegistar={() => abrirNovo('passado')}
        onRegistarAtividade={() => setARegistarAtividade(true)}
        onVerFavoritos={onVerFavoritos}
      />

      {aRegistarAtividade && (
        <RegistarAtividade
          onRegistar={registarAtividade}
          onComecarAgora={comecarAtividade}
          onFechar={() => setARegistarAtividade(false)}
        />
      )}

      {novo && (
        <NovoTreino
          modo={novo}
          origemInicial={origemInicial}
          onCriar={criarTreino}
          onFechar={() => setNovo(null)}
        />
      )}
    </div>
  )
}
