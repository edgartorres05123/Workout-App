import { useState } from 'react'
import { supabase } from './supabase'
import EscolherExercicio from './EscolherExercicio'
import FormSerie from './FormSerie'
import Numero from './Numero'
import {
  agruparPorExercicio,
  calcular1RM,
  calcularVolume,
  dataParaInput,
  formatarDataExtenso,
  formatarHora,
  formatarMinutos,
  formatarPeso,
  lerNumero,
  melhorSerie,
  pesoParaInput,
  rotulosSeries,
} from './formatar'

const CAMPOS_SERIE = 'id, exercicio_id, ordem, repeticoes, peso_kg, aquecimento, exercicios(id, nome)'

// Ao carregar em Enter num campo, sai do campo (e grava, porque grava ao sair)
function sairComEnter(e) {
  if (e.key === 'Enter') e.currentTarget.blur()
}

// Detalhe de um treino terminado. O treino vem da lista do Histórico; cada alteração é gravada
// logo no Supabase e depois comunicada com onAlterar(atualizar, mudouData), para a lista ficar certa.
export default function DetalheTreino({ treino, onVoltar, onAlterar, onApagado }) {
  const [aEditar, setAEditar] = useState(false)
  // Exercícios adicionados no modo Editar que ainda não têm séries (só existem aqui)
  const [extras, setExtras] = useState([])
  const [aEscolher, setAEscolher] = useState(false)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const [aApagar, setAApagar] = useState(false)
  const [erro, setErro] = useState('')

  const series = treino.series
  const grupos = agruparPorExercicio(series)
  if (aEditar) {
    for (const exercicio of extras) {
      if (!grupos.some((g) => g.exercicio.id === exercicio.id)) grupos.push({ exercicio, series: [] })
    }
  }

  // Todas devolvem uma mensagem de erro, ou null se correu bem
  async function guardarTreino(campos) {
    const { error } = await supabase.from('treinos').update(campos).eq('id', treino.id)
    if (error) return error.message
    onAlterar((t) => ({ ...t, ...campos }), 'data' in campos)
    return null
  }

  async function adicionarSerie(exercicioId, { repeticoes, peso_kg, aquecimento }) {
    const ordem = series.reduce((maior, s) => Math.max(maior, s.ordem ?? 0), 0) + 1
    const { data, error } = await supabase
      .from('series')
      .insert({ treino_id: treino.id, exercicio_id: exercicioId, ordem, repeticoes, peso_kg, aquecimento })
      .select(CAMPOS_SERIE)
      .single()
    if (error) return error.message
    onAlterar((t) => ({ ...t, series: [...t.series, data] }))
    return null
  }

  async function guardarSerie(id, campos) {
    const { data, error } = await supabase
      .from('series')
      .update(campos)
      .eq('id', id)
      .select(CAMPOS_SERIE)
      .single()
    if (error) return error.message
    onAlterar((t) => ({ ...t, series: t.series.map((s) => (s.id === id ? data : s)) }))
    return null
  }

  async function apagarSerie(id) {
    const { error } = await supabase.from('series').delete().eq('id', id)
    if (error) return error.message
    onAlterar((t) => ({ ...t, series: t.series.filter((s) => s.id !== id) }))
    return null
  }

  async function apagarTreino() {
    setAApagar(true)
    setErro('')
    const { error } = await supabase.from('treinos').delete().eq('id', treino.id)
    setAApagar(false)
    if (error) return setErro(error.message)
    onApagado()
  }

  function adicionarExercicio(exercicio) {
    setAEscolher(false)
    setExtras((atuais) => (atuais.some((e) => e.id === exercicio.id) ? atuais : [...atuais, exercicio]))
  }

  return (
    <div>
      <div className="detalhe-topo">
        <button className="botao-voltar" onClick={onVoltar}>
          ‹ Voltar
        </button>
        <button
          className={aEditar ? 'botao-editar ativo' : 'botao-editar'}
          onClick={() => setAEditar(!aEditar)}
        >
          {aEditar ? 'Concluir' : 'Editar'}
        </button>
      </div>

      <div className="cartao treino-cabecalho">
        <p className="treino-data">
          {formatarDataExtenso(treino.data)} · {formatarHora(treino.data)}
        </p>
        <div className="numeros">
          <Numero valor={formatarMinutos(treino.duracao_min)} rotulo="Duração" />
          <Numero valor={`${formatarPeso(calcularVolume(series))} kg`} rotulo="Volume" />
        </div>
        {aEditar && <CamposTreino treino={treino} onGuardar={guardarTreino} />}
      </div>

      {aEditar && (
        <p className="subtitulo dica">
          As alterações são gravadas logo. Toca no número de uma série para a marcar ou desmarcar
          como aquecimento.
        </p>
      )}

      {grupos.length === 0 && !aEditar && (
        <p className="subtitulo">Este treino não tem séries.</p>
      )}

      {grupos.map(({ exercicio, series: seriesExercicio }) => (
        <CartaoExercicio
          key={exercicio.id}
          exercicio={exercicio}
          series={seriesExercicio}
          aEditar={aEditar}
          onAdicionar={adicionarSerie}
          onGuardarSerie={guardarSerie}
          onApagarSerie={apagarSerie}
        />
      ))}

      {aEditar && (
        <button className="botao-secundario" onClick={() => setAEscolher(true)}>
          + Adicionar exercício
        </button>
      )}

      <Notas treino={treino} onGuardar={guardarTreino} />

      {erro && <p className="erro">{erro}</p>}

      {confirmarApagar ? (
        <div className="cartao confirmacao">
          <p>Apagar este treino? Todas as séries serão apagadas e não é possível desfazer.</p>
          <button className="botao-perigo-cheio" onClick={apagarTreino} disabled={aApagar}>
            {aApagar ? 'A apagar...' : 'Apagar treino'}
          </button>
          <button className="botao-secundario" onClick={() => setConfirmarApagar(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <button className="botao-perigo" onClick={() => setConfirmarApagar(true)}>
          Apagar treino
        </button>
      )}

      {aEscolher && (
        <EscolherExercicio
          jaEscolhidos={grupos.map((g) => g.exercicio.id)}
          onEscolher={adicionarExercicio}
          onFechar={() => setAEscolher(false)}
        />
      )}
    </div>
  )
}

// Data, hora e duração do treino (modo Editar). Grava ao sair de cada campo.
function CamposTreino({ treino, onGuardar }) {
  const [data, setData] = useState(dataParaInput(treino.data))
  const [duracao, setDuracao] = useState(String(treino.duracao_min))
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
    if (!Number.isInteger(minutos) || minutos < 1) {
      setErro('A duração tem de ser um número inteiro de minutos (mínimo 1).')
      setDuracao(String(treino.duracao_min))
      return
    }
    if (minutos === treino.duracao_min) return
    const mensagem = await onGuardar({ duracao_min: minutos })
    setErro(mensagem ?? '')
    if (mensagem) setDuracao(String(treino.duracao_min))
  }

  return (
    <div className="campos-treino">
      <label>
        <span>Data e hora</span>
        <input
          type="datetime-local"
          value={data}
          onChange={(e) => setData(e.target.value)}
          onBlur={guardarData}
          onKeyDown={sairComEnter}
        />
      </label>
      <label>
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

function CartaoExercicio({ exercicio, series, aEditar, onAdicionar, onGuardarSerie, onApagarSerie }) {
  const rotulos = rotulosSeries(series)
  const melhor = melhorSerie(series)

  return (
    <div className="cartao exercicio">
      <h2>{exercicio.nome}</h2>
      <p className="ultima-vez">
        {melhor
          ? `1RM estimado: ${formatarPeso(Math.round(calcular1RM(melhor.repeticoes, melhor.peso_kg) * 10) / 10)} kg`
          : 'Sem séries normais'}
      </p>

      {series.length > 0 && (
        <ul className="series">
          {series.map((serie, i) =>
            aEditar ? (
              <LinhaSerieEditavel
                key={serie.id}
                serie={serie}
                rotulo={rotulos[i]}
                onGuardar={onGuardarSerie}
                onApagar={onApagarSerie}
              />
            ) : (
              <li key={serie.id} className={serie === melhor ? 'serie-melhor' : undefined}>
                <span className={serie.aquecimento ? 'serie-num aquecimento' : 'serie-num'}>
                  {rotulos[i]}
                </span>
                <span className="serie-valor">{serie.repeticoes} reps</span>
                <span className="serie-valor">{formatarPeso(serie.peso_kg)} kg</span>
                {serie === melhor && <span className="etiqueta-melhor">Melhor</span>}
              </li>
            )
          )}
        </ul>
      )}

      {aEditar && (
        <FormSerie
          sugestao={series.at(-1) ?? null}
          onAdicionar={(valores) => onAdicionar(exercicio.id, valores)}
        />
      )}
    </div>
  )
}

// Uma série no modo Editar: grava as reps e o peso ao sair do campo, o aquecimento ao tocar no número
function LinhaSerieEditavel({ serie, rotulo, onGuardar, onApagar }) {
  const [reps, setReps] = useState(String(serie.repeticoes))
  const [kg, setKg] = useState(pesoParaInput(serie.peso_kg))
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  function repor() {
    setReps(String(serie.repeticoes))
    setKg(pesoParaInput(serie.peso_kg))
  }

  async function guardar(campos) {
    setAGravar(true)
    const mensagem = await onGuardar(serie.id, campos)
    setAGravar(false)
    setErro(mensagem ?? '')
    if (mensagem) repor()
  }

  function guardarReps() {
    const repeticoes = Number(reps.trim())
    if (!Number.isInteger(repeticoes) || repeticoes <= 0) {
      setErro('Indica as repetições.')
      return repor()
    }
    if (repeticoes !== serie.repeticoes) guardar({ repeticoes })
  }

  function guardarKg() {
    const peso = lerNumero(kg)
    if (peso === null || peso < 0 || peso > 9999.99) {
      setErro('Indica um peso válido.')
      return repor()
    }
    const arredondado = Math.round(peso * 100) / 100
    setKg(pesoParaInput(arredondado))
    if (arredondado !== Number(serie.peso_kg)) guardar({ peso_kg: arredondado })
  }

  async function apagar() {
    setAGravar(true)
    const mensagem = await onApagar(serie.id)
    // Se correu bem, a linha desaparece; só é preciso tratar do erro
    if (mensagem) {
      setAGravar(false)
      setErro(mensagem)
    }
  }

  return (
    <li className="serie-editavel">
      <div className="serie-editavel-linha">
        <button
          className={serie.aquecimento ? 'serie-num botao-num aquecimento' : 'serie-num botao-num'}
          onClick={() => guardar({ aquecimento: !serie.aquecimento })}
          disabled={aGravar}
          aria-label={serie.aquecimento ? 'Desmarcar aquecimento' : 'Marcar como aquecimento'}
        >
          {rotulo}
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={guardarReps}
          onKeyDown={sairComEnter}
          aria-label="Repetições"
        />
        <span className="unidade">reps</span>
        <input
          type="text"
          inputMode="decimal"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          onBlur={guardarKg}
          onKeyDown={sairComEnter}
          aria-label="Peso em kg"
        />
        <span className="unidade">kg</span>
        <button
          className="botao-apagar"
          onClick={apagar}
          disabled={aGravar}
          aria-label="Apagar série"
        >
          ×
        </button>
      </div>
      {erro && <p className="erro">{erro}</p>}
    </li>
  )
}

// Notas do treino: sempre editáveis, gravadas em treinos.notas ao sair do campo
function Notas({ treino, onGuardar }) {
  const [texto, setTexto] = useState(treino.notas ?? '')
  const [estado, setEstado] = useState('') // '' | 'A gravar...' | 'Gravado'
  const [erro, setErro] = useState('')

  async function guardar() {
    const valor = texto.trim() === '' ? null : texto.trim()
    if (valor === (treino.notas ?? null)) return
    setEstado('A gravar...')
    const mensagem = await onGuardar({ notas: valor })
    setEstado(mensagem ? '' : 'Gravado')
    setErro(mensagem ?? '')
  }

  return (
    <div className="cartao notas">
      <div className="notas-topo">
        <h2>Notas</h2>
        {estado && <span className="notas-estado">{estado}</span>}
      </div>
      <textarea
        rows={3}
        placeholder="Como correu o treino?"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setEstado('')
        }}
        onBlur={guardar}
      />
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
