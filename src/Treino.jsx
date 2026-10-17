import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { buscarTreino, buscarTreinoEmCurso } from './consultas'
import EditorTreino from './EditorTreino'
import NovoTreino from './NovoTreino'
import Numero from './Numero'
import { formatarMinutos, formatarPeso } from './formatar'

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

// Separador Treino: retoma o treino em curso, ou mostra o ecrã para começar um treino
// ou registar um passado. O editor é o mesmo nos dois casos.
export default function Treino() {
  const [aCarregar, setACarregar] = useState(true)
  const [falhouCarregar, setFalhouCarregar] = useState(false)
  const [treino, setTreino] = useState(null)
  const [modo, setModo] = useState('aoVivo') // 'aoVivo' | 'passado'
  const [novo, setNovo] = useState(null) // null | 'aoVivo' | 'passado' (janela aberta)
  const [resumo, setResumo] = useState(null)
  const [erro, setErro] = useState('')

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
    window.scrollTo(0, 0)
  }

  if (aCarregar) return <p className="subtitulo">A carregar...</p>

  if (falhouCarregar) {
    return (
      <div>
        <h1>Treino</h1>
        <p className="erro">{erro}</p>
        <button onClick={tentarNovamente}>Tentar novamente</button>
      </div>
    )
  }

  if (treino) {
    return (
      <div>
        {modo === 'passado' && <h1 className="titulo-editor">Treino passado</h1>}
        {erro && <p className="erro">{erro}</p>}
        <EditorTreino
          modo={modo}
          treino={treino}
          onAlterar={(atualizar) => setTreino((atual) => atualizar(atual))}
          onTerminado={(r) => fecharTreino({ ...r, titulo: 'Treino terminado 💪' })}
          onConcluido={(r) => fecharTreino({ ...r, titulo: 'Treino registado ✓' })}
          onApagado={() => fecharTreino(null)}
        />
      </div>
    )
  }

  return (
    <div>
      <h1>Treino</h1>
      {resumo ? (
        <div className="cartao resumo">
          <h2>{resumo.titulo}</h2>
          <div className="numeros">
            <Numero valor={formatarMinutos(resumo.duracao)} rotulo="Duração" />
            <Numero valor={`${formatarPeso(resumo.volume)} kg`} rotulo="Volume" />
          </div>
          <p className="subtitulo resumo-detalhe">
            {resumo.numExercicios} {resumo.numExercicios === 1 ? 'exercício' : 'exercícios'} ·{' '}
            {resumo.numSeries} {resumo.numSeries === 1 ? 'série' : 'séries'}
          </p>
        </div>
      ) : (
        <p className="subtitulo">Não tens nenhum treino em curso.</p>
      )}
      {erro && <p className="erro">{erro}</p>}

      <button onClick={() => setNovo('aoVivo')}>Começar treino</button>
      <button className="botao-secundario" onClick={() => setNovo('passado')}>
        Registar treino passado
      </button>

      {novo && <NovoTreino modo={novo} onCriar={criarTreino} onFechar={() => setNovo(null)} />}
    </div>
  )
}
