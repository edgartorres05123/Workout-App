import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { estadoVoltas, letraExercicio, sugestaoVolta, validarVolta } from './blocos'
import { formatarPeso, pesoParaInput } from './formatar'

// Última série deste exercício num treino anterior: de aquecimento nos blocos de aquecimento,
// normal nos outros
function buscarUltimaVez(exercicioId, aquecimento, antesDe) {
  return supabase
    .from('series')
    .select('repeticoes, peso_kg, ordem, treinos!inner(data)')
    .eq('exercicio_id', exercicioId)
    .eq('aquecimento', aquecimento)
    .lt('treinos.data', antesDe)
    .order('treinos(data)', { ascending: false })
    .order('ordem', { ascending: false })
    .limit(1)
}

// Um bloco no editor: exercícios com os alvos e a última vez, e as voltas com os campos e o ✓.
// As funções on* devolvem uma mensagem de erro, ou null se correu bem.
export default function CartaoBloco({
  bloco,
  titulo,
  series,
  dataTreino,
  onOpcoes,
  onMudarVoltas,
  onGravarVolta,
  onDesfazerVolta,
  onGuardarSerie,
}) {
  const exercicios = bloco.bloco_exercicios
  const aquecimento = bloco.tipo === 'aquecimento'
  const chaveExercicios = exercicios.map((be) => be.exercicio_id).join(',')
  const [ultimas, setUltimas] = useState({}) // exercicio_id → { repeticoes, peso_kg } | null
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    const ids = chaveExercicios ? chaveExercicios.split(',').map(Number) : []
    Promise.all(ids.map((id) => buscarUltimaVez(id, aquecimento, dataTreino))).then((resultados) => {
      if (!ativo) return
      setUltimas(Object.fromEntries(resultados.map(({ data, error }, i) => [ids[i], error ? null : (data[0] ?? null)])))
    })
    return () => {
      ativo = false
    }
  }, [chaveExercicios, aquecimento, dataTreino])

  async function mudarVoltas(delta) {
    setErro('')
    const mensagem = await onMudarVoltas(delta)
    if (mensagem) setErro(mensagem)
  }

  const voltas = estadoVoltas(bloco, series)

  return (
    <div className={`cartao bloco bloco-${bloco.tipo}`}>
      <div className="bloco-topo">
        <h2>{titulo}</h2>
        <button className="botao-opcoes" onClick={onOpcoes} aria-label="Opções do bloco">
          ⋯
        </button>
      </div>

      {exercicios.length === 0 ? (
        <p className="nota sem-margem-topo">Este bloco não tem exercícios. Toca em ⋯ para os adicionar.</p>
      ) : (
        <ul className="bloco-exercicios">
          {exercicios.map((be, i) => {
            const ultima = ultimas[be.exercicio_id]
            return (
              <li key={be.id}>
                {exercicios.length > 1 && <span className="letra">{letraExercicio(i)}</span>}
                <span className="bloco-exercicio-texto">
                  <span className="bloco-exercicio-nome">{be.exercicios?.nome ?? '—'}</span>
                  <span className="bloco-exercicio-alvo">
                    Alvo: {be.reps_alvo} reps
                    {be.peso_alvo !== null && be.peso_alvo !== undefined && ` × ${formatarPeso(be.peso_alvo)} kg`}
                  </span>
                  {ultima && (
                    <span className="bloco-exercicio-alvo">
                      Última vez: {ultima.repeticoes} × {formatarPeso(ultima.peso_kg)} kg
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {bloco.tipo === 'superserie' && exercicios.length === 1 && (
        <p className="aviso">Uma super série precisa de 2 ou mais exercícios. Toca em ⋯ para adicionar outro.</p>
      )}

      {exercicios.length > 0 &&
        voltas.map((estado) => (
          <Volta
            key={estado.volta}
            numero={estado.volta}
            estado={estado}
            exercicios={exercicios}
            seriesDoBloco={series}
            ultimas={ultimas}
            onGravar={(lista) => onGravarVolta(estado.volta, lista)}
            onDesfazer={() => onDesfazerVolta(estado.volta)}
            onGuardarSerie={(exercicioId, dados) => onGuardarSerie(estado.volta, exercicioId, dados)}
          />
        ))}

      <div className="bloco-voltas">
        <button
          className="botao-redondo"
          onClick={() => mudarVoltas(-1)}
          disabled={bloco.voltas <= 1}
          aria-label="Menos uma volta"
        >
          −
        </button>
        <span>
          {bloco.voltas} {bloco.voltas === 1 ? 'volta' : 'voltas'}
        </span>
        <button className="botao-redondo" onClick={() => mudarVoltas(1)} aria-label="Mais uma volta">
          +
        </button>
      </div>

      {bloco.notas && <p className="nota">{bloco.notas}</p>}
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

// Uma volta: os campos de reps e peso de cada exercício e o ✓.
// ✓ grava a volta inteira (as reps vazias saltam o exercício); tocar outra vez desfaz a volta.
// Numa volta já feita, cada campo grava ao sair (reps vazias apagam essa série).
function Volta({ numero, estado, exercicios, seriesDoBloco, ultimas, onGravar, onDesfazer, onGuardarSerie }) {
  const [editados, setEditados] = useState({}) // exercicio_id → { reps?, kg? } escritos à mão
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  function valores(be) {
    const serie = estado.series.get(be.exercicio_id)
    const base = serie
      ? { reps: String(serie.repeticoes), kg: pesoParaInput(serie.peso_kg) }
      : sugestaoVolta(be, numero, seriesDoBloco, ultimas[be.exercicio_id])
    const editado = editados[be.exercicio_id]
    return { reps: editado?.reps ?? base.reps, kg: editado?.kg ?? base.kg }
  }

  function mudar(exercicioId, campo, valor) {
    setEditados((atuais) => ({ ...atuais, [exercicioId]: { ...atuais[exercicioId], [campo]: valor } }))
  }

  function esquecer(exercicioId) {
    setEditados(({ [exercicioId]: _removido, ...resto }) => resto)
  }

  async function alternar() {
    setErro('')
    if (estado.feita) {
      // Desfaz a volta, mas os números ficam nos campos
      const atuais = Object.fromEntries(exercicios.map((be) => [be.exercicio_id, valores(be)]))
      setAGravar(true)
      const mensagem = await onDesfazer()
      setAGravar(false)
      if (mensagem) return setErro(mensagem)
      setEditados(atuais)
      return
    }

    const resultado = validarVolta(exercicios.map((be) => ({ exercicio_id: be.exercicio_id, ...valores(be) })))
    if (resultado.erro) return setErro(resultado.erro)
    setAGravar(true)
    const mensagem = await onGravar(resultado.series)
    setAGravar(false)
    if (mensagem) return setErro(mensagem)
    setEditados({})
  }

  async function sairDoCampo(be) {
    if (!estado.feita || !editados[be.exercicio_id]) return
    const { reps, kg } = valores(be)
    let dados = null
    if (reps.trim() !== '') {
      const resultado = validarVolta([{ exercicio_id: be.exercicio_id, reps, kg }])
      if (resultado.erro) {
        setErro(resultado.erro)
        esquecer(be.exercicio_id)
        return
      }
      dados = resultado.series[0]
    }

    const serie = estado.series.get(be.exercicio_id)
    const igual =
      serie && dados && serie.repeticoes === dados.repeticoes && Number(serie.peso_kg) === dados.peso_kg
    if (igual || (!serie && !dados)) return esquecer(be.exercicio_id)

    setErro('')
    const mensagem = await onGuardarSerie(be.exercicio_id, dados)
    if (mensagem) setErro(mensagem)
    esquecer(be.exercicio_id)
  }

  return (
    <div className={estado.feita ? 'volta feita' : 'volta'}>
      <span className="volta-numero">{numero}</span>
      <div className="volta-linhas">
        {exercicios.map((be, i) => {
          const { reps, kg } = valores(be)
          const nome = be.exercicios?.nome ?? 'exercício'
          return (
            <div key={be.id} className="volta-linha">
              {exercicios.length > 1 && <span className="letra">{letraExercicio(i)}</span>}
              <input
                type="text"
                inputMode="numeric"
                className="campo-reps"
                value={reps}
                placeholder="reps"
                onChange={(e) => mudar(be.exercicio_id, 'reps', e.target.value)}
                onBlur={() => sairDoCampo(be)}
                aria-label={`Reps de ${nome}, volta ${numero}`}
              />
              <span className="vezes">×</span>
              <input
                type="text"
                inputMode="decimal"
                className="campo-kg"
                value={kg}
                placeholder="0"
                onChange={(e) => mudar(be.exercicio_id, 'kg', e.target.value)}
                onBlur={() => sairDoCampo(be)}
                aria-label={`Peso em kg de ${nome}, volta ${numero}`}
              />
              <span className="unidade">kg</span>
            </div>
          )
        })}
      </div>
      <button
        className={estado.feita ? 'botao-volta feita' : 'botao-volta'}
        onClick={alternar}
        disabled={aGravar}
        aria-pressed={estado.feita}
        aria-label={estado.feita ? `Desfazer a volta ${numero}` : `Marcar a volta ${numero} como feita`}
      >
        ✓
      </button>
      {erro && <p className="erro volta-erro">{erro}</p>}
    </div>
  )
}
