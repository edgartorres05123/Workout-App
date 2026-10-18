import { useEffect, useImperativeHandle, useState } from 'react'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import { estruturaParaCopiar } from './blocos'
import { buscarTreino, buscarTreinoEmCurso } from './consultas'
import EditorTreino from './EditorTreino'
import Esqueleto from './Esqueleto'
import InicioTreino from './InicioTreino'
import NovoTreino from './NovoTreino'

// Copia a estrutura de um treino anterior (blocos, exercícios e alvos) para o treino novo
async function copiarEstrutura(treinoId, estrutura) {
  if (estrutura.length === 0) return null
  const { data: blocos, error } = await supabase
    .from('blocos')
    .insert(estrutura.map(({ ordem, tipo, voltas, notas }) => ({ treino_id: treinoId, ordem, tipo, voltas, notas })))
    .select('id, ordem')
  if (error) return error.message

  const idPorOrdem = new Map(blocos.map((b) => [b.ordem, b.id]))
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
// ref: expõe comecarComFavorito(modo, favorito), usado pela página dos favoritos.
export default function Treino({ ref, nome, ativo = true, onCabecalho, onVerFavoritos }) {
  const [aCarregar, setACarregar] = useState(true)
  const [falhouCarregar, setFalhouCarregar] = useState(false)
  const [treino, setTreino] = useState(null)
  const [modo, setModo] = useState('aoVivo') // 'aoVivo' | 'passado'
  const [novo, setNovo] = useState(null) // null | 'aoVivo' | 'passado' (janela aberta)
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

  // Começar a partir de um favorito: ao vivo começa logo; passado abre a janela com ele escolhido.
  // Com um treino aberto no editor, não começa outro (o treino em curso nunca é posto de lado).
  function comecarComFavorito(modoNovo, favorito) {
    if (aCarregar) {
      avisar('Um momento: ainda estou a ver se há um treino em curso.', 'erro')
      return
    }
    if (treino) {
      avisar(
        modo === 'aoVivo'
          ? 'Já tens um treino em curso. Termina-o antes de começar outro.'
          : 'Conclui o treino que estás a registar antes de começar outro.',
        'erro'
      )
      return
    }
    if (modoNovo === 'aoVivo') repetir(estruturaParaCopiar(favorito))
    else abrirNovo('passado', favorito)
  }

  useImperativeHandle(ref, () => ({ comecarComFavorito }))

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
        onVerFavoritos={onVerFavoritos}
      />

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
