import { useEffect, useState } from 'react'
import { Check, Ellipsis, History, Minus, Plus, Target, Timer, X } from 'lucide-react'
import { supabase } from './supabase'
import CronometroBloco from './CronometroBloco'
import IconeBloco from './IconeBloco'
import { estadoVoltas, letraExercicio, sugestaoVolta, validarVolta } from './blocos'
import {
  exercicioDoIntervalo,
  exercicioPorTempo,
  formatarTempo,
  gerarSeriesAmrap,
  resultadoAmrap,
  textoResultadoAmrap,
  textoSegundos,
} from './condicionamento'
import { lerNumero, pesoParaInput } from './formatar'
import { vibrar } from './movimento'
import { textoCarga, textoDaSerie } from './pesoCorporal'

// Última série deste exercício num treino anterior: de aquecimento nos blocos de aquecimento,
// normal nos outros
function buscarUltimaVez(exercicioId, aquecimento, antesDe) {
  return supabase
    .from('series')
    .select('repeticoes, peso_kg, duracao_seg, ordem, treinos!inner(data)')
    .eq('exercicio_id', exercicioId)
    .eq('aquecimento', aquecimento)
    .lt('treinos.data', antesDe)
    .order('treinos(data)', { ascending: false })
    .order('ordem', { ascending: false })
    .limit(1)
}

// localStorage com try/catch (os intervalos falhados de um EMOM ficam só neste telemóvel)
function lerLista(chave) {
  try {
    const lista = JSON.parse(localStorage.getItem(chave) ?? '[]')
    return Array.isArray(lista) ? lista.filter(Number.isInteger) : []
  } catch {
    return []
  }
}
function gravarLista(chave, lista) {
  try {
    if (lista.length === 0) localStorage.removeItem(chave)
    else localStorage.setItem(chave, JSON.stringify(lista))
  } catch {
    // sem armazenamento: fica só enquanto o ecrã estiver aberto
  }
}

// Um bloco no editor: exercícios com os alvos e a última vez, e as voltas com os campos e o ✓.
// Nos exercícios de peso corporal (etiqueta PC), o peso é o extra. pesoCorporalKg: o peso do corpo
// na data do treino (null se desconhecido), para validar. Nos exercícios por tempo, há segundos em vez de reps.
// Blocos de condicionamento: o circuito pode ser feito por tempo (cronómetro a contar para cima); o AMRAP
// tem um cronómetro decrescente e regista-se com "voltas + reps extra"; o EMOM tem um cronómetro por
// intervalo e cada intervalo marca-se feito (✓) ou falhado (✗).
// As on* devolvem uma mensagem de erro, ou null.
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
  onAtualizar,
  onRegistarAmrap,
}) {
  const exercicios = bloco.bloco_exercicios
  const aquecimento = bloco.tipo === 'aquecimento'
  const chaveExercicios = exercicios.map((be) => be.exercicio_id).join(',')
  const [ultimas, setUltimas] = useState({}) // exercicio_id → { repeticoes, peso_kg, duracao_seg } | null
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
  const emom = bloco.tipo === 'emom'
  const amrap = bloco.tipo === 'amrap'

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
            const temAlvoPeso = be.peso_alvo !== null && be.peso_alvo !== undefined && Number(be.peso_alvo) !== 0
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
                    {exercicioPorTempo(be) ? <Timer size={13} aria-hidden="true" /> : <Target size={13} aria-hidden="true" />}
                    Alvo: {exercicioPorTempo(be) ? textoSegundos(be.segundos_alvo) : `${be.reps_alvo} reps`}
                    {(temAlvoPeso || (pc && !exercicioPorTempo(be))) && ` × ${textoCarga(be.peso_alvo ?? 0, pc)}`}
                  </span>
                  {ultima && (
                    <span className="bloco-exercicio-alvo com-icone">
                      <History size={13} aria-hidden="true" />
                      Última vez: {textoDaSerie(ultima, pc)}
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

      {emom && exercicios.length > 0 && (
        <p className="nota sem-margem-topo nota-emom">
          {exercicios.length === 1
            ? 'O mesmo exercício em todos os intervalos.'
            : `EMOM alternado: ${exercicios.map((_, i) => `${i + 1} → ${letraExercicio(i)}`).join(', ')}, ${exercicios.length + 1} → A…`}
        </p>
      )}

      {bloco.tipo === 'circuito' && exercicios.length > 0 && <CircuitoPorTempo bloco={bloco} onAtualizar={onAtualizar} />}

      {amrap && exercicios.length > 0 && (
        <ResultadoAmrap
          bloco={bloco}
          series={series}
          ultimas={ultimas}
          pesoCorporalKg={pesoCorporalKg}
          onRegistar={onRegistarAmrap}
        />
      )}

      {emom && exercicios.length > 0 && (
        <IntervalosEmom
          bloco={bloco}
          voltas={voltas}
          series={series}
          ultimas={ultimas}
          pesoCorporalKg={pesoCorporalKg}
          onGravarVolta={onGravarVolta}
          onDesfazerVolta={onDesfazerVolta}
          onGuardarSerie={onGuardarSerie}
        />
      )}

      {!amrap &&
        !emom &&
        exercicios.length > 0 &&
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

      {!amrap && (
        <div className="bloco-voltas">
          <button
            className="botao-redondo"
            onClick={() => mudarVoltas(-1)}
            disabled={bloco.voltas <= 1}
            aria-label={emom ? 'Menos um intervalo' : 'Menos uma volta'}
          >
            <Minus size={20} />
          </button>
          <span className="numero-voltas">
            {bloco.voltas}{' '}
            {emom ? (bloco.voltas === 1 ? 'intervalo' : 'intervalos') : bloco.voltas === 1 ? 'volta' : 'voltas'}
          </span>
          <button
            className="botao-redondo"
            onClick={() => mudarVoltas(1)}
            aria-label={emom ? 'Mais um intervalo' : 'Mais uma volta'}
          >
            <Plus size={20} />
          </button>
        </div>
      )}

      {bloco.notas && <p className="nota">{bloco.notas}</p>}
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

// ---------- Circuito ----------

// "Por tempo": cronómetro a contar para cima; "Terminar" grava o tempo em blocos.tempo_seg
function CircuitoPorTempo({ bloco, onAtualizar }) {
  const chave = `cronometro-bloco-${bloco.id}`
  // Abre sozinho se já houver um tempo gravado ou um cronómetro a meio
  const [aberto, setAberto] = useState(() => Boolean(bloco.tempo_seg) || temEstado(chave))
  const [erro, setErro] = useState('')

  async function guardarTempo(segundos) {
    setErro('')
    const mensagem = await onAtualizar({ tempo_seg: segundos === null ? null : Math.max(1, segundos) })
    if (mensagem) setErro(mensagem)
  }

  if (!aberto) {
    return (
      <button className="botao-secundario com-icone botao-por-tempo" onClick={() => setAberto(true)}>
        <Timer size={18} />
        Por tempo
        {bloco.duracao_seg ? ` (limite ${formatarTempo(bloco.duracao_seg)})` : ''}
      </button>
    )
  }

  return (
    <div className="condicionamento">
      <CronometroBloco tipo="circuito" chave={chave} modo="crescente" totalSeg={bloco.duracao_seg} onFim={guardarTempo} />
      {bloco.tempo_seg ? (
        <p className="resultado-bloco">
          Tempo: <strong>{formatarTempo(bloco.tempo_seg)}</strong>{' '}
          <button className="botao-link" onClick={() => guardarTempo(null)}>
            Apagar
          </button>
        </p>
      ) : (
        <p className="nota sem-margem-topo">Começa quando arrancares e toca em Terminar no fim: o tempo fica no bloco.</p>
      )}
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

function temEstado(chave) {
  try {
    return localStorage.getItem(chave) !== null
  } catch {
    return false
  }
}

// ---------- AMRAP ----------

// Cronómetro decrescente e o resultado: "voltas completas" + "reps extra" (e o peso de cada exercício).
// A app gera as séries (ver gerarSeriesAmrap) e substitui as que o bloco tinha.
function ResultadoAmrap({ bloco, series, ultimas, pesoCorporalKg, onRegistar }) {
  const exercicios = bloco.bloco_exercicios
  const resultado = series.length > 0 ? resultadoAmrap(bloco, series) : null
  const [aberto, setAberto] = useState(false)
  const [voltas, setVoltas] = useState(resultado ? String(resultado.voltas) : '')
  const [extra, setExtra] = useState(resultado && resultado.repsExtra > 0 ? String(resultado.repsExtra) : '')
  const [pesos, setPesos] = useState(() =>
    Object.fromEntries(
      exercicios.map((be) => {
        const peso = series.find((s) => s.exercicio_id === be.exercicio_id)?.peso_kg ?? be.peso_alvo ?? null
        return [be.exercicio_id, peso === null ? '' : pesoParaInput(peso)]
      })
    )
  )
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  function abrir() {
    setAberto(true)
    setErro('')
  }

  async function registar(e) {
    e.preventDefault()
    const mapa = new Map()
    for (const be of exercicios) {
      const texto = String(pesos[be.exercicio_id] ?? '').trim()
      const pc = Boolean(be.exercicios?.peso_corporal)
      const valor = texto === '' ? 0 : lerNumero(texto)
      if (valor === null || (!pc && valor < 0) || Math.abs(valor) > 9999.99) {
        return setErro(`Indica um peso válido para ${be.exercicios?.nome ?? 'o exercício'}.`)
      }
      if (pc && pesoCorporalKg !== null && pesoCorporalKg + valor <= 0) {
        return setErro(`${be.exercicios?.nome}: o peso efetivo (corpo + extra) tem de ser maior do que 0.`)
      }
      mapa.set(be.exercicio_id, valor)
    }
    const gerado = gerarSeriesAmrap(exercicios, { voltas, repsExtra: extra, pesos: mapa })
    if (gerado.erro) return setErro(gerado.erro)
    setAGravar(true)
    setErro('')
    const mensagem = await onRegistar(gerado.series, gerado.voltasBloco)
    setAGravar(false)
    if (mensagem) return setErro(mensagem)
    setAberto(false)
    vibrar(30)
  }

  return (
    <div className="condicionamento">
      <CronometroBloco
        tipo={bloco.tipo}
        chave={`cronometro-bloco-${bloco.id}`}
        modo="decrescente"
        totalSeg={bloco.duracao_seg}
        onFim={abrir}
      />

      {resultado && !aberto && (
        <p className="resultado-bloco">
          Resultado: <strong>{textoResultadoAmrap(resultado)}</strong>{' '}
          <button className="botao-link" onClick={abrir}>
            Corrigir
          </button>
        </p>
      )}
      {!resultado && !aberto && (
        <button className="botao-secundario com-icone" onClick={abrir}>
          <Check size={18} />
          Registar resultado
        </button>
      )}

      {aberto && (
        <form className="resultado-amrap" onSubmit={registar}>
          <div className="alvos">
            <label>
              <span>Voltas completas</span>
              <input type="text" inputMode="numeric" value={voltas} placeholder="0" onChange={(e) => setVoltas(e.target.value)} autoFocus />
            </label>
            <label>
              <span>Reps extra (volta incompleta)</span>
              <input type="text" inputMode="numeric" value={extra} placeholder="0" onChange={(e) => setExtra(e.target.value)} />
            </label>
          </div>
          <p className="nota">
            As reps extra contam pelos exercícios, por ordem. Peso de cada exercício (vazio = 0
            {exercicios.some((be) => be.exercicios?.peso_corporal) ? '; nos PC é o extra, − se for assistido' : ''}):
          </p>
          <ul className="lista pesos-amrap">
            {exercicios.map((be, i) => {
              const ultima = ultimas[be.exercicio_id]
              return (
                <li key={be.id}>
                  {exercicios.length > 1 && <span className="letra">{letraExercicio(i)}</span>}
                  <span className="pesos-amrap-nome">
                    {be.exercicios?.nome ?? '—'}
                    <span className="pesos-amrap-alvo">
                      {exercicioPorTempo(be) ? textoSegundos(be.segundos_alvo) : `${be.reps_alvo} reps`}
                      {ultima && ` · última vez ${textoDaSerie(ultima, be.exercicios?.peso_corporal)}`}
                    </span>
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="campo-kg"
                    value={pesos[be.exercicio_id] ?? ''}
                    placeholder="0"
                    onChange={(e) => setPesos((atuais) => ({ ...atuais, [be.exercicio_id]: e.target.value }))}
                    aria-label={`Peso em kg de ${be.exercicios?.nome ?? 'exercício'}`}
                  />
                  <span className="unidade">kg</span>
                </li>
              )
            })}
          </ul>
          {erro && <p className="erro">{erro}</p>}
          <div className="linha-botoes">
            <button type="button" className="botao-secundario" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button type="submit" disabled={aGravar}>
              {aGravar ? 'A gravar...' : 'Guardar resultado'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ---------- EMOM ----------

// Cronómetro por intervalo (com o exercício desse intervalo) e a lista dos intervalos: cada um tem o
// exercício que lhe calha (alternado, se houver vários), ✓ para gravar e ✗ para o marcar falhado.
function IntervalosEmom({ bloco, voltas, series, ultimas, pesoCorporalKg, onGravarVolta, onDesfazerVolta, onGuardarSerie }) {
  const exercicios = bloco.bloco_exercicios
  const chaveFalhados = `emom-falhados-${bloco.id}`
  const [falhados, setFalhados] = useState(() => lerLista(chaveFalhados))

  function alternarFalhado(intervalo) {
    const novos = falhados.includes(intervalo) ? falhados.filter((n) => n !== intervalo) : [...falhados, intervalo]
    setFalhados(novos)
    gravarLista(chaveFalhados, novos)
  }

  const feitos = voltas.filter((v) => v.feita).length

  return (
    <div className="condicionamento">
      <CronometroBloco
        tipo={bloco.tipo}
        chave={`cronometro-bloco-${bloco.id}`}
        modo="emom"
        intervaloSeg={bloco.intervalo_seg ?? 60}
        intervalos={bloco.voltas}
        renderIntervalo={(numero) => {
          const be = exercicioDoIntervalo(exercicios, numero)
          const indice = exercicios.indexOf(be)
          return (
            <p className="cronometro-exercicio">
              {exercicios.length > 1 && <span className="letra">{letraExercicio(indice)}</span>}
              {be?.exercicios?.nome ?? '—'}
              <span className="cronometro-exercicio-alvo">
                {exercicioPorTempo(be) ? textoSegundos(be.segundos_alvo) : `${be?.reps_alvo} reps`}
              </span>
            </p>
          )
        }}
      />
      <p className="resultado-bloco">
        <strong>
          {feitos}/{bloco.voltas}
        </strong>{' '}
        intervalos feitos{falhados.length > 0 && ` · ${falhados.filter((n) => n <= bloco.voltas).length} falhados`}
      </p>

      {voltas.map((estado) => {
        const be = exercicioDoIntervalo(exercicios, estado.volta)
        const falhado = !estado.feita && falhados.includes(estado.volta)
        return (
          <Volta
            key={estado.volta}
            numero={estado.volta}
            rotulo="intervalo"
            letra={exercicios.length > 1 ? letraExercicio(exercicios.indexOf(be)) : null}
            estado={estado}
            exercicios={[be]}
            seriesDoBloco={series}
            ultimas={ultimas}
            pesoCorporalKg={pesoCorporalKg}
            falhado={falhado}
            onFalhar={() => alternarFalhado(estado.volta)}
            onGravar={(lista) => {
              if (falhados.includes(estado.volta)) alternarFalhado(estado.volta)
              return onGravarVolta(estado.volta, lista)
            }}
            onDesfazer={() => onDesfazerVolta(estado.volta)}
            onGuardarSerie={(exercicioId, dados) => onGuardarSerie(estado.volta, exercicioId, dados)}
          />
        )
      })}
    </div>
  )
}

// ---------- Voltas ----------

// Uma volta (ou intervalo do EMOM): os campos de reps (ou segundos) e peso de cada exercício e o ✓.
// ✓ grava a volta inteira (as reps vazias saltam o exercício); tocar outra vez desfaz a volta.
// Numa volta já feita, cada campo grava ao sair (reps vazias apagam essa série).
// No EMOM: letra = a letra do exercício do intervalo; onFalhar/falhado = o ✗ (não grava nada).
function Volta({
  numero,
  rotulo = 'volta',
  letra = null,
  estado,
  exercicios,
  seriesDoBloco,
  ultimas,
  pesoCorporalKg,
  falhado = false,
  onFalhar,
  onGravar,
  onDesfazer,
  onGuardarSerie,
}) {
  const [editados, setEditados] = useState({}) // exercicio_id → { reps?, kg?, segundos? } escritos à mão
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const [acabouDeMarcar, setAcabouDeMarcar] = useState(false) // para a animação do ✓

  function valores(be) {
    const serie = estado.series.get(be.exercicio_id)
    const base = serie
      ? {
          reps: serie.repeticoes > 0 ? String(serie.repeticoes) : '',
          kg: pesoParaInput(serie.peso_kg),
          segundos: serie.duracao_seg ? String(serie.duracao_seg) : '',
        }
      : { segundos: '', ...sugestaoVolta(be, numero, seriesDoBloco, ultimas[be.exercicio_id]) }
    const editado = editados[be.exercicio_id]
    return {
      reps: editado?.reps ?? base.reps,
      kg: editado?.kg ?? base.kg,
      segundos: editado?.segundos ?? base.segundos,
    }
  }

  function mudar(exercicioId, campo, valor) {
    setEditados((atuais) => ({ ...atuais, [exercicioId]: { ...atuais[exercicioId], [campo]: valor } }))
  }

  // Linha para validar: nos exercícios de peso corporal, o kg é o extra (pode ser negativo); nos
  // exercícios por tempo, contam os segundos
  function linha(be, campos) {
    return {
      exercicio_id: be.exercicio_id,
      ...campos,
      porTempo: exercicioPorTempo(be),
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
    const campos = valores(be)
    const porTempo = exercicioPorTempo(be)
    let dados = null
    if ((porTempo ? campos.segundos : campos.reps).trim() !== '') {
      const resultado = validarVolta([linha(be, campos)])
      if (resultado.erro) {
        setErro(resultado.erro)
        esquecer(be.exercicio_id)
        return
      }
      dados = { duracao_seg: null, ...resultado.series[0] }
      delete dados.exercicio_id
    }

    const serie = estado.series.get(be.exercicio_id)
    const igual =
      serie &&
      dados &&
      serie.repeticoes === dados.repeticoes &&
      Number(serie.peso_kg) === dados.peso_kg &&
      (serie.duracao_seg ?? null) === dados.duracao_seg
    if (igual || (!serie && !dados)) return esquecer(be.exercicio_id)

    setErro('')
    const mensagem = await onGuardarSerie(be.exercicio_id, dados)
    if (mensagem) setErro(mensagem)
    esquecer(be.exercicio_id)
  }

  const varios = exercicios.length > 1
  // 'a volta' / 'o intervalo'
  const artigo = rotulo === 'volta' ? 'a' : 'o'
  const feito = rotulo === 'volta' ? 'feita' : 'feito'
  const classes = ['volta', estado.feita && 'feita', onFalhar && 'com-falha', falhado && 'falhada'].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      <span className="volta-numero">{numero}</span>
      <div className="volta-linhas">
        {falhado ? (
          <p className="volta-falhada">
            {letra && <span className="letra">{letra}</span>}
            Falhado
          </p>
        ) : (
          exercicios.map((be, i) => {
            const { reps, kg, segundos } = valores(be)
            const nome = be.exercicios?.nome ?? 'exercício'
            const porTempo = exercicioPorTempo(be)
            return (
              <div key={be.id} className="volta-linha">
                {(varios || letra) && <span className="letra">{letra ?? letraExercicio(i)}</span>}
                {porTempo ? (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="campo-reps"
                      value={segundos}
                      placeholder="s"
                      onChange={(e) => mudar(be.exercicio_id, 'segundos', e.target.value)}
                      onBlur={() => sairDoCampo(be)}
                      aria-label={`Segundos de ${nome}, ${rotulo} ${numero}`}
                    />
                    <span className="unidade">s</span>
                  </>
                ) : (
                  <input
                    type="text"
                    inputMode="numeric"
                    className="campo-reps"
                    value={reps}
                    placeholder="reps"
                    onChange={(e) => mudar(be.exercicio_id, 'reps', e.target.value)}
                    onBlur={() => sairDoCampo(be)}
                    aria-label={`Reps de ${nome}, ${rotulo} ${numero}`}
                  />
                )}
                {be.exercicios?.peso_corporal ? (
                  <CampoExtra
                    valor={kg}
                    nome={nome}
                    numero={numero}
                    rotulo={rotulo}
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
                      aria-label={`Peso em kg de ${nome}, ${rotulo} ${numero}`}
                    />
                    <span className="unidade">kg</span>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
      {onFalhar && !estado.feita && (
        <button
          className={falhado ? 'botao-falha ativo' : 'botao-falha'}
          onClick={onFalhar}
          aria-pressed={falhado}
          aria-label={falhado ? `Desmarcar o ${rotulo} ${numero} como falhado` : `Marcar o ${rotulo} ${numero} como falhado`}
        >
          <X size={20} strokeWidth={3} />
        </button>
      )}
      {onFalhar && estado.feita && <span aria-hidden="true" />}
      <button
        className={`botao-volta${estado.feita ? ' feita' : ''}${acabouDeMarcar ? ' pop' : ''}`}
        onClick={alternar}
        onAnimationEnd={() => setAcabouDeMarcar(false)}
        disabled={aGravar || falhado}
        aria-pressed={estado.feita}
        aria-label={estado.feita ? `Desfazer ${artigo} ${rotulo} ${numero}` : `Marcar ${artigo} ${rotulo} ${numero} como ${feito}`}
      >
        <Check size={26} strokeWidth={3} />
      </button>
      {erro && <p className="erro volta-erro">{erro}</p>}
    </div>
  )
}

// Peso extra de um exercício de peso corporal: "× PC + [10] kg". O botão +/− troca o sinal (o teclado
// decimal do iPhone não tem a tecla −); o campo mostra só o valor, sem sinal. Vazio ou 0 = só o corpo.
function CampoExtra({ valor, nome, numero, rotulo, onMudar, onSair }) {
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
        aria-label={`Kg extra de ${nome}, ${rotulo} ${numero} (${negativo ? 'a menos, assistido' : 'a mais'})`}
      />
      <span className="unidade">kg</span>
    </>
  )
}
