import { useEffect, useState } from 'react'
import { Check, Ellipsis, History, Minus, Plus, Target } from 'lucide-react'
import { supabase } from './supabase'
import IconeBloco from './IconeBloco'
import { estadoVoltas, letraExercicio, sugestaoVolta, validarVolta } from './blocos'
import { pesoParaInput } from './formatar'
import { vibrar } from './movimento'
import { textoCarga, textoSerie } from './pesoCorporal'

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
// Nos exercícios de peso corporal (etiqueta PC), o peso é o extra. pesoCorporalKg: o peso do corpo
// na data do treino (null se desconhecido), para validar. As on* devolvem uma mensagem de erro, ou null.
export default function CartaoBloco({
  bloco,
  titulo,
  series,
  dataTreino,
  pesoCorporalKg = null,
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
        <h2 className="etiqueta-bloco">
          <IconeBloco tipo={bloco.tipo} />
          {titulo}
        </h2>
        <button className="botao-opcoes" onClick={onOpcoes} aria-label="Opções do bloco">
          <Ellipsis size={22} />
        </button>
      </div>

      {exercicios.length === 0 ? (
        <p className="nota sem-margem-topo">Este bloco não tem exercícios. Toca em ⋯ para os adicionar.</p>
      ) : (
        <ul className="bloco-exercicios">
          {exercicios.map((be, i) => {
            const ultima = ultimas[be.exercicio_id]
            const pc = Boolean(be.exercicios?.peso_corporal)
            const temAlvoPeso = be.peso_alvo !== null && be.peso_alvo !== undefined
            return (
              <li key={be.id}>
                {exercicios.length > 1 && <span className="letra">{letraExercicio(i)}</span>}
                <span className="bloco-exercicio-texto">
                  <span className="bloco-exercicio-nome">
                    {be.exercicios?.nome ?? '—'}
                    {pc && (
                      <span className="etiqueta etiqueta-pc" title="Peso corporal: o peso é o extra">
                        PC
                      </span>
                    )}
                  </span>
                  <span className="bloco-exercicio-alvo com-icone">
                    <Target size={13} aria-hidden="true" />
                    Alvo: {be.reps_alvo} reps
                    {(temAlvoPeso || pc) && ` × ${textoCarga(be.peso_alvo ?? 0, pc)}`}
                  </span>
                  {ultima && (
                    <span className="bloco-exercicio-alvo com-icone">
                      <History size={13} aria-hidden="true" />
                      Última vez: {textoSerie(ultima.repeticoes, ultima.peso_kg, pc)}
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
            pesoCorporalKg={pesoCorporalKg}
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
          <Minus size={20} />
        </button>
        <span className="numero-voltas">
          {bloco.voltas} {bloco.voltas === 1 ? 'volta' : 'voltas'}
        </span>
        <button className="botao-redondo" onClick={() => mudarVoltas(1)} aria-label="Mais uma volta">
          <Plus size={20} />
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
function Volta({
  numero,
  estado,
  exercicios,
  seriesDoBloco,
  ultimas,
  pesoCorporalKg,
  onGravar,
  onDesfazer,
  onGuardarSerie,
}) {
  const [editados, setEditados] = useState({}) // exercicio_id → { reps?, kg? } escritos à mão
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const [acabouDeMarcar, setAcabouDeMarcar] = useState(false) // para a animação do ✓

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

  // Linha para validar: nos exercícios de peso corporal, o kg é o extra (pode ser negativo)
  function linha(be, campos) {
    return {
      exercicio_id: be.exercicio_id,
      ...campos,
      pesoCorporal: Boolean(be.exercicios?.peso_corporal),
      pesoCorporalKg,
    }
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

    const resultado = validarVolta(exercicios.map((be) => linha(be, valores(be))))
    if (resultado.erro) return setErro(resultado.erro)
    setAGravar(true)
    const mensagem = await onGravar(resultado.series)
    setAGravar(false)
    if (mensagem) return setErro(mensagem)
    setEditados({})
    setAcabouDeMarcar(true)
    vibrar(30)
  }

  async function sairDoCampo(be) {
    if (!estado.feita || !editados[be.exercicio_id]) return
    const { reps, kg } = valores(be)
    let dados = null
    if (reps.trim() !== '') {
      const resultado = validarVolta([linha(be, { reps, kg })])
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
              {be.exercicios?.peso_corporal ? (
                <CampoExtra
                  valor={kg}
                  nome={nome}
                  numero={numero}
                  onMudar={(valor) => mudar(be.exercicio_id, 'kg', valor)}
                  onSair={() => sairDoCampo(be)}
                />
              ) : (
                <>
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
                </>
              )}
            </div>
          )
        })}
      </div>
      <button
        className={`botao-volta${estado.feita ? ' feita' : ''}${acabouDeMarcar ? ' pop' : ''}`}
        onClick={alternar}
        onAnimationEnd={() => setAcabouDeMarcar(false)}
        disabled={aGravar}
        aria-pressed={estado.feita}
        aria-label={estado.feita ? `Desfazer a volta ${numero}` : `Marcar a volta ${numero} como feita`}
      >
        <Check size={26} strokeWidth={3} />
      </button>
      {erro && <p className="erro volta-erro">{erro}</p>}
    </div>
  )
}

// Peso extra de um exercício de peso corporal: "× PC + [10] kg". O botão +/− troca o sinal (o teclado
// decimal do iPhone não tem a tecla −); o campo mostra só o valor, sem sinal. Vazio ou 0 = só o corpo.
function CampoExtra({ valor, nome, numero, onMudar, onSair }) {
  const texto = String(valor ?? '')
  const negativo = /^\s*[-−]/.test(texto)
  const absoluto = texto.replace(/^\s*[-−]\s*/, '')
  const juntar = (sinalNegativo, numeroTexto) => (sinalNegativo && numeroTexto !== '' ? `-${numeroTexto}` : numeroTexto)

  return (
    <>
      <span className="vezes">× PC</span>
      <button
        type="button"
        className={negativo ? 'botao-sinal negativo' : 'botao-sinal'}
        onClick={() => onMudar(juntar(!negativo, absoluto || '0'))}
        onBlur={onSair}
        aria-label={negativo ? 'Peso assistido (a menos). Tocar para mais' : 'Peso extra (a mais). Tocar para menos'}
      >
        {negativo ? '−' : '+'}
      </button>
      <input
        type="text"
        inputMode="decimal"
        className="campo-kg"
        value={absoluto}
        placeholder="0"
        onChange={(e) => onMudar(juntar(negativo, e.target.value.replace(/[-−]/g, '')))}
        onBlur={onSair}
        aria-label={`Kg extra de ${nome}, volta ${numero} (${negativo ? 'a menos, assistido' : 'a mais'})`}
      />
      <span className="unidade">kg</span>
    </>
  )
}
