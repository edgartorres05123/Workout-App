import { useEffect, useMemo, useRef, useState } from 'react'
import { ChartColumn, ChevronRight, Dumbbell, Flame, Timer, Trophy, TriangleAlert } from 'lucide-react'
import AvisoPesoCorporal from './AvisoPesoCorporal'
import { buscarExercicios, buscarTreino, buscarTreinosTerminados } from './consultas'
import { useCalorias, useCarga, usePesoCorporal } from './contextoPesoCorporal'
import DetalheExercicio from './DetalheExercicio'
import DetalheTreino from './DetalheTreino'
import Esqueleto from './Esqueleto'
import EstadoVazio from './EstadoVazio'
import EstatisticasCardio from './EstatisticasCardio'
import Janela from './Janela'
import { CORES } from './cores'
import Grafico from './Grafico'
import Pilulas from './Pilulas'
import {
  grelhaCalor,
  inicioPeriodo,
  nivelCalor,
  recordesGerais,
  resumoPeriodos,
  sequenciasSemanas,
  serieTemporal,
  treinosPorDia,
  volumePorMusculo,
} from './estatisticas'
import {
  abreviarNumero,
  calcularVolume,
  formatarDataCurta,
  formatarDataExtenso,
  formatarHora,
  formatarMes,
  formatarMinutos,
  formatarPeso,
} from './formatar'
import { MUSCULOS } from './musculos'
import { decomposicaoCarga, pesoCorporalNaData, textoCarga } from './pesoCorporal'

const METRICAS = [
  { id: 'treinos', nome: 'Treinos' },
  { id: 'volume', nome: 'Volume' },
  { id: 'duracao', nome: 'Duração' },
  { id: 'series', nome: 'Séries' },
  { id: 'calorias', nome: 'Calorias' },
]
// Separadores internos: o ginásio (força) e o cardio
const SEPARADORES = [
  { id: 'ginasio', nome: 'Ginásio' },
  { id: 'cardio', nome: 'Cardio' },
]
const UNIDADES = [
  { id: 'semana', nome: 'Semanas' },
  { id: 'mes', nome: 'Meses' },
]
const PERIODOS_MUSCULOS = [
  { id: '30d', nome: '30 dias' },
  { id: '3m', nome: '3 meses' },
  { id: '1a', nome: '1 ano' },
  { id: 'sempre', nome: 'Sempre' },
]
const DIAS_SEMANA = ['S', '', 'Q', '', 'S', '', ''] // só segunda, quarta e sexta, para não encher

function formatarMetrica(valor, metrica) {
  if (metrica === 'volume') return `${abreviarNumero(valor)} kg`
  if (metrica === 'duracao') return formatarMinutos(Math.round(valor))
  if (metrica === 'calorias') return `${abreviarNumero(valor)} kcal`
  return abreviarNumero(valor)
}

function mesCurto(data) {
  return data.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')
}

// Lê todos os dados de uma vez (duas consultas paginadas); o resto é calculado no browser
async function buscarDados() {
  const [treinos, exercicios] = await Promise.all([buscarTreinosTerminados(), buscarExercicios()])
  if (treinos.erro || exercicios.erro) return { erro: treinos.erro ?? exercicios.erro }
  return {
    treinos: treinos.linhas.sort((a, b) => new Date(a.data) - new Date(b.data)),
    exercicios: exercicios.linhas,
  }
}

// Montado de novo sempre que o separador é aberto, por isso recarrega sozinho
export default function PaginaEstatisticas({ onIrPara }) {
  const [agora] = useState(() => new Date())
  const [dados, setDados] = useState(null) // null = a carregar
  const [erro, setErro] = useState('')
  // null | { tipo: 'treino', treino } | { tipo: 'exercicio', id }
  const [vista, setVista] = useState(null)
  const [diaEscolhido, setDiaEscolhido] = useState(null)
  const ultimoPedido = useRef(0)
  const scrollDaPagina = useRef(0)
  const carga = useCarga()
  const [separador, setSeparador] = useState('ginasio')

  function carregar() {
    const id = ++ultimoPedido.current
    return buscarDados().then((resultado) => {
      if (id !== ultimoPedido.current) return
      if (resultado.erro) return setErro(resultado.erro)
      setErro('')
      setDados(resultado)
    })
  }

  useEffect(() => {
    carregar()
  }, [])

  function abrirVista(novaVista) {
    scrollDaPagina.current = window.scrollY
    setDiaEscolhido(null)
    setVista(novaVista)
    window.scrollTo(0, 0)
  }

  async function abrirTreino(id) {
    setErro('')
    const resultado = await buscarTreino(id)
    if (resultado.erro) return setErro(resultado.erro)
    abrirVista({ tipo: 'treino', treino: resultado.treino })
  }

  function voltar() {
    setVista(null)
    carregar() // o treino ou o exercício pode ter sido editado
    requestAnimationFrame(() => window.scrollTo(0, scrollDaPagina.current))
  }

  function escolherDia(dia) {
    if (dia.treinos.length === 1) abrirTreino(dia.treinos[0].id)
    else setDiaEscolhido(dia)
  }

  const exercicioAberto =
    vista?.tipo === 'exercicio' ? dados?.exercicios.find((e) => e.id === vista.id) : null

  return (
    <div>
      <div hidden={Boolean(vista)}>
        <Pilulas opcoes={SEPARADORES} valor={separador} onMudar={setSeparador} rotulo="Estatísticas de" />
        {erro && <p className="erro">{erro}</p>}

        {separador === 'cardio' ? (
          <EstatisticasCardio agora={agora} onAbrirTreino={abrirTreino} />
        ) : dados === null ? (
          !erro && <Esqueleto numeros={3} cartoes={3} linhas={3} />
        ) : dados.treinos.length === 0 ? (
          <EstadoVazio
            icone={ChartColumn}
            titulo="Ainda não há treinos terminados"
            texto="Termina o primeiro treino e as tuas estatísticas aparecem aqui."
          />
        ) : (
          <>
            <AvisoPesoCorporal mostrar={dados.treinos.some((t) => t.series.some((s) => s.exercicios?.peso_corporal))} />
            <SeccaoResumo treinos={dados.treinos} agora={agora} carga={carga} />
            <SeccaoConsistencia treinos={dados.treinos} agora={agora} carga={carga} onEscolherDia={escolherDia} />
            <SeccaoRecordes
              treinos={dados.treinos}
              exercicios={dados.exercicios}
              carga={carga}
              onAbrirTreino={abrirTreino}
              onAbrirExercicio={(id) => abrirVista({ tipo: 'exercicio', id })}
            />
            <SeccaoMusculos
              treinos={dados.treinos}
              exercicios={dados.exercicios}
              agora={agora}
              carga={carga}
              onCompletar={() => onIrPara('exercicios', { soSemMusculos: true })}
            />
          </>
        )}
      </div>

      {vista?.tipo === 'treino' && (
        <DetalheTreino
          key={vista.treino.id}
          treino={vista.treino}
          onVoltar={voltar}
          onAlterar={(atualizar) =>
            setVista((atual) => ({ ...atual, treino: atualizar(atual.treino) }))
          }
          onApagado={voltar}
        />
      )}

      {exercicioAberto && (
        <DetalheExercicio
          key={exercicioAberto.id}
          exercicio={exercicioAberto}
          todos={dados.exercicios}
          onVoltar={voltar}
          onAlterar={(atualizar) =>
            setDados((atuais) => ({
              ...atuais,
              exercicios: atuais.exercicios.map((e) => (e.id === exercicioAberto.id ? atualizar(e) : e)),
            }))
          }
          onApagado={voltar}
          onJuntado={(destinoId) => {
            setVista({ tipo: 'exercicio', id: destinoId })
            window.scrollTo(0, 0)
            carregar()
          }}
        />
      )}

      {diaEscolhido && (
        <TreinosDoDia
          dia={diaEscolhido}
          onAbrir={abrirTreino}
          onFechar={() => setDiaEscolhido(null)}
        />
      )}
    </div>
  )
}

// ---------- a) Resumo ----------

function SeccaoResumo({ treinos: semCalorias, agora, carga }) {
  const [metrica, setMetrica] = useState('volume')
  const [unidade, setUnidade] = useState('semana')
  // As calorias de cada treino (estimativa conservadora, ou as do relógio)
  const estimar = useCalorias()
  const treinos = useMemo(
    () => (metrica === 'calorias' ? semCalorias.map((t) => ({ ...t, kcal: estimar(t).kcal })) : semCalorias),
    [semCalorias, metrica, estimar]
  )
  const semPeso = metrica === 'calorias' && treinos.length > 0 && treinos.every((t) => t.kcal === null)

  const resumo = useMemo(() => resumoPeriodos(treinos, metrica, agora, carga), [treinos, metrica, agora, carga])
  const serie = useMemo(
    () => serieTemporal(treinos, metrica, unidade, agora, 12, carga),
    [treinos, metrica, unidade, agora, carga]
  )

  const dados = useMemo(
    () => ({
      labels: serie.map(({ inicio }) =>
        unidade === 'semana' ? `${inicio.getDate()}/${inicio.getMonth() + 1}` : mesCurto(inicio)
      ),
      datasets: [
        {
          data: serie.map((b) => b.valor),
          // A semana/mês atual fica mais clara: ainda não acabou
          backgroundColor: serie.map((_, i) => (i === serie.length - 1 ? CORES.verdeSuave : CORES.verde)),
          borderRadius: 6,
          maxBarThickness: 28,
        },
      ],
    }),
    [serie, unidade]
  )

  const opcoes = useMemo(
    () => ({
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (itens) => {
              const { inicio } = serie[itens[0].dataIndex]
              return unidade === 'semana' ? `Semana de ${formatarDataCurta(inicio)}` : formatarMes(inicio)
            },
            label: (item) => formatarMetrica(item.raw, metrica),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 6 } },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: CORES.grelha },
          ticks: {
            maxTicksLimit: 5,
            precision: 0,
            callback: (v) =>
              metrica === 'duracao'
                ? v >= 60
                  ? `${formatarPeso(Math.round((v / 60) * 10) / 10)} h`
                  : `${v} min`
                : abreviarNumero(v),
          },
        },
      },
    }),
    [serie, unidade, metrica]
  )

  return (
    <section className="seccao">
      <h2 className="titulo-seccao">Resumo</h2>
      <Pilulas opcoes={METRICAS} valor={metrica} onMudar={setMetrica} rotulo="Métrica" />

      <div className="cartoes-resumo">
        <CartaoNumero rotulo="Este mês" valor={formatarMetrica(resumo.mes, metrica)} />
        <CartaoNumero rotulo="Este ano" valor={formatarMetrica(resumo.ano, metrica)} />
        <CartaoNumero rotulo="Desde sempre" valor={formatarMetrica(resumo.sempre, metrica)} />
      </div>

      <div className="cartao">
        <div className="cartao-topo">
          <h3>{METRICAS.find((m) => m.id === metrica).nome} por {unidade === 'semana' ? 'semana' : 'mês'}</h3>
          <Pilulas opcoes={UNIDADES} valor={unidade} onMudar={setUnidade} pequenas rotulo="Agrupar por" />
        </div>
        <Grafico
          tipo="bar"
          dados={dados}
          opcoes={opcoes}
          descricao={`Gráfico de barras: ${metrica} nas últimas 12 ${unidade === 'semana' ? 'semanas' : 'meses'}`}
        />
        {metrica === 'calorias' && (
          <p className="nota">
            {semPeso
              ? 'Sem o teu peso não há estimativa: regista-o em Perfil e medições.'
              : 'Estimativa conservadora das calorias gastas pelo exercício, além do repouso (ou as do relógio, quando as escreveste).'}
          </p>
        )}
      </div>
    </section>
  )
}

function CartaoNumero({ rotulo, valor }) {
  return (
    <div className="cartao cartao-numero">
      <span className="cartao-numero-valor">{valor}</span>
      <span className="cartao-numero-rotulo">{rotulo}</span>
    </div>
  )
}

// ---------- b) Consistência ----------

function SeccaoConsistencia({ treinos, agora, carga, onEscolherDia }) {
  const porDia = useMemo(() => treinosPorDia(treinos, carga), [treinos, carga])
  const semanas = useMemo(() => grelhaCalor(agora, 6), [agora])
  const sequencias = useMemo(() => sequenciasSemanas(treinos, agora), [treinos, agora])

  // A intensidade é relativa ao dia com mais volume dentro da grelha
  let volumeMaximo = 0
  for (const semana of semanas) {
    for (const dia of semana) {
      if (!dia.fora) volumeMaximo = Math.max(volumeMaximo, porDia.get(dia.chave)?.volume ?? 0)
    }
  }

  // Etiqueta do mês na semana em que o mês começa (e na 1.ª coluna, se houver espaço)
  const meses = []
  semanas.forEach((semana, coluna) => {
    const primeiro = semana.find((d) => !d.fora && d.data.getDate() === 1)
    if (primeiro) meses.push({ coluna, texto: mesCurto(primeiro.data) })
  })
  if (!meses.length || meses[0].coluna >= 3) {
    const inicio = semanas[0].find((d) => !d.fora)
    if (inicio) meses.unshift({ coluna: 0, texto: mesCurto(inicio.data) })
  }

  return (
    <section className="seccao">
      <h2 className="titulo-seccao">Consistência</h2>
      <div className="cartao">
        <div className="calor-scroll">
          <div
            className="calor"
            style={{ gridTemplateColumns: `14px repeat(${semanas.length}, minmax(10px, 1fr))` }}
          >
            {meses.map(({ coluna, texto }) => (
              <span key={coluna} className="calor-mes" style={{ gridColumn: coluna + 2, gridRow: 1 }}>
                {texto}
              </span>
            ))}
            {DIAS_SEMANA.map((letra, linha) => (
              <span key={linha} className="calor-semana" style={{ gridColumn: 1, gridRow: linha + 2 }}>
                {letra}
              </span>
            ))}
            {semanas.map((semana, coluna) =>
              semana.map((dia, linha) => {
                const info = porDia.get(dia.chave)
                const estilo = { gridColumn: coluna + 2, gridRow: linha + 2 }
                if (dia.fora) return <span key={dia.chave} className="calor-dia fora" style={estilo} />
                const nivel = nivelCalor(info?.volume ?? 0, volumeMaximo, Boolean(info))
                return (
                  <button
                    key={dia.chave}
                    className={`calor-dia nivel-${nivel}`}
                    style={estilo}
                    disabled={!info}
                    onClick={() => onEscolherDia({ chave: dia.chave, ...info })}
                    aria-label={
                      info
                        ? `${formatarDataCurta(dia.data)}: ${info.treinos.length} treino(s), ${abreviarNumero(info.volume)} kg`
                        : formatarDataCurta(dia.data)
                    }
                  />
                )
              })
            )}
          </div>
        </div>
        <div className="calor-legenda">
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className={`calor-dia nivel-${n}`} />
          ))}
          <span>Mais volume</span>
        </div>

        <div className="numeros consistencia">
          <Indicador valor={sequencias.treinosEstaSemana} rotulo="Treinos esta semana" />
          <Indicador
            valor={sequencias.atual}
            rotulo={sequencias.atual === 1 ? 'Semana seguida' : 'Semanas seguidas'}
          />
          <Indicador valor={sequencias.melhor} rotulo="Melhor sequência" />
        </div>
      </div>
    </section>
  )
}

function Indicador({ valor, rotulo }) {
  return (
    <div className="numero">
      <span className="numero-valor verde">{valor}</span>
      <span className="numero-rotulo">{rotulo}</span>
    </div>
  )
}

function TreinosDoDia({ dia, onAbrir, onFechar }) {
  const carga = useCarga()
  return (
    <Janela titulo={formatarDataExtenso(dia.treinos[0].data)} onFechar={onFechar} baixa>
        <ul className="lista">
          {dia.treinos.map((treino) => (
            <li key={treino.id}>
              <button className="opcao-exercicio" onClick={() => onAbrir(treino.id)}>
                <span className="opcao-texto">
                  {formatarHora(treino.data)}
                  <span className="opcao-musculos">
                    {formatarMinutos(treino.duracao_min)} · {abreviarNumero(calcularVolume(treino.series, (s) => carga(s, treino.data)))} kg
                  </span>
                </span>
                <ChevronRight size={20} className="seta" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
    </Janela>
  )
}

// ---------- c) Recordes ----------

function SeccaoRecordes({ treinos, exercicios, carga, onAbrirTreino, onAbrirExercicio }) {
  const recordes = useMemo(() => recordesGerais(treinos, carga), [treinos, carga])
  const nomes = useMemo(() => new Map(exercicios.map((e) => [e.id, e.nome])), [exercicios])
  const { medicoes } = usePesoCorporal()
  const { maiorPeso, maisReps, maiorVolume, maisLongo } = recordes
  // Nos exercícios de peso corporal, o maior peso mostra a decomposição: "84,5 kg" + "PC 74,5 + 10"
  const pesoCorporalMaior = Boolean(maiorPeso?.serie.exercicios?.peso_corporal)
  const decomposicao = pesoCorporalMaior
    ? decomposicaoCarga(maiorPeso.serie.peso_kg, pesoCorporalNaData(medicoes, maiorPeso.treino.data))
    : null

  const cartoes = []
  if (maiorPeso) {
    cartoes.push({
      id: 'peso',
      icone: Dumbbell,
      rotulo: 'Maior peso',
      valor:
        pesoCorporalMaior && !decomposicao
          ? textoCarga(maiorPeso.serie.peso_kg, true)
          : `${formatarPeso(maiorPeso.carga)} kg`,
      detalhe: [nomes.get(maiorPeso.serie.exercicio_id) ?? '—', decomposicao && `(${decomposicao})`, `${maiorPeso.serie.repeticoes} reps`]
        .filter(Boolean)
        .join(' · '),
      data: maiorPeso.treino.data,
      abrir: () => onAbrirExercicio(maiorPeso.serie.exercicio_id),
    })
  }
  if (maisReps) {
    cartoes.push({
      id: 'reps',
      icone: Trophy,
      rotulo: 'Mais repetições',
      valor: `${maisReps.serie.repeticoes} reps`,
      detalhe: `${nomes.get(maisReps.serie.exercicio_id) ?? '—'} · ${textoCarga(maisReps.serie.peso_kg, maisReps.serie.exercicios?.peso_corporal)}`,
      data: maisReps.treino.data,
      abrir: () => onAbrirExercicio(maisReps.serie.exercicio_id),
    })
  }
  if (maiorVolume?.valor > 0) {
    cartoes.push({
      id: 'volume',
      icone: Flame,
      rotulo: 'Maior volume num treino',
      valor: `${abreviarNumero(maiorVolume.valor)} kg`,
      detalhe: `${maiorVolume.treino.series.filter((s) => !s.aquecimento).length} séries`,
      data: maiorVolume.treino.data,
      abrir: () => onAbrirTreino(maiorVolume.treino.id),
    })
  }
  if (maisLongo?.valor > 0) {
    cartoes.push({
      id: 'duracao',
      icone: Timer,
      rotulo: 'Treino mais longo',
      valor: formatarMinutos(maisLongo.valor),
      detalhe: `${abreviarNumero(calcularVolume(maisLongo.treino.series, (s) => carga(s, maisLongo.treino.data)))} kg de volume`,
      data: maisLongo.treino.data,
      abrir: () => onAbrirTreino(maisLongo.treino.id),
    })
  }

  return (
    <section className="seccao">
      <h2 className="titulo-seccao com-icone">
        <Trophy size={20} aria-hidden="true" />
        Recordes
      </h2>
      {cartoes.length === 0 ? (
        <p className="subtitulo">Ainda não há recordes. Regista séries com peso para os ver aqui.</p>
      ) : (
        <div className="recordes">
          {cartoes.map((c) => (
            <button key={c.id} className="cartao cartao-recorde" onClick={c.abrir}>
              <span className="cartao-recorde-rotulo com-icone">
                <c.icone size={16} aria-hidden="true" />
                {c.rotulo}
              </span>
              <span className="cartao-recorde-valor">{c.valor}</span>
              <span className="cartao-recorde-detalhe">{c.detalhe}</span>
              <span className="cartao-recorde-data com-icone">
                {formatarDataCurta(c.data)}
                <ChevronRight size={14} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------- d) Músculos trabalhados ----------

function SeccaoMusculos({ treinos, exercicios, agora, carga, onCompletar }) {
  const [periodo, setPeriodo] = useState('3m')

  const musculosPorExercicio = useMemo(
    () => new Map(exercicios.map((e) => [e.id, e.exercicio_musculos])),
    [exercicios]
  )
  const { valores, total, semMusculos } = useMemo(
    () => volumePorMusculo(treinos, musculosPorExercicio, inicioPeriodo(periodo, agora), carga),
    [treinos, musculosPorExercicio, periodo, agora, carga]
  )

  const percentagem = (v) => (total > 0 ? (v / total) * 100 : 0)
  const lista = MUSCULOS.map((m) => ({ ...m, valor: valores.get(m.id) ?? 0 }))
    .filter((m) => m.valor > 0)
    .sort((a, b) => b.valor - a.valor)
  const maximo = lista[0]?.valor ?? 0

  const dados = useMemo(
    () => ({
      labels: MUSCULOS.map((m) => m.nome),
      datasets: [
        {
          data: MUSCULOS.map((m) => valores.get(m.id) ?? 0),
          borderColor: CORES.verde,
          backgroundColor: CORES.verdeSuave,
          borderWidth: 2,
          pointBackgroundColor: CORES.verde,
          pointRadius: 3,
          pointHitRadius: 14,
        },
      ],
    }),
    [valores]
  )

  const opcoes = useMemo(
    () => ({
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) =>
              `${abreviarNumero(item.raw)} kg · ${Math.round(total > 0 ? (item.raw / total) * 100 : 0)}%`,
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          ticks: { display: false },
          grid: { color: CORES.grelha },
          angleLines: { color: CORES.grelha },
          pointLabels: { color: CORES.textoSuave, font: { size: 11 } },
        },
      },
    }),
    [total]
  )

  return (
    <section className="seccao">
      <h2 className="titulo-seccao">Músculos trabalhados</h2>
      <Pilulas opcoes={PERIODOS_MUSCULOS} valor={periodo} onMudar={setPeriodo} rotulo="Período" />

      <div className="cartao">
        {total === 0 ? (
          <p className="subtitulo sem-margem">
            Não há volume em exercícios com músculos associados neste período.
          </p>
        ) : (
          <>
            <Grafico
              tipo="radar"
              dados={dados}
              opcoes={opcoes}
              altura={300}
              descricao="Gráfico radar do volume por músculo"
            />
            <ul className="lista-musculos">
              {lista.map((m) => (
                <li key={m.id}>
                  <span className="lista-musculos-nome">{m.nome}</span>
                  <span className="lista-musculos-barra">
                    <span style={{ width: `${(m.valor / maximo) * 100}%` }} />
                  </span>
                  <span className="lista-musculos-pct">{Math.round(percentagem(m.valor))}%</span>
                </li>
              ))}
            </ul>
            <p className="nota">O músculo principal conta com 100% do volume da série e os secundários com 50%.</p>
          </>
        )}

        {semMusculos.size > 0 && (
          <div className="aviso aviso-caixa">
            <TriangleAlert size={18} className="aviso-caixa-icone" aria-hidden="true" />
            <p>
              {semMusculos.size === 1
                ? '1 exercício sem músculos associados teve volume neste período e não entra nestas contas.'
                : `${semMusculos.size} exercícios sem músculos associados tiveram volume neste período e não entram nestas contas.`}
            </p>
            <button className="botao-link com-icone" onClick={onCompletar}>
              Completar no separador Exercícios
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
