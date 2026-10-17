import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import EscolherExercicio from './EscolherExercicio'
import {
  calcularVolume,
  formatarCronometro,
  formatarDataExtenso,
  formatarMinutos,
  formatarPeso,
  lerNumero,
  pesoParaInput,
} from './formatar'

const CAMPOS_SERIE = 'id, exercicio_id, ordem, repeticoes, peso_kg, aquecimento'

// Procura o treino em curso (duracao_min null, o mais recente) com as suas séries.
// Devolve { erro } ou { treino, exercicios, series } (treino null se não houver nenhum).
async function buscarTreinoEmCurso() {
  const { data: treino, error } = await supabase
    .from('treinos')
    .select('id, data')
    .is('duracao_min', null)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { erro: error.message }
  if (!treino) return { treino: null, exercicios: [], series: [] }

  const { data: linhas, error: erroSeries } = await supabase
    .from('series')
    .select(`${CAMPOS_SERIE}, exercicios(id, nome)`)
    .eq('treino_id', treino.id)
    .order('ordem')

  if (erroSeries) return { erro: erroSeries.message }

  // Os exercícios ficam pela ordem da sua primeira série
  const vistos = new Map()
  for (const linha of linhas) {
    if (!vistos.has(linha.exercicio_id)) vistos.set(linha.exercicio_id, linha.exercicios)
  }

  return {
    treino,
    exercicios: [...vistos.values()],
    series: linhas.map(({ exercicios: _ex, ...serie }) => serie),
  }
}

export default function Treino() {
  const [aCarregar, setACarregar] = useState(true)
  const [falhouCarregar, setFalhouCarregar] = useState(false)
  const [treino, setTreino] = useState(null)
  // Exercícios do treino, pela ordem em que foram adicionados.
  // Um exercício sem séries só existe aqui (estado local) até ter a primeira série.
  const [exercicios, setExercicios] = useState([])
  const [series, setSeries] = useState([])
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [aEscolher, setAEscolher] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // null | 'descartar' | 'vazio'
  const [resumo, setResumo] = useState(null)

  function aplicarCarregamento(resultado) {
    if (resultado.erro) {
      setErro(resultado.erro)
      setFalhouCarregar(true)
    } else {
      setTreino(resultado.treino)
      setExercicios(resultado.exercicios)
      setSeries(resultado.series)
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

  function limparTreino() {
    setTreino(null)
    setExercicios([])
    setSeries([])
    setConfirmar(null)
    setErro('')
  }

  async function comecar() {
    setAGravar(true)
    setErro('')
    const { data, error } = await supabase
      .from('treinos')
      .insert({ data: new Date().toISOString() })
      .select('id, data')
      .single()
    setAGravar(false)
    if (error) return setErro(error.message)
    setResumo(null)
    setExercicios([])
    setSeries([])
    setTreino(data)
  }

  function adicionarExercicio(exercicio) {
    setAEscolher(false)
    setExercicios((atuais) =>
      atuais.some((e) => e.id === exercicio.id) ? atuais : [...atuais, exercicio]
    )
  }

  // Devolve uma mensagem de erro, ou null se correu bem
  async function adicionarSerie(exercicioId, { repeticoes, peso_kg, aquecimento }) {
    const ordem = series.reduce((maior, s) => Math.max(maior, s.ordem ?? 0), 0) + 1
    const { data, error } = await supabase
      .from('series')
      .insert({
        treino_id: treino.id,
        exercicio_id: exercicioId,
        ordem,
        repeticoes,
        peso_kg,
        aquecimento,
      })
      .select(CAMPOS_SERIE)
      .single()
    if (error) return error.message
    setSeries((atuais) => [...atuais, data])
    return null
  }

  async function apagarSerie(id) {
    const { error } = await supabase.from('series').delete().eq('id', id)
    if (error) return error.message
    setSeries((atuais) => atuais.filter((s) => s.id !== id))
    return null
  }

  async function terminar() {
    if (series.length === 0) return setConfirmar('vazio')

    const duracao = Math.max(1, Math.round((Date.now() - new Date(treino.data)) / 60000))
    setAGravar(true)
    setErro('')
    const { error } = await supabase
      .from('treinos')
      .update({ duracao_min: duracao })
      .eq('id', treino.id)
    setAGravar(false)
    if (error) return setErro(error.message)

    setResumo({
      duracao,
      volume: calcularVolume(series),
      numSeries: series.filter((s) => !s.aquecimento).length,
      numExercicios: new Set(series.map((s) => s.exercicio_id)).size,
    })
    limparTreino()
  }

  async function descartar() {
    setAGravar(true)
    setErro('')
    const { error } = await supabase.from('treinos').delete().eq('id', treino.id)
    setAGravar(false)
    if (error) return setErro(error.message)
    limparTreino()
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

  if (!treino) {
    return (
      <div>
        <h1>Treino</h1>
        {resumo ? (
          <div className="cartao resumo">
            <h2>Treino terminado 💪</h2>
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
        <button onClick={comecar} disabled={aGravar}>
          {aGravar ? 'A começar...' : 'Começar treino'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="cartao treino-cabecalho">
        <p className="treino-data">{formatarDataExtenso(treino.data)}</p>
        <div className="numeros">
          <Cronometro inicio={treino.data} />
          <Numero valor={`${formatarPeso(calcularVolume(series))} kg`} rotulo="Volume" />
        </div>
      </div>

      {exercicios.length === 0 && (
        <p className="subtitulo">Adiciona o primeiro exercício para começar.</p>
      )}

      {exercicios.map((exercicio) => (
        <CartaoExercicio
          key={exercicio.id}
          exercicio={exercicio}
          series={series.filter((s) => s.exercicio_id === exercicio.id)}
          inicioTreino={treino.data}
          onAdicionar={adicionarSerie}
          onApagar={apagarSerie}
        />
      ))}

      <button className="botao-secundario" onClick={() => setAEscolher(true)}>
        + Adicionar exercício
      </button>

      {erro && <p className="erro">{erro}</p>}

      {confirmar ? (
        <div className="cartao confirmacao">
          <p>
            {confirmar === 'vazio'
              ? 'Este treino não tem séries. Queres descartá-lo?'
              : 'Descartar este treino? Todas as séries serão apagadas.'}
          </p>
          <button className="botao-perigo-cheio" onClick={descartar} disabled={aGravar}>
            Descartar treino
          </button>
          <button className="botao-secundario" onClick={() => setConfirmar(null)}>
            Continuar a treinar
          </button>
        </div>
      ) : (
        <div className="acoes-treino">
          <button onClick={terminar} disabled={aGravar}>
            {aGravar ? 'A gravar...' : 'Terminar treino'}
          </button>
          <button className="botao-perigo" onClick={() => setConfirmar('descartar')}>
            Descartar treino
          </button>
        </div>
      )}

      {aEscolher && (
        <EscolherExercicio
          jaEscolhidos={exercicios.map((e) => e.id)}
          onEscolher={adicionarExercicio}
          onFechar={() => setAEscolher(false)}
        />
      )}
    </div>
  )
}

function Numero({ valor, rotulo }) {
  return (
    <div className="numero">
      <span className="numero-valor">{valor}</span>
      <span className="numero-rotulo">{rotulo}</span>
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

  const segundos = (agora - new Date(inicio).getTime()) / 1000
  return <Numero valor={formatarCronometro(segundos)} rotulo="Duração" />
}

function CartaoExercicio({ exercicio, series, inicioTreino, onAdicionar, onApagar }) {
  const ultimaSerie = series[series.length - 1]
  // undefined = a carregar; null = nunca feito antes
  const [ultimaVez, setUltimaVez] = useState(undefined)
  const [reps, setReps] = useState(ultimaSerie ? String(ultimaSerie.repeticoes) : '')
  const [kg, setKg] = useState(ultimaSerie ? pesoParaInput(ultimaSerie.peso_kg) : '')
  const [aquecimento, setAquecimento] = useState(false)
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    // Última série (sem aquecimento) deste exercício num treino anterior
    supabase
      .from('series')
      .select('repeticoes, peso_kg, ordem, treinos!inner(data)')
      .eq('exercicio_id', exercicio.id)
      .eq('aquecimento', false)
      .lt('treinos.data', inicioTreino)
      .order('treinos(data)', { ascending: false })
      .order('ordem', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (!ativo) return
        if (error) {
          setErro(error.message)
          setUltimaVez(null)
          return
        }
        const anterior = data[0] ?? null
        setUltimaVez(anterior)
        // Só pré-preenche se ainda não houver valores (de uma série deste treino ou escritos à mão)
        if (anterior) {
          setReps((atual) => (atual === '' ? String(anterior.repeticoes) : atual))
          setKg((atual) => (atual === '' ? pesoParaInput(anterior.peso_kg) : atual))
        }
      })

    return () => {
      ativo = false
    }
  }, [exercicio.id, inicioTreino])

  async function submeter(e) {
    e.preventDefault()
    const repeticoes = Number(reps.trim())
    const peso = lerNumero(kg)

    if (!Number.isInteger(repeticoes) || repeticoes <= 0) return setErro('Indica as repetições.')
    if (peso === null || peso < 0 || peso > 9999.99) return setErro('Indica um peso válido.')

    setAEnviar(true)
    const mensagem = await onAdicionar(exercicio.id, {
      repeticoes,
      peso_kg: Math.round(peso * 100) / 100,
      aquecimento,
    })
    setAEnviar(false)
    setErro(mensagem ?? '')
    // Volta a desmarcar para não gravar séries normais como aquecimento por esquecimento
    if (!mensagem) setAquecimento(false)
  }

  async function apagar(id) {
    const mensagem = await onApagar(id)
    setErro(mensagem ?? '')
  }

  // As séries de aquecimento mostram "A" e não contam para a numeração
  const rotulos = []
  let contador = 0
  for (const serie of series) {
    if (serie.aquecimento) rotulos.push('A')
    else rotulos.push(String(++contador))
  }

  return (
    <div className="cartao exercicio">
      <h2>{exercicio.nome}</h2>
      <p className="ultima-vez">
        {ultimaVez === undefined
          ? 'Última vez: …'
          : ultimaVez
            ? `Última vez: ${ultimaVez.repeticoes} × ${formatarPeso(ultimaVez.peso_kg)} kg`
            : 'Primeira vez neste exercício'}
      </p>

      {series.length > 0 && (
        <ul className="series">
          {series.map((serie, i) => (
            <li key={serie.id}>
              <span className={serie.aquecimento ? 'serie-num aquecimento' : 'serie-num'}>
                {rotulos[i]}
              </span>
              <span className="serie-valor">{serie.repeticoes} reps</span>
              <span className="serie-valor">{formatarPeso(serie.peso_kg)} kg</span>
              <button
                className="botao-apagar"
                onClick={() => apagar(serie.id)}
                aria-label="Apagar série"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="serie-form" onSubmit={submeter}>
        <label>
          <span>Reps</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </label>
        <label>
          <span>kg</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
        </label>
        <button type="submit" disabled={aEnviar} aria-label="Adicionar série">
          +
        </button>
      </form>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={aquecimento}
          onChange={(e) => setAquecimento(e.target.checked)}
        />
        Série de aquecimento
      </label>

      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
